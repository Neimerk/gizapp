// Parte do módulo gizApi (split por domínio). Não alterar lógica aqui.

import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/authStore";
import type { CouponDB, CreateOrderPayload, Order, OrderRow, PointTransaction, ProfileResponse, SavedAddressDB, UpdateProfilePayload } from "./core";
import { ALLOWED_PAYMENT_METHODS, UUID_RE, mapAddress, mapOrder } from "./core";

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  // Validação de entrada antes de qualquer query
  if (!UUID_RE.test(payload.storeId)) throw new Error("Loja inválida.");
  if (!payload.items?.length || payload.items.length > 50) throw new Error("Itens inválidos.");
  if (!ALLOWED_PAYMENT_METHODS.has(payload.paymentMethod)) throw new Error("Método de pagamento inválido.");
  if (!payload.deliveryAddress?.trim() || !payload.deliveryNeighborhood?.trim()) throw new Error("Endereço incompleto.");
  for (const item of payload.items) {
    if (!UUID_RE.test(item.storeProductId)) throw new Error("Produto inválido.");
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error("Quantidade inválida.");
  }

  const user = useAuthStore.getState().user;

  const { data, error } = await supabase.rpc("create_order_atomic", {
    p_store_id:              payload.storeId,
    p_items:                 payload.items.map((i) => ({ store_product_id: i.storeProductId, quantity: i.quantity })),
    p_customer_name:         payload.customerName,
    p_customer_phone:        payload.customerPhone,
    p_delivery_address:      payload.deliveryAddress,
    p_delivery_neighborhood: payload.deliveryNeighborhood,
    p_payment_method:        payload.paymentMethod,
    p_delivery_number:       payload.deliveryNumber ?? null,
    p_delivery_complement:   payload.deliveryComplement ?? null,
    p_delivery_fee_override: payload.deliveryFeeOverride ?? null,
    p_coupon_code:           payload.couponCode?.trim() || null,
    p_points_discount:       Math.max(0, Math.floor(payload.pointsDiscount ?? 0)),
  });

  if (error) {
    const m = error.message;
    const msg = m.includes("INVALID_COUPON") || m.includes("EXPIRED_COUPON") || m.includes("EXHAUSTED_COUPON") || m.includes("ALREADY_USED")
        ? "Cupom inválido ou expirado."
      : m.includes("INSUFFICIENT_POINTS") ? "Pontos insuficientes ou erro ao debitar."
      : m.includes("PRODUCT_NOT_FOUND")   ? "Um produto do carrinho não está mais disponível."
      : m.includes("STORE_NOT_FOUND")     ? "Loja não encontrada."
      : m.includes("INVALID_QUANTITY")    ? "Quantidade inválida."
      : "Erro ao criar pedido.";
    throw new Error(msg);
  }

  const r = data as {
    id: string; store_id: string; store_name: string;
    subtotal: number; delivery_fee: number; total: number;
    items: Array<{ store_product_id: string; product_name: string; image_url: string | null; unit_price: number; quantity: number; total_price: number }>;
  };

  const now = new Date().toISOString();
  return {
    id: r.id,
    storeId: r.store_id,
    storeName: r.store_name,
    customerId: user?.id ?? undefined,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    deliveryAddress: payload.deliveryAddress,
    deliveryNumber: payload.deliveryNumber ?? "",
    deliveryComplement: payload.deliveryComplement ?? "",
    deliveryNeighborhood: payload.deliveryNeighborhood,
    paymentMethod: payload.paymentMethod,
    deliveryFee: Number(r.delivery_fee),
    subtotal: Number(r.subtotal),
    total: Number(r.total),
    status: 0,
    paymentStatus: "PENDING",
    createdAt: now,
    updatedAt: now,
    items: r.items.map((i, idx) => ({
      id: `${r.id}-${idx}`,
      orderId: r.id,
      storeProductId: i.store_product_id,
      productName: i.product_name,
      imageUrl: i.image_url ?? undefined,
      unitPrice: Number(i.unit_price),
      quantity: i.quantity,
      totalPrice: Number(i.total_price),
    })),
  };
}

