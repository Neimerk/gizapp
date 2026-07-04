import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAsaasBase } from "../_shared/asaas.ts";

const ASAAS_BASE_RAW = requireAsaasBase("process-withdrawal");
const ASAAS_BASE     = ASAAS_BASE_RAW ?? "";
const ASAAS_KEY     = Deno.env.get("ASAAS_API_KEY") ?? "";
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY")!;

/**
 * process-withdrawal
 * Admin-only: aprova e processa um saque pendente via Asaas PIX transfer.
 * Aceita duas formas de autenticação:
 *   1. x-internal-key — chamado pelo cron-runner ou funções internas
 *   2. JWT de admin    — chamado pelo painel admin via supabase.functions.invoke
 */
async function asaas(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": ASAAS_KEY,
      "User-Agent": "BrasUX-Shopping/1.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? data?.message ?? "Erro Asaas";
    throw new Error(msg);
  }
  return data;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!ASAAS_BASE_RAW) return new Response("Service Unavailable", { status: 503 });

  const internalKey = Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "";
  const reqKey      = req.headers.get("x-internal-key") ?? "";
  const authHeader  = req.headers.get("Authorization") ?? "";

  const isInternalCall = internalKey && reqKey === internalKey;

  if (!isInternalCall) {
    // Alternativa: JWT de admin via supabase.functions.invoke
    if (!authHeader.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response("Unauthorized", { status: 401 });
    }
    const adminCheck = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: profile } = await adminCheck
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json() as { withdrawalId?: string; processAll?: boolean };

    let withdrawalIds: string[] = [];

    if (body.withdrawalId) {
      withdrawalIds = [body.withdrawalId];
    } else if (body.processAll) {
      const { data } = await admin
        .from("withdrawals")
        .select("id")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(50);
      withdrawalIds = (data ?? []).map((r) => r.id as string);
    }

    if (!withdrawalIds.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; status: "ok" | "failed"; error?: string }> = [];

    for (const wdId of withdrawalIds) {
      try {
        const { data: wd } = await admin
          .from("withdrawals")
          .select("*")
          .eq("id", wdId)
          .single();

        if (!wd || wd.status !== "pending") {
          results.push({ id: wdId, status: "failed", error: "Saque não encontrado ou já processado" });
          continue;
        }

        // Marca como processing
        await admin.from("withdrawals").update({ status: "processing" }).eq("id", wdId);

        // Verifica se Asaas está configurado
        if (!ASAAS_KEY) {
          // Simulação para ambiente de dev: marca como paid
          await admin.from("withdrawals").update({
            status: "paid",
            processed_at: new Date().toISOString(),
            gateway_reference: `SIM_${Date.now()}`,
          }).eq("id", wdId);
          results.push({ id: wdId, status: "ok" });
          continue;
        }

        // Busca conta Asaas do dono (precisa ter asaas_account_id)
        // Por ora, usa transferência via chave Pix
        const transfer = await asaas("/transfers", "POST", {
          value:             Number(wd.amount_net),
          pixAddressKey:     wd.pix_key,
          pixAddressKeyType: (wd.pix_key_type as string ?? "cpf").toUpperCase(),
          description:       `Saque BrasUX — ${wdId.slice(0, 8).toUpperCase()}`,
        });

        const gatewayRef = transfer.id ?? transfer.transferId ?? `ASAAS_${Date.now()}`;

        await admin.from("withdrawals").update({
          status:            "paid",
          gateway_reference: gatewayRef,
          processed_at:      new Date().toISOString(),
        }).eq("id", wdId);

        await admin.rpc("log_financial_event", {
          p_actor_type:  "system",
          p_actor_id:    wd.owner_id ?? null,
          p_action:      "withdrawal_paid",
          p_entity_type: "withdrawals",
          p_entity_id:   wdId,
          p_amount:      Number(wd.amount_net),
          p_description: `Saque processado — ${wdId.slice(0, 8).toUpperCase()}`,
          p_metadata:    { gateway_reference: gatewayRef, pix_key: wd.pix_key },
        }).catch(() => null);

        console.log(`[process-withdrawal] OK wdId=${wdId} asaasId=${transfer.id}`);
        results.push({ id: wdId, status: "ok" });
      } catch (err) {
        console.error(`[process-withdrawal] FAILED wdId=${wdId}:`, err);
        await admin.from("withdrawals").update({
          status: "failed",
          notes:  err instanceof Error ? err.message : "Erro desconhecido",
        }).eq("id", wdId);
        results.push({ id: wdId, status: "failed", error: err instanceof Error ? err.message : "Erro" });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[process-withdrawal]", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
