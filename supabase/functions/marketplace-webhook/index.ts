import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * marketplace-webhook
 * Webhook dedicado para pagamentos do marketplace (pedidos de clientes).
 * URL a configurar no painel Asaas: .../functions/v1/marketplace-webhook
 *
 * Eventos tratados:
 *   PAYMENT_CONFIRMED / PAYMENT_RECEIVED → confirma pedido + executa split
 *   PAYMENT_DECLINED / PAYMENT_REFUSED / PAYMENT_CHARGEBACK_REQUESTED → marca declinado
 *   PAYMENT_REFUNDED / PAYMENT_CHARGEBACK_DONE → estorna + reverte split
 *   PAYMENT_DELETED → cancela pedido
 *
 * Ignorados (encaminhar para subscriptions-webhook via painel Asaas):
 *   SUBSCRIPTION_* → não tratados aqui
 */

const WEBHOOK_TOKEN  = Deno.env.get("ASAAS_WEBHOOK_TOKEN")   ?? "";
const RESEND_KEY     = Deno.env.get("RESEND_API_KEY")         ?? "";
const FROM_EMAIL     = Deno.env.get("EMAIL_FROM")             ?? "BrasUX Shopping <noreply@brasux.com.br>";
const APP_URL        = Deno.env.get("APP_URL")                ?? "https://brasux.com.br";
const INTERNAL_KEY   = Deno.env.get("INTERNAL_FUNCTION_KEY")  ?? "";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_RETRIES = 5;

const CONFIRMED_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const DECLINED_EVENTS  = new Set(["PAYMENT_DECLINED", "PAYMENT_REFUSED", "PAYMENT_CHARGEBACK_REQUESTED"]);
const REFUNDED_EVENTS  = new Set(["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_DONE"]);

// ── Helpers ───────────────────────────────────────────────────

function brl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function shortId(id: string): string { return `#${id.slice(0, 8).toUpperCase()}`; }

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_KEY || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  }).catch((e) => console.error("[marketplace-webhook] sendEmail failed:", e));
}

