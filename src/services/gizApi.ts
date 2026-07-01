import { supabase } from "../lib/supabase";
import { shoppingDb } from "./shoppingSupabase";
import { useAuthStore } from "../stores/authStore";
import { BRASUX_API, authHeaders } from "./auth";

const IMAGE_BASE_URL =
  import.meta.env.VITE_IMAGE_BASE_URL ||
  "https://cbyufprmiuwvhsxsxttn.supabase.co/storage/v1/object/public";

// api-gizapp deployada no Render — usada apenas para o banco de imagens (catálogo)
export const GIZ_API_URL = (import.meta.env.VITE_API_URL as string) || "";

// ID da loja no Supabase (usado em todas as queries Supabase)
export const DEFAULT_STORE_ID = "21f2f9d1-de5f-40b5-a3fc-765aba6d70a0";

async function brasuxFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BRASUX_API}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) throw new Error((data.message as string) ?? `Erro ${res.status}`);
  return data as T;
}

/* ── AUTH TYPES ─────────────────────────────────────────── */

export type AuthResponse = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Customer" | "Seller" | "Courier";
  storeId?: string | null;
  token: string;
};

export type LoginPayload = { email: string; password: string };

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  role?: "Customer";
  storeId?: null;
};

export async function loginCustomer(payload: LoginPayload): Promise<AuthResponse> {
  return brasuxFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: payload.email.trim().toLowerCase(), password: payload.password }),
  });
}

export async function registerCustomer(payload: RegisterPayload): Promise<AuthResponse> {
  return brasuxFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: payload.name.trim(), email: payload.email.trim().toLowerCase(), password: payload.password, role: "Customer" }),
  });
}

/* ── STORE TYPES ─────────────────────────────────────────── */

export type Store = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  deliveryFee: number;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  rating: number;
  isOpen: boolean;
  active: boolean;
  featured: boolean;
  lat?: number;
  lng?: number;
  createdAt: string;
  updatedAt: string;
};

