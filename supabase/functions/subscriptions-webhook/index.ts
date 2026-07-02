import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { timingSafeCompare, verifyHmacSha256 } from "../_shared/hmac.ts";

/**
 * subscriptions-webhook
 * Webhook dedicado para assinaturas SaaS dos lojistas.
 * URL a configurar no painel Asaas: .../functions/v1/subscriptions-webhook
 *
 * Eventos tratados:
 *   PAYMENT_CONFIRMED / PAYMENT_RECEIVED  → renova assinatura (active)
 *   PAYMENT_OVERDUE                        → marca overdue / suspende
 *   PAYMENT_REFUNDED                       → estorna mensalidade
 *   SUBSCRIPTION_INACTIVATED               → cancela / suspende
 *   SUBSCRIPTION_DELETED                   → cancela definitivamente
 */

const WEBHOOK_TOKEN       = Deno.env.get("ASAAS_SUBSCRIPTION_WEBHOOK_TOKEN")
  ?? Deno.env.get("ASAAS_WEBHOOK_TOKEN")
  ?? "";
const WEBHOOK_HMAC_SECRET = Deno.env.get("ASAAS_SUBSCRIPTION_HMAC_SECRET")
  ?? Deno.env.get("ASAAS_WEBHOOK_HMAC_SECRET")
  ?? "";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY     = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL     = Deno.env.get("EMAIL_FROM") ?? "BrasUX <noreply@brasux.com.br>";

const MAX_RETRIES = 5;

type AdminClient = ReturnType<typeof createClient>;

// ── Helpers ───────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_KEY || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  }).catch((e) => console.error("[subscriptions-webhook] sendEmail:", e));
}

function brl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

// Resolve vendor_id a partir do externalReference (pode ser user_id) ou subscription_id
async function resolveVendorId(
  admin: AdminClient,
  externalRef: string | undefined,
  asaasSubId: string | undefined,
): Promise<string | null> {
  // externalReference contém o user.id no fluxo de create-subscription
  if (externalRef && externalRef.length === 36) {
    const { data } = await admin.from("profiles").select("id").eq("id", externalRef).maybeSingle();
    if (data?.id) return data.id as string;
  }
  // Fallback: busca pelo asaas_subscription_id
  if (asaasSubId) {
    const { data } = await admin.from("subscriptions")
      .select("vendor_id").eq("asaas_subscription_id", asaasSubId).maybeSingle();
    if (data?.vendor_id) return data.vendor_id as string;
  }
  return null;
}

// ── Handlers ──────────────────────────────────────────────────

