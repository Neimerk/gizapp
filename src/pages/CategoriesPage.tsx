import { Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { categories } from "../data/categories";

const categoryIcons: Record<string, string> = {
  restaurantes: "🍽️",
  mercearia: "🛒",
  cervejas: "🍺",
  "destilados-e-vinhos": "🍷",
  "nao-alcoolicos": "🥤",
  farmacia: "💊",
  lanches: "🍔",
  pizzarias: "🍕",
  "acai-sorvetes": "🍨",
  cafeterias: "☕",
  padaria: "🥖",
  doces: "🍫",
  conveniencia: "🏪",
  hortifruti: "🥦",
  carnes: "🥩",
  petshop: "🐶",
  beleza: "💄",
  moda: "👕",
  fitness: "🏋️",
  bebes: "🍼",
  "casa-cozinha": "🏠",
  utilidades: "🧰",
  ferramentas: "🔧",
  construcao: "🧱",
  eletronicos: "📱",
  papelaria: "✏️",
  brinquedos: "🧸",
  presentes: "🎁",
  automotivo: "🚗",
  servicos: "🤝",
  "cursos-online": "📚",
  "assistencia-tecnica": "🛠️",
  outros: "✨",
};

const PALETTES = [
  "bg-gradient-to-br from-[#16a34a] to-[#15803d]",
  "bg-gradient-to-br from-[#2563eb] to-[#1d4ed8]",
  "bg-gradient-to-br from-[#0f172a] to-[#1e293b]",
  "bg-gradient-to-br from-[#ec4899] to-[#db2777]",
  "bg-gradient-to-br from-[#f59e0b] to-[#f97316]",
];

export default function CategoriesPage() {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : categories;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">BrasUX</p>
          <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">Categorias</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5">
            <span className="text-base font-black text-[#16a34a]">{categories.length}</span>
            <span className="text-xs font-semibold text-[#64748b]">categorias</span>
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 focus-within:border-[#16a34a]/40 sm:min-w-56">
            <Search size={15} className="shrink-0 text-[#94a3b8]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar categorias…"
              className="flex-1 bg-transparent text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
            />
          </div>
        </div>
      </div>

      {/* GRID */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#e2e8f0] bg-white p-10 text-center">
          <p className="font-black text-[#0f172a]">Nenhuma categoria encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((cat, i) => (
            <Link
              key={cat.id}
              to={`/categorias/${cat.slug}`}
              className="group flex flex-col items-center gap-2"
            >
              <div
                className={`relative flex h-24 w-full items-center justify-center overflow-hidden rounded-2xl shadow-md transition-all duration-200 group-hover:scale-[1.03] group-hover:shadow-lg ${
                  PALETTES[i % PALETTES.length]
                }`}
              >
                <div className="absolute inset-0 bg-white/5" />
                <span className="relative z-10 text-5xl drop-shadow-lg transition-transform duration-200 group-hover:scale-110">
                  {categoryIcons[cat.slug] ?? "✨"}
                </span>
              </div>
              <h3 className="text-center text-[11px] font-black uppercase leading-tight tracking-wide text-[#475569]">
                {cat.name}
              </h3>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