export async function getMyOrders(): Promise<Order[]> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Não autenticado.");

  const { data, error } = await supabase
    .from("orders")
    .select("*, stores(name), order_items(*)")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Erro ao buscar pedidos.");
  return data.map((row) => mapOrder(row as OrderRow));
}

export async function getOrderById(id: string): Promise<Order> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, stores(name), order_items(*)")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("Pedido não encontrado.");
  return mapOrder(data as OrderRow);
}

/* ── PROFILE API ─────────────────────────────────────────── */

export async function getMyProfile(): Promise<ProfileResponse | null> {
  const user = useAuthStore.getState().user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, phone, cpf, zip_code, address, address_number, address_complement, neighborhood, updated_at")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    email: user.email,
    phone: data.phone ?? null,
    cpf: data.cpf ?? null,
    zipCode: data.zip_code ?? null,
    address: data.address ?? null,
    addressNumber: data.address_number ?? null,
    addressComplement: data.address_complement ?? null,
    neighborhood: data.neighborhood ?? null,
    updatedAt: data.updated_at,
  };
}

export async function updateMyProfile(payload: UpdateProfilePayload): Promise<ProfileResponse> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Não autenticado.");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.phone !== undefined && { phone: payload.phone }),
      ...(payload.cpf !== undefined && { cpf: payload.cpf }),
      ...(payload.zipCode !== undefined && { zip_code: payload.zipCode }),
      ...(payload.address !== undefined && { address: payload.address }),
      ...(payload.addressNumber !== undefined && { address_number: payload.addressNumber }),
      ...(payload.addressComplement !== undefined && { address_complement: payload.addressComplement }),
      ...(payload.neighborhood !== undefined && { neighborhood: payload.neighborhood }),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error || !data) throw new Error("Erro ao atualizar perfil.");

  return {
    id: data.id,
    name: data.name,
    email: user.email,
    phone: data.phone,
    cpf: data.cpf,
    zipCode: data.zip_code,
    address: data.address,
    addressNumber: data.address_number,
    addressComplement: data.address_complement,
    neighborhood: data.neighborhood,
    updatedAt: data.updated_at,
  };
}

/* ── ADMIN API ───────────────────────────────────────────── */

