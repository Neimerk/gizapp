import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, optionsResponse } from "../_shared/cors.ts";

// ── Config ────────────────────────────────────────────────────
const ASAAS_BASE = Deno.env.get("ASAAS_API_URL") ?? "https://sandbox.asaas.com/api/v3";
const ASAAS_KEY  = Deno.env.get("ASAAS_API_KEY") ?? "";

async function asaas(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": ASAAS_KEY,
      "User-Agent":   "BrasUX-Shopping/2.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? data?.message ?? "Erro na API Asaas";
    throw new Error(msg);
  }
  return data;
}

function dueDate(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString().split("T")[0];
}

const METHOD_MAP: Record<string, string> = {
  PIX:         "pix",
  CREDIT_CARD: "card",
  BOLETO:      "boleto",
};

// ── Serve ─────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

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

    // Rate limit: 5 cobranças por minuto por usuário
    const { data: allowed } = await admin.rpc("check_rate_limit", {
      p_key:            `charge:${user.id}`,
      p_max_requests:   5,
      p_window_seconds: 60,
    });
    if (!allowed) return json({ error: "Muitas tentativas. Aguarde um momento." }, 429, req);

    const body = await req.json();
    const { orderId, paymentMethod, creditCard, creditCardHolderInfo } = body as {
      orderId: string;
      paymentMethod: "PIX" | "CREDIT_CARD" | "BOLETO";
      creditCard?: {
        holderName: string; number: string;
        expiryMonth: string; expiryYear: string; ccv: string;
      };
      creditCardHolderInfo?: {
        name: string; email: string; cpfCnpj: string;
        postalCode: string; addressNumber: string; phone?: string;
      };
    };

    if (!orderId || !paymentMethod) return json({ error: "Parâmetros inválidos." }, 400, req);

    // ── 1. Busca pedido (verifica ownership) ──────────────────
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, total, delivery_number, customer_name, customer_phone")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .single();

    if (orderErr || !order) return json({ error: "Pedido não encontrado." }, 404, req);

    // ── 2. Idempotência: verifica se já existe pagamento ──────
    const { data: existingPayment } = await admin
      .from("payments")
      .select("id, external_id, status, pix_code, pix_qr_image, pix_expires_at, boleto_url, boleto_bar_code")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existingPayment) {
      const st = existingPayment.status as string;

      if (st === "approved") {
        return json({ error: "Este pedido já foi pago." }, 409, req);
      }

      // Para PIX com QR ainda válido, retorna dados cacheados
      if (st === "pending" && existingPayment.external_id && paymentMethod === "PIX") {
        const expiresAt = existingPayment.pix_expires_at
          ? new Date(existingPayment.pix_expires_at as string)
          : null;
        const stillValid = expiresAt ? expiresAt.getTime() > Date.now() + 5 * 60 * 1000 : false;

        if (stillValid && existingPayment.pix_code) {
          return json({
            chargeId:       existingPayment.external_id,
            paymentId:      existingPayment.id,
            pixQrCodeImage: existingPayment.pix_qr_image,
            pixCode:        existingPayment.pix_code,
            expirationDate: existingPayment.pix_expires_at,
          }, 200, req);
        }
        // QR expirado: re-busca no Asaas
        if (existingPayment.external_id) {
          try {
            const pix = await asaas(`/payments/${existingPayment.external_id}/pixQrCode`);
            return json({
              chargeId:       existingPayment.external_id,
              paymentId:      existingPayment.id,
              pixQrCodeImage: pix.encodedImage,
              pixCode:        pix.payload,
              expirationDate: pix.expirationDate,
            }, 200, req);
          } catch { /* fallthrough: cria novo charge */ }
        }
      }

      // Para boleto com external_id: retorna cacheado
      if (st === "pending" && existingPayment.external_id && paymentMethod === "BOLETO") {
        return json({
          chargeId:      existingPayment.external_id,
          paymentId:     existingPayment.id,
          boletoUrl:     existingPayment.boleto_url,
          boletoBarCode: existingPayment.boleto_bar_code,
        }, 200, req);
      }
    }

    // ── 3. Busca perfil do usuário ────────────────────────────
    const { data: profile } = await admin
      .from("profiles")
      .select("name, phone, cpf, asaas_customer_id")
      .eq("id", user.id)
      .single();

    // ── 4. Busca ou cria cliente no Asaas ────────────────────
    let asaasCustomerId: string = profile?.asaas_customer_id ?? "";

    if (!asaasCustomerId) {
      const rawCpf = (profile?.cpf ?? creditCardHolderInfo?.cpfCnpj ?? "").replace(/\D/g, "");
      const customer = await asaas("/customers", "POST", {
        name:              profile?.name ?? order.customer_name,
        email:             user.email,
        cpfCnpj:           rawCpf || undefined,
        phone:             (profile?.phone ?? "").replace(/\D/g, "") || undefined,
        externalReference: user.id,
      });
      asaasCustomerId = customer.id;
      await admin.from("profiles").update({ asaas_customer_id: customer.id }).eq("id", user.id);
    }

    // ── 5. Cria registro em payments ANTES de chamar Asaas ───
    const paymentMethod_db = METHOD_MAP[paymentMethod] ?? "pix";
    let paymentRowId: string;

    if (existingPayment?.id) {
      paymentRowId = existingPayment.id as string;
    } else {
      const { data: newPayment, error: pmErr } = await admin
        .from("payments")
        .insert({
          order_id: orderId,
          gateway:  "asaas",
          method:   paymentMethod_db,
          amount:   Number(order.total),
          status:   "pending",
        })
        .select("id")
        .single();

      if (pmErr || !newPayment) {
        console.error("[asaas-create-charge] payments insert error:", pmErr?.message);
        return json({ error: "Erro ao registrar pagamento." }, 500, req);
      }
      paymentRowId = newPayment.id as string;
    }

    // ── 6. Monta payload da cobrança ──────────────────────────
    const baseCharge: Record<string, unknown> = {
      customer:          asaasCustomerId,
      billingType:       paymentMethod,
      value:             Number(order.total),
      description:       `Pedido BrasUX #${orderId.slice(0, 8).toUpperCase()}`,
      externalReference: orderId,
    };

    if (paymentMethod === "PIX") {
      baseCharge.dueDate = dueDate(30 * 60 * 1000);      // 30 min
    } else if (paymentMethod === "BOLETO") {
      baseCharge.dueDate = dueDate(3 * 24 * 60 * 60 * 1000); // 3 dias
    } else if (paymentMethod === "CREDIT_CARD") {
      baseCharge.dueDate = dueDate(0);
      baseCharge.creditCard = {
        holderName:  creditCard!.holderName,
        number:      creditCard!.number.replace(/\s/g, ""),
        expiryMonth: creditCard!.expiryMonth,
        expiryYear:  creditCard!.expiryYear,
        ccv:         creditCard!.ccv,
      };
      baseCharge.creditCardHolderInfo = {
        name:          creditCardHolderInfo?.name ?? profile?.name ?? order.customer_name,
        email:         creditCardHolderInfo?.email ?? user.email ?? "",
        cpfCnpj:       (creditCardHolderInfo?.cpfCnpj ?? profile?.cpf ?? "").replace(/\D/g, ""),
        postalCode:    (creditCardHolderInfo?.postalCode ?? "").replace(/\D/g, ""),
        addressNumber: creditCardHolderInfo?.addressNumber ?? order.delivery_number ?? "S/N",
        phone:         (creditCardHolderInfo?.phone ?? profile?.phone ?? order.customer_phone ?? "").replace(/\D/g, ""),
      };
    }

    // ── 7. Cria cobrança no Asaas ─────────────────────────────
    let charge: Record<string, unknown>;
    try {
      charge = await asaas("/payments", "POST", baseCharge);
    } catch (e) {
      // Reverte status do payment record
      await admin.from("payments").update({ status: "cancelled" }).eq("id", paymentRowId);
      return json({ error: e instanceof Error ? e.message : "Erro ao criar cobrança." }, 422, req);
    }

    const isDeclined = charge.status === "DECLINED" || charge.status === "REFUSED";
    const gatewayStatus = isDeclined ? "declined"
      : charge.status === "CONFIRMED" ? "approved"
      : "pending";

    // ── 8. Atualiza payment record com dados do gateway ───────
    await admin.from("payments").update({
      external_id:     charge.id,
      status:          gatewayStatus,
      gateway_response: charge,
    }).eq("id", paymentRowId);

    // ── 9. Atualiza orders ────────────────────────────────────
    await admin.from("orders").update({
      asaas_charge_id: charge.id,
      payment_status:  isDeclined ? "DECLINED"
        : charge.status === "CONFIRMED" ? "CONFIRMED"
        : "PENDING",
      ...(charge.status === "CONFIRMED" && { status: 1 }),
    }).eq("id", orderId);

    // ── 10. Monta resposta por método ─────────────────────────
    if (paymentMethod === "PIX") {
      const pix = await asaas(`/payments/${charge.id}/pixQrCode`);

      await admin.from("payments").update({
        pix_code:       pix.payload,
        pix_qr_image:   pix.encodedImage,
        pix_expires_at: new Date(pix.expirationDate).toISOString(),
      }).eq("id", paymentRowId);

      return json({
        chargeId:       charge.id,
        paymentId:      paymentRowId,
        pixQrCodeImage: pix.encodedImage,
        pixCode:        pix.payload,
        expirationDate: pix.expirationDate,
      }, 200, req);
    }

    if (paymentMethod === "BOLETO") {
      await admin.from("payments").update({
        boleto_url:      charge.bankSlipUrl,
        boleto_bar_code: charge.identificationField,
      }).eq("id", paymentRowId);

      return json({
        chargeId:      charge.id,
        paymentId:     paymentRowId,
        boletoUrl:     charge.bankSlipUrl,
        boletoBarCode: charge.identificationField,
        dueDate:       charge.dueDate,
      }, 200, req);
    }

    // CREDIT_CARD
    return json({
      chargeId:  charge.id,
      paymentId: paymentRowId,
      confirmed: !isDeclined,
      status:    charge.status,
      error:     isDeclined ? "Cartão recusado. Verifique os dados e tente novamente." : undefined,
    }, 200, req);

  } catch (e) {
    console.error("[asaas-create-charge]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500, req);
  }
});
