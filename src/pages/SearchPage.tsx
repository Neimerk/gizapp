import { useEffect, useState, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Search, Store as StoreIcon, ArrowRight } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import {
  getStoreProducts,
  getStores,
  getProductImageUrl,
  type StoreProduct,
  type Store,
} from "../services/gizApi";
import { usePagination } from "../hooks/usePagination";
import Pagination from "../components/ui/Pagination";
import ProductImage from "../components/ui/ProductImage";
import { formatBRL } from "../utils/format";
import { categories } from "../data/categories";
import { categoryIcons } from "../data/categoryIcons";

const PAGE_SIZE = 24;

function matchesCategory(productCategory: string, slug: string): boolean {
  const norm = productCategory.toLowerCase().replace(/\s+/g, "-");
  return norm === slug || norm.includes(slug) || slug.includes(norm);
}

export default function SearchPage() {
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [filter, setFilter] = useState("");
  const [allProducts, setAllProducts] = useState<StoreProduct[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getStores()
      .then(async (storeList) => {
        const activeStores = storeList.filter((s) => s.active);
        const productArrays = await Promise.all(
          activeStores.map((store) =>
            getStoreProducts({ storeId: store.id }).catch(() => [] as StoreProduct[])
          )
        );
        if (!cancelled) {
          setStores(activeStores);
          setAllProducts(productArrays.flat());
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const filteredProducts = useMemo(() => {
    let result = allProducts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.brand?.toLowerCase() ?? "").includes(q) ||
          (p.description?.toLowerCase() ?? "").includes(q)
      );
    }
    if (filter) result = result.filter((p) => matchesCategory(p.category ?? "", filter));
    return result;
  }, [allProducts, search, filter]);

  const filteredStores = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return stores.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [stores, search]);

  const { page, setPage, totalPages, pageItems } = usePagination(filteredProducts, PAGE_SIZE);

  useEffect(() => { setPage(1); }, [filter, search, setPage]);

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <button onClick={() => setSearch("")} className="text-xl leading-none text-[#94a3b8] hover:text-[#0f172a]">
            ×
          </button>
        )}
      </div>

      {/* Category filter chips */}
      <CategoryScroll filter={filter} onSelect={setFilter} />

      {/* Stores found */}
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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#7c3aed] text-sm font-black text-white">
                  {s.logoUrl ? (
                    <img src={getProductImageUrl(s.logoUrl)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    s.name.charAt(0)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-black text-[#0f172a]">{s.name}</h3>
                  <p className="text-xs text-[#64748b]">
                    {s.category.split(",")[0]} · {s.deliveryTimeMin}-{s.deliveryTimeMax}min
                  </p>
                </div>
                <ArrowRight size={16} className="shrink-0 text-[#94a3b8]" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Products */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">
            {search ? "Produtos encontrados" : "Em destaque"}
          </h2>
          <div className="flex items-center gap-2">
            {loading && <span className="text-xs text-[#94a3b8]">Buscando…</span>}
            {!loading && filteredProducts.length > 0 && (
              <span className="text-xs font-bold text-[#64748b]">{filteredProducts.length} {filteredProducts.length === 1 ? "resultado" : "resultados"}</span>
            )}
          </div>
        </div>

        {!loading && filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#e2e8f0] bg-white p-16 text-center">
            <p className="text-lg font-black text-[#0f172a]">Nenhum produto encontrado</p>
            <p className="mt-1 text-sm text-[#64748b]">Tente outra busca ou categoria.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {pageItems.map((p) => (
                <Link
                  key={p.id}
                  to={`/lojas/${p.storeId}`}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex h-36 items-center justify-center overflow-hidden bg-[#f8fafc] p-3">
                    <ProductImage
                      imageUrl={p.imageUrl}
                      alt={p.imageAlt || p.name}
                      category={p.category}
                      containerClassName="h-28 w-full rounded-xl"
                      className="h-28 w-full object-contain transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <p className="truncate text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
                      {p.category}
                    </p>
                    <h3 className="mt-0.5 flex-1 text-xs font-black leading-tight text-[#0f172a] line-clamp-2">
                      {p.name}
                    </h3>
                    <div className="mt-2">
                      {p.promotionalPrice ? (
                        <>
                          <p className="text-[10px] font-bold text-[#94a3b8] line-through">
                            {formatBRL(Number(p.price))}
                          </p>
                          <p className="text-sm font-black text-[#16a34a]">
                            {formatBRL(Number(p.promotionalPrice))}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-black text-[#7c3aed]">
                          {formatBRL(Number(p.price))}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-1 rounded-xl bg-[#0f172a] py-1.5 text-[10px] font-black text-white transition-colors group-hover:bg-[#7c3aed]">
                      <StoreIcon size={11} /> Ver loja
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={filteredProducts.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

function CategoryScroll({
  filter,
  onSelect,
}: {
  filter: string;
  onSelect: (slug: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    el?.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el?.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, []);

  function scroll(dir: "left" | "right") {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -240 : 240, behavior: "smooth" });
  }

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => scroll("left")}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e2e8f0] bg-white shadow-sm transition-all ${
          canLeft ? "opacity-100 hover:border-[#7c3aed]/30 hover:text-[#7c3aed]" : "pointer-events-none opacity-0"
        }`}
      >
        <ChevronLeft size={16} />
      </button>

      <div
        ref={scrollRef}
        className="flex flex-1 gap-2 overflow-x-auto pb-1 scrollbar-none"
        onScroll={updateArrows}
      >
        <button
          onClick={() => onSelect("")}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black transition-colors ${
            filter === ""
              ? "bg-[#7c3aed] text-white"
              : "border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
          }`}
        >
          Todos
        </button>

        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => onSelect(cat.slug)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black transition-colors ${
              filter === cat.slug
                ? "bg-[#7c3aed] text-white"
                : "border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
            }`}
          >
            <span>{categoryIcons[cat.slug] ?? "✨"}</span>
            {cat.name}
          </button>
        ))}
      </div>

      <button
        onClick={() => scroll("right")}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e2e8f0] bg-white shadow-sm transition-all ${
          canRight ? "opacity-100 hover:border-[#7c3aed]/30 hover:text-[#7c3aed]" : "pointer-events-none opacity-0"
        }`}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