export async function getMyPoints(): Promise<{ balance: number; transactions: PointTransaction[] }> {
  const user = useAuthStore.getState().user;
  if (!user) return { balance: 0, transactions: [] };
  const [pointsRes, txRes] = await Promise.all([
    supabase.from("user_points").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("point_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  return {
    balance: pointsRes.data?.balance ?? 0,
    transactions: (txRes.data ?? []).map((t) => ({
      id: t.id,
      amount: t.amount,
      description: t.description,
      orderId: t.order_id ?? undefined,
      createdAt: t.created_at,
    })),
  };
}

export async function dbEarnPoints(amountBRL: number, description: string, orderId?: string): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return;
  const pts = Math.floor(amountBRL);
  if (pts <= 0) return;
  await supabase.rpc("earn_points", {
    p_user_id: user.id,
    p_amount: pts,
    p_description: description,
    p_order_id: orderId ?? null,
  });
}

export async function dbSpendPoints(points: number, description: string, orderId?: string): Promise<boolean> {
  const user = useAuthStore.getState().user;
  if (!user) return false;
  const { data, error } = await supabase.rpc("spend_points", {
    p_user_id: user.id,
    p_amount: points,
    p_description: description,
    p_order_id: orderId ?? null,
  });
  return !error && data === true;
}

/* ── COUPONS API ─────────────────────────────────────────── */

export async function validateCoupon(code: string): Promise<CouponDB> {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("active", true)
    .maybeSingle();

  if (error || !data) throw new Error("Cupom inválido ou expirado.");
  if (data.expires_at && new Date(data.expires_at) < new Date()) throw new Error("Cupom expirado.");
  if (data.max_uses !== null && data.uses_count >= data.max_uses) throw new Error("Cupom esgotado.");

  const user = useAuthStore.getState().user;
  if (user && data.max_uses === 1) {
    const { data: used } = await supabase
      .from("user_coupons")
      .select("id")
      .eq("user_id", user.id)
      .eq("coupon_id", data.id)
      .maybeSingle();
    if (used) throw new Error("Você já utilizou este cupom.");
  }

  return {
    id: data.id,
    code: data.code,
    type: data.type as CouponDB["type"],
    value: Number(data.value),
    label: data.label,
    minOrder: Number(data.min_order ?? 0),
  };
}

/* ── SAVED ADDRESSES API ─────────────────────────────────── */

export async function getMySavedAddresses(): Promise<SavedAddressDB[]> {
  const user = useAuthStore.getState().user;
  if (!user) return [];
  const { data } = await supabase
    .from("saved_addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapAddress);
}

export async function insertSavedAddress(addr: Omit<SavedAddressDB, "id">): Promise<SavedAddressDB> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Não autenticado.");
  const { data, error } = await supabase
    .from("saved_addresses")
    .insert({
      user_id: user.id,
      label: addr.label,
      phone: addr.phone ?? null,
      cep: addr.cep ?? null,
      address: addr.address,
      number: addr.number,
      complement: addr.complement ?? null,
      neighborhood: addr.neighborhood,
      city: addr.city ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error("Erro ao salvar endereço.");
  return mapAddress(data);
}

export async function updateSavedAddress(id: string, patch: Partial<Omit<SavedAddressDB, "id">>): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return;
  await supabase
    .from("saved_addresses")
    .update({
      ...(patch.label !== undefined && { label: patch.label }),
      ...(patch.phone !== undefined && { phone: patch.phone ?? null }),
      ...(patch.cep !== undefined && { cep: patch.cep ?? null }),
      ...(patch.address !== undefined && { address: patch.address }),
      ...(patch.number !== undefined && { number: patch.number }),
      ...(patch.complement !== undefined && { complement: patch.complement ?? null }),
      ...(patch.neighborhood !== undefined && { neighborhood: patch.neighborhood }),
      ...(patch.city !== undefined && { city: patch.city ?? null }),
    })
    .eq("id", id)
    .eq("user_id", user.id);
}

export async function deleteSavedAddress(id: string): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return;
  await supabase.from("saved_addresses").delete().eq("id", id).eq("user_id", user.id);
}

/* ── FAVORITES API ───────────────────────────────────────── */

export async function getMyFavoriteIds(): Promise<{ productIds: string[]; storeIds: string[] }> {
  const user = useAuthStore.getState().user;
  if (!user) return { productIds: [], storeIds: [] };
  const { data } = await supabase
    .from("favorites")
    .select("item_type, item_id")
    .eq("user_id", user.id);
  const rows = data ?? [];
  return {
    productIds: rows.filter((r) => r.item_type === "product").map((r) => r.item_id as string),
    storeIds: rows.filter((r) => r.item_type === "store").map((r) => r.item_id as string),
  };
}

export async function toggleFavoriteDB(itemType: "product" | "store", itemId: string): Promise<boolean> {
  const user = useAuthStore.getState().user;
  if (!user) return false;
  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .maybeSingle();
  if (existing) {
    await supabase.from("favorites").delete().eq("id", existing.id);
    return false;
  }
  await supabase.from("favorites").insert({ user_id: user.id, item_type: itemType, item_id: itemId });
  return true;
}

/* ── COURIER (ENTREGADOR) API ────────────────────────────── */

export async function getOrderPaymentStatus(orderId: string): Promise<string> {
  const { data } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .single();
  return (data?.payment_status as string | null) ?? "PENDING";
}

/* ── CUPONS DISPONÍVEIS (públicos, ativos) ───────────────── */
