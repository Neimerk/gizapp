// Parte do módulo gizApi (split por domínio). Não alterar lógica aqui.

import { supabase } from "../../lib/supabase";
import { shoppingDb } from "../shoppingSupabase";
import { useAuthStore } from "../../stores/authStore";
import type { OpeningHours, Order, OrderRow, SellerWithdrawal, Store, StorePayload, StoreProduct, StoreProductPayload } from "./core";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE, SELLER_ALLOWED_STATUSES, mapOrder, mapStore, mapStoreProduct, notifyOrderStatus } from "./core";

export async function getStoreOrders(storeId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, stores(name), order_items(*)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Erro ao buscar pedidos da loja.");
  return (data ?? []).map((row) => mapOrder(row as OrderRow));
}

export async function sellerUpdateOrderStatus(
  orderId: string,
  storeId: string,
  status: number,
): Promise<void> {
  if (!SELLER_ALLOWED_STATUSES.has(status)) {
    throw new Error("Status de pedido inválido.");
  }
  const { error, count } = await supabase
    .from("orders")
    .update({ status }, { count: "exact" })
    .eq("id", orderId)
    .eq("store_id", storeId);   // defesa em profundidade — RLS também verifica owner_id
  if (error) throw new Error("Erro ao atualizar status do pedido.");
  if (count === 0) throw new Error("Pedido não encontrado ou sem permissão.");
  void notifyOrderStatus(orderId, undefined, status);
}

/* ── ADMIN ORDERS API ─────────────────────────────────────── */

export async function getMyStore(): Promise<Store | null> {
  const user = useAuthStore.getState().user;
  if (!user) return null;
  const { data, error } = await shoppingDb
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return mapStore(data);
}

export async function createStore(payload: StorePayload): Promise<Store> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Não autenticado.");
  const { data, error } = await shoppingDb
    .from("stores")
    .insert({
      name: payload.name,
      slug: payload.slug,
      category: payload.category,
      description: payload.description,
      logo_url: payload.logoUrl,
      banner_url: payload.bannerUrl,
      phone: payload.phone,
      whatsapp: payload.whatsapp,
      email: payload.email,
      address: payload.address,
      number: payload.number,
      complement: payload.complement,
      neighborhood: payload.neighborhood,
      city: payload.city,
      state: payload.state,
      zip_code: payload.zipCode,
      delivery_fee: payload.deliveryFee ?? 0,
      delivery_time_min: payload.deliveryTimeMin ?? 30,
      delivery_time_max: payload.deliveryTimeMax ?? 60,
      is_open: payload.isOpen ?? true,
      active: payload.active ?? true,
      owner_id: user.id,
      lat: payload.lat ?? null,
      lng: payload.lng ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "Erro ao criar loja.");
  return mapStore(data);
}

export async function updateStore(storeId: string, payload: Partial<StorePayload>): Promise<Store> {
  const { data, error } = await shoppingDb
    .from("stores")
    .update({
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.slug !== undefined && { slug: payload.slug }),
      ...(payload.category !== undefined && { category: payload.category }),
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.logoUrl !== undefined && { logo_url: payload.logoUrl }),
      ...(payload.bannerUrl !== undefined && { banner_url: payload.bannerUrl }),
      ...(payload.phone !== undefined && { phone: payload.phone }),
      ...(payload.whatsapp !== undefined && { whatsapp: payload.whatsapp }),
      ...(payload.email !== undefined && { email: payload.email }),
      ...(payload.address !== undefined && { address: payload.address }),
      ...(payload.number !== undefined && { number: payload.number }),
      ...(payload.complement !== undefined && { complement: payload.complement }),
      ...(payload.neighborhood !== undefined && { neighborhood: payload.neighborhood }),
      ...(payload.city !== undefined && { city: payload.city }),
      ...(payload.state !== undefined && { state: payload.state }),
      ...(payload.zipCode !== undefined && { zip_code: payload.zipCode }),
      ...(payload.deliveryFee !== undefined && { delivery_fee: payload.deliveryFee }),
      ...(payload.deliveryTimeMin !== undefined && { delivery_time_min: payload.deliveryTimeMin }),
      ...(payload.deliveryTimeMax !== undefined && { delivery_time_max: payload.deliveryTimeMax }),
      ...(payload.isOpen !== undefined && { is_open: payload.isOpen }),
      ...(payload.active !== undefined && { active: payload.active }),
      ...(payload.lat !== undefined && { lat: payload.lat }),
      ...(payload.lng !== undefined && { lng: payload.lng }),
    })
    .eq("id", storeId)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "Erro ao atualizar loja.");
  return mapStore(data);
}

/* ── SELLER: PRODUCT MANAGEMENT ─────────────────────────── */

export async function getMyStoreProducts(storeId: string): Promise<StoreProduct[]> {
  const { data, error } = await shoppingDb
    .from("store_products")
    .select("*")
    .eq("store_id", storeId)
    .order("name");
  if (error) throw new Error("Erro ao buscar produtos.");
  return (data ?? []).map(mapStoreProduct);
}

