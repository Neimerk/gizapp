import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";

const IMAGE_BASE_URL =
  import.meta.env.VITE_IMAGE_BASE_URL ||
  "https://cbyufprmiuwvhsxsxttn.supabase.co/storage/v1/object/public";

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

export async function loginCustomer(_payload: LoginPayload): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: _payload.email,
    password: _payload.password,
  });
  if (error || !data.user) throw new Error("Email ou senha inválidos.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role, store_id")
    .eq("id", data.user.id)
    .single();

  const roleMap: Record<string, AuthResponse["role"]> = {
    admin: "Admin", customer: "Customer", seller: "Seller", courier: "Courier",
  };

  return {
    id: data.user.id,
    name: profile?.name ?? "",
    email: data.user.email ?? "",
    role: roleMap[profile?.role ?? "customer"] ?? "Customer",
    storeId: profile?.store_id ?? null,
    token: data.session?.access_token ?? "",
  };
}

export async function registerCustomer(payload: RegisterPayload): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: { data: { name: payload.name, role: "customer" } },
  });
  if (error || !data.user) throw new Error(error?.message || "Erro ao cadastrar cliente.");

  return {
    id: data.user.id,
    name: payload.name,
    email: payload.email,
    role: "Customer",
    storeId: null,
    token: data.session?.access_token ?? "",
  };
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
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
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
  paymentMethod: string;
  items: CreateOrderItem[];
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
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
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
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .order("featured", { ascending: false })
    .order("name");
  if (error) throw new Error("Erro ao buscar lojas");
  return data.map(mapStore);
}

export async function getStoreById(storeId: string): Promise<Store> {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .single();
  if (error || !data) throw new Error("Erro ao buscar loja");
  return mapStore(data);
}

/* ── STORE PRODUCTS API ──────────────────────────────────── */

