import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, optionsResponse } from "../_shared/cors.ts";

/**
 * create-asaas-account
 * Cria (ou atualiza) uma conta Asaas Marketplace para o lojista autenticado.
 * A conta é uma subconta vinculada ao marketplace BrasUX, permitindo split de pagamentos.
 *
 * Idempotente: se já existe uma subconta para o owner_id, retorna os dados atuais
 * sem criar uma nova conta na Asaas.
 */

const ASAAS_BASE = Deno.env.get("ASAAS_API_URL") ?? "https://sandbox.asaas.com/api/v3";
const ASAAS_KEY  = Deno.env.get("ASAAS_API_KEY") ?? "";

interface AsaasSubaccountPayload {
  name:          string;
  email:         string;
  cpfCnpj:       string;
  birthDate?:    string;
  companyType?:  "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
  phone?:        string;
  mobilePhone?:  string;
  address?:      string;
  addressNumber?: string;
  complement?:   string;
  province?:     string;   // bairro
  postalCode?:   string;
}

interface AsaasSubaccountResponse {
  id:             string;   // walletId no Asaas Marketplace
  accountNumber?: { agency: string; account: string; accountDigit: string };
  name?:          string;
  email?:         string;
  cpfCnpj?:       string;
  walletId?:      string;
  apiKey?:        string;
}

async function asaasFetch(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": ASAAS_KEY,
      "User-Agent":   "BrasUX/2.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? data?.message ?? `Erro Asaas ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405, req);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401, req);

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Identifica o usuário pelo JWT
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Token inválido." }, 401, req);

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json() as {
      name: string; email: string; cpfCnpj: string;
      phone?: string; postalCode?: string;
      address?: string; addressNumber?: string; province?: string;
    };

    // Valida campos obrigatórios
    if (!body.name?.trim())    return json({ error: "Nome é obrigatório."    }, 400, req);
    if (!body.email?.trim())   return json({ error: "E-mail é obrigatório."  }, 400, req);
    if (!body.cpfCnpj?.trim()) return json({ error: "CPF/CNPJ é obrigatório."}, 400, req);

    const cpfCnpj = body.cpfCnpj.replace(/\D/g, "");

    // ── Idempotência: verifica se já existe subconta para este vendor ────────
    const { data: existing } = await admin
      .from("asaas_subaccounts")
      .select("asaas_account_id, asaas_wallet_id, kyc_status, split_enabled")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (existing?.asaas_account_id) {
      return json({
        ok:         true,
        alreadyExists: true,
        accountId:  existing.asaas_account_id,
        walletId:   existing.asaas_wallet_id,
        kycStatus:  existing.kyc_status,
        splitEnabled: existing.split_enabled,
      }, 200, req);
    }

    // ── Cria subconta no Asaas ───────────────────────────────────────────────
    const payload: AsaasSubaccountPayload = {
      name:          body.name.trim(),
      email:         body.email.trim().toLowerCase(),
      cpfCnpj,
      phone:         body.phone?.replace(/\D/g, "") || undefined,
      mobilePhone:   body.phone?.replace(/\D/g, "") || undefined,
      postalCode:    body.postalCode?.replace(/\D/g, "") || undefined,
      address:       body.address?.trim() || undefined,
      addressNumber: body.addressNumber?.trim() || undefined,
      province:      body.province?.trim() || undefined,
      companyType:   cpfCnpj.length === 14 ? "MEI" : undefined,
    };

    const asaasRes: AsaasSubaccountResponse = await asaasFetch(
      "/accounts",
      "POST",
      payload,
    );

    // O Asaas retorna `id` como walletId da subconta e `apiKey` como chave de acesso
    const accountId = asaasRes.walletId ?? asaasRes.id;
    const walletId  = asaasRes.id;

    // ── Persiste no banco ────────────────────────────────────────────────────
    const { error: upsertErr } = await admin
      .from("asaas_subaccounts")
      .upsert({
        owner_id:     user.id,
        owner_type:   "vendor",
        asaas_account_id: accountId,
        asaas_wallet_id:  walletId,
        cpf_cnpj:     cpfCnpj,
        account_name: body.name.trim(),
        email:        body.email.trim().toLowerCase(),
        kyc_status:   "pending",
        split_enabled: false,
        raw_response: asaasRes,
        updated_at:   new Date().toISOString(),
      }, { onConflict: "owner_id" });

    if (upsertErr) throw new Error(upsertErr.message);

    return json({
      ok:           true,
      accountId,
      walletId,
      kycStatus:    "pending",
      splitEnabled: false,
    }, 201, req);

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("[create-asaas-account]", msg);
    return json({ ok: false, error: msg }, 500, req);
  }
});
