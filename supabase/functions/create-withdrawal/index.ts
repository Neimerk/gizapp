import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, optionsResponse } from "../_shared/cors.ts";

/**
 * create-withdrawal
 * Autenticado: vendedor ou entregador solicita saque via Pix.
 * Valida saldo disponível atomicamente via Postgres function.
 */
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

    // Rate limit: 3 saques por hora
    const { data: allowed } = await admin.rpc("check_rate_limit", {
      p_key:            `withdrawal:${user.id}`,
      p_max_requests:   3,
      p_window_seconds: 3600,
    });
    if (!allowed) return json({ error: "Muitas solicitações. Aguarde antes de tentar novamente." }, 429, req);

    // Valida perfil e role
    const { data: profile } = await admin
      .from("profiles")
      .select("role, name")
      .eq("id", user.id)
      .single();

    if (!profile || !["seller", "courier"].includes(profile.role)) {
      return json({ error: "Apenas vendedores e entregadores podem solicitar saques." }, 403, req);
    }

    const body = await req.json() as {
      amount:      number;
      pixKey:      string;
      pixKeyType?: string;
    };

    const amount      = Number(body.amount);
    const pixKey      = String(body.pixKey ?? "").trim();
    const pixKeyType  = (body.pixKeyType ?? "cpf") as string;

    if (!isFinite(amount) || amount < 10) {
      return json({ error: "Valor mínimo para saque é R$ 10,00." }, 400, req);
    }
    if (!pixKey) {
      return json({ error: "Chave Pix obrigatória." }, 400, req);
    }

    const validKeyTypes = ["cpf","cnpj","email","phone","random"];
    if (!validKeyTypes.includes(pixKeyType)) {
      return json({ error: "Tipo de chave Pix inválido." }, 400, req);
    }

    const ownerType = profile.role === "seller" ? "vendor" : "courier";
    const walletType = ownerType as "vendor" | "courier";

    // Busca ou cria carteira
    let walletId: string;
    const { data: existingWallet } = await admin
      .from("wallets")
      .select("id")
      .eq("owner_id", user.id)
      .eq("wallet_type", walletType)
      .maybeSingle();

    if (existingWallet) {
      walletId = existingWallet.id as string;
    } else {
      const { data: newWallet, error: wErr } = await admin
        .from("wallets")
        .insert({ owner_id: user.id, wallet_type: walletType })
        .select("id")
        .single();
      if (wErr || !newWallet) return json({ error: "Erro ao acessar carteira." }, 500, req);
      walletId = newWallet.id as string;
    }

    // Solicita saque via função atômica
    const { data: withdrawalId, error: wdErr } = await admin.rpc("request_withdrawal", {
      p_wallet_id:    walletId,
      p_owner_id:     user.id,
      p_owner_type:   ownerType,
      p_amount:       amount,
      p_pix_key:      pixKey,
      p_pix_key_type: pixKeyType,
    });

    if (wdErr) {
      const msg = wdErr.message.includes("INSUFFICIENT_BALANCE")
        ? "Saldo disponível insuficiente."
        : wdErr.message.includes("MINIMUM_AMOUNT")
          ? "Valor mínimo para saque é R$ 10,00."
          : wdErr.message.includes("WALLET_NOT_OWNED")
            ? "Carteira inválida."
            : "Erro ao solicitar saque.";
      return json({ error: msg }, 422, req);
    }

    console.log(`[create-withdrawal] user=${user.id} amount=${amount} withdrawal=${withdrawalId}`);

    return json({
      ok:          true,
      withdrawalId: withdrawalId as string,
      message:     `Saque de R$ ${amount.toFixed(2).replace(".", ",")} solicitado. Processamos em até 24h úteis.`,
    }, 201, req);

  } catch (e) {
    console.error("[create-withdrawal]", e);
    return json({ error: "Erro interno." }, 500, req);
  }
});
