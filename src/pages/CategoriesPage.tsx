import { ChevronRight, Search, X } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { categories, type Category } from "../data/categories";
import { categoryIcons } from "../data/categoryIcons";
import { usePageMeta } from "../hooks/usePageMeta";
import { canonicalUrl } from "../lib/seo";

// ── Gradiente + sombra únicos por categoria ─────────────────────────────────

const CAT_STYLE: Record<string, { gradient: string; shadow: string }> = {
  restaurantes:          { gradient: "linear-gradient(135deg,#dc2626,#9a3412)", shadow: "rgba(220,38,38,0.35)" },
  mercearia:             { gradient: "linear-gradient(135deg,#16a34a,#14532d)", shadow: "rgba(22,163,74,0.35)" },
  cervejas:              { gradient: "linear-gradient(135deg,#d97706,#7c2d12)", shadow: "rgba(217,119,6,0.35)" },
  "destilados-e-vinhos": { gradient: "linear-gradient(135deg,#7c3aed,#4c1d95)", shadow: "rgba(124,58,237,0.35)" },
  "nao-alcoolicos":      { gradient: "linear-gradient(135deg,#0891b2,#164e63)", shadow: "rgba(8,145,178,0.35)" },
  farmacia:              { gradient: "linear-gradient(135deg,#dc2626,#7f1d1d)", shadow: "rgba(220,38,38,0.35)" },
  lanches:               { gradient: "linear-gradient(135deg,#ea580c,#9a3412)", shadow: "rgba(234,88,12,0.35)" },
  pizzarias:             { gradient: "linear-gradient(135deg,#b91c1c,#7f1d1d)", shadow: "rgba(185,28,28,0.35)" },
  "acai-sorvetes":       { gradient: "linear-gradient(135deg,#a855f7,#6d28d9)", shadow: "rgba(168,85,247,0.35)" },
  cafeterias:            { gradient: "linear-gradient(135deg,#92400e,#1c0a00)", shadow: "rgba(146,64,14,0.35)" },
  padaria:               { gradient: "linear-gradient(135deg,#b45309,#7c2d12)", shadow: "rgba(180,83,9,0.35)" },
  doces:                 { gradient: "linear-gradient(135deg,#db2777,#831843)", shadow: "rgba(219,39,119,0.35)" },
  conveniencia:          { gradient: "linear-gradient(135deg,#0f766e,#134e4a)", shadow: "rgba(15,118,110,0.35)" },
  hortifruti:            { gradient: "linear-gradient(135deg,#22c55e,#14532d)", shadow: "rgba(34,197,94,0.35)" },
  carnes:                { gradient: "linear-gradient(135deg,#991b1b,#450a0a)", shadow: "rgba(153,27,27,0.35)" },
  petshop:               { gradient: "linear-gradient(135deg,#f59e0b,#7c2d12)", shadow: "rgba(245,158,11,0.35)" },
  beleza:                { gradient: "linear-gradient(135deg,#e11d48,#831843)", shadow: "rgba(225,29,72,0.35)" },
  moda:                  { gradient: "linear-gradient(135deg,#1e3a5f,#0f172a)", shadow: "rgba(30,58,95,0.35)" },
  fitness:               { gradient: "linear-gradient(135deg,#059669,#0e7490)", shadow: "rgba(5,150,105,0.35)" },
  bebes:                 { gradient: "linear-gradient(135deg,#3b82f6,#7c3aed)", shadow: "rgba(59,130,246,0.35)" },
  "casa-cozinha":        { gradient: "linear-gradient(135deg,#92400e,#1c1917)", shadow: "rgba(146,64,14,0.35)" },
  utilidades:            { gradient: "linear-gradient(135deg,#475569,#1e293b)", shadow: "rgba(71,85,105,0.35)" },
  ferramentas:           { gradient: "linear-gradient(135deg,#374151,#111827)", shadow: "rgba(55,65,81,0.35)" },
  construcao:            { gradient: "linear-gradient(135deg,#ea580c,#7c2d12)", shadow: "rgba(234,88,12,0.35)" },
  eletronicos:           { gradient: "linear-gradient(135deg,#1d4ed8,#1e1b4b)", shadow: "rgba(29,78,216,0.35)" },
  papelaria:             { gradient: "linear-gradient(135deg,#4338ca,#1e1b4b)", shadow: "rgba(67,56,202,0.35)" },
  brinquedos:            { gradient: "linear-gradient(135deg,#dc2626,#7c3aed)", shadow: "rgba(220,38,38,0.35)" },
  presentes:             { gradient: "linear-gradient(135deg,#7c3aed,#db2777)", shadow: "rgba(124,58,237,0.35)" },
  automotivo:            { gradient: "linear-gradient(135deg,#334155,#0f172a)", shadow: "rgba(51,65,85,0.35)" },
  servicos:              { gradient: "linear-gradient(135deg,#4f46e5,#1e3a5f)", shadow: "rgba(79,70,229,0.35)" },
  "cursos-online":       { gradient: "linear-gradient(135deg,#002776,#16a34a)", shadow: "rgba(0,39,118,0.35)" },
  "assistencia-tecnica": { gradient: "linear-gradient(135deg,#374151,#1e3a5f)", shadow: "rgba(55,65,81,0.35)" },
  outros:                { gradient: "linear-gradient(135deg,#16a34a,#002776)", shadow: "rgba(22,163,74,0.35)" },
};

