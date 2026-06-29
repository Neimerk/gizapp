import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Locate, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getStores, queryKeys } from "../services/gizApi";
import { useGeolocation } from "../hooks/useGeolocation";
import { haversineKm } from "../utils/geo";
import StoreCard from "../components/store/StoreCard";
import { usePageMeta } from "../hooks/usePageMeta";
import { categories } from "../data/categories";
import { categoryIcons } from "../data/categoryIcons";

type SortKey = "rating" | "time" | "fee" | "distance";
type RadiusKm = 2 | 5 | 10 | 20 | 30 | 0; // 0 = sem filtro

function storeMatchesSlug(storeCategory: string, slug: string): boolean {
  return storeCategory
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .some((s) => s === slug || s.includes(slug) || slug.includes(s));
}

export default function StoresPage() {
  usePageMeta({ title: "Lojas" });
  const [params] = useSearchParams();

  const [search,      setSearch]      = useState(params.get("q") ?? "");
  const [activeSlug,  setActiveSlug]  = useState("todas");
  const [sort,        setSort]        = useState<SortKey>("rating");
  const [radius,      setRadius]      = useState<RadiusKm>(0);

  const { position, loading: loadingGeo, request: requestGeo } = useGeolocation();

  const { data: stores = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.stores(),
    queryFn:  getStores,
    select:   (data) => data.filter((s) => s.active),
  });

  // Enriquece stores com distância quando posição disponível
  const storesWithDistance = useMemo(() => {
    return stores.map((s) => ({
      ...s,
      distanceKm:
        position && s.lat != null && s.lng != null
          ? haversineKm(position.lat, position.lng, s.lat, s.lng)
          : undefined,
    }));
  }, [stores, position]);

  const filtered = useMemo(() => {
    let list = storesWithDistance;

    // Filtro de categoria por slug
    if (activeSlug !== "todas")
      list = list.filter((s) => storeMatchesSlug(s.category, activeSlug));

    // Busca por nome
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    }

    // Filtro por raio
    if (radius > 0 && position)
      list = list.filter((s) => s.distanceKm === undefined || s.distanceKm <= radius);

    // Ordenação
    if (sort === "distance" && position)
      list = [...list].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    else if (sort === "rating")
      list = [...list].sort((a, b) => b.rating - a.rating);
    else if (sort === "time")
      list = [...list].sort((a, b) => a.deliveryTimeMin - b.deliveryTimeMin);
    else if (sort === "fee")
      list = [...list].sort((a, b) => a.deliveryFee - b.deliveryFee);

    return list;
  }, [storesWithDistance, activeSlug, search, sort, radius, position]);

  const activeLabel = activeSlug === "todas"
    ? "Todas"
    : (categories.find((c) => c.slug === activeSlug)?.name ?? activeSlug);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft,  setCanScrollLeft]  = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    syncScroll();
    window.addEventListener("resize", syncScroll);
    return () => window.removeEventListener("resize", syncScroll);
  }, [syncScroll]);

  function scrollCats(dir: "left" | "right") {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  }

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "rating",   label: "Nota" },
    { key: "time",     label: "Mais rápida" },
    { key: "fee",      label: "Menor taxa" },
    { key: "distance", label: "Mais próxima" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">BrasUX</p>
          <h1 className="mt-0.5 text-3xl font-black text-content">Lojas</h1>
        </div>

        {/* Botão de localização */}
        {!position && (
          <button
            onClick={requestGeo}
            disabled={loadingGeo}
            className="flex items-center gap-2 rounded-2xl border border-[#16a34a]/30 bg-[#f0fdf4] px-4 py-2.5 text-sm font-black text-[#16a34a]"
          >
            <Locate size={15} className={loadingGeo ? "animate-spin" : ""} />
            {loadingGeo ? "Localizando…" : "Usar minha localização"}
          </button>
        )}
        {position && (
          <span className="flex items-center gap-1.5 rounded-2xl bg-[#f0fdf4] px-3 py-2 text-xs font-bold text-[#16a34a]">
            <Locate size={13} /> Localização ativa
          </span>
        )}
      </div>

      {/* Busca + Ordenação */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 shadow-sm focus-within:border-[#16a34a]/40">
          <Search size={16} className="shrink-0 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar loja ou categoria…"
            className="flex-1 bg-transparent text-sm font-medium text-content outline-none placeholder:text-faint"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-faint">Ordenar:</span>
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => { setSort(s.key); if (s.key === "distance" && !position) requestGeo(); }}
              className={`rounded-xl px-3 py-2 text-xs font-black transition-colors ${
                sort === s.key ? "bg-[#0f172a] text-white" : "border border-line bg-surface text-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro por raio (só quando tem posição) */}
      {position && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-faint">Raio:</span>
          {([0, 2, 5, 10, 20, 30] as RadiusKm[]).map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`rounded-xl px-3 py-2 text-xs font-black transition-colors ${
                radius === r ? "bg-[#16a34a] text-white" : "border border-line bg-surface text-muted"
              }`}
            >
              {r === 0 ? "Todos" : `${r}km`}
            </button>
          ))}
        </div>
      )}

      {/* Category scroll with arrows (desktop) */}
      <div className="relative">
        {/* Left arrow — desktop only, shown when scrolled */}
        <button
          onClick={() => scrollCats("left")}
          aria-label="Categorias anteriores"
          className={`absolute left-0 top-1/2 z-10 -translate-y-1/2 hidden md:flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface shadow-md text-content transition-all hover:border-[#16a34a]/40 hover:text-[#16a34a] ${
            canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <ChevronLeft size={16} />
        </button>

        <div
          ref={scrollRef}
          onScroll={syncScroll}
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden md:px-10"
        >
          <button
            onClick={() => setActiveSlug("todas")}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition-colors ${
              activeSlug === "todas"
                ? "bg-[#16a34a] text-white"
                : "border border-line bg-surface text-content"
            }`}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setActiveSlug(cat.slug)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black transition-colors ${
                activeSlug === cat.slug
                  ? "bg-[#16a34a] text-white"
                  : "border border-line bg-surface text-content"
              }`}
            >
              <span>{categoryIcons[cat.slug] ?? "✨"}</span>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Right arrow — desktop only, shown when more content ahead */}
        <button
          onClick={() => scrollCats("right")}
          aria-label="Próximas categorias"
          className={`absolute right-0 top-1/2 z-10 -translate-y-1/2 hidden md:flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface shadow-md text-content transition-all hover:border-[#16a34a]/40 hover:text-[#16a34a] ${
            canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Resultados */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-3xl bg-surface p-5 shadow-sm">
              <div className="h-24 rounded-2xl bg-subtle-2" />
              <div className="mt-4 h-4 w-1/2 rounded bg-subtle-2" />
              <div className="mt-2 h-3 w-1/3 rounded bg-subtle-2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-surface p-16 text-center">
          <p className="text-lg font-black text-content">Nenhuma loja encontrada</p>
          <p className="mt-1 text-sm text-muted">
            {radius > 0
              ? `Nenhuma loja em ${radius}km. Tente aumentar o raio.`
              : "Tente outra categoria ou ajuste a busca."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm font-bold text-faint">
            {filtered.length} {filtered.length === 1 ? "loja" : "lojas"}
            {activeSlug !== "todas" ? ` · ${activeLabel}` : ""}
            {radius > 0 ? ` · até ${radius}km` : ""}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((store) => (
              <StoreCard key={store.id} store={store} distanceKm={store.distanceKm} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
