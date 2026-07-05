import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
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
  const cors = req ? corsHeaders(req) : { "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0] };
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401, req);

    // Valida o JWT do usuário
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Token inválido." }, 401, req);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Anonimiza o perfil antes de deletar (preserva integridade referencial)
    await admin.from("profiles").update({
      name:               "Usuário Removido",
      phone:              null,
      cpf:                null,
      zip_code:           null,
      address:            null,
      address_number:     null,
      address_complement: null,
      neighborhood:       null,
    }).eq("id", user.id);

    // Remove endereços salvos, favoritos e subscriptions de push
    await Promise.all([
      admin.from("saved_addresses").delete().eq("user_id", user.id),
      admin.from("favorites").delete().eq("user_id", user.id),
      admin.from("push_subscriptions").delete().eq("user_id", user.id),
    ]);

    // Registra na auditoria antes de deletar
    await admin.from("audit_logs").insert({
      user_id:    user.id,
      action:     "ACCOUNT_DELETION",
      table_name: "auth",
      new_data:   { email_hash: user.email ? btoa(user.email).slice(0, 16) : null },
    });

    // Deleta o usuário do Supabase Auth (CASCADE deleta o profile)
    const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
    if (deleteErr) return json({ error: "Erro ao excluir conta." }, 500, req);

    return json({ ok: true }, 200, req);
  } catch (e) {
    console.error("[delete-account]", e);
    return json({ error: "Erro interno." }, 500, req);
  }
});
