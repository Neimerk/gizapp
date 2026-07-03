import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, optionsResponse } from "../_shared/cors.ts";

// track-order — rastreamento público de pedido sem login.
//
// Aceita: GET /track-order?code=A1B2C3D4
// Retorna: status do pedido, loja, valor total, timeline de status.
// Sem autenticação — dados não-sensíveis apenas (sem endereço completo, sem dados de pagamento).
//
// Rate limit: 20 req/hora por IP para evitar enumeration.

const STATUS_LABELS: Record<number, string> = {
  0: "Aguardando confirmação",
  1: "Pedido confirmado",
  2: "Em preparação",
  3: "Saiu para entrega",
  4: "Entregue",
  5: "Cancelado",
};

const PAYMENT_LABELS: Record<string, string> = {
  PENDING:   "Aguardando pagamento",
  CONFIRMED: "Pagamento confirmado",
  RECEIVED:  "Pagamento recebido",
  OVERDUE:   "Pagamento vencido",
  DECLINED:  "Pagamento recusado",
  CANCELLED: "Cancelado",
};

async function hashIp(ip: string): Promise<string> {
  const data   = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin          = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── 1. Extrai tracking code ──────────────────────────────
    let code: string | null = null;

    if (req.method === "GET") {
      code = new URL(req.url).searchParams.get("code");
    } else {
      const body = await req.json().catch(() => ({})) as { code?: string };
      code = body.code ?? null;
    }

    if (!code || !/^[A-F0-9]{8}$/i.test(code)) {
      return json({ error: "Código de rastreamento inválido. Formato: 8 caracteres hexadecimais." }, 400, req);
    }

    // ── 2. Rate limit por IP ─────────────────────────────────
    const forwarded = req.headers.get("x-forwarded-for") ?? "";
    const ip        = forwarded.split(",")[0]?.trim() || "unknown";
    const ipHash    = await hashIp(ip);

    const { data: allowed } = await admin.rpc("check_rate_limit", {
      p_key:            `track_order:${ipHash}`,
      p_max_requests:   20,
      p_window_seconds: 3600,
    });
    if (!allowed) return json({ error: "Muitas tentativas. Aguarde um momento." }, 429, req);

    // ── 3. Busca via função pública (dados não-sensíveis) ────
    const { data: rows, error } = await admin.rpc("get_order_by_tracking", {
      p_code: code.toUpperCase(),
    });

    if (error) {
      console.error("[track-order] rpc error:", error.message);
      return json({ error: "Erro ao buscar pedido." }, 500, req);
    }

    if (!rows || rows.length === 0) {
      return json({ error: "Pedido não encontrado. Verifique o código de rastreamento." }, 404, req);
    }

    const row = rows[0] as {
      order_id:       string;
      tracking_code:  string;
      status:         number;
      payment_status: string | null;
      payment_method: string;
      total:          number;
      customer_name:  string;
      store_name:     string | null;
      created_at:     string;
    };

    const statusCode    = Number(row.status ?? 0);
    const paymentStatus = (row.payment_status ?? "PENDING").toUpperCase();

    // ── 4. Monta timeline ────────────────────────────────────
    const timeline = Object.entries(STATUS_LABELS).map(([code, label]) => ({
      step:      Number(code),
      label,
      completed: statusCode >= Number(code) && Number(code) !== 5,
      current:   statusCode === Number(code),
    }));

    return json({
      trackingCode:   row.tracking_code,
      orderId:        row.order_id.slice(0, 8).toUpperCase(),
      status:         statusCode,
      statusLabel:    STATUS_LABELS[statusCode] ?? "Status desconhecido",
      paymentStatus,
      paymentLabel:   PAYMENT_LABELS[paymentStatus] ?? paymentStatus,
      paymentMethod:  row.payment_method,
      total:          Number(row.total),
      storeName:      row.store_name ?? "Loja",
      firstNameOnly:  row.customer_name?.split(" ")[0] ?? "Cliente",
      createdAt:      row.created_at,
      timeline,
    }, 200, req);

  } catch (e) {
    console.error("[track-order]", e);
    return json({ error: "Erro interno." }, 500, req);
  }
});
