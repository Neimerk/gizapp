import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_TOKEN  = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
const RESEND_KEY     = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL     = Deno.env.get("EMAIL_FROM") ?? "BrasUX Shopping <noreply@brasux.com.br>";
const APP_URL        = Deno.env.get("APP_URL") ?? "https://brasux.com.br";
const INTERNAL_KEY   = Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_RETRIES = 5;

const CONFIRMED_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const DECLINED_EVENTS  = new Set(["PAYMENT_DECLINED", "PAYMENT_REFUSED", "PAYMENT_CHARGEBACK_REQUESTED"]);
const REFUNDED_EVENTS  = new Set(["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_DONE"]);

// ── Helpers ──────────────────────────────────────────────────

function brl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function shortId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_KEY || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  }).catch((e) => console.error("[webhook] sendEmail failed:", e));
}

function paymentConfirmedHtml(customerName: string, orderId: string, total: number, storeName: string): string {
  const oid = shortId(orderId);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f7f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#001640,#002776,#003d1a);padding:28px 40px;text-align:center;">
          <p style="color:#4ade80;font-size:11px;font-weight:900;letter-spacing:4px;text-transform:uppercase;margin:0 0 6px;">O Shopping Brasileiro</p>
          <h1 style="color:#fff;font-size:26px;font-weight:900;margin:0;">BrasUX Shopping</h1>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">PAGAMENTO CONFIRMADO</p>
          <h2 style="color:#0f172a;font-size:22px;font-weight:900;margin:0 0 4px;">Pagamento recebido! 💰</h2>
          <p style="color:#475569;font-size:14px;margin:0 0 28px;">Olá, <b>${customerName}</b>! Seu pagamento foi confirmado e o pedido já está sendo preparado.</p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;text-align:center;margin-bottom:24px;">
            <p style="color:#16a34a;font-size:13px;font-weight:700;margin:0 0 4px;">Pedido ${oid} · ${storeName}</p>
            <p style="color:#0f172a;font-size:28px;font-weight:900;margin:0;">${brl(total)}</p>
          </div>
          <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;border:1px solid #e2e8f0;text-align:center;">
            <p style="font-size:28px;margin:0;">✅ → 👨‍🍳 → 🛵 → 📦</p>
            <p style="color:#475569;font-size:13px;margin:8px 0 0;">Confirmado → Preparando → Saindo → Entregue</p>
          </div>
          <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
            <tr><td>
              <a href="${APP_URL}/pedidos"
                 style="display:inline-block;background:#16a34a;color:#fff;font-weight:900;font-size:14px;text-decoration:none;padding:14px 28px;border-radius:14px;">
                Acompanhar entrega →
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
          <p style="color:#94a3b8;font-size:12px;margin:0;">BrasUX Shopping · Não responda este email</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Handlers de negócio ───────────────────────────────────────

async function handleOrderConfirmed(
  admin: ReturnType<typeof createClient>,
  orderId: string,
  payment: AsaasPayment,
): Promise<void> {
  await admin.from("orders")
    .update({ payment_status: "CONFIRMED", status: 1 })
    .eq("id", orderId);

  const { data: paymentRow } = await admin
    .from("payments").select("id").eq("order_id", orderId).maybeSingle();

  if (paymentRow?.id) {
    // Idempotência na tabela legacy (gateway_event_id UNIQUE)
    await admin.from("payment_transactions").insert({
      payment_id:       paymentRow.id,
      event_type:       payment.event,
      gateway_event_id: `${payment.event}_${payment.id}`,
      amount:           payment.value,
      status:           "approved",
      metadata:         { raw: payment },
    }).then(() => null);

    // Executa split v2 via função interna
    if (INTERNAL_KEY) {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/execute-split`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
        body:    JSON.stringify({ orderId, paymentId: paymentRow.id }),
      });
      if (!res.ok) {
        throw new Error(`execute-split failed: ${await res.text()}`);
      }
    }
  }

  await admin.rpc("earn_points_on_payment", { p_order_id: orderId }).catch(() => null);

  // Notificações
  const { data: order } = await admin
    .from("orders")
    .select("customer_id, customer_name, total, stores(name, owner_id)")
    .eq("id", orderId)
    .maybeSingle();

  if (!order?.customer_id) return;

  const store = order.stores as { name: string; owner_id?: string } | null;

  if (store?.owner_id) {
    await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
      body:    JSON.stringify({
        userId: store.owner_id,
        title:  "🛒 Novo pedido pago!",
        body:   `Pedido ${shortId(orderId)} — ${brl(Number(order.total))}`,
        url:    "/minha-loja",
      }),
    }).catch(() => null);
  }

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
}

async function handleOrderDeclined(
  admin: ReturnType<typeof createClient>,
  orderId: string,
): Promise<void> {
  await admin.from("orders").update({ payment_status: "DECLINED" }).eq("id", orderId);
}

async function handleOrderRefunded(
  admin: ReturnType<typeof createClient>,
  orderId: string,
  payment: AsaasPayment,
): Promise<void> {
  await admin.from("orders")
    .update({ payment_status: "REFUNDED", status: 5 })
    .eq("id", orderId);

  const { data: paymentRow } = await admin
    .from("payments").select("id").eq("order_id", orderId).maybeSingle();

  if (!paymentRow?.id) return;

  const { data: refundRow } = await admin
    .from("refunds")
    .insert({ payment_id: paymentRow.id, order_id: orderId, amount: payment.value, status: "processing" })
    .select("id").single();

  if (refundRow?.id) {
    await admin.rpc("reverse_split_on_refund", { p_order_id: orderId, p_refund_id: refundRow.id });
    await admin.from("refunds").update({ status: "completed" }).eq("id", refundRow.id);
  }
}

async function handleSubscriptionPayment(
  admin: ReturnType<typeof createClient>,
  vendorId: string,
  payment: AsaasPayment,
): Promise<void> {
  const nextBilling = new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0];

  await admin.from("subscriptions")
    .update({ status: "active", next_billing_date: nextBilling })
    .eq("vendor_id", vendorId);

  await admin.rpc("log_financial_event", {
    p_actor_type:  "system",
    p_actor_id:    vendorId,
    p_action:      "subscription_renewed",
    p_entity_type: "subscriptions",
    p_entity_id:   null,
    p_amount:      payment.value,
    p_description: `Assinatura renovada — vendor=${vendorId}`,
    p_metadata:    { asaas_payment_id: payment.id, subscription_id: payment.subscription },
  }).catch(() => null);
}

async function handleSubscriptionOverdue(
  admin: ReturnType<typeof createClient>,
  vendorId: string,
): Promise<void> {
  await admin.from("subscriptions")
    .update({ status: "overdue" })
    .eq("vendor_id", vendorId);
}

// ── Tipos ─────────────────────────────────────────────────────

interface AsaasPayment {
  id:                string;
  event:             string;
  status:            string;
  value:             number;
  externalReference?: string;
  subscription?:     string;   // presente quando é pagamento de assinatura
}

// ── Handler principal ─────────────────────────────────────────

serve(async (req) => {
  if (!WEBHOOK_TOKEN) {
    console.error("[webhook] ASAAS_WEBHOOK_TOKEN não configurado");
    return new Response("Service Unavailable", { status: 503 });
  }
  if (req.headers.get("asaas-access-token") !== WEBHOOK_TOKEN) {
    console.warn("[webhook] token inválido ou ausente");
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let bodyText: string;
  let body: { event: string; payment: AsaasPayment };

  try {
    bodyText = await req.text();
    body     = JSON.parse(bodyText);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { event, payment } = body;
  if (!event || !payment?.id) return new Response("OK", { status: 200 });

  // Injecta event no objeto para facilitar handlers
  payment.event = event;

  const eventId = `${event}_${payment.id}`;

  // ── 1. Deduplicação via webhook_events ──────────────────────

  const { data: existing } = await admin
    .from("webhook_events")
    .select("id, status, retry_count")
    .eq("source", "asaas")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing?.status === "processed") {
    console.log(`[webhook] duplicate ignored: ${eventId}`);
    return new Response("OK", { status: 200 });
  }
  if (existing?.status === "dead_letter") {
    console.warn(`[webhook] dead_letter hit again: ${eventId}`);
    return new Response("OK", { status: 200 });
  }

  let eventRowId: string;

  if (!existing) {
    const { data: row, error: insertErr } = await admin
      .from("webhook_events")
      .insert({ source: "asaas", event_id: eventId, event_type: event, payload: body, status: "processing" })
      .select("id")
      .single();

    if (insertErr || !row) {
      // Corrida: outro request já inseriu — ignorar
      console.warn(`[webhook] insert race for ${eventId}:`, insertErr?.message);
      return new Response("OK", { status: 200 });
    }
    eventRowId = row.id;
  } else {
    eventRowId = existing.id;
    await admin.from("webhook_events")
      .update({ status: "processing", retry_count: (existing.retry_count ?? 0) + 1 })
      .eq("id", eventRowId);
  }

  // ── 2. Processa evento ───────────────────────────────────────

  try {
    const orderId  = payment.externalReference;
    const isSubPay = !!payment.subscription;   // pagamento de assinatura tem este campo

    if (CONFIRMED_EVENTS.has(event)) {
      if (isSubPay && orderId) {
        await handleSubscriptionPayment(admin, orderId, payment);
      } else if (orderId) {
        await handleOrderConfirmed(admin, orderId, payment);
      }

    } else if (DECLINED_EVENTS.has(event)) {
      if (orderId && !isSubPay) await handleOrderDeclined(admin, orderId);

    } else if (REFUNDED_EVENTS.has(event)) {
      if (orderId && !isSubPay) await handleOrderRefunded(admin, orderId, payment);

    } else if (event === "PAYMENT_OVERDUE" && isSubPay && orderId) {
      await handleSubscriptionOverdue(admin, orderId);
    }

    // ── 3. Marca como processado ─────────────────────────────
    await admin.from("webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", eventRowId);

    console.log(`[webhook] OK ${event} → ${payment.externalReference ?? payment.id}`);
    return new Response("OK", { status: 200 });

  } catch (err: unknown) {
    const errMsg     = err instanceof Error ? err.message : String(err);
    const retryCount = existing?.retry_count ?? 0;
    const nextStatus = retryCount >= MAX_RETRIES - 1 ? "dead_letter" : "failed";

    console.error(`[webhook] error (retry ${retryCount}) ${eventId}:`, errMsg);

    await admin.from("webhook_events")
      .update({ status: nextStatus, last_error: errMsg })
      .eq("id", eventRowId);

    if (nextStatus === "dead_letter") {
      console.error(`[webhook] DEAD_LETTER: ${eventId} — manual intervention required`);
    }

    // Retorna 500 para que o Asaas tente novamente conforme sua política de retry
    return new Response("Error", { status: 500 });
  }
});
