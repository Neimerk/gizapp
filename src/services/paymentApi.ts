import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import type {
  Wallet, WalletTransaction, WalletBalance,
  Withdrawal, Subscription, Refund, SplitRule,
  AdminWithdrawal, FinancialSummary,
  WithdrawalRequest, PixKeyType,
} from "../types/payment";

// ── Utilitários ─────────────────────────────────────────────

function mapWalletTransaction(r: Record<string, unknown>): WalletTransaction {
  return {
    id:           r.id as string,
    walletId:     r.wallet_id as string,
    orderId:      (r.order_id as string | null) ?? undefined,
    paymentId:    (r.payment_id as string | null) ?? undefined,
    refundId:     (r.refund_id as string | null) ?? undefined,
    withdrawalId: (r.withdrawal_id as string | null) ?? undefined,
    type:         r.type as WalletTransaction["type"],
    amount:       Number(r.amount),
    direction:    r.direction as WalletTransaction["direction"],
    status:       r.status as WalletTransaction["status"],
    description:  r.description as string,
    balanceAfter: r.balance_after != null ? Number(r.balance_after) : undefined,
    metadata:     (r.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt:    r.created_at as string,
  };
}

function mapWithdrawal(r: Record<string, unknown>): Withdrawal {
  return {
    id:               r.id as string,
    walletId:         r.wallet_id as string,
    ownerId:          r.owner_id as string,
    ownerType:        r.owner_type as "vendor" | "courier",
    amountGross:      Number(r.amount_gross),
    withdrawalFee:    Number(r.withdrawal_fee ?? 0),
    amountNet:        Number(r.amount_net),
    pixKey:           r.pix_key as string,
    pixKeyType:       (r.pix_key_type as PixKeyType) ?? "cpf",
    status:           r.status as Withdrawal["status"],
    gatewayReference: (r.gateway_reference as string | null) ?? undefined,
    notes:            (r.notes as string | null) ?? undefined,
    processedAt:      (r.processed_at as string | null) ?? undefined,
    createdAt:        r.created_at as string,
    updatedAt:        r.updated_at as string,
  };
}

function mapSubscription(r: Record<string, unknown>): Subscription {
  return {
    id:              r.id as string,
    vendorId:        r.vendor_id as string,
    plan:            r.plan as Subscription["plan"],
    monthlyPrice:    Number(r.monthly_price),
    commissionRate:  Number(r.commission_rate),
    status:          r.status as Subscription["status"],
    trialEndsAt:     (r.trial_ends_at as string | null) ?? undefined,
    nextBillingDate: (r.next_billing_date as string | null) ?? undefined,
    createdAt:       r.created_at as string,
  };
}

// ── WALLET API ───────────────────────────────────────────────

/** Retorna a carteira do usuário autenticado (vendor ou courier). */
export async function getMyWallet(): Promise<Wallet | null> {
  const user = useAuthStore.getState().user;
  if (!user) return null;

  const profile = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile.data?.role as string;
  const walletType = role === "seller" ? "vendor" : role === "courier" ? "courier" : null;
  if (!walletType) return null;

  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("owner_id", user.id)
    .eq("wallet_type", walletType)
    .maybeSingle();

  if (!wallet) return null;

  const { data: balance } = await supabase.rpc("get_wallet_balance", {
    p_wallet_id: wallet.id as string,
  });

  return {
    id:         wallet.id as string,
    ownerId:    user.id,
    walletType: wallet.wallet_type as Wallet["walletType"],
    currency:   wallet.currency as string,
    balance:    (balance as WalletBalance) ?? { available: 0, held: 0, total: 0 },
    createdAt:  wallet.created_at as string,
  };
}

/** Extrato da carteira (últimas N transações). */
export async function getWalletStatement(
  walletId: string,
  limit = 50,
): Promise<WalletTransaction[]> {
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error("Erro ao buscar extrato.");
  return (data ?? []).map(mapWalletTransaction);
}

// ── WITHDRAWAL API ───────────────────────────────────────────

/** Solicita saque via Edge Function (valida saldo atomicamente). */
export async function requestWithdrawal(params: WithdrawalRequest): Promise<{ withdrawalId: string }> {
  const session = await supabase.auth.getSession();
  const token   = session.data.session?.access_token;
  if (!token) throw new Error("Não autenticado.");

  const res = await supabase.functions.invoke("create-withdrawal", {
    body: {
      amount:     params.amount,
      pixKey:     params.pixKey,
      pixKeyType: params.pixKeyType,
    },
  });

  if (res.error) throw new Error(res.error.message ?? "Erro ao solicitar saque.");

  const data = res.data as { ok?: boolean; withdrawalId?: string; error?: string };
  if (!data.ok || !data.withdrawalId) throw new Error(data.error ?? "Erro ao solicitar saque.");

  return { withdrawalId: data.withdrawalId };
}

/** Lista saques da carteira do usuário autenticado. */
export async function getMyWithdrawals(): Promise<Withdrawal[]> {
  const user = useAuthStore.getState().user;
  if (!user) return [];

  const { data, error } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw new Error("Erro ao buscar saques.");
  return (data ?? []).map(mapWithdrawal);
}

// ── SUBSCRIPTION API ─────────────────────────────────────────

/** Retorna plano de assinatura ativo do vendedor autenticado. */
export async function getMySubscription(): Promise<Subscription | null> {
  const user = useAuthStore.getState().user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("vendor_id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return mapSubscription(data as Record<string, unknown>);
}

// ── SPLIT API ────────────────────────────────────────────────

/** Regra de split do pedido (visível para o vendedor). */
export async function getOrderSplit(orderId: string): Promise<SplitRule | null> {
  const { data } = await supabase
    .from("split_rules")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (!data) return null;

  return {
    id:               data.id as string,
    orderId:          data.order_id as string,
    paymentId:        (data.payment_id as string | null) ?? undefined,
    productsAmount:   Number(data.products_amount),
    deliveryAmount:   Number(data.delivery_amount),
    serviceFee:       Number(data.service_fee),
    commissionRate:   Number(data.commission_rate),
    commissionAmount: Number(data.commission_amount),
    vendorNet:        Number(data.vendor_net),
    vendorId:         (data.vendor_id as string | null) ?? undefined,
    courierId:        (data.courier_id as string | null) ?? undefined,
    executedAt:       (data.executed_at as string | null) ?? undefined,
    createdAt:        data.created_at as string,
  };
}

// ── REFUND API ───────────────────────────────────────────────

/** Estorno de pagamento — apenas admin, via Edge Function. */
export async function adminRefundPayment(params: {
  orderId:    string;
  reason:     string;
  refundType?: "full" | "partial";
  amount?:    number;
  absorbedBy?: "vendor" | "courier" | "brasux" | "shared";
}): Promise<{ refundId: string }> {
  const res = await supabase.functions.invoke("refund-payment", { body: params });
  if (res.error) throw new Error(res.error.message ?? "Erro ao estornar.");
  const data = res.data as { ok?: boolean; refundId?: string; error?: string };
  if (!data.ok || !data.refundId) throw new Error(data.error ?? "Erro ao estornar.");
  return { refundId: data.refundId };
}

/** Lista estornos de um pedido. */
export async function getOrderRefunds(orderId: string): Promise<Refund[]> {
  const { data } = await supabase
    .from("refunds")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id:              r.id as string,
    paymentId:       r.payment_id as string,
    orderId:         r.order_id as string,
    reason:          r.reason as string,
    refundType:      r.refund_type as Refund["refundType"],
    amount:          Number(r.amount),
    absorbedBy:      r.absorbed_by as Refund["absorbedBy"],
    status:          r.status as Refund["status"],
    gatewayRefundId: (r.gateway_refund_id as string | null) ?? undefined,
    createdAt:       r.created_at as string,
    updatedAt:       r.updated_at as string,
  }));
}

