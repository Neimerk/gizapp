import { supabase } from "../lib/supabase";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SHOPPING_SUPABASE_URL) as string;

// Resolve cabeçalhos de autenticação: JWT para usuários logados, X-Guest-Token para convidados.
async function authHeaders(guestToken?: string | null): Promise<Record<string, string>> {
  if (guestToken) {
    return { "Content-Type": "application/json", "X-Guest-Token": guestToken };
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Sessão expirada. Faça login novamente para continuar.");
  }
  return { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` };
}

async function callEdgeFunction<T>(
  fnName: string,
  body: unknown,
  guestToken?: string | null,
): Promise<T> {
  const headers = await authHeaders(guestToken);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method:  "POST",
    headers,
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Erro ao processar pagamento.");
  return data as T;
}

// ── Types ─────────────────────────────────────────────────────

export type PixResult = {
  chargeId:       string;
  paymentId:      string;
  pixQrCodeImage: string;
  pixCode:        string;
  expirationDate: string;
};

export type CardResult = {
  chargeId:  string;
  paymentId: string;
  confirmed: boolean;
  status:    string;
  error?:    string;
};

export type BoletoResult = {
  chargeId:      string;
  paymentId:     string;
  boletoUrl:     string;
  boletoBarCode?: string;
  dueDate:       string;
};

export type PixStatusResult = {
  status:         "pending" | "paid" | "failed" | "not_pix";
  paymentStatus?: string;
  pixCode?:       string;
  pixQrCodeImage?: string;
  expirationDate?: string;
};

export type CreditCardData = {
  holderName:  string;
  number:      string;
  expiryMonth: string;
  expiryYear:  string;
  ccv:         string;
};

export type CardHolderInfo = {
  name:          string;
  email:         string;
  cpfCnpj:       string;
  postalCode:    string;
  addressNumber: string;
  phone?:        string;
};

// ── API ───────────────────────────────────────────────────────

export function createPixCharge(orderId: string, guestToken?: string | null): Promise<PixResult> {
  return callEdgeFunction("asaas-create-charge", { orderId, paymentMethod: "PIX" }, guestToken);
}

export function createCardCharge(
  orderId: string,
  creditCard: CreditCardData,
  holderInfo: CardHolderInfo,
  guestToken?: string | null,
): Promise<CardResult> {
  return callEdgeFunction(
    "asaas-create-charge",
    { orderId, paymentMethod: "CREDIT_CARD", creditCard, creditCardHolderInfo: holderInfo },
    guestToken,
  );
}

export function createBoletoCharge(orderId: string, guestToken?: string | null): Promise<BoletoResult> {
  return callEdgeFunction("asaas-create-charge", { orderId, paymentMethod: "BOLETO" }, guestToken);
}

export async function pollPixStatus(orderId: string, guestToken?: string | null): Promise<PixStatusResult> {
  const headers = await authHeaders(guestToken);
  delete (headers as Record<string, string>)["Content-Type"];

  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/get-pix-qrcode?orderId=${encodeURIComponent(orderId)}`,
    { method: "GET", headers },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Erro ao consultar status PIX.");
  return data as PixStatusResult;
}

// Polling genérico para qualquer método de pagamento.
// Usa o mesmo endpoint de PIX — ele retorna "paid" para qualquer método
// assim que o webhook de confirmação processar o pedido.
export async function pollPaymentStatus(
  orderId: string,
  guestToken?: string | null,
): Promise<"paid" | "pending" | "failed"> {
  try {
    const { status } = await pollPixStatus(orderId, guestToken);
    if (status === "paid") return "paid";
    if (status === "failed") return "failed";
    // "not_pix" = boleto/card ainda pendente (mas não falhou)
    return "pending";
  } catch {
    return "pending";
  }
}

export function notifyOrderPlaced(orderId: string, guestToken?: string | null): void {
  callEdgeFunction("send-order-emails", { orderId, type: "order_placed" }, guestToken).catch(() => null);
}
