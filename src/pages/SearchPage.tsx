import { useEffect, useState, useMemo, useRef } from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { ArrowRight, Clock, ExternalLink, History, LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

import {
  getProducts,
  getStores,
  getProductImageUrl,
  getSearchSuggestions,
  queryKeys,
  type Product,
} from "../services/gizApi";
import { useDebounce } from "../hooks/useDebounce";
import { useSearchHistory } from "../hooks/useSearchHistory";
import Pagination from "../components/ui/Pagination";
import CategoryScroll, { type CategoryScrollTab } from "../components/ui/CategoryScroll";
import ProductImage from "../components/ui/ProductImage";
import { formatBRL } from "../utils/format";
import { categories } from "../data/categories";
import { categoryIcons } from "../data/categoryIcons";
import { brasuxSolutions, type BrasUXSolution } from "../data/brasuxSolutions";
import { useFavoritesStore } from "../stores/favoritesStore";

const PAGE_SIZE = 24;

type SortOption = "default" | "price-asc" | "price-desc" | "newest";

const SORT_LABELS: Record<SortOption, string> = {
  default: "Relevância",
  "price-asc": "Menor preço",
  "price-desc": "Maior preço",
  newest: "Mais recentes",
};

const CATEGORY_TABS: CategoryScrollTab[] = categories.map((cat) => ({
  slug: cat.slug,
  icon: categoryIcons[cat.slug] ?? "✨",
  label: cat.name,
}));

const TRENDING_SEARCHES = [
  "Smartphones", "Notebook", "Fone de ouvido", "Tênis",
  "Arroz", "Café", "Cerveja", "Suplementos",
];

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<SortOption>("default");
  const [searchFocused, setSearchFocused] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [freeShippingOnly, setFreeShippingOnly] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const { history, add: addHistory, remove: removeHistory, clear: clearHistory } = useSearchHistory();

  const debouncedSearch = useDebounce(search, 400);
  const debouncedMin = useDebounce(minPrice, 400);
  const debouncedMax = useDebounce(maxPrice, 400);

  // Sugestões de autocomplete (FTS prefix)
  const { data: suggestions = [] } = useQuery({
    queryKey: queryKeys.suggestions(debouncedSearch),
    queryFn:  () => getSearchSuggestions(debouncedSearch),
    enabled:  debouncedSearch.length >= 2,
    staleTime: 30_000,
  });

  const { data: storesData } = useQuery({
    queryKey: queryKeys.stores(),
    queryFn: getStores,
    select: (data) => data.filter((s) => s.active),
  });
  const stores = storesData ?? [];

  const priceFilterActive = minPrice !== "" || maxPrice !== "";
  const parsedMin = debouncedMin ? parseFloat(debouncedMin.replace(",", ".")) : undefined;
  const parsedMax = debouncedMax ? parseFloat(debouncedMax.replace(",", ".")) : undefined;

  usePageMeta({
    title: debouncedSearch ? `Buscar: ${debouncedSearch}` : "Buscar produtos",
  });

  const productsParams = {
    search: debouncedSearch || undefined,
    category: filter || undefined,
    page,
    pageSize: PAGE_SIZE,
    available: true as const,
    minPrice: parsedMin,
    maxPrice: parsedMax,
    sort: sort !== "default" ? sort : undefined,
  };

  const { data: result, isLoading: loadingProducts } = useQuery({
    queryKey: queryKeys.products(productsParams),
    queryFn: () => getProducts(productsParams),
    placeholderData: keepPreviousData,
  });

  // Reset page when filters or sort change
  useEffect(() => { setPage(1); }, [debouncedSearch, filter, debouncedMin, debouncedMax, sort]);

  const filteredStores = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    let result = stores.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
    if (freeShippingOnly) result = result.filter((s) => s.deliveryFee === 0);
    if (minRating !== null) result = result.filter((s) => s.rating >= minRating);
    return result;
  }, [stores, search, freeShippingOnly, minRating]);

  const products = result?.items ?? [];
  const totalItems = result?.totalItems ?? 0;
  const totalPages = result?.totalPages ?? 1;

  // Client-side price filter as safety net (backend may not always enforce the range)
  const priceFiltered = useMemo(() => {
    if (!priceFilterActive) return products;
    return products.filter((p) => {
      const price = Number(p.price ?? 0);
      if (parsedMin != null && price < parsedMin) return false;
      if (parsedMax != null && price > parsedMax) return false;
      return true;
    });
  }, [products, parsedMin, parsedMax, priceFilterActive]);

  // Sorting is handled server-side; priceFiltered is a client-side safety net for range edge cases
  const visibleProducts = priceFiltered;

  function commitSearch(term: string) {
    if (term.trim()) addHistory(term.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      commitSearch(search);
      inputRef.current?.blur();
      setSearchFocused(false);
    }
    if (e.key === "Escape") {
      setSearchFocused(false);
      inputRef.current?.blur();
    }
  }

  const showHistory     = searchFocused && !search.trim() && history.length > 0;
  const showSuggestions = searchFocused && search.trim().length >= 2 && suggestions.length > 0;
  const showDropdown    = showHistory || showSuggestions || (searchFocused && !search.trim());

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">BrasUX</p>
        <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Buscar produtos</h1>
      </div>

      {/* Search bar */}
      <div className="relative">
        <div
          className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm transition-colors ${
            searchFocused ? "border-[#16a34a]/50 ring-2 ring-[#16a34a]/10" : "border-[#e2e8f0]"
          }`}
        >
          <Search size={18} className="shrink-0 text-[#16a34a]" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar produtos, marcas, categorias…"
            className="flex-1 bg-transparent text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
            autoFocus
          />
          {search && (
            <button
              onClick={() => { setSearch(""); inputRef.current?.focus(); }}
              className="text-xl leading-none text-[#94a3b8] hover:text-[#0f172a]"
            >
              ×
            </button>
          )}
        </div>

        {/* Dropdown: histórico, trending ou sugestões FTS */}
        {showDropdown && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-xl">

            {/* Histórico (quando sem texto e há histórico) */}
            {showHistory && (
              <>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                    <History size={11} /> Buscas recentes
                  </span>
                  <button onClick={clearHistory} className="text-[10px] font-bold text-[#94a3b8] hover:text-red-500">
                    Limpar
                  </button>
                </div>
                {history.map((term) => (
                  <div key={term} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#f8fafc]">
                    <button
                      className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-[#0f172a]"
                      onClick={() => { setSearch(term); setSearchFocused(false); }}
                    >
                      <Clock size={14} className="shrink-0 text-[#94a3b8]" />
                      {term}
                    </button>
                    <button onClick={() => removeHistory(term)} className="shrink-0 text-[#cbd5e1] hover:text-[#94a3b8]">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* Trending (quando campo vazio) */}
            {searchFocused && !search.trim() && (
              <div className="px-4 py-3">
                {showHistory && <div className="mb-3 border-t border-[#f1f5f9]" />}
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                  🔥 Em alta
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TRENDING_SEARCHES.map((term) => (
                    <button
                      key={term}
                      className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1.5 text-xs font-bold text-[#64748b] hover:border-[#16a34a]/40 hover:bg-[#f0fdf4] hover:text-[#16a34a] transition-colors"
                      onClick={() => {
                        setSearch(term);
                        commitSearch(term);
                        setSearchFocused(false);
                      }}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sugestões FTS (quando digitando) */}
            {showSuggestions && (
              <>
                <div className="px-4 py-2.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                    Sugestões
                  </span>
                </div>
                {suggestions.map((s) => (
                  <button
                    key={s.label}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#f8fafc]"
                    onClick={() => {
                      setSearch(s.label);
                      commitSearch(s.label);
                      setSearchFocused(false);
                    }}
                  >
                    <Search size={13} className="shrink-0 text-[#16a34a]" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0f172a] truncate">{s.label}</p>
                      <p className="text-[11px] text-[#94a3b8]">{s.category}</p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Category filter */}
      <CategoryScroll tabs={CATEGORY_TABS} activeSlug={filter} onSelect={setFilter} />

      {/* Quick filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {[
          { key: "free-shipping", label: "🚚 Frete grátis", active: freeShippingOnly, toggle: () => setFreeShippingOnly(v => !v) },
          { key: "promo", label: "🏷️ Menor preço", active: sort === "price-asc", toggle: () => setSort(s => s === "price-asc" ? "default" : "price-asc") },
          { key: "newest", label: "✨ Novidades", active: sort === "newest", toggle: () => setSort(s => s === "newest" ? "default" : "newest") },
          { key: "price-desc", label: "💎 Maior preço", active: sort === "price-desc", toggle: () => setSort(s => s === "price-desc" ? "default" : "price-desc") },
        ].map((chip) => (
          <button
            key={chip.key}
            onClick={chip.toggle}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition-all ${
              chip.active
                ? "border-[#16a34a] bg-[#f0fdf4] text-[#16a34a]"
                : "border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#16a34a]/40"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Rating filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
          Avaliação
        </span>
        {([3, 4, 4.5] as const).map((r) => (
          <button
            key={r}
            onClick={() => setMinRating(minRating === r ? null : r)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition-all ${
              minRating === r
                ? "border-[#f59e0b] bg-[#fffbeb] text-[#b45309]"
                : "border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#f59e0b]/40"
            }`}
          >
            {"⭐".repeat(Math.floor(r))} {r}+
          </button>
        ))}
        {minRating !== null && (
          <button
            onClick={() => setMinRating(null)}
            className="shrink-0 rounded-full border border-[#fecdd3] bg-[#fff1f2] px-3 py-1.5 text-xs font-black text-red-500"
          >
            × Limpar
          </button>
        )}
      </div>

      {/* Filters row: price + sort + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#94a3b8]">
          <SlidersHorizontal size={13} /> Filtros
        </div>

        {/* Price filter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 shadow-sm focus-within:border-[#16a34a]/40">
            <span className="text-xs font-bold text-[#94a3b8]">R$</span>
            <input
              type="number"
              min="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Mín"
              className="w-16 bg-transparent text-sm font-bold text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
            />
          </div>
          <span className="text-xs text-[#94a3b8]">—</span>
          <div className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 shadow-sm focus-within:border-[#16a34a]/40">
            <span className="text-xs font-bold text-[#94a3b8]">R$</span>
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Máx"
              className="w-16 bg-transparent text-sm font-bold text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
            />
          </div>
        </div>

        {priceFilterActive && (
          <button
            onClick={() => { setMinPrice(""); setMaxPrice(""); }}
            className="flex items-center gap-1 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-3 py-2 text-xs font-black text-[#e11d48]"
          >
            <X size={12} /> Preço
          </button>
        )}

        {/* Sort */}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-xs font-bold text-[#0f172a] outline-none shadow-sm focus:border-[#16a34a]/40 cursor-pointer"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
              <option key={key} value={key}>{SORT_LABELS[key]}</option>
            ))}
          </select>

          {/* View mode toggle */}
          <div className="flex gap-1 rounded-xl border border-[#e2e8f0] bg-white p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-lg p-1.5 transition-colors ${viewMode === "grid" ? "bg-[#0f172a] text-white" : "text-[#94a3b8]"}`}
              aria-label="Grade"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-lg p-1.5 transition-colors ${viewMode === "list" ? "bg-[#0f172a] text-white" : "text-[#94a3b8]"}`}
              aria-label="Lista"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Store results */}
      {filteredStores.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#94a3b8]">Lojas</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredStores.map((s) => (
              <Link
                key={s.id}
                to={`/lojas/${s.id}`}
                className="flex items-center gap-4 rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#16a34a] text-sm font-black text-white">
                  {s.logoUrl ? (
                    <img src={getProductImageUrl(s.logoUrl)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    s.name.charAt(0)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-black text-[#0f172a]">{s.name}</h3>
                  <p className="text-xs text-[#64748b]">
                    {s.category.split(",")[0]} · {s.deliveryTimeMin}–{s.deliveryTimeMax}min
                    {s.deliveryFee === 0 && <span className="ml-1 text-[#16a34a] font-bold">· Frete grátis</span>}
                  </p>
                  {s.rating > 0 && (
                    <span className="text-[10px] font-bold text-[#f59e0b]">⭐ {s.rating.toFixed(1)}</span>
                  )}
                </div>
                <ArrowRight size={16} className="shrink-0 text-[#94a3b8]" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* BrasUX Solutions */}
      {(() => {
        const solutions = brasuxSolutions.filter((s) => s.categorySlug === filter);
        if (solutions.length === 0) return null;
        return (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">
                Soluções BrasUX
              </span>
              <span className="rounded-full bg-[#16a34a]/10 px-2 py-0.5 text-[10px] font-black text-[#16a34a]">
                {solutions.length}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {solutions.map((s) => (
                <BrasUXSolutionCard key={s.id} solution={s} />
              ))}
            </div>
          </section>
        );
      })()}

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
            {!loadingProducts && (visibleProducts.length > 0 || totalItems > 0) && (
              <span className="text-xs font-bold text-[#64748b]">
                {priceFilterActive
                  ? `${visibleProducts.length} resultado${visibleProducts.length !== 1 ? "s" : ""}`
                  : `${totalItems} resultado${totalItems !== 1 ? "s" : ""}`}
              </span>
            )}
          </div>
        </div>

        {!result && loadingProducts ? (
          <div className={viewMode === "grid"
            ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            : "flex flex-col gap-3"
          }>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`animate-pulse rounded-3xl bg-white shadow-sm ${viewMode === "grid" ? "p-3" : "flex items-center gap-4 p-4"}`}>
                <div className={viewMode === "grid" ? "h-28 rounded-xl bg-[#f1f5f9]" : "h-20 w-20 shrink-0 rounded-2xl bg-[#f1f5f9]"} />
                {viewMode === "list" && (
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-[#f1f5f9]" />
                    <div className="h-4 w-1/2 rounded bg-[#f1f5f9]" />
                  </div>
                )}
                {viewMode === "grid" && (
                  <>
                    <div className="mt-2 h-3 w-3/4 rounded bg-[#f1f5f9]" />
                    <div className="mt-1.5 h-4 w-1/2 rounded bg-[#f1f5f9]" />
                  </>
                )}
              </div>
            ))}
          </div>
        ) : !loadingProducts && visibleProducts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#e2e8f0] bg-white p-16 text-center">
            <p className="text-lg font-black text-[#0f172a]">Nenhum produto encontrado</p>
            <p className="mt-1 text-sm text-[#64748b]">
              {priceFilterActive ? "Tente ajustar o filtro de preço." : "Tente outra busca ou categoria."}
            </p>
          </div>
        ) : (
          <>
            <div className={viewMode === "grid"
              ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              : "flex flex-col gap-3"
            }>
              {visibleProducts.map((p) =>
                viewMode === "grid"
                  ? <SearchProductCard key={p.id} product={p} />
                  : <SearchProductCardList key={p.id} product={p} />
              )}
            </div>

            {!priceFilterActive && (
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

function BrasUXSolutionCard({ solution }: { solution: BrasUXSolution }) {
  return (
    <a
      href={solution.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-3xl transition-all hover:-translate-y-0.5 hover:shadow-xl"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.10)" }}
    >
      <div className={`relative flex items-center gap-4 bg-gradient-to-br p-5 ${solution.gradient}`}>
        <span className="text-4xl">{solution.icon}</span>
        <div className="flex-1 min-w-0">
          <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white/90">
            {solution.badge}
          </span>
          <h3 className="mt-1 text-lg font-black text-white leading-tight">{solution.name}</h3>
        </div>
        <ExternalLink size={16} className="shrink-0 text-white/60 transition-colors group-hover:text-white" />
      </div>
      <div className="flex flex-1 flex-col bg-white px-5 pb-5 pt-4">
        <p className="flex-1 text-sm leading-relaxed text-[#64748b]">{solution.description}</p>
        <div
          className={`mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r py-2.5 text-xs font-black text-white ${solution.gradient}`}
        >
          Acessar <ArrowRight size={13} />
        </div>
      </div>
    </a>
  );
}

function SearchProductCard({ product }: { product: Product }) {
  const toggleProduct = useFavoritesStore((s) => s.toggleProduct);
  const isFav = useFavoritesStore((s) => s.products.some((p) => p.id === product.id));

  const to = product.storeId
    ? `/lojas/${product.storeId}/produto/${product.id}`
    : `/lojas`;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      {/* Favorite button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          toggleProduct({
            id: product.id,
            storeId: product.storeId ?? "",
            name: product.name,
            imageUrl: product.imageUrl,
            price: Number(product.price ?? 0),
            category: product.category,
          });
        }}
        className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-transform hover:scale-110"
        aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      >
        <span className={`text-base leading-none ${isFav ? "text-red-500" : "text-[#cbd5e1]"}`}>
          {isFav ? "♥" : "♡"}
        </span>
      </button>

      <Link to={to} className="flex flex-col">
        <div className="flex h-36 items-center justify-center overflow-hidden rounded-t-3xl bg-[#f8fafc] p-3">
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
            <p className="mt-2 text-sm font-black text-[#16a34a]">
              {formatBRL(Number(product.price))}
            </p>
          )}
          <div className="mt-2 flex items-center justify-center rounded-xl bg-[#0f172a] py-1.5 text-[10px] font-black text-white transition-colors group-hover:bg-[#16a34a]">
            Ver produto
          </div>
        </div>
      </Link>
    </div>
  );
}

function SearchProductCardList({ product }: { product: Product }) {
  const toggleProduct = useFavoritesStore((s) => s.toggleProduct);
  const isFav = useFavoritesStore((s) => s.products.some((p) => p.id === product.id));
  const to = product.storeId
    ? `/lojas/${product.storeId}/produto/${product.id}`
    : `/lojas`;

  return (
    <div className="flex items-center gap-4 rounded-3xl border border-[#e8eaf0] bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <Link to={to} className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#f8fafc]">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.imageAlt || product.name}
            className="h-16 w-16 object-contain"
            loading="lazy"
          />
        ) : (
          <div className="text-3xl">🛍️</div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">{product.category}</p>
        <Link to={to}>
          <h3 className="text-sm font-black text-[#0f172a] line-clamp-2 leading-tight">{product.name}</h3>
        </Link>
        {product.price != null && (
          <p className="text-base font-black text-[#16a34a]">{formatBRL(Number(product.price))}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-center gap-2">
        <button
          onClick={() => toggleProduct({
            id: product.id,
            storeId: product.storeId ?? "",
            name: product.name,
            imageUrl: product.imageUrl,
            price: Number(product.price ?? 0),
            category: product.category,
          })}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f8fafc] border border-[#e2e8f0]"
          aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <span className={`text-sm leading-none ${isFav ? "text-red-500" : "text-[#cbd5e1]"}`}>
            {isFav ? "♥" : "♡"}
          </span>
        </button>
        <Link
          to={to}
          className="flex items-center justify-center rounded-xl bg-[#0f172a] px-3 py-1.5 text-[10px] font-black text-white hover:bg-[#16a34a] transition-colors"
        >
          Ver
        </Link>
      </div>
    </div>
  );
}