// ── Seções semânticas ────────────────────────────────────────────────────────

type SectionDef = {
  key: string;
  label: string;
  emoji: string;
  accent: string;
  description: string;
  slugs: string[];
};

const SECTIONS: SectionDef[] = [
  {
    key: "alimentacao",
    label: "Alimentação & Bebidas",
    emoji: "🍽️",
    accent: "#dc2626",
    description: "Restaurantes, lanches, bebidas, farmácia e muito mais",
    slugs: [
      "restaurantes", "mercearia", "cervejas", "destilados-e-vinhos", "nao-alcoolicos",
      "farmacia", "lanches", "pizzarias", "acai-sorvetes", "cafeterias", "padaria", "doces",
    ],
  },
  {
    key: "mercado",
    label: "Mercado & Estilo",
    emoji: "🛒",
    accent: "#16a34a",
    description: "Hortifruti, pets, beleza, moda, fitness e bem-estar",
    slugs: [
      "conveniencia", "hortifruti", "carnes", "petshop",
      "beleza", "moda", "fitness", "bebes", "casa-cozinha",
    ],
  },
  {
    key: "casa-tech",
    label: "Casa & Tecnologia",
    emoji: "📱",
    accent: "#1d4ed8",
    description: "Eletrônicos, ferramentas, construção, presentes e mais",
    slugs: [
      "utilidades", "ferramentas", "construcao", "eletronicos", "papelaria",
      "brinquedos", "presentes", "automotivo", "servicos",
    ],
  },
  {
    key: "educacao",
    label: "Educação & Serviços",
    emoji: "📚",
    accent: "#002776",
    description: "Cursos on-line, assistência técnica e soluções diversas",
    slugs: ["cursos-online", "assistencia-tecnica", "outros"],
  },
];

