// Parte do módulo gizApi (split por domínio). Não alterar lógica aqui.

import { supabase } from "../../lib/supabase";
import { shoppingDb } from "../shoppingSupabase";
import { useAuthStore } from "../../stores/authStore";
import type { Banner, FeaturedStore, PagedProducts, Product, ProductQuery, PublicCoupon, Review, Store, StoreProduct, StoreProductsQuery } from "./core";
import { mapStore, mapStoreProduct } from "./core";

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

export async function getAvailableCoupons(): Promise<PublicCoupon[]> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("coupons")
    .select("id, code, label, type, value, min_order_value, expires_at")
    .eq("active", true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("value", { ascending: false })
    .limit(6);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    label: r.label as string,
    type: r.type as PublicCoupon["type"],
    value: Number(r.value),
    minOrderValue: r.min_order_value != null ? Number(r.min_order_value) : null,
    expiresAt: r.expires_at as string | null,
  }));
}

/* ── SELLER WITHDRAWALS ──────────────────────────────────── */
