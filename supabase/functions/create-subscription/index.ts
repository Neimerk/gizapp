import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, optionsResponse } from "../_shared/cors.ts";

const ASAAS_BASE = Deno.env.get("ASAAS_API_URL") ?? "https://sandbox.asaas.com/api/v3";
const ASAAS_KEY  = Deno.env.get("ASAAS_API_KEY") ?? "";

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

// Preços e comissões — fonte única (espelha vendor_plans no banco)
const PLAN_CFG: Record<string, { price: number; commission: number; label: string }> = {
  free:       { price: 0,      commission: 0.08, label: "Gratuito"    },
  start:      { price: 49.90,  commission: 0.05, label: "Básico"      },
  pro:        { price: 99.90,  commission: 0.03, label: "Premium"     },
  whitelabel: { price: 199.90, commission: 0.00, label: "White Label" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405, req);

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
    const { planId } = await req.json() as { planId: string };

    const validPlans = Object.keys(PLAN_CFG);
    if (!planId || !validPlans.includes(planId)) {
      return json({ error: `planId inválido. Use: ${validPlans.join(", ")}` }, 400, req);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const cfg   = PLAN_CFG[planId];

    // ── Busca assinatura e perfil atuais ──────────────────────
    const [subRes, profileRes] = await Promise.all([
      admin.from("subscriptions").select("*").eq("vendor_id", user.id).maybeSingle(),
      admin.from("profiles").select("name, cpf, asaas_customer_id").eq("id", user.id).single(),
    ]);

    const currentSub = subRes.data;

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

    // ── 4. Atualiza DB com pendente de pagamento ──────────────
    const nextBilling = nextDueDateStr(30);
    await admin.from("subscriptions").upsert(
      {
        vendor_id:              user.id,
        plan:                   planId,
        monthly_price:          cfg.price,
        commission_rate:        cfg.commission,
        status:                 "trial",   // ativa em "trial" até webhook confirmar pagamento
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
      to_status:    "trial",
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
