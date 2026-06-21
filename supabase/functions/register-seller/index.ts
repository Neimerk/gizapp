import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://brasux.store",
  "https://shopping.brasux.com.br",
  "https://brasux.com.br",
  "https://brasux.vercel.app",
];

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
  const cors = req ? corsHeaders(req) : {};
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const { name, email, password } = await req.json() as {
      name: string;
      email: string;
      password: string;
    };

    // Validações básicas
    if (!name?.trim() || name.trim().length < 2)  return json({ error: "Nome inválido."          }, 400, req);
    if (!email?.includes("@"))                    return json({ error: "E-mail inválido."         }, 400, req);
    if (!password || password.length < 8)         return json({ error: "Senha mínima: 8 caracteres." }, 400, req);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Cria o usuário via admin (contorna email_confirm para UX mais fluido)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email:          email.trim().toLowerCase(),
      password,
      email_confirm:  true,   // confirma automaticamente — seller cadastrado direto
      user_metadata:  { name: name.trim() },
    });

    if (createErr) {
      const msg = createErr.message.includes("already registered")
        ? "Este e-mail já está cadastrado."
        : createErr.message;
      return json({ error: msg }, 409, req);
    }

    const userId = created.user.id;

    // Atualiza o profile para seller (o trigger cria como 'customer')
    await admin.from("profiles")
      .update({ role: "seller", name: name.trim() })
      .eq("id", userId);

    // Registra na auditoria
    await admin.from("audit_logs").insert({
      user_id:    userId,
      action:     "SELLER_REGISTRATION",
      table_name: "profiles",
      new_data:   { email: email.trim().toLowerCase(), name: name.trim() },
    });

    return json({ ok: true, userId }, 200, req);

  } catch (e) {
    console.error("[register-seller]", e);
    return json({ error: "Erro interno ao criar conta." }, 500, req);
  }
});
