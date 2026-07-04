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
const RESEND_KEY     = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL     = Deno.env.get("EMAIL_FROM") ?? "BrasUX Shopping <noreply@brasux.com.br>";
const APP_URL        = Deno.env.get("APP_URL") ?? "https://brasux.com.br";

async function sendConfirmationEmail(to: string, customerName: string, orderId: string, total: number, storeName: string): Promise<void> {
  if (!RESEND_KEY || !to) return;
  const oid = `#${orderId.slice(0, 8).toUpperCase()}`;
  const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f7f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#001640,#002776,#003d1a);padding:28px 40px;text-align:center;">
<h1 style="color:#fff;font-size:26px;font-weight:900;margin:0;">BrasUX Shopping</h1>
</td></tr>
<tr><td style="padding:36px 40px;">
<h2 style="color:#0f172a;font-size:22px;font-weight:900;margin:0 0 8px;">Pagamento confirmado! 💰</h2>
<p style="color:#475569;font-size:14px;margin:0 0 24px;">Olá, <b>${customerName}</b>! Seu pagamento foi confirmado.</p>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;text-align:center;margin-bottom:24px;">
<p style="color:#16a34a;font-size:13px;font-weight:700;margin:0 0 4px;">Pedido ${oid} · ${storeName}</p>
<p style="color:#0f172a;font-size:28px;font-weight:900;margin:0;">${brl(total)}</p>
</div>
<a href="${APP_URL}/pedidos" style="display:inline-block;background:#16a34a;color:#fff;font-weight:900;font-size:14px;text-decoration:none;padding:14px 28px;border-radius:14px;">
Acompanhar entrega →</a>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
<p style="color:#94a3b8;font-size:12px;margin:0;">BrasUX Shopping · Não responda este email</p>
</td></tr>
</table></td></tr></table></body></html>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject: `💰 Pagamento confirmado — Pedido ${oid}`, html }),
  }).catch((e) => console.error("[reconcile-payments] sendEmail failed:", e));
}

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
    // Rate limit: 3 reconciliações por 5 minutos por lojista
    const { data: allowed } = await admin.rpc("check_rate_limit", {
      p_key:            `reconcile:${user.id}`,
      p_max_requests:   3,
      p_window_seconds: 300,
    });
    if (!allowed) return json({ error: "Aguarde alguns minutos antes de reconciliar novamente." }, 429, req);

    // Busca as lojas do lojista autenticado
    const { data: stores, error: storesErr } = await admin
      .from("stores")
      .select("id")
      .eq("owner_id", user.id);

    if (storesErr) throw new Error(storesErr.message);
    if (!stores || stores.length === 0) {
      return json({ ok: true, reconciled: 0, checked: 0 }, 200, req);
    }

    const storeIds = stores.map((s) => s.id as string);

    // Busca pedidos dessas lojas com pagamento pendente e charge Asaas conhecida
    const { data: orders, error: oErr } = await admin
      .from("orders")
      .select("id, total, payment_status, status, asaas_charge_id")
      .in("store_id", storeIds)
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

      // Pontos de fidelidade (idempotentes via RPC)
      await admin.rpc("earn_points_on_payment", { p_order_id: order.id }).catch(() => null);
      await admin.rpc("spend_points_for_order", { p_order_id: order.id }).catch(() => null);

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

      // Notifica o comprador (webhook foi perdido, então o email não foi enviado)
      const { data: fullOrder } = await admin
        .from("orders")
        .select("customer_id, customer_name, customer_email, stores(name)")
        .eq("id", order.id)
        .maybeSingle();

      if (fullOrder) {
        let buyerEmail = (fullOrder.customer_email as string | null) ?? null;
        const customerId = fullOrder.customer_id as string | null;
        if (!buyerEmail && customerId) {
          const { data: { user: buyer } } = await admin.auth.admin.getUserById(customerId);
          buyerEmail = buyer?.email ?? null;
        }
        if (buyerEmail) {
          const store = fullOrder.stores as { name: string } | null;
          await sendConfirmationEmail(
            buyerEmail,
            fullOrder.customer_name as string,
            order.id,
            Number(order.total),
            store?.name ?? "Loja",
          );
        }
      }

      reconciled++;
      console.log(`[reconcile-payments] reconciled order=${order.id} asaas_status=${payment.status}`);
    }

    return json({ ok: true, reconciled, checked: orders.length }, 200, req);

  } catch (e) {
    console.error("[reconcile-payments]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500, req);
  }
});
