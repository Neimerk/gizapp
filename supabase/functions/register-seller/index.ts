import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, optionsResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const { name, email, password } = await req.json() as {
      name: string; email: string; password: string;
    };

    if (!name?.trim() || name.trim().length < 2)
      return json({ error: "Nome inválido." }, 400, req);
    if (!email?.includes("@"))
      return json({ error: "E-mail inválido." }, 400, req);
    if (!password || password.length < 8)
      return json({ error: "Senha mínima: 8 caracteres." }, 400, req);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── 1. Cria usuário ───────────────────────────────────────
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email:         email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { name: name.trim() },
    });

    if (createErr) {
      const msg = createErr.message.includes("already registered")
        ? "Este e-mail já está cadastrado."
        : createErr.message;
      return json({ error: msg }, 409, req);
    }

    const userId = created.user.id;

    // ── 2. Atualiza profile para seller ──────────────────────
    await admin.from("profiles")
      .update({ role: "seller", name: name.trim() })
      .eq("id", userId);

    // ── 3. Cria carteira do vendedor ──────────────────────────
    await admin.rpc("get_or_create_wallet", {
      p_owner_id:    userId,
      p_wallet_type: "vendor",
    }).catch((e: Error) => {
      console.warn("[register-seller] wallet creation failed:", e.message);
    });

    // ── 4. Cria assinatura free ───────────────────────────────
    const { error: subErr } = await admin.from("subscriptions").upsert(
      {
        vendor_id:       userId,
        plan:            "free",
        monthly_price:   0.00,
        commission_rate: 0.12,
        status:          "active",
        updated_at:      new Date().toISOString(),
      },
      { onConflict: "vendor_id" },
    );

    if (subErr) {
      console.warn("[register-seller] subscription upsert failed:", subErr.message);
    }

    // ── 5. Registra evento de plano ───────────────────────────
    await admin.from("subscription_events").insert({
      vendor_id:    userId,
      from_plan:    null,
      to_plan:      "free",
      to_status:    "active",
      reason:       "Cadastro inicial",
      triggered_by: "system",
    }).catch(() => null);

    // ── 6. Auditoria ──────────────────────────────────────────
    await admin.from("audit_logs").insert({
      user_id:    userId,
      action:     "SELLER_REGISTRATION",
      table_name: "profiles",
      new_data:   { email: email.trim().toLowerCase(), name: name.trim(), role: "seller" },
    }).catch(() => null);

    await admin.rpc("log_financial_event", {
      p_actor_type:  "system",
      p_actor_id:    userId,
      p_action:      "seller_registered",
      p_entity_type: "profiles",
      p_entity_id:   null,
      p_amount:      null,
      p_description: `Vendedor cadastrado: ${name.trim()}`,
      p_metadata:    { email: email.trim().toLowerCase() },
    }).catch(() => null);

    console.log(`[register-seller] ok userId=${userId} plan=free`);
    return json({ ok: true, userId }, 200, req);

  } catch (e) {
    console.error("[register-seller]", e);
    return json({ error: "Erro interno ao criar conta." }, 500, req);
  }
});