// ── ADMIN API ────────────────────────────────────────────────

/** Lista todos os saques para o painel admin. */
export async function adminGetAllWithdrawals(): Promise<AdminWithdrawal[]> {
  const { data, error } = await supabase
    .from("withdrawals")
    .select("*, profiles(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error("Erro ao buscar saques.");

  return (data ?? []).map((r) => ({
    ...mapWithdrawal(r as Record<string, unknown>),
    ownerName: (r.profiles as { name?: string } | null)?.name ?? "Usuário",
  }));
}

/** Aprova ou rejeita um saque (admin). */
export async function adminUpdateWithdrawal(
  id: string,
  status: "paid" | "failed",
  notes?: string,
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    processed_at: new Date().toISOString(),
  };
  if (notes) update.notes = notes;

  const { error } = await supabase
    .from("withdrawals")
    .update(update)
    .eq("id", id);

  if (error) throw new Error("Erro ao atualizar saque.");
}

/** Resumo financeiro para dashboard admin. */
export async function adminGetFinancialSummary(
  startDate: string,
  endDate: string,
): Promise<FinancialSummary> {
  // Agregação feita no servidor (antes era reduce de TODOS os pedidos no cliente).
  const { data, error } = await supabase.rpc("admin_financial_summary", {
    p_start: startDate,
    p_end:   endDate,
  });
  if (error) throw new Error("Erro ao carregar resumo financeiro.");

  const d = (data ?? {}) as Record<string, number>;
  return {
    period:             `${startDate} → ${endDate}`,
    totalRevenue:       Number(d.totalRevenue ?? 0),
    platformRevenue:    Number(d.platformRevenue ?? 0),
    totalOrders:        Number(d.totalOrders ?? 0),
    paidOrders:         Number(d.paidOrders ?? 0),
    splitExecuted:      Number(d.splitExecuted ?? 0),
    totalRefunds:       Number(d.totalRefunds ?? 0),
    pendingWithdrawals: Number(d.pendingWithdrawals ?? 0),
  };
}

/** Ledger completo da plataforma (admin). */
export async function adminGetPlatformLedger(limit = 100): Promise<WalletTransaction[]> {
  const { data: platformWallet } = await supabase
    .from("wallets")
    .select("id")
    .eq("wallet_type", "platform")
    .is("owner_id", null)
    .maybeSingle();

  if (!platformWallet) return [];

  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("wallet_id", platformWallet.id as string)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error("Erro ao buscar ledger.");
  return (data ?? []).map(mapWalletTransaction);
}

// ── QUERY KEYS (para React Query) ────────────────────────────

export const paymentQueryKeys = {
  myWallet:             () => ["payment", "wallet", "mine"] as const,
  walletStatement:      (id: string) => ["payment", "wallet", id, "statement"] as const,
  myWithdrawals:        () => ["payment", "withdrawals", "mine"] as const,
  mySubscription:       () => ["payment", "subscription", "mine"] as const,
  orderSplit:           (orderId: string) => ["payment", "split", orderId] as const,
  orderRefunds:         (orderId: string) => ["payment", "refunds", orderId] as const,
  adminWithdrawals:     () => ["payment", "admin", "withdrawals"] as const,
  adminFinancialSummary:(period: string) => ["payment", "admin", "summary", period] as const,
  adminPlatformLedger:  () => ["payment", "admin", "ledger"] as const,
};