function mapStore(row: Record<string, unknown>): Store {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    category: row.category as string,
    description: row.description as string | undefined,
    logoUrl: row.logo_url as string | undefined,
    bannerUrl: row.banner_url as string | undefined,
    phone: row.phone as string | undefined,
    whatsapp: row.whatsapp as string | undefined,
    email: row.email as string | undefined,
    address: row.address as string | undefined,
    number: row.number as string | undefined,
    complement: row.complement as string | undefined,
    neighborhood: row.neighborhood as string | undefined,
    city: row.city as string | undefined,
    state: row.state as string | undefined,
    zipCode: row.zip_code as string | undefined,
    deliveryFee: Number(row.delivery_fee),
    deliveryTimeMin: Number(row.delivery_time_min),
    deliveryTimeMax: Number(row.delivery_time_max),
    rating: Number(row.rating),
    isOpen: row.is_open as boolean,
    active: row.active as boolean,
    featured: row.featured as boolean,
    lat: row.lat != null ? Number(row.lat) : undefined,
    lng: row.lng != null ? Number(row.lng) : undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/* ── PRODUCT TYPES ───────────────────────────────────────── */

export type Product = {
  id: string;
  storeId?: string;
  name: string;
  slug: string;
  category: string;
  subCategory?: string;
  brand?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string;
  imageUrl?: string;
  imageAlt?: string;
  price?: number;
  available: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PagedProducts = {
  items: Product[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type ProductQuery = {
  category?: string;
  search?: string;
  available?: boolean;
  page?: number;
  pageSize?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: "default" | "price-asc" | "price-desc" | "newest";
};

export type StoreProduct = {
  id: string;
  storeId: string;
  productId: string;
  name: string;
  slug: string;
  category: string;
  subCategory?: string;
  brand?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string;
  imageUrl?: string;
  imageAlt?: string;
  price: number;
  promotionalPrice?: number | null;
  stock: number;
  available: boolean;
  featured?: boolean;
  /** Preenchido quando fetchado com join em stores */
  storeName?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoreProductsQuery = {
  storeId?: string;
  category?: string;
  search?: string;
  available?: boolean;
};

function mapStoreProduct(row: Record<string, unknown>): StoreProduct {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    productId: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    category: row.category as string,
    subCategory: row.sub_category as string | undefined,
    brand: row.brand as string | undefined,
    description: row.description as string | undefined,
    seoTitle: row.seo_title as string | undefined,
    seoDescription: row.seo_description as string | undefined,
    keywords: row.keywords as string | undefined,
    imageUrl: row.image_url as string | undefined,
    imageAlt: row.image_alt as string | undefined,
    price: Number(row.price),
    promotionalPrice: row.promotional_price != null ? Number(row.promotional_price) : null,
    stock: Number(row.stock),
    available: row.available as boolean,
    featured: (row.featured as boolean | null) ?? false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Retorna os produtos marcados como destaque (featured=true) com o nome da loja. */
export async function getFeaturedProducts(): Promise<StoreProduct[]> {
  const { data, error } = await shoppingDb
    .from("store_products")
    .select("*, stores(name)")
    .eq("featured", true)
    .eq("available", true)
    .order("name");
  if (error) throw new Error("Erro ao buscar produtos em destaque.");
  return (data ?? []).map((row) => ({
    ...mapStoreProduct(row),
    storeName: (row.stores as { name: string } | null)?.name ?? "Loja",
  }));
}

export type FeaturedStore = {
  storeId: string;
  storeName: string;
  products: StoreProduct[];
};

/** Retorna produtos em destaque agrupados por loja — para a home. */
export async function getFeaturedByStore(): Promise<FeaturedStore[]> {
  const { data, error } = await supabase
    .from("store_products")
    .select("*, stores(name)")
    .eq("featured", true)
    .eq("available", true)
    .order("name");
  if (error) throw new Error("Erro ao buscar destaques por loja.");

  const map = new Map<string, FeaturedStore>();
  for (const row of data ?? []) {
    const storeName = (row.stores as { name: string } | null)?.name ?? "Loja";
    const storeId = row.store_id as string;
    if (!map.has(storeId)) {
      map.set(storeId, { storeId, storeName, products: [] });
    }
    map.get(storeId)!.products.push({
      ...mapStoreProduct(row),
      storeName,
    });
  }

  return Array.from(map.values());
}

/* ── ORDER TYPES ─────────────────────────────────────────── */

export type CreateOrderItem = { storeProductId: string; quantity: number };

export type CreateOrderPayload = {
  storeId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNumber: string;
  deliveryComplement: string;
  deliveryNeighborhood: string;
  deliveryZipCode?: string;
  paymentMethod: string;
  items: CreateOrderItem[];
  deliveryFeeOverride?: number;
  couponCode?: string;
  pointsDiscount?: number;
  customerCpfCnpj?: string;
  customerEmail?: string;
  // Dados do cartão (apenas para paymentMethod === 'card')
  cardNumber?: string;
  cardHolderName?: string;
  cardExpiryMonth?: string;
  cardExpiryYear?: string;
  cardCcv?: string;
};

export type OrderItem = {
  id: string;
  orderId: string;
  storeProductId: string;
  productName: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
};

export type Order = {
  id: string;
  storeId: string;
  storeName?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNumber: string;
  deliveryComplement: string;
  deliveryNeighborhood: string;
  paymentMethod: string;
  deliveryFee: number;
  subtotal: number;
  total: number;
  status: number;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  // Campos de pagamento Asaas (presentes apenas quando cobrança foi criada)
  paymentLink?: string;
  pixPayload?: string;
  pixQrCodeImage?: string;
  dueDate?: string;
  // Campos específicos do cartão
  cardConfirmed?: boolean;
  cardDeclined?: boolean;
  cardDeclineReason?: string | null;
};

type OrderRow = {
  id: string;
  store_id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_number?: string;
  delivery_complement?: string;
  delivery_neighborhood: string;
  payment_method: string;
  delivery_fee: number;
  subtotal: number;
  total: number;
  status: number;
  payment_status?: string;
  created_at: string;
  updated_at: string;
  stores?: { name: string } | null;
  order_items?: Array<{
    id: string;
    order_id: string;
    store_product_id: string;
    product_name: string;
    image_url?: string;
    unit_price: number;
    quantity: number;
    total_price: number;
  }>;
};

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    storeId: row.store_id,
    storeName: row.stores?.name,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryAddress: row.delivery_address,
    deliveryNumber: row.delivery_number ?? "",
    deliveryComplement: row.delivery_complement ?? "",
    deliveryNeighborhood: row.delivery_neighborhood,
    paymentMethod: row.payment_method,
    deliveryFee: Number(row.delivery_fee),
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    status: row.status,
    paymentStatus: row.payment_status ?? "PENDING",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.order_items ?? []).map((i) => ({
      id: i.id,
      orderId: i.order_id,
      storeProductId: i.store_product_id,
      productName: i.product_name,
      imageUrl: i.image_url,
      unitPrice: Number(i.unit_price),
      quantity: i.quantity,
      totalPrice: Number(i.total_price),
    })),
  };
}

/* ── STORES API ──────────────────────────────────────────── */

export async function getStores(): Promise<Store[]> {
  const { data, error } = await shoppingDb
    .from("stores")
    .select("*")
    .order("featured", { ascending: false })
    .order("name");
  if (error) throw new Error("Erro ao buscar lojas");
  return data.map(mapStore);
}

export async function getStoreById(storeId: string): Promise<Store> {
  const { data, error } = await shoppingDb
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .single();
  if (error || !data) throw new Error("Erro ao buscar loja");
  return mapStore(data);
}

/* ── STORE PRODUCTS API ──────────────────────────────────── */

export async function getStoreProducts(params?: StoreProductsQuery): Promise<StoreProduct[]> {
  let query = shoppingDb.from("store_products").select("*");

  if (params?.storeId) query = query.eq("store_id", params.storeId);
  if (params?.available !== false) query = query.eq("available", true);
  if (params?.category) query = query.eq("category", params.category);
  if (params?.search) {
    const q = params.search.toLowerCase();
    query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%,brand.ilike.%${q}%`);
  }

  const { data, error } = await query.order("name");
  if (error) throw new Error("Erro ao buscar produtos da loja");
  return data.map(mapStoreProduct);
}

export async function getStoreProductsByCategory(
  category: string,
  storeId?: string
): Promise<StoreProduct[]> {
  let query = shoppingDb
    .from("store_products")
    .select("*")
    .eq("category", category)
    .eq("available", true);

  if (storeId) query = query.eq("store_id", storeId);

  const { data, error } = await query.order("name");
  if (error) throw new Error("Erro ao buscar categoria da loja");
  return data.map(mapStoreProduct);
}

/* ── PRODUCTS API (global) ───────────────────────────────── */

export async function getProducts(params?: ProductQuery): Promise<PagedProducts> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = shoppingDb.from("store_products").select("*", { count: "exact" });

  if (params?.available !== false) query = query.eq("available", true);
  if (params?.category) query = query.eq("category", params.category);
  if (params?.search) {
    const term = params.search.trim();
    if (term.length >= 3) {
      // Full-text search com suporte a acentos e typos (search_vector + pg_trgm)
      query = query.textSearch("search_vector", term, {
        type: "websearch",
        config: "portuguese_unaccent",
      });
    } else {
      // Query curta: prefix ILIKE
      query = query.ilike("name", `${term}%`);
    }
  }
  if (params?.minPrice !== undefined) query = query.gte("price", params.minPrice);
  if (params?.maxPrice !== undefined) query = query.lte("price", params.maxPrice);

  if (!params?.sort || params.sort === "default") {
    query = query.order("name");
  } else if (params.sort === "price-asc") {
    query = query.order("price", { ascending: true });
  } else if (params.sort === "price-desc") {
    query = query.order("price", { ascending: false });
  } else if (params.sort === "newest") {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error("Erro ao buscar produtos");

  const totalItems = count ?? 0;
  const products = data.map((row) => ({
    id: row.id as string,
    storeId: row.store_id as string,
    name: row.name as string,
    slug: row.slug as string,
    category: row.category as string,
    subCategory: row.sub_category as string | undefined,
    brand: row.brand as string | undefined,
    description: row.description as string | undefined,
    imageUrl: row.image_url as string | undefined,
    imageAlt: row.image_alt as string | undefined,
    price: Number(row.price),
    available: row.available as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));

  return {
    items: products,
    page,
    pageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / pageSize),
  };
}

/** Envia notificação push para um usuário via Edge Function. Fire-and-forget. */
export function sendPushToUser(
  userId: string,
  title:  string,
  body:   string,
  url?:   string,
): void {
  supabase.functions.invoke("send-push", { body: { userId, title, body, url } }).catch(() => null);
}

/** Sugestões de autocomplete para a barra de busca. */
export async function getSearchSuggestions(
  query: string,
): Promise<Array<{ label: string; category: string }>> {
  if (!query.trim() || query.trim().length < 2) return [];
  const { data } = await supabase.rpc("get_search_suggestions", {
    p_query: query.trim(),
    p_limit: 6,
  });
  return (data ?? []) as Array<{ label: string; category: string }>;
}

export async function getProductBySlug(slug: string): Promise<Product> {
  const { data, error } = await shoppingDb
    .from("store_products")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error || !data) throw new Error("Produto não encontrado");

  return {
    id: data.id as string,
    storeId: data.store_id as string,
    name: data.name as string,
    slug: data.slug as string,
    category: data.category as string,
    imageUrl: data.image_url as string | undefined,
    price: Number(data.price),
    available: data.available as boolean,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

/* ── ORDERS API ──────────────────────────────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_PAYMENT_METHODS = new Set(["pix", "card", "boleto", "cash", "dinheiro"]);

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  if (!UUID_RE.test(payload.storeId)) throw new Error("Loja inválida.");
  if (!payload.items?.length || payload.items.length > 50) throw new Error("Itens inválidos.");
  if (!ALLOWED_PAYMENT_METHODS.has(payload.paymentMethod)) throw new Error("Método de pagamento inválido.");
  if (!payload.deliveryAddress?.trim() || !payload.deliveryNeighborhood?.trim()) throw new Error("Endereço incompleto.");

  const body: Record<string, unknown> = {
    storeId:               payload.storeId,
    customerName:          payload.customerName,
    customerPhone:         payload.customerPhone,
    deliveryAddress:       payload.deliveryAddress,
    deliveryNumber:        payload.deliveryNumber,
    deliveryComplement:    payload.deliveryComplement,
    deliveryNeighborhood:  payload.deliveryNeighborhood,
    paymentMethod:         payload.paymentMethod,
    items:                 payload.items.map((i) => ({ storeProductId: i.storeProductId, quantity: i.quantity })),
  };
  if (payload.couponCode?.trim())           body.couponCode = payload.couponCode.trim();
  if (payload.deliveryFeeOverride !== undefined) body.deliveryFeeOverride = payload.deliveryFeeOverride;
  if (payload.deliveryZipCode)              body.deliveryZipCode = payload.deliveryZipCode.replace(/\D/g, '');
  if (payload.customerCpfCnpj)             body.customerCpfCnpj = payload.customerCpfCnpj;
  if (payload.customerEmail)               body.customerEmail = payload.customerEmail;
  // Cartão: só envia se todos os campos obrigatórios estiverem presentes
  if (payload.paymentMethod === 'card' && payload.cardNumber && payload.cardHolderName && payload.cardExpiryMonth && payload.cardExpiryYear && payload.cardCcv) {
    body.cardNumber      = payload.cardNumber.replace(/\D/g, '');
    body.cardHolderName  = payload.cardHolderName;
    body.cardExpiryMonth = payload.cardExpiryMonth;
    body.cardExpiryYear  = payload.cardExpiryYear;
    body.cardCcv         = payload.cardCcv;
  }

  return brasuxFetch<Order>("/api/orders", { method: "POST", body: JSON.stringify(body) });
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

export type UpdateProfilePayload = {
  name?: string;
  phone?: string;
  cpf?: string;
  zipCode?: string;
  address?: string;
  addressNumber?: string;
  addressComplement?: string;
  neighborhood?: string;
};

export type ProfileResponse = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
  zipCode?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  neighborhood?: string | null;
  updatedAt: string;
};

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

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Customer" | "Seller" | "Courier";
  active: boolean;
  storeId?: string | null;
  store?: { id: string; name: string; category: string } | null;
  createdAt: string;
};

export async function adminGetUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, role, active, store_id, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error("Erro ao buscar usuários.");

  const roleMap: Record<string, AdminUser["role"]> = {
    admin: "Admin", customer: "Customer", seller: "Seller", courier: "Courier",
  };

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: "",
    role: roleMap[row.role] ?? "Customer",
    active: row.active,
    storeId: row.store_id ?? null,
    store: null,
    createdAt: row.created_at,
  }));
}

export async function adminToggleUserActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
  if (error) throw new Error("Erro ao atualizar usuário.");
}

/* ── SELLER ORDERS API ───────────────────────────────────── */

export async function getStoreOrders(storeId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, stores(name), order_items(*)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Erro ao buscar pedidos da loja.");
  return (data ?? []).map((row) => mapOrder(row as OrderRow));
}

const SELLER_ALLOWED_STATUSES = new Set([2, 3, 4, 5]); // preparando, saiu, entregue, cancelado

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
}

/* ── ADMIN ORDERS API ─────────────────────────────────────── */

export async function adminGetAllOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, stores(name), order_items(*)")
    .order("created_at", { ascending: false });

  if (error) throw new Error("Erro ao buscar pedidos.");
  return (data ?? []).map((row) => mapOrder(row as OrderRow));
}

export async function adminUpdateOrderStatus(id: string, status: number): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw new Error("Erro ao atualizar status.");
}

/* ── SELLER: STORE MANAGEMENT ────────────────────────────── */

export type StorePayload = {
  name: string;
  slug: string;
  category: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  deliveryFee?: number;
  deliveryTimeMin?: number;
  deliveryTimeMax?: number;
  isOpen?: boolean;
  active?: boolean;
  lat?: number | null;
  lng?: number | null;
};

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

export type StoreProductPayload = {
  name: string;
  slug: string;
  category: string;
  subCategory?: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  price: number;
  promotionalPrice?: number | null;
  stock?: number;
  available?: boolean;
  featured?: boolean;
};

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

const ALLOWED_IMAGE_TYPES: Record<string, { ext: string; magic: number[][] }> = {
  "image/jpeg": { ext: "jpg",  magic: [[0xFF, 0xD8, 0xFF]] },
  "image/png":  { ext: "png",  magic: [[0x89, 0x50, 0x4E, 0x47]] },
  "image/webp": { ext: "webp", magic: [[0x52, 0x49, 0x46, 0x46]] },
  "image/gif":  { ext: "gif",  magic: [[0x47, 0x49, 0x46, 0x38]] },
};
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

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

export type CatalogImage = {
  id: string;
  slug: string;
  name: string;
  brand?: string;
  category: string;
  subcategory?: string;
  imageUrl: string;
};

export type CatalogResult = {
  products: CatalogImage[];
  total: number;
  totalPages: number;
};

export async function searchImageCatalog(params: {
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}): Promise<CatalogResult> {
  if (!GIZ_API_URL) return { products: [], total: 0, totalPages: 0 };
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.category) q.set("category", params.category);
  q.set("page", String(params.page ?? 1));
  q.set("pageSize", String(params.pageSize ?? 24));
  const res = await fetch(`${GIZ_API_URL}/api/products?${q}`);
  if (!res.ok) throw new Error("Catálogo indisponível");
  const json = await res.json();
  return {
    products: (json.items ?? []).map((p: Record<string, unknown>) => ({
      id: String(p.id),
      slug: p.slug as string,
      name: p.name as string,
      brand: p.brand as string | undefined,
      category: p.category as string,
      subcategory: p.subCategory as string | undefined,
      imageUrl: p.imageUrl as string,
    })).filter((p: CatalogImage) => !!p.imageUrl),
    total: (json.totalItems as number) ?? 0,
    totalPages: (json.totalPages as number) ?? 0,
  };
}

export async function getImageApiCategories(): Promise<{ category: string; count: number }[]> {
  if (!GIZ_API_URL) return [];
  const res = await fetch(`${GIZ_API_URL}/api/categories`);
  if (!res.ok) return [];
  const categories: string[] = await res.json();
  return categories.map((c) => ({ category: c, count: 0 }));
}

/* ── REVIEWS API ─────────────────────────────────────────── */

export type Review = {
  id: string;
  storeProductId: string;
  userId: string;
  userName: string;
  stars: number;
  comment?: string;
  createdAt: string;
};

export async function getProductReviews(storeProductId: string): Promise<Review[]> {
  const { data } = await supabase
    .from("reviews")
    .select("*, profiles(name)")
    .eq("store_product_id", storeProductId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    storeProductId: r.store_product_id,
    userId: r.user_id,
    userName: (r.profiles as { name?: string } | null)?.name ?? "Usuário",
    stars: r.stars,
    comment: r.comment ?? undefined,
    createdAt: r.created_at,
  }));
}

export async function getMyReview(storeProductId: string): Promise<Review | null> {
  const user = useAuthStore.getState().user;
  if (!user) return null;
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("store_product_id", storeProductId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    storeProductId: data.store_product_id,
    userId: data.user_id,
    userName: "",
    stars: data.stars,
    comment: data.comment ?? undefined,
    createdAt: data.created_at,
  };
}

export async function upsertReview(storeProductId: string, stars: number, comment?: string): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Faça login para avaliar.");
  const { error } = await supabase
    .from("reviews")
    .upsert(
      { store_product_id: storeProductId, user_id: user.id, stars, comment: comment?.trim() || null },
      { onConflict: "store_product_id,user_id" }
    );
  if (error) throw new Error("Erro ao salvar avaliação.");
}

export async function deleteReview(storeProductId: string): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return;
  await supabase
    .from("reviews")
    .delete()
    .eq("store_product_id", storeProductId)
    .eq("user_id", user.id);
}

/* ── POINTS API ──────────────────────────────────────────── */

export type PointTransaction = {
  id: string;
  amount: number;
  description: string;
  orderId?: string;
  createdAt: string;
};

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

export type CouponDB = {
  id: string;
  code: string;
  type: "percent" | "fixed" | "free_delivery";
  value: number;
  label: string;
  minOrder: number;
};

export async function validateCoupon(code: string, storeId: string, orderValue?: number): Promise<CouponDB> {
  type ValidateResp = { valid: boolean; discountType: string; discountValue: number; description?: string; minOrderValue?: number };
  const resp = await brasuxFetch<ValidateResp>("/api/coupons/validate", {
    method: "POST",
    body: JSON.stringify({ code: code.toUpperCase().trim(), storeId, orderValue: orderValue ?? 0 }),
  });
  return {
    id: code,
    code: code.toUpperCase().trim(),
    type: (resp.discountType === "percent" ? "percent" : "fixed") as CouponDB["type"],
    value: Number(resp.discountValue),
    label: resp.description ?? (resp.discountType === "percent" ? `${resp.discountValue}% off` : `R$ ${resp.discountValue} off`),
    minOrder: Number(resp.minOrderValue ?? 0),
  };
}

/* ── SAVED ADDRESSES API ─────────────────────────────────── */

export type SavedAddressDB = {
  id: string;
  label: string;
  phone?: string;
  cep?: string;
  address: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city?: string;
};

function mapAddress(r: Record<string, unknown>): SavedAddressDB {
  return {
    id: r.id as string,
    label: r.label as string,
    phone: (r.phone as string | null) ?? undefined,
    cep: (r.cep as string | null) ?? undefined,
    address: r.address as string,
    number: r.number as string,
    complement: (r.complement as string | null) ?? undefined,
    neighborhood: r.neighborhood as string,
    city: (r.city as string | null) ?? undefined,
  };
}

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

export type AvailableDelivery = {
  orderId: string;
  storeId: string;
  storeName: string;
  storeAddress?: string;
  deliveryAddress: string;
  deliveryNumber: string;
  deliveryNeighborhood: string;
  deliveryFee: number;
  total: number;
  createdAt: string;
  courierEarnings: number; // 70% da taxa de entrega, mínimo R$3
};

export type DeliveryOrder = {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNumber: string;
  deliveryComplement?: string;
  deliveryNeighborhood: string;
  total: number;
  deliveryFee: number;
  storeName?: string;
  storeAddress?: string;
  storeNeighborhood?: string;
  items: Array<{ id: string; productName: string; quantity: number; unitPrice: number; totalPrice: number }>;
};

export type Delivery = {
  id: string;
  orderId: string;
  courierId: string;
  status: "ACCEPTED" | "PICKED_UP" | "DELIVERED" | "CANCELLED";
  earnings: number;
  acceptedAt: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  createdAt: string;
  order?: DeliveryOrder;
};

export type CourierEarningSummary = {
  todayTotal: number;
  weekTotal: number;
  allTimeTotal: number;
  deliveriesCount: number;
};

export type WithdrawalRequest = {
  id: string;
  amount: number;
  pixKey: string;
  status: "PENDING" | "PAID" | "REJECTED";
  note?: string;
  createdAt: string;
};

function mapDelivery(row: Record<string, unknown>): Delivery {
  const order = row.orders as Record<string, unknown> | null;
  const store = order?.stores as Record<string, unknown> | null;
  const rawItems = (order?.order_items as Array<Record<string, unknown>> | null) ?? [];
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    courierId: row.courier_id as string,
    status: row.status as Delivery["status"],
    earnings: Number(row.earnings),
    acceptedAt: row.accepted_at as string,
    pickedUpAt: (row.picked_up_at as string | null) ?? undefined,
    deliveredAt: (row.delivered_at as string | null) ?? undefined,
    createdAt: row.created_at as string,
    order: order
      ? {
          customerName: order.customer_name as string,
          customerPhone: order.customer_phone as string,
          deliveryAddress: order.delivery_address as string,
          deliveryNumber: (order.delivery_number as string | null) ?? "",
          deliveryComplement: (order.delivery_complement as string | null) ?? undefined,
          deliveryNeighborhood: order.delivery_neighborhood as string,
          total: Number(order.total),
          deliveryFee: Number(order.delivery_fee),
          storeName: (store?.name as string | null) ?? undefined,
          storeAddress: (store?.address as string | null) ?? undefined,
          storeNeighborhood: (store?.neighborhood as string | null) ?? undefined,
          items: rawItems.map((i) => ({
            id: i.id as string,
            productName: i.product_name as string,
            quantity: i.quantity as number,
            unitPrice: Number(i.unit_price),
            totalPrice: Number(i.total_price),
          })),
        }
      : undefined,
  };
}

export async function getAvailableDeliveries(): Promise<AvailableDelivery[]> {
  // Busca pedidos em status=2 que ainda não foram aceitos por nenhum entregador
  const [ordersRes, takenRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, store_id, total, delivery_fee, delivery_address, delivery_number, delivery_neighborhood, created_at, stores(name, address, neighborhood)")
      .eq("status", 2)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("deliveries")
      .select("order_id")
      .neq("status", "CANCELLED"),
  ]);

  if (ordersRes.error) throw new Error("Erro ao buscar entregas disponíveis.");

  const takenIds = new Set((takenRes.data ?? []).map((d) => d.order_id as string));

  return (ordersRes.data ?? [])
    .filter((o) => !takenIds.has(o.id as string))
    .map((o) => {
      const store = o.stores as { name?: string; address?: string; neighborhood?: string } | null;
      const fee = Number(o.delivery_fee);
      return {
        orderId: o.id as string,
        storeId: o.store_id as string,
        storeName: store?.name ?? "Loja",
        storeAddress: store?.address
          ? `${store.address}${store.neighborhood ? `, ${store.neighborhood}` : ""}`
          : undefined,
        deliveryAddress: o.delivery_address as string,
        deliveryNumber: (o.delivery_number as string | null) ?? "",
        deliveryNeighborhood: o.delivery_neighborhood as string,
        deliveryFee: fee,
        total: Number(o.total),
        createdAt: o.created_at as string,
        courierEarnings: Math.max(7, Math.round(fee * 0.9 * 100) / 100),
      };
    });
}

export async function acceptDelivery(orderId: string): Promise<Delivery> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Não autenticado.");
  const { data, error } = await supabase
    .rpc("accept_delivery_safe", { p_order_id: orderId, p_courier_id: user.id });
  if (error) {
    if (error.code === "23505") throw new Error("Esta entrega já foi aceita por outro entregador.");
    throw new Error("Erro ao aceitar entrega.");
  }
  return mapDelivery(data as Record<string, unknown>);
}

export async function getMyDeliveries(): Promise<Delivery[]> {
  const user = useAuthStore.getState().user;
  if (!user) return [];
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, orders(customer_name, customer_phone, delivery_address, delivery_number, delivery_complement, delivery_neighborhood, total, delivery_fee, stores(name, address, neighborhood), order_items(id, product_name, quantity, unit_price, total_price))")
    .eq("courier_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error("Erro ao buscar suas entregas.");
  return (data ?? []).map((d) => mapDelivery(d as Record<string, unknown>));
}

export async function updateDeliveryStatus(
  deliveryId: string,
  newStatus: "PICKED_UP" | "DELIVERED" | "CANCELLED",
): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Não autenticado.");

  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === "PICKED_UP")  updates.picked_up_at = new Date().toISOString();
  if (newStatus === "DELIVERED")  updates.delivered_at = new Date().toISOString();

  const { data: delivery, error } = await supabase
    .from("deliveries")
    .update(updates)
    .eq("id", deliveryId)
    .eq("courier_id", user.id)
    .select("order_id, earnings")
    .single();

  if (error || !delivery) throw new Error("Erro ao atualizar entrega.");

  // Atualiza status do pedido
  const orderStatus = newStatus === "PICKED_UP" ? 3 : newStatus === "DELIVERED" ? 4 : undefined;
  if (orderStatus !== undefined) {
    await supabase.from("orders").update({ status: orderStatus }).eq("id", delivery.order_id);
  }

  // Credita ganho ao entregador e libera saldo HELD quando entrega é concluída
  if (newStatus === "DELIVERED") {
    await supabase.from("courier_earnings").insert({
      courier_id: user.id,
      delivery_id: deliveryId,
      amount: Number(delivery.earnings),
      description: `Entrega #${(delivery.order_id as string).slice(0, 8).toUpperCase()}`,
    });

    // Libera saldo HELD → AVAILABLE para vendedor e entregador via Edge Function
    supabase.functions.invoke("release-balance", {
      body: { orderId: delivery.order_id },
    }).catch(() => null); // fire-and-forget: o split já está registrado; falha não bloqueia o fluxo
  }
}

export async function updateCourierLocation(lat: number, lng: number, heading?: number): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return;
  await supabase
    .from("courier_locations")
    .upsert({ courier_id: user.id, lat, lng, heading: heading ?? null, updated_at: new Date().toISOString() });
}

