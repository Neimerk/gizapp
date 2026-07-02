import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, optionsResponse } from "../_shared/cors.ts";
import { requireAsaasBase } from "../_shared/asaas.ts";

/**
 * create-payment
 * Edge Function para criar cobrança no Asaas a partir do brasux-entregas.
 *
 * Diferenças vs asaas-create-charge (brasux-shopping):
 *   – Aceita customerId + vendorId explícitos (não verifica ownership do pedido)
 *   – Aceita método em formato brasux-entregas (pix | credit_card | boleto)
 *   – Popula customer_id + vendor_id na tabela payments
 *   – Retorna campos no formato esperado por paymentService.ts do entregas:
 *       paymentId, asaasPaymentId, pixQrCode, pixCopyPaste, pixExpirationDate…
 *
 * POST /functions/v1/create-payment
 * Authorization: Bearer <user_jwt>
 */

const ASAAS_BASE_RAW = requireAsaasBase("create-payment");
const ASAAS_BASE     = ASAAS_BASE_RAW ?? "";
const ASAAS_KEY      = Deno.env.get("ASAAS_API_KEY") ?? "";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY       = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── método brasux-entregas → billingType Asaas ────────────────
const TO_ASAAS_BILLING: Record<string, string> = {
  pix:         "PIX",
  credit_card: "CREDIT_CARD",
  debit_card:  "CREDIT_CARD",   // Asaas não diferencia
  boleto:      "BOLETO",
};

// ── método para coluna legada `method` ────────────────────────
const TO_LEGACY_METHOD: Record<string, string> = {
  pix:         "pix",
  credit_card: "card",
  debit_card:  "card",
  boleto:      "boleto",
};

function dueDate(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString().split("T")[0];
}

