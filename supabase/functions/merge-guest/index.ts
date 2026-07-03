import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, optionsResponse } from "../_shared/cors.ts";

// merge-guest — Merge atômico de sessão de convidado para conta autenticada.
//
// Fluxo:
//   1. Frontend cria conta (supabase.auth.signUp)
//   2. Frontend chama esta função com o guest_token + JWT da nova conta
//   3. Esta função transfere pedidos, endereços e dados do perfil
//
// Segurança:
//   - Requer JWT válido (conta recém-criada) + guest_token do localStorage
//   - RPC merge_guest_to_account executa em transação atômica no Postgres
//   - Rate limit: 3 tentativas por hora por usuário (evita força bruta)

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin          = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── 1. Valida JWT da conta recém-criada ──────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Autenticação necessária." }, 401, req);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Token inválido." }, 401, req);

    // ── 2. Extrai guest_token do body ────────────────────────
    const body = await req.json().catch(() => ({})) as { guestToken?: string };
    const guestToken = body.guestToken?.trim();
    if (!guestToken || guestToken.length < 32) {
      return json({ error: "guest_token inválido." }, 400, req);
    }

    // ── 3. Rate limit ────────────────────────────────────────
    const { data: allowed } = await admin.rpc("check_rate_limit", {
      p_key:            `merge_guest:${user.id}`,
      p_max_requests:   3,
      p_window_seconds: 3600,
    });
    if (!allowed) return json({ error: "Muitas tentativas. Aguarde um momento." }, 429, req);

    // ── 4. Executa merge atômico ─────────────────────────────
    const { data: result, error: mergeErr } = await admin.rpc("merge_guest_to_account", {
      p_guest_token: guestToken,
      p_user_id:     user.id,
    });

    if (mergeErr) {
      console.error("[merge-guest] rpc error:", mergeErr.message);
      return json({ error: "Erro ao realizar merge de conta." }, 500, req);
    }

    const r = result as { ok: boolean; error?: string; orders_merged: number; addresses_merged: number };

    if (!r.ok) {
      return json({ error: r.error ?? "Merge falhou." }, 422, req);
    }

    console.log(`[merge-guest] user=${user.id} orders=${r.orders_merged} addresses=${r.addresses_merged}`);

    return json({
      ok:               true,
      ordersMerged:     r.orders_merged,
      addressesMerged:  r.addresses_merged,
    }, 200, req);

  } catch (e) {
    console.error("[merge-guest]", e);
    return json({ error: "Erro interno." }, 500, req);
  }
});
