import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://loja.brasux.com.br",
  "https://brasux-loja.vercel.app",
  "https://brasux.com.br",
  "http://localhost:5174",
];

const PLAN_PRICES: Record<string, number> = {
  free:       0,
  start:      49,
  pro:        99,
  whitelabel: 0, // Negociado manualmente
};

const PLAN_COMMISSION: Record<string, number> = {
  free:       0.12, // 12%
  start:      0.09, // 9%
  pro:        0.07, // 7%
  whitelabel: 0.05, // 5%
};

function corsHeaders(req: Request) {
  const origin  = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function json(data: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...(req ? corsHeaders(req) : {}), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405, req);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401, req);

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Valida JWT do vendedor
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Token inválido." }, 401, req);

  try {
    const { planId } = await req.json() as { planId: string };

    const validPlans = ["free", "start", "pro", "whitelabel"];
    if (!planId || !validPlans.includes(planId)) {
      return json({ error: `planId inválido. Use: ${validPlans.join(", ")}` }, 400, req);
    }

    if (planId === "whitelabel") {
      return json({ error: "O plano White Label requer negociação direta com a equipe BrasUX." }, 422, req);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const monthlyPrice    = PLAN_PRICES[planId] ?? 0;
    const commissionRate  = PLAN_COMMISSION[planId] ?? 0.12;
    const status          = "active";
    const nextBillingDate = monthlyPrice > 0
      ? new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0]
      : null;

    const { error: upsertErr } = await admin.from("subscriptions").upsert(
      {
        vendor_id:          user.id,
        plan:               planId,
        monthly_price:      monthlyPrice,
        commission_rate:    commissionRate,
        status,
        next_billing_date:  nextBillingDate,
        updated_at:         new Date().toISOString(),
      },
      { onConflict: "vendor_id" },
    );

    if (upsertErr) {
      console.error("[create-subscription] upsert error:", upsertErr.message);
      return json({ error: "Erro ao atualizar assinatura." }, 500, req);
    }

    await admin.rpc("log_financial_event", {
      p_actor_type:  "vendor",
      p_actor_id:    user.id,
      p_action:      "subscription_changed",
      p_entity_type: "subscriptions",
      p_entity_id:   null,
      p_amount:      monthlyPrice,
      p_description: `Plano alterado para ${planId}`,
      p_metadata:    { plan: planId, monthly_price: monthlyPrice },
    }).catch(() => null);

    console.log(`[create-subscription] vendor=${user.id} plan=${planId}`);
    return json({ ok: true, plan: planId, monthlyPrice }, 200, req);

  } catch (e) {
    console.error("[create-subscription] error:", e);
    return json({ error: "Erro interno." }, 500, req);
  }
});
