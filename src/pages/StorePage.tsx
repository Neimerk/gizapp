import { useEffect, useState, useMemo, useRef } from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { useJsonLd } from "../hooks/useJsonLd";
import { buildLocalBusinessSchema, buildBreadcrumbSchema, canonicalUrl } from "../lib/seo";
import Breadcrumbs from "../components/seo/Breadcrumbs";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bike, Clock3, GitCompareArrows, MessageCircle, Search, Star, X } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  DEFAULT_STORE_ID,
  resolveGizApiStoreId,
  getProductImageUrl,
  getStoreById,
  getStoreProducts,
  queryKeys,
  type Store as StoreType,
  type StoreProduct,
} from "../services/gizApi";
import { useCartStore } from "../stores/cartStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import { useCompareStore } from "../stores/compareStore";
import { usePagination } from "../hooks/usePagination";
import Pagination from "../components/ui/Pagination";
import CategoryScroll from "../components/ui/CategoryScroll";
import ProductImage from "../components/ui/ProductImage";
import { categoryIcons } from "../data/categoryIcons";
import { categories as masterCategories } from "../data/categories";
import { formatBRL } from "../utils/format";

const PAGE_SIZE = 10;

function parseCategorySlugs(raw: string): string[] {
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function matchesSlug(productCategory: string, slug: string): boolean {
  const norm = productCategory.toLowerCase().replace(/\s+/g, "-");
  return norm === slug || norm.includes(slug) || slug.includes(norm);
}

export default function StorePage() {
  const { storeId } = useParams();
  return <StorePageContent key={storeId ?? ""} />;
}

function StorePageContent() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentStoreId = storeId || DEFAULT_STORE_ID;
  // Resolve o ID do GizAPI (pode diferir do ID do Supabase usado no link)
  const gizApiStoreId = resolveGizApiStoreId(currentStoreId);

  const [activeSlug, setActiveSlug] = useState(searchParams.get("categoria") ?? "");
  const [search, setSearch] = useState("");

  const { data: store, isLoading: loadingStore } = useQuery({
    queryKey: queryKeys.store(gizApiStoreId),
    queryFn: () => getStoreById(gizApiStoreId),
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: queryKeys.storeProducts(gizApiStoreId),
    queryFn: () => getStoreProducts({ storeId: gizApiStoreId }),
  });

  const loading = loadingStore || loadingProducts;

  usePageMeta({
    title: store?.name,
    description: store
      ? `${store.name} no BrasUX Shopping. Entrega em ${store.deliveryTimeMin}–${store.deliveryTimeMax} min${Number(store.deliveryFee) === 0 ? ", frete grátis" : ""}. Avaliação ${Number(store.rating).toFixed(1)}/5.`
      : undefined,
    canonical: canonicalUrl(`/lojas/${currentStoreId}`),
  });

  const storeSchemas = useMemo(() => {
    if (!store) return null;
    return [
      buildLocalBusinessSchema({
        id: store.id,
        name: store.name,
        description: store.description ?? undefined,
        logoUrl: store.logoUrl ?? undefined,
        category: store.category,
        rating: Number(store.rating),
        deliveryTimeMin: store.deliveryTimeMin,
        deliveryTimeMax: store.deliveryTimeMax,
        deliveryFee: Number(store.deliveryFee),
        isOpen: store.isOpen,
      }),
      buildBreadcrumbSchema([
        { name: "Início", path: "/" },
        { name: "Lojas", path: "/lojas" },
        { name: store.name, path: `/lojas/${currentStoreId}` },
      ]),
    ];
  }, [store, currentStoreId]);
  useJsonLd(storeSchemas);

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
      {/* ── BREADCRUMBS ── */}
      {store && (
        <Breadcrumbs
          items={[
            { name: "Lojas", path: "/lojas" },
            { name: store.name, path: `/lojas/${currentStoreId}` },
          ]}
        />
      )}

      {/* ── BACK BUTTON ── */}
      <button
        onClick={() => navigate(-1)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:border-[#16a34a]/40 hover:text-[#16a34a]"
      >
        <ArrowLeft size={17} />
      </button>

      {/* ── HERO BANNER ── */}
      <div className="relative overflow-hidden rounded-3xl">
        <div className="relative h-64 md:h-80">
          {store.bannerUrl ? (
            <img
              src={getProductImageUrl(store.bannerUrl)}
              alt={store.name}
              className="h-full w-full object-cover"
              loading="eager"
              decoding="sync"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              fetchPriority={"high" as any}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-7xl"
              style={{
                background:
                  "radial-gradient(circle at 70% 30%, rgba(0,39,118,0.55), transparent 55%), linear-gradient(135deg, #0a1628, #1e293b)",
              }}
            >
              🏪
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#4ade80]">
                {primaryCategoryName}
              </p>
              <h1 className="mt-1 text-3xl font-black text-white md:text-4xl">{store.name}</h1>
              {store.description && (
                <p className="mt-1.5 max-w-lg text-sm text-white/70 line-clamp-2">{store.description}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <StoreFavoriteButton store={store} />
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
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
      </div>

      {/* ── ACTIONS ── */}
      <div className="flex gap-2">
        <Link
          to={`/lojas/${currentStoreId}/chat`}
          className="flex items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-black text-[#0f172a] shadow-sm transition-colors hover:border-[#16a34a]/40 hover:text-[#16a34a]"
        >
          <MessageCircle size={16} /> Chat com a loja
        </Link>
      </div>

      {/* ── STORE INFO ── */}
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6 md:gap-4">
        {[
          { icon: <Clock3 size={16} className="text-[#16a34a]" />, label: "Entrega", value: `${store.deliveryTimeMin}–${store.deliveryTimeMax}min` },
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
        <CategoryScroll
          tabs={tabs.map((t) => ({ slug: t.slug, icon: t.icon, label: t.name, count: t.count }))}
          activeSlug={activeSlug}
          allCount={products.length}
          onSelect={setActiveSlug}
        />
      )}

      {/* ── SEARCH BAR ── */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-sm transition-colors focus-within:border-[#16a34a]/40 focus-within:ring-2 focus-within:ring-[#16a34a]/10">
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

function CompareButton({ product }: { product: StoreProduct }) {
  const add = useCompareStore((s) => s.add);
  const remove = useCompareStore((s) => s.remove);
  const has = useCompareStore((s) => s.has);
  const products = useCompareStore((s) => s.products);
  const inCompare = has(product.id);
  const full = products.length >= 3 && !inCompare;

  function toggle() {
    if (inCompare) { remove(product.id); return; }
    add({
      id: product.id,
      storeId: product.storeId,
      name: product.name,
      imageUrl: product.imageUrl,
      price: Number(product.price),
      promotionalPrice: product.promotionalPrice,
      category: product.category,
      brand: product.brand,
      description: product.description,
      stock: product.stock,
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={full}
      className={`flex h-8 w-8 items-center justify-center rounded-xl border text-xs transition-colors disabled:opacity-30 ${
        inCompare
          ? "border-[#2563eb]/40 bg-[#eff6ff] text-[#2563eb]"
          : "border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8] hover:border-[#2563eb]/40 hover:text-[#2563eb]"
      }`}
      aria-label={inCompare ? "Remover da comparação" : "Adicionar à comparação"}
      title={full ? "Máximo de 3 produtos" : inCompare ? "Remover da comparação" : "Comparar"}
    >
      <GitCompareArrows size={14} />
    </button>
  );
}

function StoreFavoriteButton({ store }: { store: StoreType }) {
  const toggleStore = useFavoritesStore((s) => s.toggleStore);
  const isFav = useFavoritesStore((s) => s.stores.some((st) => st.id === store.id));

  return (
    <button
      onClick={() =>
        toggleStore({
          id: store.id,
          name: store.name,
          category: store.category,
          logoUrl: store.logoUrl,
          deliveryTimeMin: store.deliveryTimeMin,
          deliveryTimeMax: store.deliveryTimeMax,
          deliveryFee: Number(store.deliveryFee),
          rating: Number(store.rating),
          isOpen: store.isOpen,
        })
      }
      className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg backdrop-blur-sm transition-all hover:scale-110 ${
        isFav ? "bg-red-500/90 text-white" : "bg-white/20 text-white/70 hover:bg-white/30"
      }`}
      aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
    >
      {isFav ? "♥" : "♡"}
    </button>
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
      <Link to={`/lojas/${product.storeId}/produto/${product.id}`} className="block">
        <div className="flex h-44 items-center justify-center overflow-hidden rounded-t-3xl bg-[#f8fafc] p-4">
          <ProductImage
            imageUrl={product.imageUrl}
            alt={product.imageAlt || product.name}
            category={product.category}
            containerClassName="h-36 w-full rounded-2xl"
            className="h-36 w-full object-contain transition-transform group-hover:scale-105"
          />
        </div>

        <div className="px-4 pt-4">
          <p className="truncate text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
            {product.category}
          </p>
          <h3 className="mt-1 text-sm font-black leading-tight text-[#0f172a] line-clamp-2">
            {product.name}
          </h3>
          {product.description && (
            <p className="mt-1 text-xs text-[#64748b] line-clamp-1">{product.description}</p>
          )}
          <div className="mt-2">
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
              <p className="text-base font-black text-[#16a34a]">
                {formatBRL(Number(product.price))}
              </p>
            )}
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-2 p-4 pt-2">
        {/* Compare button */}
        <CompareButton product={product} />

        {product.stock <= 0 ? (
          <span className="rounded-xl bg-[#f1f5f9] px-3 py-1.5 text-xs font-black text-[#94a3b8]">
            Sem estoque
          </span>
        ) : !cartItem ? (
          <button
            onClick={handleAdd}
            className="rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-black text-white transition-colors hover:bg-[#16a34a]"
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
  );
}
