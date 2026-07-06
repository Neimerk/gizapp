// deploy: 2026-07-05-prod
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, optionsResponse } from "../_shared/cors.ts";
import { requireAsaasBase } from "../_shared/asaas.ts";

// ── Config ────────────────────────────────────────────────────
const ASAAS_BASE_RAW = requireAsaasBase("asaas-create-charge");
const ASAAS_BASE     = (ASAAS_BASE_RAW ?? "").replace(/\/+$/, ""); // remove trailing slash
const ASAAS_KEY      = Deno.env.get("ASAAS_API_KEY") ?? "";

if (!ASAAS_KEY) {
  console.error("[asaas-create-charge] ASAAS_API_KEY não configurada");
}

// Remove campos de cartão de respostas antes de persistir no banco.
// Asaas raramente os inclui, mas o strip garante que dados brutos nunca
// chegam ao gateway_response mesmo em erros inesperados da API.
function sanitizeGatewayResponse(data: Record<string, unknown>): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { creditCard, creditCardToken, number, ccv, expiryMonth, expiryYear, ...safe } = data as Record<string, unknown>;
  return safe;
}

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

  // Lê como texto primeiro para evitar SyntaxError em respostas com corpo vazio.
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // corpo não é JSON — usa texto cru como mensagem de erro
      if (!res.ok) throw new Error(`Asaas HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
  }

  if (!res.ok) {
    const msg = (data?.errors as Array<{ description: string }> | undefined)?.[0]?.description
      ?? (data?.message as string | undefined)
      ?? `Erro na API Asaas (HTTP ${res.status})`;
    console.error(`[asaas ${method} ${path}] HTTP ${res.status}:`, JSON.stringify(data));
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

// ── Resolução de identidade (JWT ou guest token) ────────────────

type Identity =
  | { type: "user";  userId: string;         guestSessionId: null;   customerName: string; customerEmail: string; customerPhone: string; asaasCustomerId: string | null; cpf: string | null }
  | { type: "guest"; userId: null;            guestSessionId: string; customerName: string; customerEmail: string; customerPhone: string; asaasCustomerId: string | null; cpf: string | null };

async function resolveIdentity(
  req: Request,
  admin: ReturnType<typeof createClient>,
  anonKey: string,
  supabaseUrl: string,
  orderId: string,
): Promise<Identity | Response> {
  const guestTokenHeader = req.headers.get("X-Guest-Token");
  const authHeader       = req.headers.get("Authorization");

  if (guestTokenHeader) {
    // Valida guest session
    const { data: sess, error: sessErr } = await admin
      .from("guest_sessions")
      .select("id, name, email, phone, asaas_customer_id, expires_at")
      .eq("guest_token", guestTokenHeader)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessErr || !sess) return json({ error: "Sessão de convidado inválida ou expirada." }, 401, req);

    // Verifica que o pedido pertence a esta guest session
    const { data: order } = await admin
      .from("orders")
      .select("id, customer_name, customer_phone, customer_email, total")
      .eq("id", orderId)
      .eq("guest_session_id", sess.id)
      .single();

    if (!order) return json({ error: "Pedido não encontrado." }, 404, req);

    return {
      type:           "guest",
      userId:         null,
      guestSessionId: sess.id as string,
      customerName:   (sess.name as string) || (order.customer_name as string),
      customerEmail:  (sess.email as string | null) ?? (order.customer_email as string | null) ?? "",
      customerPhone:  (sess.phone as string | null) ?? (order.customer_phone as string) ?? "",
      asaasCustomerId: (sess.asaas_customer_id as string | null) ?? null,
      cpf:            null, // guests não fornecem CPF por padrão
    };

  } else if (authHeader) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Token inválido." }, 401, req);

    // Verifica ownership pelo customer_id
    const { data: order } = await admin
      .from("orders")
      .select("id, total, delivery_number, customer_name, customer_phone")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .single();

    if (!order) return json({ error: "Pedido não encontrado." }, 404, req);

    // Busca perfil para Asaas customer ID e CPF
    const { data: profile } = await admin
      .from("profiles")
      .select("name, phone, cpf, asaas_customer_id")
      .eq("id", user.id)
      .single();

    return {
      type:           "user",
      userId:         user.id,
      guestSessionId: null,
      customerName:   (profile?.name as string | null) ?? (order.customer_name as string),
      customerEmail:  user.email ?? "",
      customerPhone:  (profile?.phone as string | null) ?? (order.customer_phone as string) ?? "",
      asaasCustomerId: (profile?.asaas_customer_id as string | null) ?? null,
      cpf:            (profile?.cpf as string | null) ?? null,
    };

  } else {
    return json({ error: "Não autenticado." }, 401, req);
  }
}

// ── Serve ─────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (!ASAAS_BASE_RAW) return new Response("Service Unavailable: ASAAS_API_URL ausente", { status: 503 });
  if (!ASAAS_KEY)      return json({ error: "Configuração de pagamento indisponível. Contate o suporte." }, 503, req);

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin          = createClient(supabaseUrl, serviceRoleKey);

  try {
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
    if (paymentMethod === "CREDIT_CARD" && !creditCard)
      return json({ error: "Dados do cartão são obrigatórios." }, 400, req);

    // ── 1. Resolve identidade ────────────────────────────────
    const identity = await resolveIdentity(req, admin, anonKey, supabaseUrl, orderId);
    if (identity instanceof Response) return identity;

    // ── 2. Busca dados do pedido ─────────────────────────────
    const { data: order } = await admin
      .from("orders")
      .select("id, total, delivery_number, customer_name, customer_phone, customer_email")
      .eq("id", orderId)
      .single();

    if (!order) return json({ error: "Pedido não encontrado." }, 404, req);

    // ── 3. Rate limit por identidade ─────────────────────────
    const rateLimitKey = identity.type === "user"
      ? `charge:${identity.userId}`
      : `charge:guest:${identity.guestSessionId}`;

    const { data: allowed } = await admin.rpc("check_rate_limit", {
      p_key:            rateLimitKey,
      p_max_requests:   5,
      p_window_seconds: 60,
    });
    if (!allowed) return json({ error: "Muitas tentativas. Aguarde um momento." }, 429, req);

    // ── 4. Idempotência: verifica se já existe pagamento ──────
    const { data: existingPayment } = await admin
      .from("payments")
      .select("id, external_id, status, pix_code, pix_qr_image, pix_expires_at, boleto_url, boleto_bar_code")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existingPayment) {
      const st = existingPayment.status as string;

      if (st === "approved") return json({ error: "Este pedido já foi pago." }, 409, req);

      if (st === "pending" && existingPayment.external_id && paymentMethod === "PIX") {
        const expiresAt  = existingPayment.pix_expires_at ? new Date(existingPayment.pix_expires_at as string) : null;
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

      if (st === "pending" && existingPayment.external_id && paymentMethod === "BOLETO") {
        return json({
          chargeId:      existingPayment.external_id,
          paymentId:     existingPayment.id,
          boletoUrl:     existingPayment.boleto_url,
          boletoBarCode: existingPayment.boleto_bar_code,
        }, 200, req);
      }
    }

    // ── 5. Busca ou cria cliente no Asaas ────────────────────
    let asaasCustomerId = identity.asaasCustomerId ?? "";

    if (!asaasCustomerId) {
      const rawCpf = (identity.cpf ?? creditCardHolderInfo?.cpfCnpj ?? "").replace(/\D/g, "");
      const customer = await asaas("/customers", "POST", {
        name:              identity.customerName || order.customer_name,
        email:             identity.customerEmail || order.customer_email || undefined,
        cpfCnpj:           rawCpf || undefined,
        phone:             identity.customerPhone.replace(/\D/g, "") || undefined,
        externalReference: identity.type === "user" ? identity.userId : `guest:${identity.guestSessionId}`,
      });
      asaasCustomerId = customer.id;

      // Persiste na tabela correta para reutilização futura
      if (identity.type === "user") {
        await admin.from("profiles").update({ asaas_customer_id: customer.id }).eq("id", identity.userId);
      } else {
        await admin.from("guest_sessions").update({ asaas_customer_id: customer.id }).eq("id", identity.guestSessionId);
      }
    }

    // ── 6. Cria registro em payments ──────────────────────────
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

      if (pmErr) {
        // Violação de unique constraint (order_id) por requests paralelos — retorna o payment existente
        if (pmErr.code === "23505") {
          const { data: race } = await admin
            .from("payments")
            .select("id, external_id, status, pix_code, pix_qr_image, pix_expires_at, boleto_url, boleto_bar_code")
            .eq("order_id", orderId)
            .single();
          if (race?.id) {
            return json({ error: "Pagamento já em processamento. Aguarde e tente novamente." }, 409, req);
          }
        }
        console.error("[asaas-create-charge] payments insert:", pmErr.message);
        return json({ error: "Erro ao registrar pagamento." }, 500, req);
      }
      if (!newPayment) return json({ error: "Erro ao registrar pagamento." }, 500, req);
      paymentRowId = newPayment.id as string;
    }

    // ── 7. Monta payload da cobrança ──────────────────────────
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

      const holderInfo = {
        name:          creditCardHolderInfo?.name ?? identity.customerName,
        email:         creditCardHolderInfo?.email ?? identity.customerEmail ?? "",
        cpfCnpj:       (creditCardHolderInfo?.cpfCnpj ?? identity.cpf ?? "").replace(/\D/g, ""),
        postalCode:    (creditCardHolderInfo?.postalCode ?? "").replace(/\D/g, ""),
        addressNumber: creditCardHolderInfo?.addressNumber ?? (order.delivery_number as string | null) ?? "S/N",
        phone:         (creditCardHolderInfo?.phone ?? identity.customerPhone ?? "").replace(/\D/g, ""),
      };

      // P2-12: tokeniza o cartão antes de criar a cobrança.
      // O token é usado no lugar dos dados brutos — os dados raw nunca
      // saem deste bloco e não são armazenados em nenhum lugar.
      let cardToken: string;
      try {
        const tokenResult = await asaas("/creditCards/tokenize", "POST", {
          customer:             asaasCustomerId,
          creditCard: {
            holderName:  creditCard!.holderName,
            number:      creditCard!.number.replace(/\s/g, ""),
            expiryMonth: creditCard!.expiryMonth,
            expiryYear:  creditCard!.expiryYear,
            ccv:         creditCard!.ccv,
          },
          creditCardHolderInfo: holderInfo,
        });
        cardToken = tokenResult.creditCardToken as string;
        if (!cardToken) throw new Error("Token não retornado pelo gateway");
      } catch (tokenErr) {
        await admin.from("payments").update({ status: "cancelled" }).eq("id", paymentRowId);
        return json({ error: tokenErr instanceof Error ? tokenErr.message : "Dados do cartão inválidos." }, 422, req);
      }

      // Usa apenas o token — dados brutos do cartão não passam para a cobrança
      baseCharge.creditCardToken      = cardToken;
      baseCharge.creditCardHolderInfo = holderInfo;
    }

    // ── 8. Cria cobrança no Asaas ─────────────────────────────
    let charge: Record<string, unknown>;
    try {
      charge = await asaas("/payments", "POST", baseCharge);
    } catch (e) {
      // Se havia um customer ID salvo e a cobrança falhou, pode ser stale
      // (sandbox → prod, key trocada, conta resetada). Recria o customer e tenta uma vez.
      // Não restringe por mensagem — qualquer falha com customer ID existente pode ser stale.
      if (e instanceof Error && asaasCustomerId) {
        const rawCpf = (identity.cpf ?? creditCardHolderInfo?.cpfCnpj ?? "").replace(/\D/g, "");
        let freshCustomer: Record<string, unknown> | null = null;
        try {
          freshCustomer = await asaas("/customers", "POST", {
            name:              identity.customerName || order.customer_name,
            email:             identity.customerEmail || order.customer_email || undefined,
            cpfCnpj:           rawCpf || undefined,
            phone:             identity.customerPhone.replace(/\D/g, "") || undefined,
            externalReference: identity.type === "user" ? identity.userId : `guest:${identity.guestSessionId}`,
          });
        } catch { /* ignora — vai retornar erro original */ }

        if (freshCustomer?.id) {
          asaasCustomerId = freshCustomer.id as string;
          baseCharge.customer = asaasCustomerId;
          if (identity.type === "user") {
            await admin.from("profiles").update({ asaas_customer_id: asaasCustomerId }).eq("id", identity.userId!);
          } else {
            await admin.from("guest_sessions").update({ asaas_customer_id: asaasCustomerId }).eq("id", identity.guestSessionId!);
          }
          try {
            charge = await asaas("/payments", "POST", baseCharge);
          } catch (retryErr) {
            await admin.from("payments").update({ status: "cancelled" }).eq("id", paymentRowId);
            return json({ error: retryErr instanceof Error ? retryErr.message : "Erro ao criar cobrança." }, 422, req);
          }
        } else {
          await admin.from("payments").update({ status: "cancelled" }).eq("id", paymentRowId);
          return json({ error: e instanceof Error ? e.message : "Erro ao criar cobrança." }, 422, req);
        }
      } else {
        await admin.from("payments").update({ status: "cancelled" }).eq("id", paymentRowId);
        return json({ error: e instanceof Error ? e.message : "Erro ao criar cobrança." }, 422, req);
      }
    }

    const isDeclined    = charge.status === "DECLINED" || charge.status === "REFUSED";
    const gatewayStatus = isDeclined ? "declined"
      : charge.status === "CONFIRMED" ? "approved"
      : "pending";

    await admin.from("payments").update({
      external_id:      charge.id,
      status:           gatewayStatus,
      gateway_response: sanitizeGatewayResponse(charge),
    }).eq("id", paymentRowId);

    await admin.from("orders").update({
      asaas_charge_id: charge.id,
      payment_status:  isDeclined ? "DECLINED" : charge.status === "CONFIRMED" ? "CONFIRMED" : "PENDING",
      ...(charge.status === "CONFIRMED" && { status: 1 }),
    }).eq("id", orderId);

    // ── 9. Monta resposta por método ──────────────────────────
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
