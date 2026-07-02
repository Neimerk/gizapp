// ── Planos de assinatura ────────────────────────────────────

export type SubscriptionPlan = "free" | "start" | "pro" | "whitelabel";
export type SubscriptionStatus = "trial" | "active" | "overdue" | "suspended" | "cancelled";

export const PLAN_CONFIG: Record<SubscriptionPlan, {
  label: string;
  monthlyPrice: number;
  commissionRate: number;
  color: string;
}> = {
  free:       { label: "Gratuito",    monthlyPrice: 0,      commissionRate: 0.08, color: "#64748b" },
  start:      { label: "Básico",      monthlyPrice: 49.90,  commissionRate: 0.05, color: "#2563eb" },
  pro:        { label: "Premium",     monthlyPrice: 99.90,  commissionRate: 0.03, color: "#7c3aed" },
  whitelabel: { label: "White Label", monthlyPrice: 199.90, commissionRate: 0.00, color: "#0f172a" },
};

export const PLAN_FEATURES: Record<SubscriptionPlan, string[]> = {
  free:       ["Até 30 produtos", "8% de comissão por venda", "Suporte por e-mail"],
  start:      ["Até 200 produtos", "5% de comissão por venda", "Suporte prioritário"],
  pro:        ["Produtos ilimitados", "3% de comissão por venda", "Analytics", "Suporte 24h"],
  whitelabel: ["Produtos ilimitados", "0% de comissão", "Domínio próprio", "Acesso à API"],
};

export type Subscription = {
  id: string;
  vendorId: string;
  plan: SubscriptionPlan;
  monthlyPrice: number;
  commissionRate: number;
  status: SubscriptionStatus;
  trialEndsAt?: string;
  nextBillingDate?: string;
  createdAt: string;
};

// ── Gateway de pagamento ────────────────────────────────────

export type PaymentGateway = "asaas" | "mercadopago" | "pagarme" | "stripe" | "manual";
export type PaymentMethod  = "pix" | "card" | "boleto" | "cash" | "other";
export type PaymentStatus  = "pending" | "approved" | "declined" | "refunded" | "cancelled" | "expired";

export type Payment = {
  id: string;
  orderId: string;
  gateway: PaymentGateway;
  externalId?: string;
  method: PaymentMethod;
  amount: number;
  serviceFee: number;
  status: PaymentStatus;
  pixCode?: string;
  pixQrImage?: string;
  pixExpiresAt?: string;
  boletoUrl?: string;
  boletoBarCode?: string;
  splitExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PaymentTransaction = {
  id: string;
  paymentId: string;
  eventType: string;
  gatewayEventId?: string;
  amount?: number;
  status?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

// ── Carteiras ───────────────────────────────────────────────

export type WalletType = "vendor" | "courier" | "platform";

export type Wallet = {
  id: string;
  ownerId?: string;
  walletType: WalletType;
  currency: string;
  balance: WalletBalance;
  createdAt: string;
};

export type WalletBalance = {
  available: number;
  held: number;
  total: number;
};

export type WalletTransactionType = "credit" | "debit" | "refund" | "withdrawal" | "fee" | "adjustment";
export type WalletTransactionDirection = "in" | "out";
export type WalletTransactionStatus = "held" | "available" | "completed" | "reversed";

export type WalletTransaction = {
  id: string;
  walletId: string;
  orderId?: string;
  paymentId?: string;
  refundId?: string;
  withdrawalId?: string;
  type: WalletTransactionType;
  amount: number;
  direction: WalletTransactionDirection;
  status: WalletTransactionStatus;
  description: string;
  balanceAfter?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

// ── Split de pagamento ──────────────────────────────────────

export type SplitRule = {
  id: string;
  orderId: string;
  paymentId?: string;
  productsAmount: number;
  deliveryAmount: number;
  serviceFee: number;
  commissionRate: number;
  commissionAmount: number;
  vendorNet: number;
  vendorId?: string;
  courierId?: string;
  executedAt?: string;
  createdAt: string;
};

export type SplitCalculation = {
  productsAmount: number;
  deliveryAmount: number;
  serviceFee: number;
  commissionRate: number;
  commissionAmount: number;
  vendorNet: number;
  platformTotal: number;
  totalPaidByCustomer: number;
};

// ── Saques ──────────────────────────────────────────────────

export type WithdrawalStatus = "pending" | "processing" | "paid" | "failed" | "cancelled";
export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

export type Withdrawal = {
  id: string;
  walletId: string;
  ownerId: string;
  ownerType: "vendor" | "courier";
  amountGross: number;
  withdrawalFee: number;
  amountNet: number;
  pixKey: string;
  pixKeyType: PixKeyType;
  status: WithdrawalStatus;
  gatewayReference?: string;
  notes?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
};

// ── Estornos ────────────────────────────────────────────────

export type RefundType   = "full" | "partial";
export type RefundStatus = "pending" | "processing" | "completed" | "failed";
export type RefundAbsorbedBy = "vendor" | "courier" | "brasux" | "shared";

export type Refund = {
  id: string;
  paymentId: string;
  orderId: string;
  reason: string;
  refundType: RefundType;
  amount: number;
  absorbedBy: RefundAbsorbedBy;
  status: RefundStatus;
  gatewayRefundId?: string;
  createdAt: string;
  updatedAt: string;
};

// ── Resposta das Edge Functions ──────────────────────────────

export type CreatePaymentRequest = {
  orderId: string;
  paymentMethod: "PIX" | "CREDIT_CARD" | "BOLETO";
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone?: string;
  };
};

export type CreatePaymentResponse = {
  chargeId: string;
  paymentId: string;
  // PIX
  pixQrCodeImage?: string;
  pixCode?: string;
  expirationDate?: string;
  // Boleto
  boletoUrl?: string;
  boletoBarCode?: string;
  dueDate?: string;
  // Cartão
  confirmed?: boolean;
  status?: string;
  error?: string;
};

export type WithdrawalRequest = {
  walletId?: string;
  amount: number;
  pixKey: string;
  pixKeyType: PixKeyType;
};

// ── Provider abstrato ───────────────────────────────────────

export interface PaymentProvider {
  readonly name: PaymentGateway;
  createCharge(params: ProviderChargeParams): Promise<ProviderChargeResult>;
  getCharge(externalId: string): Promise<ProviderChargeResult>;
  refundCharge(externalId: string, amount?: number): Promise<{ refundId: string }>;
  parseWebhookEvent(payload: unknown): ProviderWebhookEvent;
}

export type ProviderChargeParams = {
  customerId: string;
  amount: number;
  method: PaymentMethod;
  description: string;
  externalReference: string;
  dueDate?: string;
};

export type ProviderChargeResult = {
  externalId: string;
  status: PaymentStatus;
  pixCode?: string;
  pixQrImage?: string;
  pixExpiresAt?: string;
  boletoUrl?: string;
  boletoBarCode?: string;
  raw: Record<string, unknown>;
};

export type ProviderWebhookEvent = {
  type: "approved" | "declined" | "refunded" | "cancelled" | "unknown";
  externalId: string;
  orderId?: string;
  amount?: number;
  raw: Record<string, unknown>;
};

// ── Admin / Dashboard ───────────────────────────────────────

export type FinancialSummary = {
  period: string;
  totalRevenue: number;
  platformRevenue: number;
  totalOrders: number;
  paidOrders: number;
  splitExecuted: number;
  totalRefunds: number;
  pendingWithdrawals: number;
};

export type AdminWithdrawal = Withdrawal & {
  ownerName: string;
  ownerEmail?: string;
};
