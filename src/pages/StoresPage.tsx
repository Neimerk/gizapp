import { useState, useMemo } from "react";
import { Bike, Clock3, Search, Star, ArrowRight } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getStores, queryKeys, type Store } from "../services/gizApi";
import { formatBRL } from "../utils/format";
import StoreLogo from "../components/ui/StoreLogo";

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
        <p className="text-xs font-black uppercase tracking-widest text-[#7c3aed]">GizApp</p>
        <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Lojas próximas</h1>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-3 shadow-sm transition-colors focus-within:border-[#7c3aed]/40">
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
              category === cat ? "bg-[#7c3aed] text-white" : "border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
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

function StoreCard({ store }: { store: Store }) {
  const deliveryFeeText = Number(store.deliveryFee) === 0 ? "Grátis" : formatBRL(Number(store.deliveryFee));

  return (
    <Link
      to={`/lojas/${store.id}`}
      className="card-hover group flex flex-col overflow-hidden rounded-3xl bg-white"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div
        className="relative h-28"
        style={{
          background: "radial-gradient(circle at 80% 30%, rgba(124,58,237,0.5), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        }}
      >
        <span
          className={`absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
            store.isOpen ? "border-green-700/40 bg-green-900/30 text-green-400" : "border-white/15 bg-white/10 text-[#94a3b8]"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${store.isOpen ? "bg-green-400" : "bg-[#94a3b8]"}`} />
          {store.isOpen ? "Aberto" : "Fechado"}
        </span>

        <span
          className="absolute -bottom-6 left-5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl text-base font-black text-white"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
            boxShadow: "0 4px 16px rgba(124,58,237,0.45)",
          }}
        >
          <StoreLogo logoUrl={store.logoUrl} name={store.name} />
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">{store.category}</p>
        <h3 className="mt-0.5 text-lg font-black text-[#0f172a]">{store.name}</h3>
        {store.description && (
          <p className="mt-1 text-xs leading-relaxed text-[#64748b] line-clamp-2">{store.description}</p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { icon: <Clock3 size={12} />, label: "Entrega", value: `${store.deliveryTimeMin}-${store.deliveryTimeMax}min` },
            { icon: <Bike size={12} />, label: "Taxa", value: deliveryFeeText },
            { icon: <Star size={12} />, label: "Nota", value: Number(store.rating).toFixed(1) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-[#f8fafc] px-2 py-2" style={{ border: "1px solid #f1f5f9" }}>
              <div className="flex items-center gap-1 text-[#94a3b8]">
                {s.icon}
                <span className="text-[9px] font-bold uppercase tracking-wide">{s.label}</span>
              </div>
              <div className="mt-0.5 text-xs font-black text-[#0f172a]">{s.value}</div>
            </div>
          ))}
        </div>

        <div
          className="mt-4 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-black text-white transition-opacity group-hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)" }}
        >
          Ver catálogo <ArrowRight size={16} />
        </div>
      </div>
    </Link>
  );
}
