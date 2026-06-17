import { useEffect, useState, useMemo } from "react";
import { ArrowRight, Search, Store as StoreIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

import {
  getProducts,
  getStores,
  getProductImageUrl,
  queryKeys,
  type Product,
} from "../services/gizApi";
import { useDebounce } from "../hooks/useDebounce";
import Pagination from "../components/ui/Pagination";
import CategoryScroll, { type CategoryScrollTab } from "../components/ui/CategoryScroll";
import ProductImage from "../components/ui/ProductImage";
import { formatBRL } from "../utils/format";
import { categories } from "../data/categories";
import { categoryIcons } from "../data/categoryIcons";

const PAGE_SIZE = 24;

const CATEGORY_TABS: CategoryScrollTab[] = categories.map((cat) => ({
  slug: cat.slug,
  icon: categoryIcons[cat.slug] ?? "✨",
  label: cat.name,
}));

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 400);

  const { data: storesData } = useQuery({
    queryKey: queryKeys.stores(),
    queryFn: getStores,
    select: (data) => data.filter((s) => s.active),
  });
  const stores = storesData ?? [];

  const productsParams = {
    search: debouncedSearch || undefined,
    category: filter || undefined,
    page,
    pageSize: PAGE_SIZE,
    available: true,
  };

  const { data: result, isLoading: loadingProducts } = useQuery({
    queryKey: queryKeys.products(productsParams),
    queryFn: () => getProducts(productsParams),
    placeholderData: keepPreviousData,
  });

  // Reset page when search or filter changes
  useEffect(() => { setPage(1); }, [debouncedSearch, filter]);

  const filteredStores = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return stores.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [stores, search]);

  const products = result?.items ?? [];
  const totalItems = result?.totalItems ?? 0;
  const totalPages = result?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-[#7c3aed]">GizApp</p>
        <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Buscar produtos</h1>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-sm transition-colors focus-within:border-[#7c3aed]/40">
        <Search size={18} className="shrink-0 text-[#7c3aed]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produtos, marcas, categorias…"
          className="flex-1 bg-transparent text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
          autoFocus
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-xl leading-none text-[#94a3b8] hover:text-[#0f172a]"
          >
            ×
          </button>
        )}
      </div>

      {/* Category filter */}
      <CategoryScroll
        tabs={CATEGORY_TABS}
        activeSlug={filter}
        onSelect={setFilter}
      />

      {/* Store results (only when searching) */}
      {filteredStores.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#94a3b8]">
            Lojas
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredStores.map((s) => (
              <Link
                key={s.id}
                to={`/lojas/${s.id}`}
                className="flex items-center gap-4 rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#7c3aed] text-sm font-black text-white">
                  {s.logoUrl ? (
                    <img
                      src={getProductImageUrl(s.logoUrl)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    s.name.charAt(0)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-black text-[#0f172a]">{s.name}</h3>
                  <p className="text-xs text-[#64748b]">
                    {s.category.split(",")[0]} · {s.deliveryTimeMin}–{s.deliveryTimeMax}min
                  </p>
                </div>
                <ArrowRight size={16} className="shrink-0 text-[#94a3b8]" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Product results */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">
            {search ? "Produtos encontrados" : "Em destaque"}
          </h2>
          <div className="flex items-center gap-2">
            {loadingProducts && (
              <span className="text-xs text-[#94a3b8]">Buscando…</span>
            )}
            {!loadingProducts && totalItems > 0 && (
              <span className="text-xs font-bold text-[#64748b]">
                {totalItems} {totalItems === 1 ? "resultado" : "resultados"}
              </span>
            )}
          </div>
        </div>

        {/* Initial skeleton */}
        {result === null && loadingProducts ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-3xl bg-white p-3 shadow-sm">
                <div className="h-28 rounded-xl bg-[#f1f5f9]" />
                <div className="mt-2 h-3 w-3/4 rounded bg-[#f1f5f9]" />
                <div className="mt-1.5 h-4 w-1/2 rounded bg-[#f1f5f9]" />
              </div>
            ))}
          </div>
        ) : !loadingProducts && products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#e2e8f0] bg-white p-16 text-center">
            <p className="text-lg font-black text-[#0f172a]">Nenhum produto encontrado</p>
            <p className="mt-1 text-sm text-[#64748b]">Tente outra busca ou categoria.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {products.map((p) => (
                <SearchProductCard key={p.id} product={p} />
              ))}
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

function SearchProductCard({ product }: { product: Product }) {
  return (
    <Link
      to={product.storeId ? `/lojas/${product.storeId}` : "/lojas"}
      className="group flex flex-col overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex h-36 items-center justify-center overflow-hidden bg-[#f8fafc] p-3">
        <ProductImage
          imageUrl={product.imageUrl}
          alt={product.imageAlt || product.name}
          category={product.category}
          containerClassName="h-28 w-full rounded-xl"
          className="h-28 w-full object-contain transition-transform group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
          {product.category}
        </p>
        <h3 className="mt-0.5 flex-1 text-xs font-black leading-tight text-[#0f172a] line-clamp-2">
          {product.name}
        </h3>
        {product.price != null && (
          <p className="mt-2 text-sm font-black text-[#7c3aed]">
            {formatBRL(Number(product.price))}
          </p>
        )}
        <div className="mt-2 flex items-center justify-center gap-1 rounded-xl bg-[#0f172a] py-1.5 text-[10px] font-black text-white transition-colors group-hover:bg-[#7c3aed]">
          <StoreIcon size={11} /> Ver loja
        </div>
      </div>
    </Link>
  );
}
