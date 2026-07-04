import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, optionsResponse } from "../_shared/cors.ts";
import { requireAsaasBase } from "../_shared/asaas.ts";

const ASAAS_BASE_RAW = requireAsaasBase("create-subscription");
const ASAAS_BASE     = ASAAS_BASE_RAW ?? "";
const ASAAS_KEY      = Deno.env.get("ASAAS_API_KEY") ?? "";

async function asaas(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": ASAAS_KEY,
      "User-Agent":   "BrasUX-Loja/2.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? data?.message ?? "Erro Asaas";
    throw new Error(msg);
  }
  return data;
}

function nextDueDateStr(daysFromNow = 1): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().split("T")[0];
}

// Aliases de UI → slug canônico do banco (brasux-loja usa "basico"/"premium")
const PLAN_ALIASES: Record<string, string> = {
  basico:   "start",
  premium:  "pro",
};

// Fallback para quando o banco não retorna vendor_plans (ex: cold start com DB indisponível)
const FALLBACK_CFG: Record<string, { price: number; label: string }> = {
  free:       { price: 0,      label: "Gratuito"    },
  start:      { price: 49.90,  label: "Básico"      },
  pro:        { price: 99.90,  label: "Premium"     },
  whitelabel: { price: 199.90, label: "White Label" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405, req);
  if (!ASAAS_BASE_RAW) return new Response("Service Unavailable", { status: 503 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401, req);

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Token inválido." }, 401, req);

  try {
    const { planId: rawPlanId } = await req.json() as { planId: string };

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Rate limit: 1 tentativa de criar/alterar assinatura por 30 segundos
    const { data: subAllowed } = await admin.rpc("check_rate_limit", {
      p_key:            `subscription:${user.id}`,
      p_max_requests:   1,
      p_window_seconds: 30,
    });
    if (!subAllowed) {
      return json({ error: "Aguarde alguns segundos antes de tentar novamente." }, 429, req);
    }

    // P2-9: preços lidos do banco (fonte única); fallback para hardcoded se DB falhar
    const planCfg = { ...FALLBACK_CFG };
    try {
      const { data: planRows } = await admin
        .from("vendor_plans")
        .select("id, label, monthly_price");
      if (planRows?.length) {
        for (const row of planRows) {
          planCfg[row.id as string] = {
            price: Number(row.monthly_price),
            label: row.label as string,
          };
        }
      }
    } catch {
      console.warn("[create-subscription] vendor_plans inacessível — usando preços hardcoded");
    }

    // Normaliza aliases de UI ("basico" → "start", "premium" → "pro")
    const planId = PLAN_ALIASES[rawPlanId] ?? rawPlanId;

    const validPlans = Object.keys(planCfg);
    if (!planId || !validPlans.includes(planId)) {
      return json({ error: `planId inválido. Use: ${validPlans.join(", ")}` }, 400, req);
    }

    const cfg = planCfg[planId];

    // ── Busca assinatura e perfil atuais ──────────────────────
    const [subRes, profileRes] = await Promise.all([
      admin.from("subscriptions").select("*").eq("vendor_id", user.id).maybeSingle(),
      admin.from("profiles").select("name, cpf, asaas_customer_id").eq("id", user.id).single(),
    ]);

    const currentSub = subRes.data;

    // Idempotência: se já há pending_payment para o MESMO plano, retorna sem criar nova assinatura.
    // Evita duplicidade no Asaas em caso de double-click ou retry rápido.
    if (currentSub?.status === "pending_payment" && currentSub?.plan === planId) {
      console.log(`[create-subscription] vendor=${user.id} plan=${planId} já em pending_payment — retornando sem criar nova assinatura`);
      return json({
        ok:           true,
        plan:         planId,
        monthlyPrice: cfg.price,
        activated:    false,
        message:      "Aguardando confirmação do pagamento. Verifique o PIX gerado anteriormente.",
      }, 200, req);
    }

    // ── Plano free: ativa imediatamente sem Asaas ─────────────
    if (planId === "free") {
      // Cancela assinatura Asaas se existia uma paga
      if (currentSub?.asaas_subscription_id && ASAAS_KEY) {
        await asaas(`/subscriptions/${currentSub.asaas_subscription_id}`, "DELETE").catch(() => null);
      }

      await admin.rpc("change_subscription_plan", {
        p_vendor_id:   user.id,
        p_to_plan:     "free",
        p_to_status:   "active",
        p_reason:      "Downgrade para plano gratuito",
        p_triggered:   "vendor",
        p_metadata:    { from_plan: currentSub?.plan ?? null },
      });

      console.log(`[create-subscription] vendor=${user.id} plan=free (no asaas)`);
      return json({ ok: true, plan: "free", monthlyPrice: 0, activated: true }, 200, req);
    }

    // ── Planos pagos: integração com Asaas ───────────────────
    if (!ASAAS_KEY) {
      // Modo dev/sandbox sem chave: ativa diretamente
      await admin.rpc("change_subscription_plan", {
        p_vendor_id: user.id,
        p_to_plan:   planId,
        p_to_status: "active",
        p_reason:    "Ativação em modo dev (sem chave Asaas)",
        p_triggered: "system",
      });
      return json({ ok: true, plan: planId, monthlyPrice: cfg.price, activated: true, devMode: true }, 200, req);
    }

    // ── 1. Obtém/cria cliente Asaas ───────────────────────────
    let asaasCustomerId: string = profileRes.data?.asaas_customer_id ?? "";

    if (!asaasCustomerId) {
      const rawCpf = (profileRes.data?.cpf ?? "").replace(/\D/g, "");
      const customer = await asaas("/customers", "POST", {
        name:              profileRes.data?.name ?? user.email,
        email:             user.email,
        cpfCnpj:           rawCpf || undefined,
        externalReference: user.id,
      });
      asaasCustomerId = customer.id;
      await admin.from("profiles").update({ asaas_customer_id: customer.id }).eq("id", user.id);
    }

    // ── 2. Cancela assinatura anterior no Asaas (se existir) ─
    if (currentSub?.asaas_subscription_id) {
      await asaas(`/subscriptions/${currentSub.asaas_subscription_id}`, "DELETE").catch(() => null);
    }

    // ── 3. Cria nova assinatura no Asaas ──────────────────────
    const subscription = await asaas("/subscriptions", "POST", {
      customer:          asaasCustomerId,
      billingType:       "PIX",
      value:             cfg.price,
      nextDueDate:       nextDueDateStr(1),
      cycle:             "MONTHLY",
      description:       `BrasUX Plano ${cfg.label}`,
      externalReference: user.id,
    });

    const asaasSubId = subscription.id as string;

    // ── 4. Atualiza DB aguardando confirmação de pagamento ────
    // Status 'pending_payment': acesso bloqueado até webhook PAYMENT_CONFIRMED.
    // O webhook chama handleSubscriptionRenewed que avança para 'active'.
    const nextBilling = nextDueDateStr(30);
    await admin.from("subscriptions").upsert(
      {
        vendor_id:              user.id,
        plan:                   planId,
        monthly_price:          cfg.price,
        commission_rate:        0,
        status:                 "pending_payment",
        next_billing_date:      nextBilling,
        asaas_subscription_id:  asaasSubId,
        asaas_customer_id:      asaasCustomerId,
        billing_cycle:          "MONTHLY",
        updated_at:             new Date().toISOString(),
      },
      { onConflict: "vendor_id" },
    );

    // Registra evento de plano
    await admin.from("subscription_events").insert({
      vendor_id:    user.id,
      from_plan:    currentSub?.plan ?? null,
      to_plan:      planId,
      from_status:  currentSub?.status ?? null,
      to_status:    "pending_payment",
      reason:       "Upgrade via create-subscription",
      triggered_by: "vendor",
      metadata:     { asaas_subscription_id: asaasSubId },
    }).catch(() => null);

    // ── 5. Busca a primeira cobrança gerada pelo Asaas ────────
    let firstPayment: Record<string, unknown> | null = null;
    try {
      const payments = await asaas(`/subscriptions/${asaasSubId}/payments?limit=1`);
      const charge   = payments?.data?.[0];
      if (charge?.id) {
        const pix = await asaas(`/payments/${charge.id}/pixQrCode`);
        firstPayment = {
          paymentId:      charge.id,
          billingType:    "PIX",
          value:          charge.value,
          dueDate:        charge.dueDate,
          pixQrCode:      pix.encodedImage,
          pixCode:        pix.payload,
          expirationDate: pix.expirationDate,
        };
      }
    } catch (e) {
      console.warn("[create-subscription] failed to fetch first payment:", e);
    }

    await admin.rpc("log_financial_event", {
      p_actor_type:  "vendor",
      p_actor_id:    user.id,
      p_action:      "subscription_created",
      p_entity_type: "subscriptions",
      p_entity_id:   null,
      p_amount:      cfg.price,
      p_description: `Assinatura ${cfg.label} criada no Asaas`,
      p_metadata:    { asaas_subscription_id: asaasSubId, plan: planId },
    }).catch(() => null);

    console.log(`[create-subscription] vendor=${user.id} plan=${planId} asaas=${asaasSubId}`);

    return json({
      ok:             true,
      plan:           planId,
      monthlyPrice:   cfg.price,
      activated:      false,    // ativa apenas após webhook de pagamento confirmado
      asaasSubId,
      firstPayment,
      message:        `Plano ${cfg.label} criado. Pague o PIX abaixo para ativar.`,
    }, 200, req);

  } catch (e) {
    console.error("[create-subscription]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500, req);
  }
});