async function handleSubscriptionRenewed(
  admin: AdminClient,
  vendorId: string,
  payment: AsaasPayload["payment"],
): Promise<void> {
  const nextBilling = new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0];

  // Busca plano atual antes de atualizar
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan, monthly_price, asaas_subscription_id")
    .eq("vendor_id", vendorId)
    .single();

  await admin.from("subscriptions").update({
    status:             "active",
    next_billing_date:  nextBilling,
    last_payment_date:  new Date().toISOString().split("T")[0],
    last_payment_value: payment?.value ?? null,
    delinquent_since:   null,
  }).eq("vendor_id", vendorId);

  // Registra fatura paga na subscription_invoices (idempotente via asaas_payment_id)
  if (payment?.id && sub) {
    await admin.rpc("create_subscription_invoice", {
      p_vendor_id:        vendorId,
      p_plan:             sub.plan,
      p_amount:           payment.value ?? sub.monthly_price ?? 0,
      p_asaas_payment_id: payment.id,
      p_asaas_sub_id:     sub.asaas_subscription_id ?? payment.subscription ?? null,
      p_due_date:         null,
      p_description:      `Renovação plano ${sub.plan} — ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
      p_gateway_response: payment as unknown as Record<string, unknown>,
      p_idempotency_key:  `sub_renewal_${payment.id}`,
    }).catch((e: unknown) => console.warn("[subscriptions-webhook] create_subscription_invoice:", e));

    await admin.rpc("mark_subscription_invoice_paid", {
      p_asaas_payment_id: payment.id,
      p_paid_at:          new Date().toISOString(),
    }).catch(() => null);
  }

  await admin.rpc("log_financial_event", {
    p_actor_type:  "system",
    p_actor_id:    vendorId,
    p_action:      "subscription_renewed",
    p_entity_type: "subscriptions",
    p_entity_id:   null,
    p_amount:      payment?.value ?? 0,
    p_description: "Assinatura renovada via webhook",
    p_metadata:    { asaas_payment_id: payment?.id, event: payment?.event },
  }).catch(() => null);

  // E-mail de renovação
  const { data: { user } } = await admin.auth.admin.getUserById(vendorId);
  if (user?.email) {
    const { data: sub } = await admin.from("subscriptions")
      .select("plan, monthly_price").eq("vendor_id", vendorId).single();
    await sendEmail(
      user.email,
      "✅ Assinatura BrasUX renovada",
      `<p>Olá! Sua assinatura plano <b>${sub?.plan ?? ""}</b> foi renovada com sucesso — ${brl(Number(sub?.monthly_price ?? 0))}/mês.</p>`,
    );
  }
}

async function handleSubscriptionOverdue(
  admin: AdminClient,
  vendorId: string,
  daysOverdue: number,
): Promise<void> {
  await admin.rpc("handle_subscription_overdue", {
    p_vendor_id:    vendorId,
    p_asaas_sub_id: null,
    p_days_overdue: daysOverdue,
  }).catch(() => null);

  const { data: { user } } = await admin.auth.admin.getUserById(vendorId);
  if (user?.email) {
    await sendEmail(
      user.email,
      "⚠️ Pagamento da assinatura BrasUX vencido",
      `<p>Seu pagamento está vencido há ${daysOverdue} dia(s). Regularize para manter o acesso ao painel.</p>`,
    );
  }
}

async function handleSubscriptionInactivated(
  admin: AdminClient,
  vendorId: string,
  event: string,
): Promise<void> {
  await admin.rpc("change_subscription_plan", {
    p_vendor_id:   vendorId,
    p_to_plan:     "free",
    p_to_status:   "suspended",
    p_reason:      `Assinatura inativada pelo gateway (${event})`,
    p_triggered:   "webhook",
    p_asaas_event: event,
  }).catch(() => null);

  const { data: { user } } = await admin.auth.admin.getUserById(vendorId);
  if (user?.email) {
    await sendEmail(
      user.email,
      "🔒 Assinatura BrasUX suspensa",
      "<p>Sua assinatura foi suspensa. Entre em contato com o suporte para reativar.</p>",
    );
  }
}

async function handleSubscriptionDeleted(
  admin: AdminClient,
  vendorId: string,
): Promise<void> {
  await admin.rpc("change_subscription_plan", {
    p_vendor_id:   vendorId,
    p_to_plan:     "free",
    p_to_status:   "cancelled",
    p_reason:      "Assinatura cancelada no gateway",
    p_triggered:   "webhook",
    p_asaas_event: "SUBSCRIPTION_DELETED",
  }).catch(() => null);
}

// ── Types ─────────────────────────────────────────────────────

interface AsaasPayload {
  event: string;
  payment?: {
    id: string;
    event: string;
    value: number;
    status: string;
    externalReference?: string;
    subscription?: string;
    daysOverdue?: number;
  };
  subscription?: {
    id: string;
    status: string;
    externalReference?: string;
  };
}

// ── Main handler ──────────────────────────────────────────────

serve(async (req) => {
  if (!WEBHOOK_TOKEN) {
    console.error("[subscriptions-webhook] ASAAS_SUBSCRIPTION_WEBHOOK_TOKEN não configurado");
    return new Response("Service Unavailable", { status: 503 });
  }

  // Lê corpo bruto antes de qualquer parse (necessário para HMAC)
  const rawBody = new Uint8Array(await req.arrayBuffer());

  // Verificação timing-safe do access token (evita timing attacks)
  if (!timingSafeCompare(req.headers.get("asaas-access-token") ?? "", WEBHOOK_TOKEN)) {
    console.warn("[subscriptions-webhook] token inválido");
    return new Response("Unauthorized", { status: 401 });
  }

  // HMAC-SHA256 do corpo — obrigatório (fail-secure).
  // Configurar ASAAS_SUBSCRIPTION_HMAC_SECRET em Supabase Secrets e na Asaas antes de deploy.
  if (!WEBHOOK_HMAC_SECRET) {
    console.error("[subscriptions-webhook] ASAAS_SUBSCRIPTION_HMAC_SECRET não configurado — serviço indisponível");
    return new Response("Service Unavailable", { status: 503 });
  }
  const sig = req.headers.get("x-asaas-hmac-sha256") ?? "";
  if (!sig) {
    console.warn("[subscriptions-webhook] HMAC ausente (x-asaas-hmac-sha256)");
    return new Response("Unauthorized", { status: 401 });
  }
  const valid = await verifyHmacSha256(WEBHOOK_HMAC_SECRET, rawBody, sig);
  if (!valid) {
    console.warn("[subscriptions-webhook] HMAC inválido");
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: AsaasPayload;
  try {
    body = JSON.parse(new TextDecoder().decode(rawBody)) as AsaasPayload;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { event, payment, subscription: subObj } = body;
  if (!event) return new Response("OK", { status: 200 });

  // Só processa eventos de subscription
  if (!event.startsWith("SUBSCRIPTION_") && !payment?.subscription) {
    return new Response("OK", { status: 200 });
  }

  const eventKey = payment?.id ?? subObj?.id ?? "unknown";
  const eventId  = `sub_${event}_${eventKey}`;

  // ── Deduplicação ──────────────────────────────────────────
  const { data: existing } = await admin
    .from("webhook_events")
    .select("id, status, retry_count")
    .eq("source", "asaas_subscriptions")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing?.status === "processed") return new Response("OK", { status: 200 });
  if (existing?.status === "dead_letter") return new Response("OK", { status: 200 });

  let eventRowId: string;
  if (!existing) {
    const { data: row, error } = await admin.from("webhook_events").insert({
      source: "asaas_subscriptions", event_id: eventId,
      event_type: event, payload: body, status: "processing",
    }).select("id").single();
    if (error || !row) return new Response("OK", { status: 200 });
    eventRowId = row.id;
  } else {
    eventRowId = existing.id;
    await admin.from("webhook_events")
      .update({ status: "processing", retry_count: (existing.retry_count ?? 0) + 1 })
      .eq("id", eventRowId);
  }

  try {
    // Resolve vendor_id
    const extRef   = payment?.externalReference ?? subObj?.externalReference;
    const asaasSub = payment?.subscription ?? subObj?.id;
    const vendorId = await resolveVendorId(admin, extRef, asaasSub);

    if (!vendorId) {
      console.warn(`[subscriptions-webhook] vendor not found for event ${event} extRef=${extRef}`);
      await admin.from("webhook_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("id", eventRowId);
      return new Response("OK", { status: 200 });
    }

    if (payment) payment.event = event;

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      await handleSubscriptionRenewed(admin, vendorId, payment);
    } else if (event === "PAYMENT_OVERDUE") {
      await handleSubscriptionOverdue(admin, vendorId, payment?.daysOverdue ?? 0);
    } else if (event === "SUBSCRIPTION_INACTIVATED") {
      await handleSubscriptionInactivated(admin, vendorId, event);
    } else if (event === "SUBSCRIPTION_DELETED") {
      await handleSubscriptionDeleted(admin, vendorId);
    }

    await admin.from("webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", eventRowId);

    console.log(`[subscriptions-webhook] OK ${event} → vendor=${vendorId}`);
    return new Response("OK", { status: 200 });

  } catch (err) {
    const errMsg     = err instanceof Error ? err.message : String(err);
    const retryCount = existing?.retry_count ?? 0;
    const nextStatus = retryCount >= MAX_RETRIES - 1 ? "dead_letter" : "failed";

    console.error(`[subscriptions-webhook] error (retry ${retryCount}) ${eventId}:`, errMsg);

    await admin.from("webhook_events")
      .update({ status: nextStatus, last_error: errMsg })
      .eq("id", eventRowId);

    return new Response("Error", { status: 500 });
  }
});