export async function getCourierEarningsSummary(): Promise<CourierEarningSummary> {
  const user = useAuthStore.getState().user;
  if (!user) return { todayTotal: 0, weekTotal: 0, allTimeTotal: 0, deliveriesCount: 0 };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from("courier_earnings")
    .select("amount, created_at")
    .eq("courier_id", user.id)
    .order("created_at", { ascending: false });

  const earnings = data ?? [];
  const todayTotal = earnings
    .filter((e) => new Date(e.created_at) >= todayStart)
    .reduce((s, e) => s + Number(e.amount), 0);
  const weekTotal = earnings
    .filter((e) => new Date(e.created_at) >= weekStart)
    .reduce((s, e) => s + Number(e.amount), 0);
  const allTimeTotal = earnings.reduce((s, e) => s + Number(e.amount), 0);

  return { todayTotal, weekTotal, allTimeTotal, deliveriesCount: earnings.length };
}

export async function getMyWithdrawals(): Promise<WithdrawalRequest[]> {
  const user = useAuthStore.getState().user;
  if (!user) return [];
  const { data } = await supabase
    .from("courier_withdrawals")
    .select("*")
    .eq("courier_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((w) => ({
    id: w.id,
    amount: Number(w.amount),
    pixKey: w.pix_key,
    status: w.status as WithdrawalRequest["status"],
    note: (w.note as string | null) ?? undefined,
    createdAt: w.created_at,
  }));
}