async function asaas(path: string, method = "GET", body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": ASAAS_KEY,
      "User-Agent":   "BrasUX-Entregas/1.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data as Record<string, unknown>)?.errors
      ? ((data as Record<string, { description?: string }[]>).errors[0]?.description ?? "Erro Asaas")
      : (data as Record<string, unknown>)?.message ?? "Erro Asaas";
    throw new Error(String(msg));
  }
  return data as Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST")   return json({ error: "Method Not Allowed" }, 405, req);
  if (!ASAAS_BASE_RAW) return new Response("Service Unavailable", { status: 503 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401, req);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Token inválido." }, 401, req);

  // Rate limit: 5 cobranças / minuto
  const { data: allowed } = await admin.rpc("check_rate_limit", {
    p_key:            `create-payment:${user.id}`,
    p_max_requests:   5,
    p_window_seconds: 60,
  });
  if (!allowed) return json({ error: "Muitas tentativas. Aguarde um momento." }, 429, req);

  try {
    const body = await req.json() as {
      orderId:       string;
      customerId:    string;
      vendorId:      string;
      amount:        number;
      paymentMethod: string;
      customerName:  string;
      customerEmail: string;
      customerCpf:   string;
      customerPhone?: string;
      description?:  string;
      installments?: number;
      creditCard?: {
        holderName:          string;
        number:              string;
        expiryMonth:         string;
        expiryYear:          string;
        ccv:                 string;
        holderCpf:           string;
        holderZip:           string;
        holderAddressNumber: string;
        holderPhone?:        string;
      };
    };

    const { orderId, customerId, vendorId, amount, paymentMethod,
            customerName, customerEmail, customerCpf, customerPhone,
            description, installments, creditCard } = body;

    if (!orderId || !customerId || !vendorId || !amount || !paymentMethod) {
      return json({ error: "Parâmetros obrigatórios: orderId, customerId, vendorId, amount, paymentMethod." }, 400, req);
    }

    const billingType = TO_ASAAS_BILLING[paymentMethod];
    if (!billingType) {
      return json({ error: `paymentMethod inválido. Use: ${Object.keys(TO_ASAAS_BILLING).join(", ")}` }, 400, req);
    }

    // ── Segurança: só o próprio cliente, o vendedor ou admin pode criar ──
    const { data: profile } = await admin
      .from("profiles")
      .select("role, asaas_customer_id, name, cpf, phone")
      .eq("id", user.id)
      .single();

    const isCustomer = user.id === customerId;
    const isVendor   = user.id === vendorId && (profile?.role === "seller" || profile?.role === "vendor");
    const isAdmin    = profile?.role === "admin";

    if (!isCustomer && !isVendor && !isAdmin) {
      return json({ error: "Sem permissão para criar este pagamento." }, 403, req);
    }

    // ── Idempotência: pagamento existente para este pedido ────────────
    const { data: existing } = await admin
      .from("payments")
      .select("id, asaas_payment_id, external_id, status, pix_qr_code, pix_qr_image, pix_copy_paste, pix_code, pix_expiration_date, pix_expires_at, boleto_url, boleto_barcode, boleto_bar_code, payment_method, method")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existing) {
      const st = existing.status as string;
      if (st === "approved") return json({ error: "Este pedido já foi pago." }, 409, req);

      const existingAsaasId = (existing.asaas_payment_id ?? existing.external_id) as string | null;

      if (st === "pending" && existingAsaasId && paymentMethod === "pix") {
        const expiresAt = (existing.pix_expiration_date ?? existing.pix_expires_at) as string | null;
        const stillValid = expiresAt
          ? new Date(expiresAt).getTime() > Date.now() + 5 * 60 * 1000
          : false;

        if (stillValid) {
          return json({
            paymentId:        existing.id,
            asaasPaymentId:   existingAsaasId,
            status:           "pending",
            paymentMethod:    (existing.payment_method ?? existing.method) as string,
            pixQrCode:        (existing.pix_qr_code        ?? existing.pix_qr_image)   as string | null,
            pixCopyPaste:     (existing.pix_copy_paste      ?? existing.pix_code)       as string | null,
            pixExpirationDate: expiresAt,
          }, 200, req);
        }

        // QR expirado: re-busca no Asaas
        if (existingAsaasId && ASAAS_KEY) {
          try {
            const pix = await asaas(`/payments/${existingAsaasId}/pixQrCode`);
            await admin.from("payments").update({
              pix_qr_code:         pix.encodedImage,
              pix_qr_image:        pix.encodedImage,
              pix_copy_paste:      pix.payload,
              pix_code:            pix.payload,
              pix_expiration_date: pix.expirationDate
                ? new Date(String(pix.expirationDate)).toISOString()
                : null,
              pix_expires_at: pix.expirationDate
                ? new Date(String(pix.expirationDate)).toISOString()
                : null,
            }).eq("id", existing.id);

            return json({
              paymentId:         existing.id,
              asaasPaymentId:    existingAsaasId,
              status:            "pending",
              paymentMethod:     "pix",
              pixQrCode:         pix.encodedImage,
              pixCopyPaste:      pix.payload,
              pixExpirationDate: pix.expirationDate,
            }, 200, req);
          } catch { /* fallthrough: cria nova cobrança */ }
        }
      }

      if (st === "pending" && existingAsaasId && paymentMethod === "boleto") {
        return json({
          paymentId:      existing.id,
          asaasPaymentId: existingAsaasId,
          status:         "pending",
          paymentMethod:  "boleto",
          boletoUrl:      existing.boleto_url,
          boletoBarcode:  (existing.boleto_barcode ?? existing.boleto_bar_code),
        }, 200, req);
      }
    }

    // ── Busca / cria cliente Asaas ─────────────────────────────────────
    // Prioritiza dados do perfil do banco; usa params como fallback
    const { data: customerProfile } = await admin
      .from("profiles")
      .select("name, cpf, phone, asaas_customer_id")
      .eq("id", customerId)
      .single();

    let asaasCustomerId = (customerProfile?.asaas_customer_id ?? "") as string;

    if (!asaasCustomerId && ASAAS_KEY) {
      const rawCpf = ((customerProfile?.cpf ?? customerCpf) || "").replace(/\D/g, "");
      const customer = await asaas("/customers", "POST", {
        name:              customerProfile?.name ?? customerName,
        email:             customerEmail,
        cpfCnpj:           rawCpf || undefined,
        phone:             ((customerProfile?.phone ?? customerPhone) || "").replace(/\D/g, "") || undefined,
        externalReference: customerId,
      });
      asaasCustomerId = customer.id as string;
      await admin.from("profiles")
        .update({ asaas_customer_id: asaasCustomerId })
        .eq("id", customerId);
    }

    // ── Cria registro em payments (antes do Asaas, para idempotência) ──
    const legacyMethod  = TO_LEGACY_METHOD[paymentMethod] ?? "pix";
    let paymentRowId: string;

    if (existing?.id) {
      paymentRowId = existing.id as string;
    } else {
      const { data: newPmt, error: pmtErr } = await admin
        .from("payments")
        .insert({
          order_id:         orderId,
          customer_id:      customerId,
          vendor_id:        vendorId,
          gateway:          "asaas",
          external_id:      null,
          asaas_payment_id: null,
          asaas_customer_id: asaasCustomerId || null,
          method:           legacyMethod,
          payment_method:   paymentMethod,
          amount:           amount,
          status:           "pending",
          description:      description ?? `Pedido BrasUX #${orderId.slice(0, 8).toUpperCase()}`,
        })
        .select("id")
        .single();

      if (pmtErr || !newPmt) {
        console.error("[create-payment] payments insert:", pmtErr?.message);
        return json({ error: "Erro ao registrar pagamento." }, 500, req);
      }
      paymentRowId = newPmt.id as string;
    }

    // ── Se não há chave Asaas, retorna pending (modo dev) ─────────────
    if (!ASAAS_KEY) {
      return json({
        paymentId:      paymentRowId,
        asaasPaymentId: null,
        status:         "pending",
        paymentMethod,
      }, 200, req);
    }

    // ── Monta payload da cobrança Asaas ───────────────────────────────
    const chargePayload: Record<string, unknown> = {
      customer:          asaasCustomerId,
      billingType,
      value:             amount,
      description:       description ?? `Pedido BrasUX #${orderId.slice(0, 8).toUpperCase()}`,
      externalReference: orderId,
    };

    if (billingType === "PIX") {
      chargePayload.dueDate = dueDate(30 * 60 * 1000);            // 30 min
    } else if (billingType === "BOLETO") {
      chargePayload.dueDate = dueDate(3 * 24 * 60 * 60 * 1000);  // 3 dias
    } else if (billingType === "CREDIT_CARD") {
      if (!creditCard) return json({ error: "Dados do cartão obrigatórios." }, 400, req);
      chargePayload.dueDate = dueDate(0);
      chargePayload.installmentCount = installments ?? 1;
      chargePayload.creditCard = {
        holderName:  creditCard.holderName,
        number:      creditCard.number.replace(/\s/g, ""),
        expiryMonth: creditCard.expiryMonth,
        expiryYear:  creditCard.expiryYear,
        ccv:         creditCard.ccv,
      };
      chargePayload.creditCardHolderInfo = {
        name:          creditCard.holderName,
        email:         customerEmail,
        cpfCnpj:       (creditCard.holderCpf || customerCpf || "").replace(/\D/g, ""),
        postalCode:    creditCard.holderZip.replace(/\D/g, ""),
        addressNumber: creditCard.holderAddressNumber,
        phone:         ((creditCard.holderPhone ?? customerPhone) || "").replace(/\D/g, ""),
      };
    }

    // ── Cria cobrança no Asaas ────────────────────────────────────────
    let charge: Record<string, unknown>;
    try {
      charge = await asaas("/payments", "POST", chargePayload);
    } catch (e) {
      await admin.from("payments").update({ status: "declined" }).eq("id", paymentRowId);
      return json({ error: e instanceof Error ? e.message : "Erro ao criar cobrança." }, 422, req);
    }

    const isDeclined   = charge.status === "DECLINED" || charge.status === "REFUSED";
    const gatewayStatus = isDeclined ? "declined"
      : (charge.status === "CONFIRMED" || charge.status === "RECEIVED") ? "approved"
      : "pending";

    const paymentStatus: string = gatewayStatus === "approved" ? "approved" : "pending";

    // ── Persiste dados do gateway ─────────────────────────────────────
    await admin.from("payments").update({
      external_id:      charge.id,
      asaas_payment_id: charge.id,
      status:           paymentStatus,
      gateway_response: charge,
    }).eq("id", paymentRowId);

    // ── PIX ───────────────────────────────────────────────────────────
    if (billingType === "PIX") {
      let pix: Record<string, unknown> = {};
      try {
        pix = await asaas(`/payments/${charge.id}/pixQrCode`);
      } catch {
        pix = {};
      }
      const expiresAt = pix.expirationDate
        ? new Date(String(pix.expirationDate)).toISOString()
        : null;

      await admin.from("payments").update({
        pix_qr_image:        pix.encodedImage ?? null,
        pix_qr_code:         pix.encodedImage ?? null,
        pix_code:            pix.payload      ?? null,
        pix_copy_paste:      pix.payload      ?? null,
        pix_expires_at:      expiresAt,
        pix_expiration_date: expiresAt,
      }).eq("id", paymentRowId);

      console.log(`[create-payment] PIX order=${orderId} charge=${charge.id}`);
      return json({
        paymentId:         paymentRowId,
        asaasPaymentId:    charge.id,
        status:            paymentStatus,
        paymentMethod:     "pix",
        pixQrCode:         pix.encodedImage   ?? null,
        pixCopyPaste:      pix.payload        ?? null,
        pixExpirationDate: pix.expirationDate ?? null,
      }, 200, req);
    }

    // ── BOLETO ────────────────────────────────────────────────────────
    if (billingType === "BOLETO") {
      const dueD = charge.dueDate ? String(charge.dueDate) : null;
      const barcodeVal = (charge.identificationField ?? charge.nossoNumero) as string | null;

      await admin.from("payments").update({
        boleto_url:      charge.bankSlipUrl ?? null,
        boleto_bar_code: barcodeVal,
        boleto_barcode:  barcodeVal,
        boleto_due_date: dueD,
      }).eq("id", paymentRowId);

      console.log(`[create-payment] BOLETO order=${orderId} charge=${charge.id}`);
      return json({
        paymentId:      paymentRowId,
        asaasPaymentId: charge.id,
        status:         paymentStatus,
        paymentMethod:  "boleto",
        boletoUrl:      charge.bankSlipUrl ?? null,
        boletoBarcode:  barcodeVal,
        boletoDueDate:  dueD,
      }, 200, req);
    }

    // ── CARTÃO DE CRÉDITO ─────────────────────────────────────────────
    if (isDeclined) {
      await admin.from("payments").update({ status: "declined" }).eq("id", paymentRowId);
    } else if (gatewayStatus === "approved") {
      await admin.from("payments").update({
        status:       "approved",
        confirmed_at: new Date().toISOString(),
      }).eq("id", paymentRowId);
      // Dispara split via release-balance interno
      await admin.functions.invoke("execute-split", {
        body:    { orderId, paymentId: paymentRowId },
        headers: { "x-internal-key": Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "" },
      }).catch((e: unknown) => console.warn("[create-payment] execute-split:", e));
    }

    console.log(`[create-payment] CARD order=${orderId} charge=${charge.id} declined=${isDeclined}`);
    return json({
      paymentId:      paymentRowId,
      asaasPaymentId: charge.id,
      status:         isDeclined ? "failed" : "approved",
      paymentMethod:  paymentMethod,
    }, 200, req);

  } catch (e) {
    console.error("[create-payment]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500, req);
  }
});
