import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, optionsResponse } from "../_shared/cors.ts";

/**
 * courier-payment
 * Credita ganho estruturado ao entregador após conclusão de entrega.
 * Chamado internamente por release-balance ou diretamente pelo app de entregas.
 *
 * POST { deliveryId, orderId?, amount?, description? }
 * Requer JWT de entregador (role=courier) ou x-internal-key.
 */

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_KEY   = Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405, req);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Autenticação: aceita x-internal-key ou JWT de courier
  const internalKey = req.headers.get("x-internal-key");
  let courierId: string | null = null;

  if (internalKey) {
    if (!INTERNAL_KEY || internalKey !== INTERNAL_KEY) {
      return json({ error: "Unauthorized." }, 401, req);
    }
    // Caller interno deve fornecer courierId no body
  } else {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401, req);

    const anonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Token inválido." }, 401, req);

    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "courier") return json({ error: "Apenas entregadores." }, 403, req);

    courierId = user.id;
  }

  let body: {
    deliveryId: string;
    orderId?: string;
    courierId?: string;
    amount?: number;
    platformFee?: number;
    bonusAmount?: number;
    description?: string;
    type?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido." }, 400, req);
  }

  if (!body.deliveryId) return json({ error: "deliveryId obrigatório." }, 400, req);

  // Se vier do caller interno, usa o courierId do body
  if (!courierId) {
    if (!body.courierId) return json({ error: "courierId obrigatório (chamada interna)." }, 400, req);
    courierId = body.courierId;
  }

  try {
    // Busca entrega para validar e obter dados se amount não informado
    const { data: delivery } = await admin
      .from("deliveries")
      .select("id, courier_id, order_id, earnings, status")
      .eq("id", body.deliveryId)
      .single();

    if (!delivery) return json({ error: "Entrega não encontrada." }, 404, req);
    if (delivery.courier_id !== courierId) return json({ error: "Entrega não pertence a este entregador." }, 403, req);

    const amount      = body.amount ?? Number(delivery.earnings ?? 0);
    const orderId     = body.orderId ?? delivery.order_id;
    const description = body.description ?? `Entrega #${(orderId as string ?? body.deliveryId).slice(0, 8).toUpperCase()}`;

    // Verifica se já existe ganho para esta entrega (idempotência)
    const { data: existing } = await admin
      .from("courier_earnings")
      .select("id")
      .eq("delivery_id", body.deliveryId)
      .maybeSingle();

    if (existing?.id) {
      return json({ ok: true, earningId: existing.id, duplicate: true }, 200, req);
    }

    // Insere ganho
    const { data: earning, error: insertErr } = await admin
      .from("courier_earnings")
      .insert({
        courier_id:   courierId,
        delivery_id:  body.deliveryId,
        order_id:     orderId ?? null,
        amount,
        platform_fee: body.platformFee ?? 0,
        bonus_amount: body.bonusAmount ?? 0,
        description,
        type:         body.type ?? "delivery",
        status:       "available",
      })
      .select("id")
      .single();

    if (insertErr || !earning) {
      throw new Error(insertErr?.message ?? "Falha ao registrar ganho.");
    }

    // Credita na wallet do entregador via RPC (se existir)
    await admin.rpc("credit_courier_earning", {
      p_courier_id:  courierId,
      p_earning_id:  earning.id,
      p_amount:      amount,
      p_description: description,
    }).catch(() => null); // RPC opcional — não bloqueia se não existir

    await admin.rpc("log_financial_event", {
      p_actor_type:  "system",
      p_actor_id:    courierId,
      p_action:      "courier_earning_credited",
      p_entity_type: "courier_earnings",
      p_entity_id:   earning.id,
      p_amount:      amount,
      p_description: description,
      p_metadata:    { delivery_id: body.deliveryId, order_id: orderId },
    }).catch(() => null);

    console.log(`[courier-payment] courier=${courierId} delivery=${body.deliveryId} amount=${amount}`);
    return json({ ok: true, earningId: earning.id, amount }, 200, req);

  } catch (e) {
    console.error("[courier-payment]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500, req);
  }
});
