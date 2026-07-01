import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, optionsResponse } from "../_shared/cors.ts";

/**
 * financial-dashboard
 * Dados financeiros agregados para o painel admin.
 * Requer role=admin no JWT.
 *
 * GET /functions/v1/financial-dashboard?period=30d
 * periods: 7d | 30d | 90d | 365d | all
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function periodToDate(period: string): string | null {
  const now = new Date();
  const map: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
  const days = map[period];
  if (!days) return null;
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autenticado." }, 401, req);

  const anonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Token inválido." }, 401, req);

  // Verifica role=admin
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return json({ error: "Acesso negado." }, 403, req);

  const url    = new URL(req.url);
  const period = url.searchParams.get("period") ?? "30d";
  const since  = periodToDate(period);

  try {
    // ── Pedidos ───────────────────────────────────────────────
    const ordersQuery = admin.from("orders").select("id, total, payment_status, created_at, status");
    const { data: orders } = since
      ? await ordersQuery.gte("created_at", since)
      : await ordersQuery;

    const allOrders        = orders ?? [];
    const totalOrders      = allOrders.length;
    const paidOrders       = allOrders.filter((o) => ["CONFIRMED", "RECEIVED"].includes(o.payment_status ?? ""));
    const totalRevenue     = paidOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const refundedOrders   = allOrders.filter((o) => o.payment_status === "REFUNDED");

    // ── Split / comissão ──────────────────────────────────────
    const splitsQuery = admin.from("split_rules").select("commission_amount, vendor_net, delivery_amount, executed_at");
    const { data: splits } = since
      ? await splitsQuery.gte("created_at", since)
      : await splitsQuery;

    const executedSplits   = (splits ?? []).filter((s) => s.executed_at);
    const platformRevenue  = executedSplits.reduce((s, r) => s + Number(r.commission_amount ?? 0), 0);
    const vendorRevenue    = executedSplits.reduce((s, r) => s + Number(r.vendor_net ?? 0), 0);
    const courierRevenue   = executedSplits.reduce((s, r) => s + Number(r.delivery_amount ?? 0), 0);

    // ── Estornos ──────────────────────────────────────────────
    const refundsQuery = admin.from("refunds").select("amount, status");
    const { data: refunds } = since
      ? await refundsQuery.gte("created_at", since)
      : await refundsQuery;

    const completedRefunds = (refunds ?? []).filter((r) => r.status === "completed");
    const totalRefunds     = completedRefunds.reduce((s, r) => s + Number(r.amount ?? 0), 0);

    // ── Saques pendentes ──────────────────────────────────────
    const { data: withdrawals } = await admin
      .from("withdrawals")
      .select("amount_gross, status")
      .in("status", ["pending", "processing"]);

    const pendingWithdrawals = (withdrawals ?? []).reduce((s, w) => s + Number(w.amount_gross ?? 0), 0);

    // ── Assinaturas ───────────────────────────────────────────
    const { data: subs } = await admin
      .from("subscriptions")
      .select("plan, status, monthly_price");

    const activeSubs      = (subs ?? []).filter((s) => s.status === "active");
    const mrrByPlan       = activeSubs.reduce<Record<string, number>>((acc, s) => {
      acc[s.plan] = (acc[s.plan] ?? 0) + Number(s.monthly_price ?? 0);
      return acc;
    }, {});
    const totalMRR        = Object.values(mrrByPlan).reduce((s, v) => s + v, 0);

    // ── Carteiras ─────────────────────────────────────────────
    const { data: wallets } = await admin.from("wallets").select("wallet_type, balance_held, balance_available");
    const walletSummary = (wallets ?? []).reduce<Record<string, { held: number; available: number }>>(
      (acc, w) => {
        if (!acc[w.wallet_type]) acc[w.wallet_type] = { held: 0, available: 0 };
        acc[w.wallet_type].held      += Number(w.balance_held ?? 0);
        acc[w.wallet_type].available += Number(w.balance_available ?? 0);
        return acc;
      },
      {},
    );

    // ── Ganhos dos entregadores ───────────────────────────────
    const earningsQuery = admin.from("courier_earnings").select("amount, status");
    const { data: earnings } = since
      ? await earningsQuery.gte("created_at", since)
      : await earningsQuery;

    const totalCourierEarnings = (earnings ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0);

    return json({
      period,
      since,
      orders: {
        total:    totalOrders,
        paid:     paidOrders.length,
        refunded: refundedOrders.length,
        revenue:  totalRevenue,
      },
      split: {
        executed:       executedSplits.length,
        platformRevenue,
        vendorRevenue,
        courierRevenue,
      },
      refunds: {
        count:  completedRefunds.length,
        amount: totalRefunds,
      },
      withdrawals: {
        pendingAmount: pendingWithdrawals,
      },
      subscriptions: {
        active: activeSubs.length,
        mrr:    totalMRR,
        byPlan: mrrByPlan,
        byStatus: (subs ?? []).reduce<Record<string, number>>((acc, s) => {
          acc[s.status] = (acc[s.status] ?? 0) + 1;
          return acc;
        }, {}),
      },
      wallets: walletSummary,
      couriers: {
        earnings: totalCourierEarnings,
      },
    }, 200, req);

  } catch (e) {
    console.error("[financial-dashboard]", e);
    return json({ error: "Erro interno." }, 500, req);
  }
});
