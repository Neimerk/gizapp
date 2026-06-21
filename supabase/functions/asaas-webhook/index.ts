import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL    = Deno.env.get("EMAIL_FROM") ?? "BrasUX Shopping <noreply@brasux.com.br>";
const APP_URL       = Deno.env.get("APP_URL") ?? "https://brasux.com.br";

const CONFIRMED_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const DECLINED_EVENTS  = new Set(["PAYMENT_DECLINED", "PAYMENT_REFUSED", "PAYMENT_CHARGEBACK_REQUESTED"]);
const REFUNDED_EVENTS  = new Set(["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_DONE"]);

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
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
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

serve(async (req) => {
  const token = req.headers.get("asaas-access-token");

  // Rejeitar se token não estiver configurado — nunca aceitar requests sem verificação
  if (!WEBHOOK_TOKEN) {
    console.error("[webhook] ASAAS_WEBHOOK_TOKEN não configurado — rejeitando todas as requisições");
    return new Response("Service Unavailable", { status: 503 });
  }
  if (!token || token !== WEBHOOK_TOKEN) {
    console.warn("[webhook] token inválido ou ausente");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();
    const { event, payment } = body as {
      event: string;
      payment: { id: string; status: string; value: number; externalReference?: string };
    };

    const orderId = payment?.externalReference;
    if (!event || !orderId) return new Response("OK", { status: 200 });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (CONFIRMED_EVENTS.has(event)) {
      await admin.from("orders").update({ payment_status: "CONFIRMED", status: 1 }).eq("id", orderId);
      await admin.rpc("earn_points_on_payment", { p_order_id: orderId });

      // Email + push ao comprador e push ao lojista
      const { data: order } = await admin
        .from("orders")
        .select("customer_id, customer_name, total, stores(name, owner_id)")
        .eq("id", orderId)
        .single();

      if (order?.customer_id) {
        const { data: { user: buyer } } = await admin.auth.admin.getUserById(order.customer_id as string);
        const buyerEmail = buyer?.email ?? "";
        const store = order.stores as { name: string; owner_id?: string } | null;

        // Push ao lojista: novo pedido pago
        if (store?.owner_id) {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
            method: "POST",
            headers: {
              "Content-Type":  "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              userId: store.owner_id,
              title:  "🛒 Novo pedido pago!",
              body:   `Pedido #${(orderId as string).slice(0, 8).toUpperCase()} — R$ ${Number(order.total).toFixed(2).replace(".", ",")}`,
              url:    "/minha-loja",
            }),
          }).catch(() => null);
        }

        if (buyerEmail) {
          await sendEmail(
            buyerEmail,
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

    } else if (DECLINED_EVENTS.has(event)) {
      await admin.from("orders").update({ payment_status: "DECLINED" }).eq("id", orderId);

    } else if (REFUNDED_EVENTS.has(event)) {
      await admin.from("orders").update({ payment_status: "REFUNDED", status: 5 }).eq("id", orderId);
    }

    console.log(`[webhook] ${event} → order ${orderId}`);
    return new Response("OK", { status: 200 });

  } catch (e) {
    console.error("[webhook] erro:", e);
    return new Response("Error", { status: 500 });
  }
});
