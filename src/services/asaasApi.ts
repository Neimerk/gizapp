import { supabase } from "../lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function callEdgeFunction<T>(fnName: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Faça login para continuar.");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Erro ao processar pagamento.");
  return data as T;
}

// ── Types ─────────────────────────────────────────────────────

export type PixResult = {
  chargeId: string;
  pixQrCodeImage: string;   // base64 PNG
  pixCode: string;           // string copia-e-cola
  expirationDate: string;
};

export type CardResult = {
  chargeId: string;
  confirmed: boolean;
  status: string;
  error?: string;
};

export type BoletoResult = {
  chargeId: string;
  boletoUrl: string;
  boletoBarCode?: string;
  dueDate: string;
};

export type CreditCardData = {
  holderName: string;
  number: string;
  expiryMonth: string;  // "01"–"12"
  expiryYear: string;   // "2025"
  ccv: string;
};

export type CardHolderInfo = {
  name: string;
  email: string;
  cpfCnpj: string;       // apenas dígitos
  postalCode: string;    // apenas dígitos
  addressNumber: string;
  phone?: string;        // apenas dígitos
};

// ── API ───────────────────────────────────────────────────────

export function createPixCharge(orderId: string): Promise<PixResult> {
  return callEdgeFunction("asaas-create-charge", {
    orderId,
    paymentMethod: "PIX",
  });
}

export function createCardCharge(
  orderId: string,
  creditCard: CreditCardData,
  holderInfo: CardHolderInfo,
): Promise<CardResult> {
  return callEdgeFunction("asaas-create-charge", {
    orderId,
    paymentMethod: "CREDIT_CARD",
    creditCard,
    creditCardHolderInfo: holderInfo,
  });
}

export function createBoletoCharge(orderId: string): Promise<BoletoResult> {
  return callEdgeFunction("asaas-create-charge", {
    orderId,
    paymentMethod: "BOLETO",
  });
}

/**
 * Dispara os emails de confirmação ao comprador e de novo pedido ao lojista.
 * Fire-and-forget: não bloqueia o fluxo de checkout — falhas são silenciosas.
 */
export function notifyOrderPlaced(orderId: string): void {
  callEdgeFunction("send-order-emails", { orderId, type: "order_placed" }).catch(() => null);
}