export async function requestCourierWithdrawal(amount: number, pixKey: string): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Não autenticado.");
  const { error } = await supabase
    .from("courier_withdrawals")
    .insert({ courier_id: user.id, amount, pix_key: pixKey });
  if (error) throw new Error("Erro ao solicitar saque.");
}

/* ── ADMIN: COUPONS ──────────────────────────────────────── */

export type CouponAdmin = {
  id: string;
  code: string;
  type: "percent" | "fixed" | "free_delivery";
  value: number;
  label: string;
  minOrder: number;
  maxUses?: number;
  usesCount: number;
  expiresAt?: string;
  active: boolean;
  createdAt: string;
};

export type CouponAdminPayload = {
  code: string;
  type: "percent" | "fixed" | "free_delivery";
  value: number;
  label: string;
  minOrder?: number;
  maxUses?: number | null;
  expiresAt?: string | null;
  active?: boolean;
};

function mapCouponAdmin(r: Record<string, unknown>): CouponAdmin {
  return {
    id:        r.id as string,
    code:      r.code as string,
    type:      r.type as CouponAdmin["type"],
    value:     Number(r.value),
    label:     r.label as string,
    minOrder:  Number(r.min_order ?? 0),
    maxUses:   r.max_uses != null ? Number(r.max_uses) : undefined,
    usesCount: Number(r.uses_count ?? 0),
    expiresAt: (r.expires_at as string | null) ?? undefined,
    active:    r.active as boolean,
    createdAt: r.created_at as string,
  };
}

