import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SHOPPING_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SHOPPING_SUPABASE_ANON_KEY as string;

export const shoppingDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type FeaturedProduct = {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  category: string;
  brand?: string;
  image_url?: string;
  image_alt?: string;
  price: number;
  promotional_price?: number | null;
  available: boolean;
  featured: boolean;
};

export type ShoppingStore = {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  banner_url?: string;
  plan?: string;
};

export async function getFeaturedByStore(): Promise<
  { store: ShoppingStore; products: FeaturedProduct[] }[]
> {
  const { data: stores } = await shoppingDb
    .from("stores")
    .select("id, name, slug, logo_url, banner_url, plan")
    .in("plan", ["basic", "premium"])
    .eq("is_open", true);

  if (!stores?.length) return [];

  // UMA query para todos os produtos em destaque (antes era N+1: uma por loja).
  const storeIds = stores.map((s) => s.id);
  const { data: allProducts } = await shoppingDb
    .from("store_products")
    .select("id, store_id, name, slug, category, brand, image_url, image_alt, price, promotional_price, available, featured")
    .in("store_id", storeIds)
    .eq("featured", true)
    .eq("available", true)
    .order("name");

  // Agrupa no cliente, no máximo 3 produtos por loja.
  const byStore = new Map<string, FeaturedProduct[]>();
  for (const p of (allProducts ?? []) as FeaturedProduct[]) {
    const list = byStore.get(p.store_id) ?? [];
    if (list.length < 3) {
      list.push(p);
      byStore.set(p.store_id, list);
    }
  }

  return stores
    .map((store) => ({ store, products: byStore.get(store.id) ?? [] }))
    .filter((r) => r.products.length > 0);
}