export async function getStoreProducts(params?: StoreProductsQuery): Promise<StoreProduct[]> {
  let query = supabase.from("store_products").select("*");

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
  let query = supabase
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

  let query = supabase.from("store_products").select("*", { count: "exact" });

  if (params?.available !== false) query = query.eq("available", true);
  if (params?.category) query = query.eq("category", params.category);
  if (params?.search) {
    const q = params.search.toLowerCase();
    query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%,brand.ilike.%${q}%`);
  }
  if (params?.minPrice !== undefined) query = query.gte("price", params.minPrice);
  if (params?.maxPrice !== undefined) query = query.lte("price", params.maxPrice);

  const { data, error, count } = await query.range(from, to).order("name");
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

export async function getProductBySlug(slug: string): Promise<Product> {
  const { data, error } = await supabase
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

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const user = useAuthStore.getState().user;

  const { data: store, error: storeErr } = await supabase
    .from("stores")
    .select("id, name, delivery_fee")
    .eq("id", payload.storeId)
    .single();
  if (storeErr || !store) throw new Error("Loja não encontrada.");

  const productIds = payload.items.map((i) => i.storeProductId);
  const { data: products, error: prodErr } = await supabase
    .from("store_products")
    .select("id, name, price, promotional_price, image_url")
    .in("id", productIds);
  if (prodErr) throw new Error("Erro ao buscar produtos.");

  const enriched = payload.items.map((item) => {
    const p = products.find((x) => x.id === item.storeProductId);
    if (!p) throw new Error(`Produto ${item.storeProductId} não encontrado.`);
    const unitPrice = Number(p.promotional_price ?? p.price);
    return { ...item, unitPrice, totalPrice: unitPrice * item.quantity, productName: p.name, imageUrl: p.image_url };
  });

  const deliveryFee = Number(store.delivery_fee);
  const subtotal = enriched.reduce((s, i) => s + i.totalPrice, 0);
  const total = subtotal + deliveryFee;

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      store_id: payload.storeId,
      customer_id: user?.id ?? null,
      customer_name: payload.customerName,
      customer_phone: payload.customerPhone,
      delivery_address: payload.deliveryAddress,
      delivery_number: payload.deliveryNumber,
      delivery_complement: payload.deliveryComplement,
      delivery_neighborhood: payload.deliveryNeighborhood,
      payment_method: payload.paymentMethod,
      delivery_fee: deliveryFee,
      subtotal,
      total,
      status: 0,
    })
    .select()
    .single();
  if (orderErr || !order) throw new Error("Erro ao criar pedido.");

  const { error: itemsErr } = await supabase.from("order_items").insert(
    enriched.map((i) => ({
      order_id: order.id,
      store_product_id: i.storeProductId,
      product_name: i.productName,
      image_url: i.imageUrl,
      unit_price: i.unitPrice,
      quantity: i.quantity,
      total_price: i.totalPrice,
    }))
  );
  if (itemsErr) throw new Error("Erro ao registrar itens do pedido.");

  return {
    id: order.id,
    storeId: order.store_id,
    storeName: store.name,
    customerId: order.customer_id ?? undefined,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    deliveryAddress: order.delivery_address,
    deliveryNumber: order.delivery_number ?? "",
    deliveryComplement: order.delivery_complement ?? "",
    deliveryNeighborhood: order.delivery_neighborhood,
    paymentMethod: order.payment_method,
    deliveryFee,
    subtotal,
    total,
    status: 0,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: enriched.map((i, idx) => ({
      id: `${order.id}-${idx}`,
      orderId: order.id,
      storeProductId: i.storeProductId,
      productName: i.productName,
      imageUrl: i.imageUrl,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      totalPrice: i.totalPrice,
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
};

export async function getMyStore(): Promise<Store | null> {
  const user = useAuthStore.getState().user;
  if (!user) return null;
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "Erro ao criar loja.");
  return mapStore(data);
}

export async function updateStore(storeId: string, payload: Partial<StorePayload>): Promise<Store> {
  const { data, error } = await supabase
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
};

export async function getMyStoreProducts(storeId: string): Promise<StoreProduct[]> {
  const { data, error } = await supabase
    .from("store_products")
    .select("*")
    .eq("store_id", storeId)
    .order("name");
  if (error) throw new Error("Erro ao buscar produtos.");
  return (data ?? []).map(mapStoreProduct);
}

export async function createStoreProduct(storeId: string, payload: StoreProductPayload): Promise<StoreProduct> {
  const { data, error } = await supabase
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
      stock: payload.stock ?? 0,
      available: payload.available ?? true,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "Erro ao criar produto.");
  return mapStoreProduct(data);
}

export async function updateStoreProduct(productId: string, payload: Partial<StoreProductPayload>): Promise<StoreProduct> {
  const { data, error } = await supabase
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
    })
    .eq("id", productId)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message || "Erro ao atualizar produto.");
  return mapStoreProduct(data);
}

export async function deleteStoreProduct(productId: string): Promise<void> {
  const { error } = await supabase.from("store_products").delete().eq("id", productId);
  if (error) throw new Error("Erro ao remover produto.");
}

export async function uploadProductImage(file: File, storeId: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${storeId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error || !data) throw new Error("Erro ao fazer upload da imagem.");
  const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(data.path);
  return publicUrl;
}

/* ── IMAGE API: BANCO DE IMAGENS ────────────────────────── */

export type CatalogImage = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  subcategory?: string;
  imageUrl: string;
  thumbHue?: string;
};

export type CatalogResult = {
  products: CatalogImage[];
  total: number;
  totalPages: number;
};

const IMAGE_API = (import.meta.env.VITE_IMAGE_API_URL as string) || "";

export async function searchImageCatalog(params: {
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}): Promise<CatalogResult> {
  if (!IMAGE_API) return { products: [], total: 0, totalPages: 0 };
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.category) q.set("category", params.category);
  q.set("page", String(params.page ?? 1));
  q.set("pageSize", String(params.pageSize ?? 24));
  const res = await fetch(`${IMAGE_API}/v1/catalog/products?${q}`);
  if (!res.ok) throw new Error("ImageAPI indisponível");
  const json = await res.json();
  return {
    products: (json.products ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      slug: p.slug as string,
      name: p.name as string,
      brand: p.brand as string,
      category: p.category as string,
      subcategory: p.subcategory as string | undefined,
      imageUrl: p.image_url as string,
      thumbHue: p.thumb_hue as string | undefined,
    })),
    total: (json.pagination as { total: number }).total ?? 0,
    totalPages: (json.pagination as { totalPages: number }).totalPages ?? 0,
  };
}

export async function getImageApiCategories(): Promise<{ category: string; count: number }[]> {
  if (!IMAGE_API) return [];
  const res = await fetch(`${IMAGE_API}/v1/catalog/categories`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.categories ?? [];
}

/* ── QUERY KEYS ──────────────────────────────────────────── */

export const queryKeys = {
  adminOrders: () => ["admin", "orders"] as const,
  stores: () => ["stores"] as const,
  store: (id: string) => ["stores", id] as const,
  storeProducts: (storeId: string) => ["storeProducts", storeId] as const,
  products: (params: ProductQuery) => ["products", params] as const,
  myOrders: () => ["orders", "my"] as const,
};

/* ── IMAGES ──────────────────────────────────────────────── */

export function getProductImageUrl(imageUrl?: string): string {
  if (!imageUrl) return "/placeholder.png";
  if (imageUrl.startsWith("http")) return imageUrl;
  const base = IMAGE_BASE_URL.replace(/\/$/, "");
  const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${base}${path}`;
}

export const GIZ_API_URL = "";
export const DEFAULT_STORE_ID = "";
