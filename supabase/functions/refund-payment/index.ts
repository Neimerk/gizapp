import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, optionsResponse } from "../_shared/cors.ts";
import { requireAsaasBase } from "../_shared/asaas.ts";

const ASAAS_BASE_RAW = requireAsaasBase("refund-payment");
const ASAAS_BASE     = ASAAS_BASE_RAW ?? "";
const ASAAS_KEY      = Deno.env.get("ASAAS_API_KEY") ?? "";

async function asaasRefund(externalId: string, value?: number): Promise<{ refundId: string }> {
  const res = await fetch(`${ASAAS_BASE}/payments/${externalId}/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "access_token": ASAAS_KEY,
      "User-Agent": "BrasUX-Shopping/1.0",
    },
    body: value ? JSON.stringify({ value }) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? data?.message ?? "Erro ao estornar no gateway";
    throw new Error(msg);
  }
  return { refundId: data.id ?? `REF_${Date.now()}` };
}

/**
 * refund-payment
 * Admin-only: estorna um pagamento e reverte o split financeiro.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
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

    // Apenas admins
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return json({ error: "Permissão negada." }, 403, req);
    }

    const body = await req.json() as {
      orderId:     string;
      reason:      string;
      refundType?: "full" | "partial";
      amount?:     number;
      absorbedBy?: "vendor" | "courier" | "brasux" | "shared";
    };

    const { orderId, reason } = body;
    const refundType  = body.refundType ?? "full";
    const absorbedBy  = body.absorbedBy ?? "brasux";

    if (!orderId || !reason?.trim()) {
      return json({ error: "orderId e reason são obrigatórios." }, 400, req);
    }

    // Busca pagamento do pedido
    const { data: payment } = await admin
      .from("payments")
      .select("id, external_id, amount, status")
      .eq("order_id", orderId)
      .single();

    if (!payment) return json({ error: "Pagamento não encontrado." }, 404, req);
    if (payment.status === "refunded") return json({ error: "Pagamento já estornado." }, 409, req);
    if (!["approved", "partially_refunded"].includes(payment.status as string)) {
      return json({ error: "Só é possível estornar pagamentos aprovados ou parcialmente estornados." }, 409, req);
    }

    const refundAmount = refundType === "partial" && body.amount
      ? Math.min(Number(body.amount), Number(payment.amount))
      : Number(payment.amount);

    // P1-7: verifica acumulado de estornos anteriores para evitar over-refund
    const { data: existingRefunds } = await admin
      .from("refunds")
      .select("amount")
      .eq("payment_id", payment.id)
      .neq("status", "failed");

    const alreadyRefunded = (existingRefunds ?? []).reduce(
      (sum: number, r: { amount: unknown }) => sum + Number(r.amount),
      0,
    );

    if (alreadyRefunded + refundAmount > Number(payment.amount) + 0.01) {
      return json({
        error: `Valor excede o limite disponível para estorno. Já estornado: R$ ${alreadyRefunded.toFixed(2).replace(".", ",")}. Disponível: R$ ${(Number(payment.amount) - alreadyRefunded).toFixed(2).replace(".", ",")}.`,
      }, 422, req);
    }

    // Chama estorno no gateway
    let gatewayRefundId = `MANUAL_${Date.now()}`;
    if (payment.external_id && ASAAS_KEY) {
      try {
        const result = await asaasRefund(
          payment.external_id as string,
          refundType === "partial" ? refundAmount : undefined,
        );
        gatewayRefundId = result.refundId;
      } catch (err) {
        console.error("[refund-payment] gateway error:", err);
        return json({ error: `Erro no gateway: ${err instanceof Error ? err.message : "desconhecido"}` }, 502, req);
      }
    }

    // Registra o estorno
    const { data: refund, error: refErr } = await admin
      .from("refunds")
      .insert({
        payment_id:        payment.id,
        order_id:          orderId,
        reason:            reason.trim(),
        refund_type:       refundType,
        amount:            refundAmount,
        absorbed_by:       absorbedBy,
        status:            "completed",
        gateway_refund_id: gatewayRefundId,
      })
      .select()
      .single();

    if (refErr || !refund) {
      return json({ error: "Erro ao registrar estorno." }, 500, req);
    }

    // Atualiza payment e order — estorno parcial não fecha o pagamento nem o pedido
    const isFullRefund = refundAmount >= Number(payment.amount) - 0.01;

    // Reverte split financeiro e pontos de fidelidade
    await admin.rpc("reverse_split_on_refund", {
      p_order_id:    orderId,
      p_refund_id:   refund.id,
      p_absorbed_by: absorbedBy,
    });
    if (isFullRefund) {
      await admin.rpc("revert_points_on_refund", { p_order_id: orderId })
        .catch((e: unknown) => console.error("[refund-payment] revert_points_on_refund:", e));
    }
    await admin.from("payments").update({
      status: isFullRefund ? "refunded" : "partially_refunded",
    }).eq("id", payment.id);
    await admin.from("orders").update({
      payment_status: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
      ...(isFullRefund ? { status: 5 } : {}),
    }).eq("id", orderId);

    // Registra evento de auditoria
    await admin.from("audit_log").insert({
      user_id:    user.id,
      action:     "PAYMENT_REFUNDED",
      table_name: "payments",
      record_id:  payment.id,
      extra: {
        order_id:        orderId,
        refund_id:       refund.id,
        amount:          refundAmount,
        reason,
        absorbed_by:     absorbedBy,
        gateway_refund:  gatewayRefundId,
      },
    }).catch((e: unknown) => console.error("[refund-payment] audit_log insert failed:", e));

    console.log(`[refund-payment] order=${orderId} refund=${refund.id} amount=${refundAmount}`);

    return json({
      ok:       true,
      refundId: refund.id,
      amount:   refundAmount,
      message:  `Estorno de R$ ${refundAmount.toFixed(2).replace(".", ",")} processado com sucesso.`,
    }, 200, req);

  } catch (e) {
    console.error("[refund-payment]", e);
    return json({ error: "Erro interno." }, 500, req);
  }
});
