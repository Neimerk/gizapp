import { useEffect, useState, useMemo, useRef } from "react";
import { ArrowLeft, Bike, ChevronLeft, ChevronRight, Clock3, Search, Star, X } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  DEFAULT_STORE_ID,
  getProductImageUrl,
  getStoreById,
  getStoreProducts,
  type Store,
  type StoreProduct,
} from "../services/gizApi";
import { useCartStore } from "../stores/cartStore";
import { usePagination } from "../hooks/usePagination";
import Pagination from "../components/ui/Pagination";
import ProductImage from "../components/ui/ProductImage";
import { categoryIcons } from "../data/categoryIcons";
import { categories as masterCategories } from "../data/categories";
import { formatBRL } from "../utils/format";

const PAGE_SIZE = 8;

function parseCategorySlugs(raw: string): string[] {
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function matchesSlug(productCategory: string, slug: string): boolean {
  const norm = productCategory.toLowerCase().replace(/\s+/g, "-");
  return norm === slug || norm.includes(slug) || slug.includes(norm);
}

export default function StorePage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentStoreId = storeId || DEFAULT_STORE_ID;

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState(searchParams.get("categoria") ?? "");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [storeData, prods] = await Promise.all([
          getStoreById(currentStoreId),
          getStoreProducts({ storeId: currentStoreId }),
        ]);
        setStore(storeData);
        setProducts(prods);
        setActiveSlug("");
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentStoreId]);

  // Build tab list: declared store types (from store.category) + any extra product categories
  const tabs = useMemo(() => {
    if (!store) return [];

    const declaredSlugs = parseCategorySlugs(store.category);

    // Get unique product categories
    const productCats = [...new Set(products.map((p) => p.category.toLowerCase().replace(/\s+/g, "-")).filter(Boolean))];

    // Merge: declared first, then any product cats not covered by declared
    const all = [...declaredSlugs];
    for (const pc of productCats) {
      if (!all.some((s) => matchesSlug(pc, s))) all.push(pc);
    }

    return all.map((slug) => {
      const master = masterCategories.find((c) => c.slug === slug || matchesSlug(slug, c.slug));
      const icon = categoryIcons[master?.slug ?? slug] ?? categoryIcons[slug] ?? "✨";
      const name = master?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const count = products.filter((p) => matchesSlug(p.category, slug)).length;
      return { slug, icon, name, count };
    }).filter((t) => t.count > 0);
  }, [store, products]);

  const filtered = useMemo(() => {
    let list = activeSlug ? products.filter((p) => matchesSlug(p.category, activeSlug)) : products;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          (p.brand ?? "").toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, activeSlug, search]);

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, PAGE_SIZE);
  const productsRef = useRef<HTMLElement>(null);

  // Reset page when tab or search changes
  useEffect(() => { setPage(1); }, [activeSlug, search, setPage]);

  // Scroll to products section on page change
  useEffect(() => {
    if (page === 1) return;
    productsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-64 animate-pulse rounded-3xl bg-white shadow-sm" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-3xl bg-white shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
        <p className="font-black text-red-500">Loja não encontrada.</p>
      </div>
    );
  }

  const primaryCategoryName = (() => {
    const slugs = parseCategorySlugs(store.category);
    if (slugs.length === 0) return store.category;
    const master = masterCategories.find((c) => c.slug === slugs[0]);
    return master?.name ?? slugs[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  })();

  const deliveryFeeText =
    Number(store.deliveryFee) === 0 ? "Grátis" : formatBRL(Number(store.deliveryFee));

  return (
    <div className="space-y-6">
      {/* ── HERO BANNER ── */}
      <div className="relative overflow-hidden rounded-3xl">
        <button
          onClick={() => navigate(-1)}
          className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-xl bg-black/50 backdrop-blur-md transition-colors hover:bg-black/70"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>

        <div className="relative h-64 md:h-80">
          {store.bannerUrl ? (
            <img
              src={getProductImageUrl(store.bannerUrl)}
              alt={store.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-7xl"
              style={{
                background:
                  "radial-gradient(circle at 70% 30%, rgba(124,58,237,0.5), transparent 55%), linear-gradient(135deg, #0f172a, #1e293b)",
              }}
            >
              🏪
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#a855f7]">
                {primaryCategoryName}
              </p>
              <h1 className="mt-1 text-3xl font-black text-white md:text-4xl">{store.name}</h1>
              {store.description && (
                <p className="mt-1.5 max-w-lg text-sm text-white/70 line-clamp-2">{store.description}</p>
              )}
            </div>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                store.isOpen
                  ? "border-green-700/40 bg-green-900/30 text-green-400"
                  : "border-white/20 bg-black/30 text-[#94a3b8]"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${store.isOpen ? "bg-green-400" : "bg-[#94a3b8]"}`} />
              {store.isOpen ? "Aberto" : "Fechado"}
            </span>
          </div>
        </div>
      </div>

      {/* ── STORE INFO ── */}
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6 md:gap-4">
        {[
          { icon: <Clock3 size={16} className="text-[#7c3aed]" />, label: "Entrega", value: `${store.deliveryTimeMin}–${store.deliveryTimeMax}min` },
          { icon: <Bike size={16} className="text-[#2563eb]" />, label: "Taxa", value: deliveryFeeText },
          { icon: <Star size={16} className="text-[#f59e0b]" />, label: "Avaliação", value: `⭐ ${Number(store.rating).toFixed(1)}` },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#e8eaf0] bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-[#94a3b8]">
              {s.icon}
              <span className="text-[10px] font-bold uppercase tracking-wide">{s.label}</span>
            </div>
            <div className="mt-1 text-sm font-black text-[#0f172a]">{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── CATEGORY QUICK-NAV ── */}
      {tabs.length > 1 && (
        <CategoryNav
          tabs={tabs}
          activeSlug={activeSlug}
          totalProducts={products.length}
          onSelect={setActiveSlug}
        />
      )}

      {/* ── SEARCH BAR ── */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-sm transition-colors focus-within:border-[#7c3aed]/40 focus-within:ring-2 focus-within:ring-[#7c3aed]/10">
        <Search size={17} className="shrink-0 text-[#94a3b8]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produtos nesta loja…"
          className="flex-1 bg-transparent text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* ── PRODUCTS ── */}
      <section ref={productsRef}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black text-[#0f172a]">
            {search.trim()
              ? `Resultados para "${search}"`
              : activeSlug
              ? (tabs.find((t) => t.slug === activeSlug)?.name ?? activeSlug)
              : "Todos os produtos"}
          </h2>
          <span className="text-sm font-bold text-[#94a3b8]">
            {filtered.length} {filtered.length === 1 ? "item" : "itens"}
          </span>
        </div>

        {pageItems.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#e2e8f0] bg-white p-16 text-center">
            <p className="font-black text-[#64748b]">Nenhum produto disponível.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pageItems.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </section>
    </div>
  );
}

function CategoryNav({
  tabs,
  activeSlug,
  totalProducts,
  onSelect,
}: {
  tabs: { slug: string; icon: string; name: string; count: number }[];
  activeSlug: string;
  totalProducts: number;
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
  }, [tabs]);

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -240 : 240, behavior: "smooth" });
  }

  return (
    <div className="relative flex items-center gap-1">
      {/* Left arrow */}
      <button
        onClick={() => scroll("left")}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e2e8f0] bg-white shadow-sm transition-all ${
          canLeft ? "opacity-100 hover:border-[#7c3aed]/30 hover:text-[#7c3aed]" : "pointer-events-none opacity-0"
        }`}
      >
        <ChevronLeft size={16} />
      </button>

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        className="flex flex-1 gap-2 overflow-x-auto pb-1 scrollbar-none"
        onScroll={updateArrows}
      >
        <button
          onClick={() => onSelect("")}
          className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition-colors ${
            activeSlug === ""
              ? "bg-[#0f172a] text-white"
              : "border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
          }`}
        >
          Todos
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${activeSlug === "" ? "bg-white/20 text-white" : "bg-[#f1f5f9] text-[#64748b]"}`}>
            {totalProducts}
          </span>
        </button>
        {tabs.map((tab) => (
          <button
            key={tab.slug}
            onClick={() => onSelect(tab.slug)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition-colors ${
              activeSlug === tab.slug
                ? "bg-[#7c3aed] text-white"
                : "border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.name}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${activeSlug === tab.slug ? "bg-white/20 text-white" : "bg-[#f1f5f9] text-[#64748b]"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Right arrow */}
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

function ProductCard({ product }: { product: StoreProduct }) {
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const increaseItem = useCartStore((s) => s.increaseItem);
  const decreaseItem = useCartStore((s) => s.decreaseItem);

  const cartItem = items.find((i) => i.id === product.id);
  const finalPrice = Number(product.promotionalPrice ?? product.price ?? 0);

  function handleAdd() {
    addItem({
      id: product.id,
      storeProductId: product.id,
      productId: product.productId,
      storeId: product.storeId,
      name: product.name,
      description: product.description ?? "",
      price: finalPrice,
      promotionalPrice: product.promotionalPrice,
      image: getProductImageUrl(product.imageUrl),
      stock: product.stock,
    });
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className="flex h-44 items-center justify-center overflow-hidden bg-[#f8fafc] p-4">
        <ProductImage
          imageUrl={product.imageUrl}
          alt={product.imageAlt || product.name}
          category={product.category}
          containerClassName="h-36 w-full rounded-2xl"
          className="h-36 w-full object-contain transition-transform group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="truncate text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
          {product.category}
        </p>
        <h3 className="mt-1 flex-1 text-sm font-black leading-tight text-[#0f172a] line-clamp-2">
          {product.name}
        </h3>
        {product.description && (
          <p className="mt-1 text-xs text-[#64748b] line-clamp-1">{product.description}</p>
        )}

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            {product.promotionalPrice ? (
              <>
                <p className="text-[10px] font-bold text-[#94a3b8] line-through">
                  {formatBRL(Number(product.price))}
                </p>
                <p className="text-base font-black text-[#16a34a]">
                  {formatBRL(Number(product.promotionalPrice))}
                </p>
              </>
            ) : (
              <p className="text-base font-black text-[#7c3aed]">
                {formatBRL(Number(product.price))}
              </p>
            )}
          </div>

          {product.stock <= 0 ? (
            <span className="rounded-xl bg-[#f1f5f9] px-3 py-1.5 text-xs font-black text-[#94a3b8]">
              Sem estoque
            </span>
          ) : !cartItem ? (
            <button
              onClick={handleAdd}
              className="rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-black text-white transition-colors hover:bg-[#7c3aed]"
            >
              + Adicionar
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded-xl bg-[#0f172a] p-1">
              <button
                onClick={() => decreaseItem(product.id)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 font-black text-white"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-black text-white">
                {cartItem.quantity}
              </span>
              <button
                onClick={() => increaseItem(product.id)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 font-black text-white"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
