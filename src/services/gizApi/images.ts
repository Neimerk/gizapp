// Parte do módulo gizApi (split por domínio). Não alterar lógica aqui.

import type { CatalogImage, CatalogResult } from "./core";
import { GIZ_API_URL } from "./core";

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
