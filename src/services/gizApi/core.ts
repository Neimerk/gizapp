// Parte do módulo gizApi (split por domínio). Não alterar lógica aqui.

import { supabase } from "../../lib/supabase";

export const IMAGE_BASE_URL =
  import.meta.env.VITE_IMAGE_BASE_URL ||
  "https://cbyufprmiuwvhsxsxttn.supabase.co/storage/v1/object/public";

// api-gizapp deployada no Render — usada apenas para o banco de imagens (catálogo)

export const GIZ_API_URL = (import.meta.env.VITE_API_URL as string) || "";

// ID da loja no Supabase (usado em todas as queries Supabase)

export const DEFAULT_STORE_ID = "21f2f9d1-de5f-40b5-a3fc-765aba6d70a0";

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

export function mapStore(row: Record<string, unknown>): Store {
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

export function mapStoreProduct(row: Record<string, unknown>): StoreProduct {
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

export type FeaturedStore = {
  storeId: string;
  storeName: string;
  products: StoreProduct[];
};

/** Retorna produtos em destaque agrupados por loja — para a home. */

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
  /**
   * Taxa calculada por distância pelo hook useDeliveryFee.
   * O servidor valida que não é menor que store.delivery_fee nem maior que R$500.
   * Se omitida, usa a taxa padrão da loja.
   */
  deliveryFeeOverride?: number;
  /** Código de cupom a aplicar. Validado atomicamente no servidor via use_coupon_atomic. */
  couponCode?: string;
  /** Pontos BrasUX a usar como desconto (1 ponto = R$1). Debitados no servidor. */
  pointsDiscount?: number;
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
};

export type OrderRow = {
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

export function mapOrder(row: OrderRow): Order {
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

export function sendPushToUser(
  userId: string,
  title:  string,
  body:   string,
  url?:   string,
): void {
  supabase.functions.invoke("send-push", { body: { userId, title, body, url } }).catch(() => null);
}

/** Sugestões de autocomplete para a barra de busca. */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ALLOWED_PAYMENT_METHODS = new Set(["pix", "card", "boleto"]);

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

export const SELLER_ALLOWED_STATUSES = new Set([2, 3, 4, 5]); // preparando, saiu, entregue, cancelado

export const ORDER_STATUS_PUSH: Record<number, { title: string; body: string }> = {
  2: { title: "Pedido confirmado 👨‍🍳", body: "A loja começou a preparar seu pedido." },
  3: { title: "Saiu para entrega 🛵",   body: "Seu pedido está a caminho. Acompanhe o tempo estimado." },
  4: { title: "Pedido entregue ✅",      body: "Bom apetite! Que tal avaliar seu entregador?" },
  5: { title: "Pedido cancelado",        body: "Seu pedido foi cancelado." },
};

/** Dispara push ao comprador quando o status muda. Fire-and-forget. */

export async function notifyOrderStatus(orderId: string, customerId: string | undefined, status: number): Promise<void> {
  const msg = ORDER_STATUS_PUSH[status];
  if (!msg) return;
  let uid = customerId;
  if (!uid) {
    const { data } = await supabase.from("orders").select("customer_id").eq("id", orderId).maybeSingle();
    uid = data?.customer_id as string | undefined;
  }
  if (!uid) return;
  supabase.functions.invoke("send-push", {
    body: { userId: uid, title: msg.title, body: msg.body, url: `/pedidos?o=${orderId}` },
  }).catch(() => null);
}

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

export const ALLOWED_IMAGE_TYPES: Record<string, { ext: string; magic: number[][] }> = {
  "image/jpeg": { ext: "jpg",  magic: [[0xFF, 0xD8, 0xFF]] },
  "image/png":  { ext: "png",  magic: [[0x89, 0x50, 0x4E, 0x47]] },
  "image/webp": { ext: "webp", magic: [[0x52, 0x49, 0x46, 0x46]] },
  "image/gif":  { ext: "gif",  magic: [[0x47, 0x49, 0x46, 0x38]] },
};

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

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

export type Review = {
  id: string;
  storeProductId: string;
  userId: string;
  userName: string;
  stars: number;
  comment?: string;
  createdAt: string;
};

export type PointTransaction = {
  id: string;
  amount: number;
  description: string;
  orderId?: string;
  createdAt: string;
};

export type CouponDB = {
  id: string;
  code: string;
  type: "percent" | "fixed" | "free_delivery";
  value: number;
  label: string;
  minOrder: number;
};

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

export function mapAddress(r: Record<string, unknown>): SavedAddressDB {
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

export function mapDelivery(row: Record<string, unknown>): Delivery {
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

export type CourierInfo = {
  id: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  avgStars: number | null;
  ratingsCount: number;
};

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

export function mapCouponAdmin(r: Record<string, unknown>): CouponAdmin {
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

export function mapAdminBanner(b: Record<string, unknown>): AdminBanner {
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

export const BANNER_ALLOWED_DOMAINS = ["brasux.com.br", "shopping.brasux.com.br"];

export function validateBannerLink(link: string | undefined): void {
  if (!link) return;
  if (link.startsWith("/")) return;
  try {
    const host = new URL(link).hostname;
    if (!BANNER_ALLOWED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
      throw new Error(`Link de banner inválido: domínio não permitido (${host}).`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Link de banner")) throw e;
    throw new Error("Link de banner inválido.", { cause: e });
  }
}

export type PublicCoupon = {
  id: string;
  code: string;
  label: string;
  type: "percentage" | "fixed" | "free_shipping";
  value: number;
  minOrderValue: number | null;
  expiresAt: string | null;
};

export type SellerWithdrawal = {
  id: string;
  amount: number;
  pixKey: string;
  status: "PENDING" | "PAID" | "REJECTED";
  createdAt: string;
};

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

/* ── IMAGES ──────────────────────────────────────────────── */

export function getProductImageUrl(imageUrl?: string): string {
  if (!imageUrl) return "/placeholder.png";
  if (imageUrl.startsWith("http")) return imageUrl;
  const base = IMAGE_BASE_URL.replace(/\/$/, "");
  const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${base}${path}`;
}
