import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_BASE = Deno.env.get("ASAAS_API_URL") ?? "https://sandbox.asaas.com/api/v3";
const ASAAS_KEY  = Deno.env.get("ASAAS_API_KEY") ?? "";

/**
 * process-withdrawal
 * Admin-only: aprova e processa um saque pendente via Asaas PIX transfer.
 * Chamado pelo admin dashboard ou por cron job diário.
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

  const internalKey = Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "";
  const reqKey      = req.headers.get("x-internal-key") ?? "";
  if (!internalKey || reqKey !== internalKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

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
          // FALHA FECHADA: sem chave do gateway NÃO marcamos como "paid"
          // (isso quitaria o saque sem transferir dinheiro de verdade).
          // Simulação só é permitida com flag explícita de ambiente de dev.
          const allowSim = (Deno.env.get("ALLOW_SIMULATED_WITHDRAWALS") ?? "") === "true";
          if (allowSim) {
            await admin.from("withdrawals").update({
              status: "paid",
              processed_at: new Date().toISOString(),
              gateway_reference: `SIM_${Date.now()}`,
            }).eq("id", wdId);
            results.push({ id: wdId, status: "ok" });
          } else {
            await admin.from("withdrawals").update({
              status: "failed",
              notes:  "Gateway de pagamento não configurado (ASAAS_API_KEY ausente).",
            }).eq("id", wdId);
            results.push({ id: wdId, status: "failed", error: "Gateway não configurado" });
          }
          continue;
        }

        // Busca conta Asaas do dono (precisa ter asaas_account_id)
        // Por ora, usa transferência via chave Pix
        const transfer = await asaas("/transfers", "POST", {
          value:        Number(wd.amount_net),
          pixAddressKey: wd.pix_key,
          description:  `Saque BrasUX — ${wdId.slice(0, 8).toUpperCase()}`,
        });

        await admin.from("withdrawals").update({
          status:            "paid",
          gateway_reference: transfer.id ?? transfer.transferId ?? `ASAAS_${Date.now()}`,
          processed_at:      new Date().toISOString(),
        }).eq("id", wdId);

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
