import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, optionsResponse } from "../_shared/cors.ts";

// ── Config ────────────────────────────────────────────────────
const ASAAS_BASE = Deno.env.get("ASAAS_API_URL") ?? "https://sandbox.asaas.com/api/v3";
const ASAAS_KEY  = Deno.env.get("ASAAS_API_KEY") ?? "";

async function asaas(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": ASAAS_KEY,
      "User-Agent": "BrasUX-Shopping/1.0",
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

/** YYYY-MM-DD daqui a N milissegundos */
function dueDate(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString().split("T")[0];
}

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
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
      };
      creditCardHolderInfo?: {
        name: string;
        email: string;
        cpfCnpj: string;
        postalCode: string;
        addressNumber: string;
        phone?: string;
      };
    };

    if (!orderId || !paymentMethod) return json({ error: "Parâmetros inválidos." }, 400, req);

    // ── 1. Busca o pedido (verifica que pertence ao usuário) ──
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, total, delivery_number, customer_name, customer_phone")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .single();

    if (orderErr || !order) return json({ error: "Pedido não encontrado." }, 404, req);

    // ── 2. Busca o perfil do usuário ──────────────────────────
    const { data: profile } = await admin
      .from("profiles")
      .select("name, phone, cpf, asaas_customer_id")
      .eq("id", user.id)
      .single();

    // ── 3. Busca ou cria cliente no Asaas ────────────────────
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

    // ── 4. Monta o payload da cobrança ────────────────────────
    const baseCharge: Record<string, unknown> = {
      customer:          asaasCustomerId,
      billingType:       paymentMethod,
      value:             Number(order.total),
      description:       `Pedido BrasUX #${orderId.slice(0, 8).toUpperCase()}`,
      externalReference: orderId,
    };

    if (paymentMethod === "PIX") {
      baseCharge.dueDate = dueDate(30 * 60 * 1000);
    } else if (paymentMethod === "BOLETO") {
      baseCharge.dueDate = dueDate(3 * 24 * 60 * 60 * 1000);
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

    // ── 5. Cria a cobrança no Asaas ───────────────────────────
    let charge: Record<string, unknown>;
    try {
      charge = await asaas("/payments", "POST", baseCharge);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Erro ao criar cobrança." }, 422, req);
    }

    const isDeclined = charge.status === "DECLINED" || charge.status === "REFUSED";

    // ── 6. Atualiza o pedido no banco ─────────────────────────
    await admin.from("orders").update({
      asaas_charge_id: charge.id,
      payment_status:  isDeclined ? "DECLINED" : charge.status === "CONFIRMED" ? "CONFIRMED" : "PENDING",
      ...(charge.status === "CONFIRMED" && { status: 1 }),
    }).eq("id", orderId);

    // ── 6b. Registra a cobrança em `payments` ─────────────────
    // CRÍTICO: o asaas-webhook só dispara o split se existir uma linha em
    // `payments` para o pedido. Sem este upsert, o repasse nunca acontece.
    const methodMap: Record<string, string> = { PIX: "pix", CREDIT_CARD: "card", BOLETO: "boleto" };
    const paymentStatus = isDeclined
      ? "declined"
      : charge.status === "CONFIRMED" ? "approved" : "pending";

    const { error: payErr } = await admin.from("payments").upsert({
      order_id:         orderId,
      gateway:          "asaas",
      external_id:      charge.id as string,
      method:           methodMap[paymentMethod] ?? "other",
      amount:           Number(order.total),
      status:           paymentStatus,
      idempotency_key:  orderId,
      gateway_response: charge,
    }, { onConflict: "order_id" });
    if (payErr) console.error("[asaas-create-charge] payments upsert error:", payErr.message);

    // ── 7. Monta a resposta por método de pagamento ───────────
    if (paymentMethod === "PIX") {
      const pix = await asaas(`/payments/${charge.id}/pixQrCode`);
      return json({
        chargeId:       charge.id,
        pixQrCodeImage: pix.encodedImage,
        pixCode:        pix.payload,
        expirationDate: pix.expirationDate,
      }, 200, req);
    }

    if (paymentMethod === "BOLETO") {
      return json({
        chargeId:      charge.id,
        boletoUrl:     charge.bankSlipUrl,
        boletoBarCode: charge.identificationField,
        dueDate:       charge.dueDate,
      }, 200, req);
    }

    return json({
      chargeId:  charge.id,
      confirmed: !isDeclined,
      status:    charge.status,
      error:     isDeclined ? "Cartão recusado. Verifique os dados e tente novamente." : undefined,
    }, 200, req);

  } catch (e) {
    console.error("[asaas-create-charge]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500, req);
  }
});
