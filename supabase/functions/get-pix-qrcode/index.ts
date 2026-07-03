import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, optionsResponse } from "../_shared/cors.ts";
import { requireAsaasBase } from "../_shared/asaas.ts";

// get-pix-qrcode — retorna QR code e status do PIX de um pedido.
// Aceita: Authorization: Bearer <JWT> OU X-Guest-Token: <token>

const ASAAS_BASE_RAW = requireAsaasBase("get-pix-qrcode");
const ASAAS_BASE     = ASAAS_BASE_RAW ?? "";
const ASAAS_KEY      = Deno.env.get("ASAAS_API_KEY") ?? "";

async function asaas(path: string) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { "access_token": ASAAS_KEY, "User-Agent": "BrasUX/2.0" },
  });
  if (!res.ok) throw new Error("Erro Asaas");
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (!ASAAS_BASE_RAW) return new Response("Service Unavailable", { status: 503 });

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin          = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── 1. Extrai orderId ────────────────────────────────────
    let orderId: string | null = null;
    if (req.method === "GET") {
      orderId = new URL(req.url).searchParams.get("orderId");
    } else {
      const body = await req.json().catch(() => ({})) as { orderId?: string };
      orderId = body.orderId ?? null;
    }
    if (!orderId) return json({ error: "orderId obrigatório." }, 400, req);

    // ── 2. Verifica identidade e ownership ───────────────────
    const guestTokenHeader = req.headers.get("X-Guest-Token");
    const authHeader       = req.headers.get("Authorization");

    let orderQuery = admin.from("orders").select("id, payment_status").eq("id", orderId);

    if (guestTokenHeader) {
      const { data: sess, error: sessErr } = await admin
        .from("guest_sessions")
        .select("id, expires_at")
        .eq("guest_token", guestTokenHeader)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (sessErr || !sess) return json({ error: "Sessão de convidado inválida ou expirada." }, 401, req);

      orderQuery = orderQuery.eq("guest_session_id", sess.id);

    } else if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) return json({ error: "Token inválido." }, 401, req);

      orderQuery = orderQuery.eq("customer_id", user.id);

    } else {
      return json({ error: "Não autenticado." }, 401, req);
    }

    const { data: order } = await orderQuery.maybeSingle();
    if (!order) return json({ error: "Pedido não encontrado." }, 404, req);

    // ── 3. Status final → retorna imediatamente ──────────────
    if (order.payment_status === "CONFIRMED" || order.payment_status === "RECEIVED") {
      return json({ status: "paid", paymentStatus: order.payment_status }, 200, req);
    }
    if (order.payment_status === "DECLINED" || order.payment_status === "CANCELLED") {
      return json({ status: "failed", paymentStatus: order.payment_status }, 200, req);
    }

    // ── 4. Busca payment record ──────────────────────────────
    const { data: payment } = await admin
      .from("payments")
      .select("id, external_id, status, pix_code, pix_qr_image, pix_expires_at, method")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!payment) return json({ status: "pending", message: "Aguardando cobrança ser criada." }, 200, req);
    if (payment.method !== "pix") return json({ status: "not_pix" }, 200, req);

    if (payment.status === "approved") {
      return json({ status: "paid", paymentStatus: "CONFIRMED" }, 200, req);
    }

    // ── 5. QR code cacheado (ainda válido) ───────────────────
    if (payment.pix_code && payment.pix_expires_at) {
      const expiresAt = new Date(payment.pix_expires_at as string);
      if (expiresAt.getTime() > Date.now()) {
        return json({
          status:         "pending",
          pixCode:        payment.pix_code,
          pixQrCodeImage: payment.pix_qr_image,
          expirationDate: payment.pix_expires_at,
          paymentStatus:  "PENDING",
        }, 200, req);
      }
    }

    // ── 6. QR expirado — re-busca no Asaas ──────────────────
    if (payment.external_id && ASAAS_KEY) {
      try {
        const charge = await asaas(`/payments/${payment.external_id}`);

        if (charge.status === "CONFIRMED" || charge.status === "RECEIVED") {
          await admin.from("payments").update({ status: "approved" }).eq("id", payment.id);
          await admin.from("orders").update({ payment_status: charge.status, status: 1 }).eq("id", orderId);
          return json({ status: "paid", paymentStatus: charge.status }, 200, req);
        }

        if (charge.status === "PENDING" || charge.status === "AWAITING_RISK_ANALYSIS") {
          const pix = await asaas(`/payments/${payment.external_id}/pixQrCode`);
          await admin.from("payments").update({
            pix_code:       pix.payload,
            pix_qr_image:   pix.encodedImage,
            pix_expires_at: new Date(pix.expirationDate).toISOString(),
          }).eq("id", payment.id);

          return json({
            status:         "pending",
            pixCode:        pix.payload,
            pixQrCodeImage: pix.encodedImage,
            expirationDate: pix.expirationDate,
            paymentStatus:  "PENDING",
          }, 200, req);
        }
      } catch (e) {
        console.warn("[get-pix-qrcode] asaas fetch failed:", e);
      }
    }

    return json({ status: "pending", paymentStatus: "PENDING" }, 200, req);

  } catch (e) {
    console.error("[get-pix-qrcode]", e);
    return json({ error: "Erro interno." }, 500, req);
  }
});