export async function adminGetCoupons(): Promise<CouponAdmin[]> {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Erro ao buscar cupons.");
  return (data ?? []).map(mapCouponAdmin);
}

export async function adminCreateCoupon(payload: CouponAdminPayload): Promise<void> {
  const { error } = await supabase.from("coupons").insert({
    code:       payload.code.toUpperCase().trim(),
    type:       payload.type,
    value:      payload.value,
    label:      payload.label,
    min_order:  payload.minOrder ?? 0,
    max_uses:   payload.maxUses ?? null,
    expires_at: payload.expiresAt ?? null,
    active:     payload.active ?? true,
    uses_count: 0,
  });
  if (error) throw new Error(error.message ?? "Erro ao criar cupom.");
}

export async function adminUpdateCoupon(id: string, patch: Partial<CouponAdminPayload>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.code      !== undefined) update.code       = patch.code.toUpperCase().trim();
  if (patch.type      !== undefined) update.type       = patch.type;
  if (patch.value     !== undefined) update.value      = patch.value;
  if (patch.label     !== undefined) update.label      = patch.label;
  if (patch.minOrder  !== undefined) update.min_order  = patch.minOrder;
  if (patch.maxUses   !== undefined) update.max_uses   = patch.maxUses ?? null;
  if (patch.expiresAt !== undefined) update.expires_at = patch.expiresAt ?? null;
  if (patch.active    !== undefined) update.active     = patch.active;
  const { error } = await supabase.from("coupons").update(update).eq("id", id);
  if (error) throw new Error("Erro ao atualizar cupom.");
}