function paymentConfirmedHtml(name: string, orderId: string, total: number, store: string): string {
  const oid = shortId(orderId);
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f7f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#001640,#002776,#003d1a);padding:28px 40px;text-align:center;">
<h1 style="color:#fff;font-size:26px;font-weight:900;margin:0;">BrasUX Shopping</h1>
</td></tr>
<tr><td style="padding:36px 40px;">
<h2 style="color:#0f172a;font-size:22px;font-weight:900;margin:0 0 8px;">Pagamento confirmado! 💰</h2>
<p style="color:#475569;font-size:14px;margin:0 0 24px;">Olá, <b>${name}</b>! Seu pedido está sendo preparado.</p>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;text-align:center;margin-bottom:24px;">
<p style="color:#16a34a;font-size:13px;font-weight:700;margin:0 0 4px;">Pedido ${oid} · ${store}</p>
<p style="color:#0f172a;font-size:28px;font-weight:900;margin:0;">${brl(total)}</p>
</div>
<a href="${APP_URL}/pedidos" style="display:inline-block;background:#16a34a;color:#fff;font-weight:900;font-size:14px;text-decoration:none;padding:14px 28px;border-radius:14px;">
Acompanhar entrega →</a>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
<p style="color:#94a3b8;font-size:12px;margin:0;">BrasUX Shopping · Não responda este email</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

// ── Business handlers ─────────────────────────────────────────

type AdminClient = ReturnType<typeof createClient>;

async function handleOrderConfirmed(
  admin: AdminClient, orderId: string, payment: AsaasPayment
): Promise<void> {
  // Atualiza pedido
  await admin.from("orders")
    .update({ payment_status: "CONFIRMED", status: 1 })
    .eq("id", orderId);

  // Busca ou cria payment record
  let { data: paymentRow } = await admin
    .from("payments")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (!paymentRow?.id) {
    // Cria registro retroativamente (pedidos antigos sem registro em payments)
    const { data: order } = await admin
      .from("orders").select("total").eq("id", orderId).single();
    const { data: newPm } = await admin.from("payments").insert({
      order_id:    orderId,
      gateway:     "asaas",
      method:      "pix",
      amount:      Number(order?.total ?? 0),
      external_id: payment.id,
      status:      "approved",
    }).select("id").single();
    paymentRow = newPm;
  } else {
    // Marca existente como approved
    await admin.from("payments")
      .update({ status: "approved", external_id: payment.id })
      .eq("id", paymentRow.id);
  }

  if (paymentRow?.id) {
    // Idempotência na tabela de eventos
    await admin.from("payment_transactions").insert({
      payment_id:       paymentRow.id,
      event_type:       payment.event,
      gateway_event_id: `${payment.event}_${payment.id}`,
      amount:           payment.value,
      status:           "approved",
      metadata:         { raw: payment },
    }).catch(() => null); // UNIQUE gateway_event_id — ignora duplicata

    // Executa split via execute-split
    if (INTERNAL_KEY) {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/execute-split`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
        body:    JSON.stringify({ orderId, paymentId: paymentRow.id }),
      });
      if (!res.ok) throw new Error(`execute-split failed: ${await res.text()}`);
    }
  }

  // Pontos de fidelidade
  await admin.rpc("earn_points_on_payment", { p_order_id: orderId }).catch(() => null);

  // Notificações
  const { data: order } = await admin
    .from("orders")
    .select("customer_id, customer_name, total, stores(name, owner_id)")
    .eq("id", orderId)
    .maybeSingle();

  if (!order?.customer_id) return;

  const store = order.stores as { name: string; owner_id?: string } | null;

  // Push para o lojista
  if (store?.owner_id) {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
      body:    JSON.stringify({
        userId: store.owner_id,
        title:  "🛒 Novo pedido pago!",
        body:   `Pedido ${shortId(orderId)} — ${brl(Number(order.total))}`,
        url:    "/lojista",
      }),
    }).catch(() => null);
  }

  // E-mail para o comprador
  const { data: { user: buyer } } = await admin.auth.admin.getUserById(order.customer_id as string);
  if (buyer?.email) {
    await sendEmail(
      buyer.email,
      `💰 Pagamento confirmado — Pedido ${shortId(orderId)}`,
      paymentConfirmedHtml(
        order.customer_name as string,
        orderId,
        Number(order.total),
        store?.name ?? "Loja",
      ),
    );
  }

  // Log financeiro
  await admin.rpc("log_financial_event", {
    p_actor_type:  "system",
    p_actor_id:    order.customer_id,
    p_action:      "order_payment_confirmed",
    p_entity_type: "orders",
    p_entity_id:   orderId,
    p_amount:      payment.value,
    p_description: `Pagamento confirmado — Pedido ${shortId(orderId)}`,
    p_metadata:    { asaas_payment_id: payment.id, event: payment.event },
  }).catch(() => null);
}

async function handleOrderDeclined(admin: AdminClient, orderId: string): Promise<void> {
  await admin.from("orders").update({ payment_status: "DECLINED" }).eq("id", orderId);
  await admin.from("payments").update({ status: "declined" }).eq("order_id", orderId);
}

async function handleOrderRefunded(
  admin: AdminClient, orderId: string, payment: AsaasPayment
): Promise<void> {
  await admin.from("orders")
    .update({ payment_status: "REFUNDED", status: 5 })
    .eq("id", orderId);

  const { data: pm } = await admin
    .from("payments").select("id").eq("order_id", orderId).maybeSingle();

  if (!pm?.id) return;

  await admin.from("payments").update({ status: "refunded" }).eq("id", pm.id);

  const { data: refundRow } = await admin.from("refunds").insert({
    payment_id: pm.id,
    order_id:   orderId,
    reason:     "Estorno processado pelo Asaas",
    refund_type: "full",
    amount:      payment.value,
    absorbed_by: "brasux",
    status:      "processing",
    gateway_refund_id: `ASAAS_${payment.id}`,
  }).select("id").single();

  if (refundRow?.id) {
    await admin.rpc("reverse_split_on_refund", { p_order_id: orderId, p_refund_id: refundRow.id });
    await admin.from("refunds").update({ status: "completed" }).eq("id", refundRow.id);
  }

  await admin.rpc("log_financial_event", {
    p_actor_type:  "system",
    p_actor_id:    null,
    p_action:      "order_refunded",
    p_entity_type: "orders",
    p_entity_id:   orderId,
    p_amount:      payment.value,
    p_description: `Estorno via webhook — Pedido ${shortId(orderId)}`,
    p_metadata:    { asaas_payment_id: payment.id, event: payment.event },
  }).catch(() => null);
}

async function handleOrderDeleted(admin: AdminClient, orderId: string): Promise<void> {
  await admin.from("orders").update({ payment_status: "CANCELLED", status: 5 }).eq("id", orderId);
  await admin.from("payments").update({ status: "cancelled" }).eq("order_id", orderId);
}

// ── Types ─────────────────────────────────────────────────────

interface AsaasPayment {
  id:                string;
  event:             string;
  status:            string;
  value:             number;
  externalReference?: string;
  subscription?:     string;
}

// ── Main handler ──────────────────────────────────────────────

serve(async (req) => {
  if (!WEBHOOK_TOKEN) {
    console.error("[marketplace-webhook] ASAAS_WEBHOOK_TOKEN não configurado");
    return new Response("Service Unavailable", { status: 503 });
  }
  if (req.headers.get("asaas-access-token") !== WEBHOOK_TOKEN) {
    console.warn("[marketplace-webhook] token inválido");
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: { event: string; payment: AsaasPayment };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { event, payment } = body;
  if (!event || !payment?.id) return new Response("OK", { status: 200 });

  // Ignora eventos de assinatura (destinados ao subscriptions-webhook)
  if (event.startsWith("SUBSCRIPTION_") || payment.subscription) {
    console.log(`[marketplace-webhook] skipped subscription event: ${event}`);
    return new Response("OK", { status: 200 });
  }

  payment.event = event;
  const orderId = payment.externalReference;
  if (!orderId) return new Response("OK", { status: 200 });

  const eventId = `marketplace_${event}_${payment.id}`;

  // ── Deduplicação ──────────────────────────────────────────
  const { data: existing } = await admin
    .from("webhook_events")
    .select("id, status, retry_count")
    .eq("source", "asaas_marketplace")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing?.status === "processed") {
    console.log(`[marketplace-webhook] duplicate ignored: ${eventId}`);
    return new Response("OK", { status: 200 });
  }
  if (existing?.status === "dead_letter") {
    return new Response("OK", { status: 200 });
  }

  let eventRowId: string;
  if (!existing) {
    const { data: row, error: insertErr } = await admin.from("webhook_events").insert({
      source: "asaas_marketplace", event_id: eventId,
      event_type: event, payload: body, status: "processing",
    }).select("id").single();
    if (insertErr || !row) return new Response("OK", { status: 200 });
    eventRowId = row.id;
  } else {
    eventRowId = existing.id;
    await admin.from("webhook_events")
      .update({ status: "processing", retry_count: (existing.retry_count ?? 0) + 1 })
      .eq("id", eventRowId);
  }

  // ── Processa evento ───────────────────────────────────────
  try {
    if (CONFIRMED_EVENTS.has(event)) {
      await handleOrderConfirmed(admin, orderId, payment);
    } else if (DECLINED_EVENTS.has(event)) {
      await handleOrderDeclined(admin, orderId);
    } else if (REFUNDED_EVENTS.has(event)) {
      await handleOrderRefunded(admin, orderId, payment);
    } else if (event === "PAYMENT_DELETED") {
      await handleOrderDeleted(admin, orderId);
    }

    await admin.from("webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", eventRowId);

    console.log(`[marketplace-webhook] OK ${event} → ${orderId}`);
    return new Response("OK", { status: 200 });

  } catch (err) {
    const errMsg     = err instanceof Error ? err.message : String(err);
    const retryCount = existing?.retry_count ?? 0;
    const nextStatus = retryCount >= MAX_RETRIES - 1 ? "dead_letter" : "failed";

    console.error(`[marketplace-webhook] error (retry ${retryCount}) ${eventId}:`, errMsg);

    await admin.from("webhook_events")
      .update({ status: nextStatus, last_error: errMsg })
      .eq("id", eventRowId);

    return new Response("Error", { status: 500 });
  }
});
