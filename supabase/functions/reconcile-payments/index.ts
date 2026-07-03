import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, optionsResponse } from "../_shared/cors.ts";
import { requireAsaasBase } from "../_shared/asaas.ts";

/**
 * reconcile-payments
 * Chamada pelo lojista para reparar pedidos com pagamento confirmado no Asaas
 * mas que ainda estão com payment_status=pending no banco (webhook perdido).
 *
 * POST — verify_jwt=true (usa JWT do lojista para filtrar apenas os próprios pedidos)
 * Retorna: { ok, reconciled, checked }
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_KEY = Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "";
const ASAAS_BASE_RAW = requireAsaasBase("reconcile-payments");
const ASAAS_BASE     = ASAAS_BASE_RAW ?? "";
const ASAAS_KEY      = Deno.env.get("ASAAS_API_KEY") ?? "";

// Status Asaas que equivalem a "pago"
const PAID_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

async function asaasGet(chargeId: string): Promise<{ status: string; value: number; id: string } | null> {
  if (!ASAAS_KEY) return null;
  try {
    const res = await fetch(`${ASAAS_BASE}/payments/${chargeId}`, {
      headers: { "access_token": ASAAS_KEY, "User-Agent": "BrasUX/2.0" },
    });
    if (!res.ok) return null;
    return await res.json() as { status: string; value: number; id: string };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405, req);
  if (!ASAAS_BASE_RAW) return new Response("Service Unavailable", { status: 503 });

  // Resolve usuário pelo JWT
  const anonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Não autenticado." }, 401, req);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Busca pedidos do vendedor com pagamento pendente e charge Asaas conhecida
    const { data: orders, error: oErr } = await admin
      .from("orders")
      .select("id, total, payment_status, status, asaas_charge_id")
      .eq("vendor_id", user.id)
      .in("payment_status", ["pending", "PENDING"])
      .not("asaas_charge_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (oErr) throw new Error(oErr.message);
    if (!orders || orders.length === 0) {
      return json({ ok: true, reconciled: 0, checked: 0 }, 200, req);
    }

    let reconciled = 0;

    for (const order of orders) {
      const chargeId = order.asaas_charge_id as string;
      const payment  = await asaasGet(chargeId);

      if (!payment || !PAID_STATUSES.has(payment.status)) continue;

      // Atualiza pedido: confirma pagamento e avança para status 1 (aceito) se ainda pendente
      await admin.from("orders").update({
        payment_status: "CONFIRMED",
        ...(Number(order.status) === 0 ? { status: 1 } : {}),
        updated_at: new Date().toISOString(),
      }).eq("id", order.id);

      // Garante registro em payments (idempotente via external_id)
      let { data: paymentRow } = await admin
        .from("payments")
        .select("id")
        .eq("order_id", order.id)
        .maybeSingle();

      if (!paymentRow?.id) {
        const { data: inserted } = await admin
          .from("payments")
          .insert({
            order_id:    order.id,
            gateway:     "asaas",
            method:      "pix",
            amount:      Number(order.total),
            external_id: chargeId,
            status:      "approved",
          })
          .select("id")
          .single();
        paymentRow = inserted;
      } else {
        await admin
          .from("payments")
          .update({ status: "approved", external_id: chargeId })
          .eq("id", paymentRow.id);
      }

      // Executa split (cria ledger + credita wallets)
      if (paymentRow?.id) {
        if (!INTERNAL_KEY) {
          console.error(`[reconcile-payments] INTERNAL_FUNCTION_KEY não configurado — split não executado para order=${order.id}. Configure em Supabase > Edge Functions > Secrets.`);
        } else {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/execute-split`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
            body:    JSON.stringify({ orderId: order.id, paymentId: paymentRow.id }),
          });
          if (!res.ok) {
            console.warn(`[reconcile-payments] execute-split failed for order=${order.id}:`, await res.text());
          }
        }
      }

      // Pontos de fidelidade (idempotente no lado do RPC)
      await admin.rpc("earn_points_on_payment", { p_order_id: order.id }).catch(() => null);

      // Log financeiro
      await admin.rpc("log_financial_event", {
        p_actor_type:  "system",
        p_actor_id:    user.id,
        p_action:      "order_payment_reconciled",
        p_entity_type: "orders",
        p_entity_id:   order.id,
        p_amount:      Number(order.total),
        p_description: `Pagamento reconciliado — pedido ${order.id.slice(0, 8).toUpperCase()}`,
        p_metadata:    { asaas_charge_id: chargeId, asaas_status: payment.status },
      }).catch(() => null);

      reconciled++;
      console.log(`[reconcile-payments] reconciled order=${order.id} asaas_status=${payment.status}`);
    }

    return json({ ok: true, reconciled, checked: orders.length }, 200, req);

  } catch (e) {
    console.error("[reconcile-payments]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500, req);
  }
});