export async function adminDeleteCoupon(id: string): Promise<void> {
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) throw new Error("Erro ao excluir cupom.");
}

/* ── ADMIN: WITHDRAWALS ──────────────────────────────────── */

export type WithdrawalAdmin = {
  id: string;
  courierId: string;
  courierName: string;
  amount: number;
  pixKey: string;
  status: "PENDING" | "PAID" | "REJECTED";
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export async function adminGetWithdrawals(): Promise<WithdrawalAdmin[]> {
  const { data, error } = await supabase
    .from("courier_withdrawals")
    .select("*, profiles(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Erro ao buscar saques.");
  return (data ?? []).map((r) => ({
    id:          r.id,
    courierId:   r.courier_id,
    courierName: (r.profiles as { name?: string } | null)?.name ?? "Entregador",
    amount:      Number(r.amount),
    pixKey:      r.pix_key,
    status:      r.status as WithdrawalAdmin["status"],
    note:        (r.note as string | null) ?? undefined,
    createdAt:   r.created_at,
    updatedAt:   r.updated_at,
  }));
}

export async function adminUpdateWithdrawal(
  id: string,
  status: "PAID" | "REJECTED",
  note?: string,
): Promise<void> {
  const { error } = await supabase
    .from("courier_withdrawals")
    .update({ status, ...(note ? { note } : {}) })
    .eq("id", id);
  if (error) throw new Error("Erro ao atualizar saque.");
}

/* ── BANNERS API ─────────────────────────────────────────── */

export type Banner = {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  link?: string;
  linkLabel?: string;
  badge?: string;
};

export type AdminBanner = Banner & {
  active: boolean;
  sortOrder: number;
  startsAt?: string;
  endsAt?: string;
};

export type BannerPayload = {
  title: string;
  description?: string;
  imageUrl: string;
  link?: string;
  linkLabel?: string;
  badge?: string;
  active?: boolean;
  sortOrder?: number;
  startsAt?: string | null;
  endsAt?: string | null;
};

function mapAdminBanner(b: Record<string, unknown>): AdminBanner {
  return {
    id: b.id as string,
    title: b.title as string,
    description: (b.description as string | null) ?? undefined,
    imageUrl: b.image_url as string,
    link: (b.link as string | null) ?? undefined,
    linkLabel: (b.link_label as string | null) ?? undefined,
    badge: (b.badge as string | null) ?? undefined,
    active: b.active as boolean,
    sortOrder: b.sort_order as number,
    startsAt: (b.starts_at as string | null) ?? undefined,
    endsAt: (b.ends_at as string | null) ?? undefined,
  };
}

export async function adminGetBanners(): Promise<AdminBanner[]> {
  const { data, error } = await shoppingDb
    .from("banners")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error("Erro ao buscar banners.");
  return (data ?? []).map(mapAdminBanner);
}

const BANNER_ALLOWED_DOMAINS = ["brasux.com.br", "shopping.brasux.com.br"];

function validateBannerLink(link: string | undefined): void {
  if (!link) return;
  if (link.startsWith("/")) return;
  try {
    const host = new URL(link).hostname;
    if (!BANNER_ALLOWED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
      throw new Error(`Link de banner inválido: domínio não permitido (${host}).`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Link de banner")) throw e;
    throw new Error("Link de banner inválido.");
  }
}

export async function adminCreateBanner(payload: BannerPayload): Promise<void> {
  validateBannerLink(payload.link);
  const { error } = await shoppingDb.from("banners").insert({
    title: payload.title,
    description: payload.description ?? null,
    image_url: payload.imageUrl,
    link: payload.link ?? null,
    link_label: payload.linkLabel ?? null,
    badge: payload.badge ?? null,
    active: payload.active ?? true,
    sort_order: payload.sortOrder ?? 0,
    starts_at: payload.startsAt ?? null,
    ends_at: payload.endsAt ?? null,
  });
  if (error) throw new Error("Erro ao criar banner.");
}

export async function adminUpdateBanner(id: string, patch: Partial<BannerPayload>): Promise<void> {
  validateBannerLink(patch.link);
  const update: Record<string, unknown> = {};
  if (patch.title       !== undefined) update.title       = patch.title;
  if (patch.description !== undefined) update.description = patch.description ?? null;
  if (patch.imageUrl    !== undefined) update.image_url   = patch.imageUrl;
  if (patch.link        !== undefined) update.link        = patch.link ?? null;
  if (patch.linkLabel   !== undefined) update.link_label  = patch.linkLabel ?? null;
  if (patch.badge       !== undefined) update.badge       = patch.badge ?? null;
  if (patch.active      !== undefined) update.active      = patch.active;
  if (patch.sortOrder   !== undefined) update.sort_order  = patch.sortOrder;
  if (patch.startsAt    !== undefined) update.starts_at   = patch.startsAt ?? null;
  if (patch.endsAt      !== undefined) update.ends_at     = patch.endsAt ?? null;
  const { error } = await shoppingDb.from("banners").update(update).eq("id", id);
  if (error) throw new Error("Erro ao atualizar banner.");
}

export async function adminDeleteBanner(id: string): Promise<void> {
  const { error } = await shoppingDb.from("banners").delete().eq("id", id);
  if (error) throw new Error("Erro ao excluir banner.");
}

export async function getActiveBanners(): Promise<Banner[]> {
  const { data } = await shoppingDb
    .from("banners")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description ?? undefined,
    imageUrl: b.image_url,
    link: b.link ?? undefined,
    linkLabel: b.link_label ?? undefined,
    badge: b.badge ?? undefined,
  }));
}

