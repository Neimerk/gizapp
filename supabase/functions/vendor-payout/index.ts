import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, optionsResponse } from "../_shared/cors.ts";
import { requireAsaasBase } from "../_shared/asaas.ts";

/**
 * vendor-payout
 * Automação de pagamentos para lojistas:
 * - Lista withdrawals pendentes e inicia transferência PIX via Asaas
 * - Pode ser chamada por cron ou admin
 *
 * POST { vendorId?, all?: boolean }
 * Requer x-internal-key (cron) ou role=admin (admin panel)
 */

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_KEY   = Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "";
const ASAAS_BASE_RAW = requireAsaasBase("vendor-payout");
const ASAAS_BASE     = ASAAS_BASE_RAW ?? "";
const ASAAS_KEY      = Deno.env.get("ASAAS_API_KEY") ?? "";

async function asaas(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": ASAAS_KEY,
      "User-Agent":   "BrasUX/2.0",
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
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405, req);
  if (!ASAAS_BASE_RAW) return new Response("Service Unavailable", { status: 503 });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Autenticação: x-internal-key (cron) ou admin JWT
  const internalKey = req.headers.get("x-internal-key");
  if (!internalKey) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401, req);

    const anonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Token inválido." }, 401, req);

    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return json({ error: "Acesso negado." }, 403, req);
  } else if (!INTERNAL_KEY || internalKey !== INTERNAL_KEY) {
    return json({ error: "Unauthorized." }, 401, req);
  }

  const body = await req.json().catch(() => ({}) as { vendorId?: string; all?: boolean });
  const { vendorId, all } = body as { vendorId?: string; all?: boolean };

  try {
    // Busca saques pendentes (tipo vendor)
    let withdrawalsQuery = admin
      .from("withdrawals")
      .select("id, owner_id, amount_gross, withdrawal_fee, amount_net, pix_key, pix_key_type, wallet_id")
      .eq("status", "pending")
      .eq("owner_type", "vendor")
      .order("created_at", { ascending: true });

    if (vendorId) {
      withdrawalsQuery = withdrawalsQuery.eq("owner_id", vendorId) as typeof withdrawalsQuery;
    }
    if (!all && !vendorId) {
      withdrawalsQuery = withdrawalsQuery.limit(50) as typeof withdrawalsQuery;
    }

    const { data: withdrawals, error: wErr } = await withdrawalsQuery;
    if (wErr) throw new Error(wErr.message);
    if (!withdrawals || withdrawals.length === 0) {
      return json({ ok: true, processed: 0, message: "Nenhum saque pendente." }, 200, req);
    }

    const results: Array<{ id: string; status: string; ref?: string; error?: string }> = [];

    for (const w of withdrawals) {
      try {
        // Marca como processing
        await admin.from("withdrawals").update({ status: "processing" }).eq("id", w.id);

        if (!ASAAS_KEY) {
          // Modo dev: simula pagamento
          await admin.from("withdrawals")
            .update({ status: "paid", gateway_reference: `DEV_${Date.now()}`, processed_at: new Date().toISOString() })
            .eq("id", w.id);
          results.push({ id: w.id, status: "paid", ref: `DEV_${Date.now()}` });
          continue;
        }

        // Cria transferência PIX no Asaas
        const transfer = await asaas("/transfers", "POST", {
          value:             Number(w.amount_net),
          pixAddressKey:     w.pix_key,
          pixAddressKeyType: (w.pix_key_type as string ?? "").toUpperCase(),
          description:       `Repasse BrasUX – saque ${w.id.slice(0, 8)}`,
          externalReference: w.id,
        });

        const status = transfer.status === "DONE" || transfer.status === "PENDING" ? "paid" : "failed";
        const ref    = transfer.id as string ?? "";

        await admin.from("withdrawals").update({
          status:             status,
          gateway_reference:  ref,
          processed_at:       new Date().toISOString(),
        }).eq("id", w.id);

        // Debita da wallet se transferência foi iniciada
        if (status === "paid") {
          const { data: wt } = await admin.from("wallets").select("id").eq("owner_id", w.owner_id).eq("wallet_type", "vendor").maybeSingle();
          if (wt?.id) {
            await admin.from("wallet_transactions").insert({
              wallet_id:   wt.id,
              type:        "withdrawal",
              direction:   "out",
              amount:      Number(w.amount_gross),
              status:      "completed",
              description: `Saque PIX processado – ${w.pix_key}`,
              metadata:    { withdrawal_id: w.id, transfer_id: ref },
            });
          }
        }

        await admin.rpc("log_financial_event", {
          p_actor_type:  "system",
          p_actor_id:    w.owner_id,
          p_action:      status === "paid" ? "withdrawal_processed" : "withdrawal_failed",
          p_entity_type: "withdrawals",
          p_entity_id:   w.id,
          p_amount:      Number(w.amount_net),
          p_description: `Saque ${status} – PIX ${w.pix_key}`,
          p_metadata:    { asaas_transfer_id: ref },
        }).catch(() => null);

        results.push({ id: w.id, status, ref });

      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        await admin.from("withdrawals")
          .update({ status: "failed", gateway_reference: null })
          .eq("id", w.id);
        results.push({ id: w.id, status: "failed", error: errMsg });
        console.error(`[vendor-payout] withdrawal=${w.id} failed:`, errMsg);
      }
    }

    const paid   = results.filter((r) => r.status === "paid").length;
    const failed = results.filter((r) => r.status === "failed").length;

    console.log(`[vendor-payout] processed=${results.length} paid=${paid} failed=${failed}`);
    return json({ ok: true, processed: results.length, paid, failed, results }, 200, req);

  } catch (e) {
    console.error("[vendor-payout]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500, req);
  }
});
