import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, optionsResponse } from "../_shared/cors.ts";
import { requireAsaasBase } from "../_shared/asaas.ts";

/**
 * get-pix-qrcode
 * Retorna QR code Pix de um pedido e o status atual do pagamento.
 * Usado para polling na tela de checkout enquanto aguarda confirmação.
 *
 * GET /functions/v1/get-pix-qrcode?orderId=...
 */

const ASAAS_BASE_RAW = requireAsaasBase("get-pix-qrcode");
const ASAAS_BASE     = ASAAS_BASE_RAW ?? "";
const ASAAS_KEY      = Deno.env.get("ASAAS_API_KEY") ?? "";

async function asaas(path: string) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: {
      "access_token": ASAAS_KEY,
      "User-Agent":   "BrasUX/2.0",
    },
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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401, req);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Token inválido." }, 401, req);

    // Aceita GET (?orderId) ou POST ({orderId})
    let orderId: string | null = null;
    if (req.method === "GET") {
      orderId = new URL(req.url).searchParams.get("orderId");
    } else {
      const body = await req.json().catch(() => ({})) as { orderId?: string };
      orderId = body.orderId ?? null;
    }

    if (!orderId) return json({ error: "orderId obrigatório." }, 400, req);

    // Verifica que o pedido pertence ao usuário
    const { data: order } = await admin
      .from("orders")
      .select("id, payment_status")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (!order) return json({ error: "Pedido não encontrado." }, 404, req);

    // Status final: retorna imediatamente
    if (order.payment_status === "CONFIRMED" || order.payment_status === "RECEIVED") {
      return json({ status: "paid", paymentStatus: order.payment_status }, 200, req);
    }
    if (order.payment_status === "DECLINED" || order.payment_status === "CANCELLED") {
      return json({ status: "failed", paymentStatus: order.payment_status }, 200, req);
    }

    // Busca payment record
    const { data: payment } = await admin
      .from("payments")
      .select("id, external_id, status, pix_code, pix_qr_image, pix_expires_at, method")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!payment) return json({ status: "pending", message: "Aguardando cobrança ser criada." }, 200, req);
    if (payment.method !== "pix") return json({ status: "not_pix" }, 200, req);

    // Se aprovado no banco mas status do order não atualizou ainda
    if (payment.status === "approved") {
      return json({ status: "paid", paymentStatus: "CONFIRMED" }, 200, req);
    }

    // Retorna QR code cacheado se ainda válido
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

    // QR expirado e external_id existe: busca novo QR no Asaas
    if (payment.external_id && ASAAS_KEY) {
      try {
        // Verifica status atual da cobrança
        const charge = await asaas(`/payments/${payment.external_id}`);

        if (charge.status === "CONFIRMED" || charge.status === "RECEIVED") {
          await admin.from("payments").update({ status: "approved" }).eq("id", payment.id);
          await admin.from("orders").update({ payment_status: charge.status, status: 1 }).eq("id", orderId);
          return json({ status: "paid", paymentStatus: charge.status }, 200, req);
        }

        if (charge.status === "PENDING" || charge.status === "AWAITING_RISK_ANALYSIS") {
          const pix = await asaas(`/payments/${payment.external_id}/pixQrCode`);
          await admin.from("payments").update({
            pix_code:      pix.payload,
            pix_qr_image:  pix.encodedImage,
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
