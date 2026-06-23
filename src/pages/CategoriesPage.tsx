import { Search, X } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { categories, type Category } from "../data/categories";
import { usePageMeta } from "../hooks/usePageMeta";
import { canonicalUrl } from "../lib/seo";

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
  return (
    <Link
      to={`/categorias/${cat.slug}`}
      className="group flex flex-col items-center gap-2.5"
    >
      {/* tile */}
      <div
        className="relative w-full overflow-hidden rounded-3xl shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl"
        style={{ aspectRatio: "1 / 1" }}
      >
        <img
          src={`/categorias/${cat.slug}.webp`}
          alt={cat.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]"
          loading="lazy"
          decoding="async"
        />
        {/* subtle hover scrim */}
        <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/8 rounded-3xl" />
      </div>

      {/* label — texto maior e mais legível */}
      <h3 className="text-center text-xs font-black uppercase leading-tight tracking-wide text-[#374151] line-clamp-2">
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
