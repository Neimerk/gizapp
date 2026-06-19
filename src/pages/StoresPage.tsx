import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getStores, queryKeys, type Store } from "../services/gizApi";
import StoreCard from "../components/store/StoreCard";

const CATEGORIES = ["Todas", "Restaurante", "Mercearia", "Bebidas", "Farmácia", "Pet Shop", "Padaria", "Hortifruti", "Conveniência"];

export default function StoresPage() {
  const [params] = useSearchParams();

  const [search, setSearch] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState("Todas");
  const [sort, setSort] = useState<"rating" | "time" | "fee">("rating");

  const { data: stores = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.stores(),
    queryFn: getStores,
    select: (data) => data.filter((s) => s.active),
  });

  const filtered = useMemo(() => {
    let list = stores;
    if (category !== "Todas") list = list.filter((s) => s.category.toLowerCase().includes(category.toLowerCase()));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    }
    if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    if (sort === "time") list = [...list].sort((a, b) => a.deliveryTimeMin - b.deliveryTimeMin);
    if (sort === "fee") list = [...list].sort((a, b) => a.deliveryFee - b.deliveryFee);
    return list;
  }, [stores, category, search, sort]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">BrasUX</p>
        <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Lojas próximas</h1>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-sm transition-colors focus-within:border-[#16a34a]/40">
          <Search size={16} className="shrink-0 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar loja ou categoria…"
            className="flex-1 bg-transparent text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#94a3b8]">Ordenar:</span>
          {(
            [
              { key: "rating", label: "Nota" },
              { key: "time", label: "Mais rápida" },
              { key: "fee", label: "Menor taxa" },
            ] as { key: typeof sort; label: string }[]
          ).map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`rounded-xl px-3 py-2 text-xs font-black transition-colors ${
                sort === s.key ? "bg-[#0f172a] text-white" : "border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-full px-4 py-2 text-sm font-black transition-colors ${
              category === cat ? "bg-[#16a34a] text-white" : "border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results */}
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
          <p className="mt-1 text-sm text-[#64748b]">Tente outra categoria ou ajuste a busca.</p>
        </div>
      ) : (
        <>
          <p className="text-sm font-bold text-[#94a3b8]">
            {filtered.length} {filtered.length === 1 ? "loja" : "lojas"}
            {category !== "Todas" ? ` · ${category}` : ""}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