/* ── PIX STATUS POLLING ──────────────────────────────────── */

export async function getOrderPaymentStatus(orderId: string): Promise<string> {
  try {
    const data = await brasuxFetch<{ paymentStatus?: string }>(`/api/orders/${orderId}`)
    return data.paymentStatus ?? "pending";
  } catch {
    return "pending";
  }
}

/* ── CUPONS DISPONÍVEIS (públicos, ativos) ───────────────── */

export type PublicCoupon = {
  id: string;
  code: string;
  label: string;
  type: "percent" | "fixed";
  value: number;
  minOrderValue: number | null;
  expiresAt: string | null;
};

export async function getAvailableCoupons(storeId?: string): Promise<PublicCoupon[]> {
  if (!storeId) return [];
  type ApiCoupon = { id: string; code: string; discount_type: string; discount_value: number; description?: string; min_order_value?: number; valid_until?: string };
  const list = await brasuxFetch<ApiCoupon[]>(`/api/coupons?storeId=${storeId}`);
  return list
    .filter((c) => !c.valid_until || new Date(c.valid_until) > new Date())
    .slice(0, 6)
    .map((c) => ({
      id: c.id,
      code: c.code,
      label: c.description ?? (c.discount_type === "percent" ? `${c.discount_value}% off` : `R$ ${c.discount_value} off`),
      type: (c.discount_type === "percent" ? "percent" : "fixed") as PublicCoupon["type"],
      value: Number(c.discount_value),
      minOrderValue: c.min_order_value != null ? Number(c.min_order_value) : null,
      expiresAt: c.valid_until ?? null,
    }));
}

