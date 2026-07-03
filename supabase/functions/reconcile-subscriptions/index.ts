import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAsaasBase } from "../_shared/asaas.ts";

/**
 * reconcile-subscriptions
 * Recupera assinaturas presas em status='pending_payment' após dead-letter.
 *
 * Cenário: webhook PAYMENT_CONFIRMED da assinatura falhou 5x e foi para
 * dead_letter. O vendor pagou o PIX mas a assinatura nunca ativou.
 * Sem este job, suporte manual é necessário para cada caso.
 *
 * Lógica por assinatura pendente (>24h):
 *   - Consulta Asaas pelo asaas_subscription_id para ver últimos pagamentos
 *   - Se pagamento confirmado (CONFIRMED/RECEIVED): ativa assinatura + cria invoice
 *   - Se não encontrado ou ainda pendente: loga e ignora
 *
 * Chamado pelo cron-runner a cada 6h via x-internal-key.
 */

const INTERNAL_KEY   = Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_KEY      = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_BASE_RAW = requireAsaasBase("reconcile-subscriptions");
const ASAAS_BASE     = ASAAS_BASE_RAW ?? "";

const PAID_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

interface AsaasPayment {
  id:     string;
  status: string;
  value:  number;
}

async function getLatestSubscriptionPayment(subId: string): Promise<AsaasPayment | null> {
  if (!ASAAS_KEY || !ASAAS_BASE) return null;
  try {
    const res = await fetch(
      `${ASAAS_BASE}/payments?subscription=${encodeURIComponent(subId)}&limit=5&order=desc`,
      { headers: { "access_token": ASAAS_KEY, "User-Agent": "BrasUX/2.0" } },
    );
    if (!res.ok) return null;
    const json = await res.json() as { data?: AsaasPayment[] };
    const payments = json.data ?? [];
    // Retorna o primeiro pagamento confirmado, se houver
    return payments.find((p) => PAID_STATUSES.has(p.status)) ?? null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const key = req.headers.get("x-internal-key") ?? "";
  if (!INTERNAL_KEY || key !== INTERNAL_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Assinaturas em pending_payment há mais de 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: subs, error: qErr } = await admin
      .from("subscriptions")
      .select("id, vendor_id, plan, monthly_price, asaas_subscription_id")
      .eq("status", "pending_payment")
      .lt("updated_at", cutoff)
      .not("asaas_subscription_id", "is", null)
      .limit(20);

    if (qErr) throw new Error(qErr.message);
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, reconciled: 0 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const results: Array<{ vendorId: string; action: string; reason?: string }> = [];

    for (const sub of subs) {
      const vendorId = sub.vendor_id as string;
      const asaasSubId = sub.asaas_subscription_id as string;

      const payment = await getLatestSubscriptionPayment(asaasSubId);

      if (!payment) {
        console.log(`[reconcile-subscriptions] vendor=${vendorId} sub=${asaasSubId} sem pagamento confirmado`);
        results.push({ vendorId, action: "skipped", reason: "no_paid_payment" });
        continue;
      }

      // Ativa assinatura (mesma lógica do subscriptions-webhook)
      const nextBilling = new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0];

      const { error: updateErr } = await admin.from("subscriptions").update({
        status:             "active",
        next_billing_date:  nextBilling,
        last_payment_date:  new Date().toISOString().split("T")[0],
        last_payment_value: payment.value,
        delinquent_since:   null,
      }).eq("vendor_id", vendorId);

      if (updateErr) {
        console.error(`[reconcile-subscriptions] vendor=${vendorId} update failed:`, updateErr.message);
        results.push({ vendorId, action: "failed", reason: updateErr.message });
        continue;
      }

      // Cria invoice (idempotente via asaas_payment_id)
      await admin.rpc("create_subscription_invoice", {
        p_vendor_id:        vendorId,
        p_plan:             sub.plan,
        p_amount:           payment.value,
        p_asaas_payment_id: payment.id,
        p_asaas_sub_id:     asaasSubId,
        p_due_date:         null,
        p_description:      `Renovação reconciliada plano ${sub.plan as string}`,
        p_gateway_response: payment as unknown as Record<string, unknown>,
        p_idempotency_key:  `reconcile_sub_${payment.id}`,
      }).catch((e: unknown) => console.warn("[reconcile-subscriptions] invoice RPC:", e));

      await admin.rpc("log_financial_event", {
        p_actor_type:  "system",
        p_actor_id:    vendorId,
        p_action:      "subscription_reconciled",
        p_entity_type: "subscriptions",
        p_entity_id:   sub.id,
        p_amount:      payment.value,
        p_description: `Assinatura reconciliada — plano ${sub.plan as string}`,
        p_metadata:    { asaas_sub_id: asaasSubId, asaas_payment_id: payment.id },
      }).catch(() => null);

      console.log(`[reconcile-subscriptions] vendor=${vendorId} sub=${asaasSubId} → active`);
      results.push({ vendorId, action: "activated" });
    }

    const reconciled = results.filter((r) => r.action === "activated").length;
    console.log(`[reconcile-subscriptions] checked=${subs.length} activated=${reconciled}`);

    return new Response(JSON.stringify({ ok: true, reconciled, results }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reconcile-subscriptions]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