export async function createStoreProduct(storeId: string, payload: StoreProductPayload): Promise<StoreProduct> {
  const { data, error } = await shoppingDb
    .from("store_products")
    .insert({
      store_id: storeId,
      name: payload.name,
      slug: payload.slug,
      category: payload.category,
      sub_category: payload.subCategory ?? null,
      brand: payload.brand ?? null,
      description: payload.description ?? null,
      image_url: payload.imageUrl ?? null,
      image_alt: payload.imageAlt ?? null,
      price: payload.price,
      promotional_price: payload.promotionalPrice ?? null,
      stock:     payload.stock ?? 0,
      available: payload.available ?? true,
      featured:  payload.featured ?? false,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "Erro ao criar produto.");
  return mapStoreProduct(data);
}

export async function updateStoreProduct(
  productId: string,
  storeId: string,
  payload: Partial<StoreProductPayload>,
): Promise<StoreProduct> {
  const { data, error } = await shoppingDb
    .from("store_products")
    .update({
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.slug !== undefined && { slug: payload.slug }),
      ...(payload.category !== undefined && { category: payload.category }),
      ...(payload.subCategory !== undefined && { sub_category: payload.subCategory }),
      ...(payload.brand !== undefined && { brand: payload.brand }),
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.imageUrl !== undefined && { image_url: payload.imageUrl }),
      ...(payload.imageAlt !== undefined && { image_alt: payload.imageAlt }),
      ...(payload.price !== undefined && { price: payload.price }),
      ...(payload.promotionalPrice !== undefined && { promotional_price: payload.promotionalPrice }),
      ...(payload.stock !== undefined && { stock: payload.stock }),
      ...(payload.available !== undefined && { available: payload.available }),
      ...(payload.featured  !== undefined && { featured:  payload.featured  }),
    })
    .eq("id", productId)
    .eq("store_id", storeId)   // defesa em profundidade — RLS também verifica owner_id
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "Produto não encontrado ou sem permissão.");
  return mapStoreProduct(data);
}

export async function deleteStoreProduct(productId: string, storeId: string): Promise<void> {
  const { error, count } = await shoppingDb
    .from("store_products")
    .delete({ count: "exact" })
    .eq("id", productId)
    .eq("store_id", storeId);  // defesa em profundidade — RLS também verifica owner_id
  if (error) throw new Error("Erro ao remover produto.");
  if (count === 0) throw new Error("Produto não encontrado ou sem permissão.");
}

export async function uploadProductImage(file: File, storeId: string): Promise<string> {
  const typeConfig = ALLOWED_IMAGE_TYPES[file.type];
  if (!typeConfig) throw new Error("Formato não suportado. Use JPG, PNG, WebP ou GIF.");
  if (file.size > MAX_IMAGE_SIZE) throw new Error("Arquivo muito grande. Máximo 5 MB.");

  // Verifica magic bytes reais — impede spoofing do MIME type pelo browser
  const header = await file.slice(0, 8).arrayBuffer();
  const bytes = new Uint8Array(header);
  const validMagic = typeConfig.magic.some((sig) =>
    sig.every((byte, i) => bytes[i] === byte)
  );
  if (!validMagic) throw new Error("Arquivo inválido. O conteúdo não corresponde ao tipo de imagem.");

  const path = `${storeId}/${crypto.randomUUID()}.${typeConfig.ext}`;
  const { data, error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error || !data) throw new Error("Erro ao fazer upload da imagem.");
  const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(data.path);
  return publicUrl;
}

/* ── IMAGE API: BANCO DE IMAGENS (api-gizapp no Render) ─── */

export async function requestSellerWithdrawal(amount: number, pixKey: string): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Usuário não autenticado.");
  const { error } = await supabase.from("seller_withdrawals").insert({
    seller_id: user.id,
    amount,
    pix_key: pixKey,
    status: "PENDING",
  });
  if (error) throw new Error(error.message);
}

export async function getSellerWithdrawals(): Promise<SellerWithdrawal[]> {
  const { data, error } = await supabase
    .from("seller_withdrawals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((w) => ({
    id: w.id as string,
    amount: Number(w.amount),
    pixKey: w.pix_key as string,
    status: w.status as SellerWithdrawal["status"],
    createdAt: w.created_at as string,
  }));
}

/* ── STORE OPENING HOURS ─────────────────────────────────── */

export async function updateStoreOpeningHours(storeId: string, hours: OpeningHours): Promise<void> {
  const { error } = await shoppingDb
    .from("stores")
    .update({ opening_hours: hours })
    .eq("id", storeId);
  if (error) throw new Error(error.message);
}

export async function getStoreOpeningHours(storeId: string): Promise<OpeningHours | null> {
  const { data } = await shoppingDb
    .from("stores")
    .select("opening_hours")
    .eq("id", storeId)
    .single();
  return (data?.opening_hours as OpeningHours | null) ?? null;
}

/* ── QUERY KEYS ──────────────────────────────────────────── */
