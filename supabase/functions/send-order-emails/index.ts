import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("EMAIL_FROM") ?? "BrasUX Shopping <noreply@brasux.com.br>";
const APP_URL    = Deno.env.get("APP_URL") ?? "https://brasux.com.br";

const ALLOWED_ORIGINS = [
  "https://brasux.com.br",
  "https://brasux.vercel.app",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function json(data: unknown, status = 200, req?: Request) {
  const cors = req ? corsHeaders(req) : { "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0] };
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function brl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function shortId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

// ── Resend ───────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_KEY || !to) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[email]", err);
  }
}

// ── Layout base ───────────────────────────────────────────────

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f7f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#001640 0%,#002776 50%,#003d1a 100%);padding:28px 40px;text-align:center;">
            <p style="color:#4ade80;font-size:11px;font-weight:900;letter-spacing:4px;text-transform:uppercase;margin:0 0 6px;">O Shopping Brasileiro</p>
            <h1 style="color:#ffffff;font-size:26px;font-weight:900;margin:0;">BrasUX Shopping</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
            <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">BrasUX Shopping · O Shopping Brasileiro de Soluções Tecnológicas</p>
            <p style="color:#cbd5e1;font-size:11px;margin:0;">Não responda este email · <a href="${APP_URL}" style="color:#16a34a;">brasux.com.br</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function itemsTable(items: Array<{ product_name: string; quantity: number; unit_price: number; total_price: number }>): string {
  const rows = items.map((i) => `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9;">
        <b style="color:#0f172a;">${i.quantity}×</b> ${i.product_name}
      </td>
      <td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9;">
        ${brl(Number(i.total_price))}
      </td>
    </tr>
  `).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function ctaButton(label: string, href: string, color = "#16a34a"): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
      <tr>
        <td>
          <a href="${href}"
             style="display:inline-block;background:${color};color:#ffffff;font-weight:900;font-size:14px;text-decoration:none;padding:14px 28px;border-radius:14px;">
            ${label} →
          </a>
        </td>
      </tr>
    </table>`;
}

// ── Templates ─────────────────────────────────────────────────

function buyerOrderPlacedHtml(args: {
  orderId: string;
  buyerName: string;
  items: Array<{ product_name: string; quantity: number; unit_price: number; total_price: number }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  deliveryAddress: string;
  deliveryNeighborhood: string;
  storeName: string;
  deliveryTimeMax: number;
}): string {
  const oid = shortId(args.orderId);
  const payLabel: Record<string, string> = {
    pix: "Pix", card: "Cartão de crédito", boleto: "Boleto bancário",
  };
  return layout(`Pedido ${oid} recebido`, `
    <p style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">CONFIRMAÇÃO DE PEDIDO</p>
    <h2 style="color:#0f172a;font-size:22px;font-weight:900;margin:0 0 4px;">Pedido recebido! 🎉</h2>
    <p style="color:#475569;font-size:14px;margin:0 0 28px;">Olá, <b>${args.buyerName}</b>! Seu pedido foi confirmado com sucesso.</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <p style="color:#16a34a;font-size:14px;font-weight:900;margin:0 0 2px;">Pedido ${oid}</p>
      <p style="color:#64748b;font-size:12px;margin:0;">Loja: <b style="color:#0f172a;">${args.storeName}</b></p>
    </div>

    <p style="color:#0f172a;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Itens do pedido</p>
    ${itemsTable(args.items)}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:2px solid #f1f5f9;padding-top:12px;">
      <tr>
        <td style="font-size:13px;color:#64748b;padding:4px 0;">Subtotal</td>
        <td style="font-size:13px;color:#0f172a;font-weight:700;text-align:right;">${brl(args.subtotal)}</td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#64748b;padding:4px 0;">Entrega</td>
        <td style="font-size:13px;color:#0f172a;font-weight:700;text-align:right;">${args.deliveryFee === 0 ? "Grátis" : brl(args.deliveryFee)}</td>
      </tr>
      <tr>
        <td style="font-size:16px;color:#0f172a;font-weight:900;padding:12px 0 0;">Total</td>
        <td style="font-size:22px;color:#16a34a;font-weight:900;text-align:right;padding:12px 0 0;">${brl(args.total)}</td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#f8fafc;border-radius:12px;padding:16px 20px;border:1px solid #e2e8f0;">
      <tr>
        <td width="50%" style="vertical-align:top;">
          <p style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Endereço de entrega</p>
          <p style="color:#0f172a;font-size:13px;font-weight:700;margin:0;">${args.deliveryAddress}</p>
          <p style="color:#64748b;font-size:12px;margin:2px 0 0;">${args.deliveryNeighborhood}</p>
        </td>
        <td width="50%" style="vertical-align:top;">
          <p style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Pagamento</p>
          <p style="color:#0f172a;font-size:13px;font-weight:700;margin:0;">${payLabel[args.paymentMethod] ?? args.paymentMethod}</p>
          <p style="color:#64748b;font-size:12px;margin:2px 0 0;">Prazo: até ${args.deliveryTimeMax}min</p>
        </td>
      </tr>
    </table>

    ${ctaButton("Acompanhar pedido", `${APP_URL}/pedidos`)}
  `);
}

function sellerNewOrderHtml(args: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  items: Array<{ product_name: string; quantity: number; unit_price: number; total_price: number }>;
  total: number;
  deliveryFee: number;
  deliveryAddress: string;
  deliveryNumber: string;
  deliveryNeighborhood: string;
  storeName: string;
}): string {
  const oid = shortId(args.orderId);
  return layout(`Novo pedido ${oid}`, `
    <p style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">NOVO PEDIDO</p>
    <h2 style="color:#0f172a;font-size:22px;font-weight:900;margin:0 0 4px;">Você recebeu um pedido! 🛒</h2>
    <p style="color:#475569;font-size:14px;margin:0 0 28px;">Um cliente acabou de fazer um pedido em <b>${args.storeName}</b>.</p>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <p style="color:#92400e;font-size:15px;font-weight:900;margin:0;">Pedido ${oid} — ${brl(args.total)}</p>
      <p style="color:#b45309;font-size:13px;margin:4px 0 0;">Acesse o painel para confirmar e iniciar o preparo.</p>
    </div>

    <p style="color:#0f172a;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Itens</p>
    ${itemsTable(args.items)}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:2px solid #f1f5f9;padding-top:12px;">
      <tr>
        <td style="font-size:13px;color:#64748b;padding:4px 0;">Entrega</td>
        <td style="font-size:13px;color:#0f172a;font-weight:700;text-align:right;">${args.deliveryFee === 0 ? "Grátis" : brl(args.deliveryFee)}</td>
      </tr>
      <tr>
        <td style="font-size:16px;color:#0f172a;font-weight:900;padding:8px 0 0;">Total do pedido</td>
        <td style="font-size:22px;color:#16a34a;font-weight:900;text-align:right;padding:8px 0 0;">${brl(args.total)}</td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#f8fafc;border-radius:12px;padding:16px 20px;border:1px solid #e2e8f0;">
      <tr>
        <td width="50%" style="vertical-align:top;">
          <p style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Cliente</p>
          <p style="color:#0f172a;font-size:13px;font-weight:700;margin:0;">${args.customerName}</p>
          <p style="color:#64748b;font-size:12px;margin:2px 0 0;">${args.customerPhone}</p>
        </td>
        <td width="50%" style="vertical-align:top;">
          <p style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Endereço de entrega</p>
          <p style="color:#0f172a;font-size:13px;font-weight:700;margin:0;">${args.deliveryAddress}, ${args.deliveryNumber}</p>
          <p style="color:#64748b;font-size:12px;margin:2px 0 0;">${args.deliveryNeighborhood}</p>
        </td>
      </tr>
    </table>

    ${ctaButton("Gerenciar pedido", `${APP_URL}/minha-loja`, "#002776")}
  `);
}

function buyerPaymentConfirmedHtml(args: {
  orderId: string;
  buyerName: string;
  total: number;
  storeName: string;
  deliveryTimeMax: number;
}): string {
  const oid = shortId(args.orderId);
  return layout(`Pagamento confirmado — ${oid}`, `
    <p style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">PAGAMENTO CONFIRMADO</p>
    <h2 style="color:#0f172a;font-size:22px;font-weight:900;margin:0 0 4px;">Pagamento recebido! 💰</h2>
    <p style="color:#475569;font-size:14px;margin:0 0 28px;">Olá, <b>${args.buyerName}</b>! Seu pagamento foi confirmado e o pedido já está sendo preparado.</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin-bottom:24px;text-align:center;">
      <p style="color:#16a34a;font-size:13px;font-weight:700;margin:0 0 4px;">Pedido ${oid}</p>
      <p style="color:#0f172a;font-size:28px;font-weight:900;margin:0;">${brl(args.total)}</p>
      <p style="color:#64748b;font-size:13px;margin:8px 0 0;">Loja: <b>${args.storeName}</b></p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:16px 20px;border:1px solid #e2e8f0;">
      <tr><td style="text-align:center;padding:8px 0;">
        <p style="font-size:32px;margin:0;">✅ → 👨‍🍳 → 🛵 → 📦</p>
        <p style="color:#475569;font-size:13px;margin:8px 0 0;">
          <b>Confirmado</b> → Preparando → Saindo → Entregue
        </p>
        <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">Prazo estimado: até ${args.deliveryTimeMax} minutos</p>
      </td></tr>
    </table>

    ${ctaButton("Acompanhar entrega", `${APP_URL}/pedidos`)}
  `);
}

// ── Serve ─────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Aceita JWT de usuário logado OU guest token para pedidos sem login
    const guestTokenHeader = req.headers.get("X-Guest-Token");
    const authHeader       = req.headers.get("Authorization");
    if (!authHeader && !guestTokenHeader) return json({ error: "Não autenticado." }, 401, req);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Valida identidade e ownership: guest token OU JWT
    let ownershipFilter: { column: string; value: string } | null = null;

    if (guestTokenHeader) {
      const { data: sess } = await admin
        .from("guest_sessions")
        .select("id")
        .eq("guest_token", guestTokenHeader)
        .gt("expires_at", new Date().toISOString())
        .single();
      if (!sess) return json({ error: "Sessão inválida." }, 401, req);
      ownershipFilter = { column: "guest_session_id", value: sess.id as string };
    } else {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader! } },
      });
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) return json({ error: "Token inválido." }, 401, req);
      ownershipFilter = { column: "customer_id", value: user.id };
    }

    const { orderId, type } = await req.json() as {
      orderId: string;
      type: "order_placed" | "payment_confirmed";
    };

    if (!orderId) return json({ error: "orderId é obrigatório." }, 400, req);

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("*, stores(name, email, owner_id, delivery_time_max), order_items(product_name, quantity, unit_price, total_price)")
      .eq("id", orderId)
      .eq(ownershipFilter.column, ownershipFilter.value)
      .single();

    if (orderErr || !order) {
      console.error("[send-order-emails] order lookup failed", { orderId, filter: ownershipFilter, err: orderErr?.message ?? orderErr?.code });
      return json({ error: "Pedido não encontrado." }, 404, req);
    }

    const store  = order.stores  as { name: string; email?: string; owner_id: string; delivery_time_max: number } | null;
    const items  = order.order_items as Array<{ product_name: string; quantity: number; unit_price: number; total_price: number }>;
    // customer_email é a fonte primária (inclui guests); fallback para auth user email não é necessário
    // pois order.customer_email é preenchido tanto para guests quanto para usuários autenticados
    const buyerEmail = (order.customer_email as string | null) ?? "";

    if (type === "order_placed") {
      // 1. Email de confirmação ao comprador
      if (buyerEmail) {
        await sendEmail(
          buyerEmail,
          `✅ Pedido ${shortId(orderId)} recebido — BrasUX Shopping`,
          buyerOrderPlacedHtml({
            orderId,
            buyerName:           order.customer_name,
            items,
            subtotal:            Number(order.subtotal),
            deliveryFee:         Number(order.delivery_fee),
            total:               Number(order.total),
            paymentMethod:       order.payment_method,
            deliveryAddress:     `${order.delivery_address}, ${order.delivery_number}${order.delivery_complement ? ` — ${order.delivery_complement}` : ""}`,
            deliveryNeighborhood: order.delivery_neighborhood,
            storeName:           store?.name ?? "Loja",
            deliveryTimeMax:     store?.delivery_time_max ?? 60,
          }),
        );
      }

      // 2. Notificação ao lojista
      if (store?.owner_id) {
        let sellerEmail = store.email ?? "";
        if (!sellerEmail) {
          const { data: { user: sellerUser } } = await admin.auth.admin.getUserById(store.owner_id);
          sellerEmail = sellerUser?.email ?? "";
        }
        if (sellerEmail) {
          await sendEmail(
            sellerEmail,
            `🛒 Novo pedido ${shortId(orderId)} — ${brl(Number(order.total))}`,
            sellerNewOrderHtml({
              orderId,
              customerName:        order.customer_name,
              customerPhone:       order.customer_phone,
              items,
              total:               Number(order.total),
              deliveryFee:         Number(order.delivery_fee),
              deliveryAddress:     order.delivery_address,
              deliveryNumber:      order.delivery_number ?? "",
              deliveryNeighborhood: order.delivery_neighborhood,
              storeName:           store.name,
            }),
          );
        }
      }
    }

    if (type === "payment_confirmed" && buyerEmail) {
      await sendEmail(
        buyerEmail,
        `💰 Pagamento confirmado — Pedido ${shortId(orderId)}`,
        buyerPaymentConfirmedHtml({
          orderId,
          buyerName:       order.customer_name,
          total:           Number(order.total),
          storeName:       store?.name ?? "Loja",
          deliveryTimeMax: store?.delivery_time_max ?? 60,
        }),
      );
    }

    return json({ ok: true }, 200, req);
  } catch (e) {
    console.error("[send-order-emails]", e);
    return json({ error: "Erro ao enviar emails." }, 500, req);
  }
});