/* ── SELLER WITHDRAWALS ──────────────────────────────────── */

export type SellerWithdrawal = {
  id: string;
  amount: number;
  pixKey: string;
  status: "PENDING" | "PAID" | "REJECTED";
  createdAt: string;
};

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

export type DayHours = { open: string; close: string; enabled: boolean };
export type OpeningHours = {
  seg: DayHours; ter: DayHours; qua: DayHours; qui: DayHours;
  sex: DayHours; sab: DayHours; dom: DayHours;
};

export const DEFAULT_DAY_HOURS: DayHours = { open: "09:00", close: "22:00", enabled: true };
export const DEFAULT_OPENING_HOURS: OpeningHours = {
  seg: { ...DEFAULT_DAY_HOURS },
  ter: { ...DEFAULT_DAY_HOURS },
  qua: { ...DEFAULT_DAY_HOURS },
  qui: { ...DEFAULT_DAY_HOURS },
  sex: { ...DEFAULT_DAY_HOURS },
  sab: { ...DEFAULT_DAY_HOURS },
  dom: { open: "10:00", close: "20:00", enabled: false },
};

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

export const queryKeys = {
  adminOrders: () => ["admin", "orders"] as const,
  stores: () => ["stores"] as const,
  store: (id: string) => ["stores", id] as const,
  storeProducts: (storeId: string) => ["storeProducts", storeId] as const,
  products: (params: ProductQuery) => ["products", params] as const,
  myOrders: () => ["orders", "my"] as const,
  productReviews: (storeProductId: string) => ["reviews", storeProductId] as const,
  myReview: (storeProductId: string) => ["reviews", storeProductId, "mine"] as const,
  myPoints: () => ["points", "my"] as const,
  myAddresses: () => ["addresses", "my"] as const,
  banners: () => ["banners"] as const,
  featuredProducts:  () => ["products", "featured"] as const,
  featuredByStore:   () => ["featured-by-store"] as const,
  adminCoupons:      () => ["admin", "coupons"] as const,
  adminWithdrawals:  () => ["admin", "withdrawals"] as const,
  suggestions: (query: string) => ["suggestions", query] as const,
  storeOrders: (storeId: string) => ["storeOrders", storeId] as const,
  myStoreProducts: (storeId: string) => ["myStoreProducts", storeId] as const,
  availableDeliveries: () => ["deliveries", "available"] as const,
  myDeliveries: () => ["deliveries", "mine"] as const,
  courierEarnings: () => ["courier", "earnings"] as const,
  myWithdrawals: () => ["courier", "withdrawals"] as const,
  sellerWithdrawals: () => ["seller", "withdrawals"] as const,
  availableCoupons: () => ["coupons", "available"] as const,
  storeHours: (storeId: string) => ["stores", storeId, "hours"] as const,
};

/* ── ADMIN: STORE MANAGEMENT ─────────────────────────────── */

export async function adminUpdateStore(
  id: string,
  patch: { active?: boolean; featured?: boolean; isOpen?: boolean },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.active    !== undefined) update.active   = patch.active;
  if (patch.featured  !== undefined) update.featured = patch.featured;
  if (patch.isOpen    !== undefined) update.is_open  = patch.isOpen;
  const { error } = await shoppingDb.from("stores").update(update).eq("id", id);
  if (error) throw new Error("Erro ao atualizar loja.");
}

/* ── ADMIN: USER ROLE MANAGEMENT ─────────────────────────── */

export async function adminUpdateUserRole(
  id: string,
  role: "admin" | "customer" | "seller" | "courier",
): Promise<void> {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) throw new Error("Erro ao atualizar função do usuário.");
}

/* ── IMAGES ──────────────────────────────────────────────── */

export function getProductImageUrl(imageUrl?: string): string {
  if (!imageUrl) return "/placeholder.png";
  if (imageUrl.startsWith("http")) return imageUrl;
  const base = IMAGE_BASE_URL.replace(/\/$/, "");
  const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${base}${path}`;
}

