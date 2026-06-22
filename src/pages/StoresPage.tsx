import { useState, useMemo } from "react";
import { Locate, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getStores, queryKeys } from "../services/gizApi";
import { useGeolocation } from "../hooks/useGeolocation";
import { haversineKm } from "../utils/geo";
import StoreCard from "../components/store/StoreCard";
import { usePageMeta } from "../hooks/usePageMeta";

const CATEGORIES = [
  "Todas", "Restaurante", "Mercearia", "Bebidas", "Farmácia",
  "Pet Shop", "Padaria", "Hortifruti", "Conveniência", "Tecnologia",
];

type SortKey = "rating" | "time" | "fee" | "distance";
type RadiusKm = 2 | 5 | 10 | 0; // 0 = sem filtro

export default function StoresPage() {
  usePageMeta({ title: "Lojas" });
  const [params] = useSearchParams();

  const [search,   setSearch]   = useState(params.get("q") ?? "");
  const [category, setCategory] = useState("Todas");
  const [sort,     setSort]     = useState<SortKey>("rating");
  const [radius,   setRadius]   = useState<RadiusKm>(0);

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

    // Filtro de categoria
    if (category !== "Todas")
      list = list.filter((s) => s.category.toLowerCase().includes(category.toLowerCase()));

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
  }, [storesWithDistance, category, search, sort, radius, position]);

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
          <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Lojas</h1>
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
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-sm focus-within:border-[#16a34a]/40">
          <Search size={16} className="shrink-0 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar loja ou categoria…"
            className="flex-1 bg-transparent text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#94a3b8]">Ordenar:</span>
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => { setSort(s.key); if (s.key === "distance" && !position) requestGeo(); }}
              className={`rounded-xl px-3 py-2 text-xs font-black transition-colors ${
                sort === s.key ? "bg-[#0f172a] text-white" : "border border-[#e2e8f0] bg-white text-[#64748b]"
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
          <span className="text-xs font-bold text-[#94a3b8]">Raio:</span>
          {([0, 2, 5, 10] as RadiusKm[]).map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`rounded-xl px-3 py-2 text-xs font-black transition-colors ${
                radius === r ? "bg-[#16a34a] text-white" : "border border-[#e2e8f0] bg-white text-[#64748b]"
              }`}
            >
              {r === 0 ? "Todos" : `${r}km`}
            </button>
          ))}
        </div>
      )}

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-full px-4 py-2 text-sm font-black transition-colors ${
              category === cat ? "bg-[#16a34a] text-white" : "border border-[#e2e8f0] bg-white text-[#0f172a]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Resultados */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-3xl bg-white p-5 shadow-sm">
              <div className="h-24 rounded-2xl bg-[#f1f5f9]" />
              <div className="mt-4 h-4 w-1/2 rounded bg-[#f1f5f9]" />
              <div className="mt-2 h-3 w-1/3 rounded bg-[#f1f5f9]" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#e2e8f0] bg-white p-16 text-center">
          <p className="text-lg font-black text-[#0f172a]">Nenhuma loja encontrada</p>
          <p className="mt-1 text-sm text-[#64748b]">
            {radius > 0
              ? `Nenhuma loja em ${radius}km. Tente aumentar o raio.`
              : "Tente outra categoria ou ajuste a busca."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm font-bold text-[#94a3b8]">
            {filtered.length} {filtered.length === 1 ? "loja" : "lojas"}
            {category !== "Todas" ? ` · ${category}` : ""}
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