// ── Página ───────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [search, setSearch] = useState("");

  usePageMeta({
    title: "Categorias — BrasUX Shopping",
    description: `Explore as ${categories.length} categorias do BrasUX Shopping. Restaurantes, eletrônicos, moda, serviços e muito mais com entrega em todo o Brasil.`,
    canonical: canonicalUrl("/categorias"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories;
  }, [search]);

  const isSearching = search.trim().length > 0;

  return (
    <div className="space-y-8">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-3xl p-7 sm:p-9"
        style={{
          background: "linear-gradient(135deg,#001640 0%,#002776 35%,#001a4e 65%,#003d1a 100%)",
        }}
      >
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#002776] opacity-60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-12 h-48 w-48 rounded-full bg-[#16a34a] opacity-25 blur-3xl" />
        <div className="pointer-events-none absolute right-40 bottom-4 h-32 w-32 rounded-full bg-[#1351b4] opacity-20 blur-2xl" />

        {/* grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.7) 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#4ade80] backdrop-blur-sm">
              BrasUX Shopping
            </div>
            <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
              Explore as{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg,#86efac,#4ade80)" }}
              >
                Categorias
              </span>
            </h1>
            <p className="mt-2 text-sm text-[#94a3b8]">
              {categories.length} departamentos · encontre o que precisa em segundos
            </p>
          </div>

          {/* Search bar */}
          <div className="flex w-full items-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-sm transition-all focus-within:border-[#4ade80]/35 focus-within:bg-white/12 sm:max-w-xs">
            <Search size={14} className="shrink-0 text-[#4ade80]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar categoria…"
              className="flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-[#64748b]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-[#64748b] transition-colors hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Section pills */}
        <div className="relative z-10 mt-5 flex flex-wrap items-center gap-2 border-t border-white/8 pt-5">
          {SECTIONS.map((s) => (
            <span
              key={s.key}
              className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/6 px-3 py-1 text-[11px] font-medium text-white/65"
            >
              <span>{s.emoji}</span>
              <span>{s.label}</span>
              <span className="font-black text-white/35">·</span>
              <span className="font-black text-white/50">{s.slugs.length}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── CONTEÚDO ──────────────────────────────────────────────────────── */}
      {isSearching ? (
        <SearchResults query={search} filtered={filtered} onClear={() => setSearch("")} />
      ) : (
        <div className="space-y-10">
          {SECTIONS.map((section) => {
            const sectionCats = section.slugs
              .map((slug) => categories.find((c) => c.slug === slug))
              .filter((c): c is Category => !!c);

            return (
              <div key={section.key} id={section.key}>
                <SectionHeader section={section} />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {sectionCats.map((cat) => (
                    <CategoryCard key={cat.id} cat={cat} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ section }: { section: SectionDef }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#e8eaf0] bg-white px-5 py-4 shadow-sm">
      {/* subtle tinted wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(135deg,${section.accent}08 0%,transparent 55%)`,
        }}
      />
      {/* accent left bar */}
      <div
        className="absolute inset-y-0 left-0 w-1 rounded-l-2xl"
        style={{ background: section.accent }}
      />

      <div className="relative flex items-center gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm"
          style={{
            background: `${section.accent}14`,
            border: `1.5px solid ${section.accent}28`,
          }}
        >
          {section.emoji}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black text-[#0f172a]">{section.label}</h2>
          <p className="mt-0.5 text-[11px] text-[#94a3b8]">{section.description}</p>
        </div>

        <div
          className="shrink-0 rounded-full px-3 py-1 text-[11px] font-black"
          style={{
            background: `${section.accent}12`,
            color: section.accent,
          }}
        >
          {section.slugs.length} itens
        </div>
      </div>
    </div>
  );
}

// ── Category Card ─────────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: Category }) {
  const icon = categoryIcons[cat.slug] ?? "✨";
  const style = CAT_STYLE[cat.slug] ?? {
    gradient: "linear-gradient(135deg,#16a34a,#002776)",
    shadow: "rgba(22,163,74,0.35)",
  };

  return (
    <Link
      to={`/categorias/${cat.slug}`}
      className="group flex flex-col items-center gap-2"
    >
      {/* tile */}
      <div
        className="relative w-full overflow-hidden rounded-3xl transition-all duration-300 group-hover:-translate-y-1"
        style={{
          aspectRatio: "1 / 1",
          background: style.gradient,
          boxShadow: `0 4px 16px ${style.shadow}`,
        }}
      >
        {/* gloss */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-white/5 to-transparent" />

        {/* decorative circle top-right */}
        <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/12" />
        {/* decorative circle bottom-left */}
        <div className="absolute -bottom-5 -left-5 h-20 w-20 rounded-full bg-black/12" />

        {/* hover inner glow */}
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at 50% 35%,rgba(255,255,255,0.22) 0%,transparent 65%)",
          }}
        />

        {/* emoji */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl drop-shadow-xl transition-transform duration-300 group-hover:scale-[1.15] group-hover:-translate-y-0.5">
            {icon}
          </span>
        </div>

        {/* hover arrow badge */}
        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/0 transition-all duration-300 group-hover:bg-white/20">
          <ChevronRight
            size={11}
            className="text-white/0 transition-all duration-300 group-hover:text-white/90"
          />
        </div>
      </div>

      {/* label */}
      <h3 className="text-center text-[10px] font-black uppercase leading-tight tracking-wide text-[#475569] line-clamp-2">
        {cat.name}
      </h3>
    </Link>
  );
}

// ── Search Results ────────────────────────────────────────────────────────────

function SearchResults({
  query,
  filtered,
  onClear,
}: {
  query: string;
  filtered: Category[];
  onClear: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[#64748b]">
          <strong className="text-[#0f172a]">{filtered.length}</strong>{" "}
          resultado{filtered.length !== 1 ? "s" : ""} para{" "}
          <strong className="text-[#0f172a]">"{query}"</strong>
        </p>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-black text-[#64748b] shadow-sm transition-colors hover:text-[#0f172a]"
        >
          <X size={11} /> Limpar busca
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-[#e2e8f0] bg-white p-14 text-center">
          <span className="text-5xl">🔍</span>
          <p className="mt-4 text-lg font-black text-[#0f172a]">Nenhuma categoria encontrada</p>
          <p className="mt-1.5 text-sm text-[#64748b]">
            Tente buscar por "restaurante", "eletrônico" ou "serviço"
          </p>
          <button
            onClick={onClear}
            className="mt-6 rounded-2xl px-6 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.03]"
            style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}
          >
            Ver todas as categorias
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((cat) => (
            <CategoryCard key={cat.id} cat={cat} />
          ))}
        </div>
      )}
    </div>
  );
}
