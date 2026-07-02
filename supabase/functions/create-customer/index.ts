import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, optionsResponse } from "../_shared/cors.ts";
import { requireAsaasBase } from "../_shared/asaas.ts";

/**
 * create-customer
 * Cria ou retorna cliente no Asaas para o usuário autenticado.
 * Salva asaas_customer_id em profiles para uso futuro.
 * Chamada por asaas-create-charge e create-subscription automaticamente,
 * mas pode ser chamada explicitamente durante onboarding.
 */

const ASAAS_BASE_RAW = requireAsaasBase("create-customer");
const ASAAS_BASE     = ASAAS_BASE_RAW ?? "";
const ASAAS_KEY      = Deno.env.get("ASAAS_API_KEY") ?? "";

async function asaas(path: string, method = "GET", body?: unknown) {
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
    const msg = data?.errors?.[0]?.description ?? data?.message ?? "Erro Asaas";
    throw new Error(msg);
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405, req);
  if (!ASAAS_BASE_RAW) return new Response("Service Unavailable", { status: 503 });

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

    // Verifica se já tem customer_id
    const { data: profile } = await admin
      .from("profiles")
      .select("name, cpf, phone, asaas_customer_id")
      .eq("id", user.id)
      .single();

    if (profile?.asaas_customer_id) {
      // Valida que ainda existe no Asaas
      try {
        const existing = await asaas(`/customers/${profile.asaas_customer_id}`);
        return json({ ok: true, asaasCustomerId: existing.id, isNew: false }, 200, req);
      } catch {
        // Customer removido do Asaas — recria
      }
    }

    // Lê dados do body (opcionais — usa profile como fallback)
    const body = await req.json().catch(() => ({})) as {
      cpfCnpj?: string; phone?: string; name?: string;
    };

    const rawCpf = (body.cpfCnpj ?? profile?.cpf ?? "").replace(/\D/g, "");
    const rawPhone = (body.phone ?? profile?.phone ?? "").replace(/\D/g, "");
    const name = (body.name ?? profile?.name ?? user.email ?? "").trim();

    if (!name) return json({ error: "Nome é obrigatório." }, 400, req);

    // Verifica se já existe cliente com esse CPF/email no Asaas antes de criar
    if (rawCpf) {
      try {
        const search = await asaas(`/customers?cpfCnpj=${rawCpf}&limit=1`);
        if (search?.data?.[0]?.id) {
          const customerId = search.data[0].id;
          await admin.from("profiles").update({ asaas_customer_id: customerId }).eq("id", user.id);
          return json({ ok: true, asaasCustomerId: customerId, isNew: false }, 200, req);
        }
      } catch { /* ignora erro de busca */ }
    }

    // Cria novo cliente no Asaas
    const customer = await asaas("/customers", "POST", {
      name,
      email:             user.email,
      cpfCnpj:           rawCpf || undefined,
      phone:             rawPhone || undefined,
      externalReference: user.id,
    });

    // Salva no profile
    await admin.from("profiles")
      .update({ asaas_customer_id: customer.id })
      .eq("id", user.id);

    await admin.rpc("log_financial_event", {
      p_actor_type:  "system",
      p_actor_id:    user.id,
      p_action:      "asaas_customer_created",
      p_entity_type: "profiles",
      p_entity_id:   null,
      p_description: `Cliente Asaas criado: ${customer.id}`,
      p_metadata:    { asaas_customer_id: customer.id },
    }).catch(() => null);

    console.log(`[create-customer] userId=${user.id} asaasId=${customer.id}`);
    return json({ ok: true, asaasCustomerId: customer.id, isNew: true }, 200, req);

  } catch (e) {
    console.error("[create-customer]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500, req);
  }
});
