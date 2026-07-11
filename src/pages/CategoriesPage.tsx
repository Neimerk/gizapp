import { Search, X } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { categories, type Category } from "../data/categories";
import { departments, getCategoriesOf, type Department } from "../data/taxonomy";
import CategoryTile from "../components/ui/CategoryTile";
import { usePageMeta } from "../hooks/usePageMeta";
import { canonicalUrl } from "../lib/seo";

// ─────────────────────────────────────────────────────────────────────────────
// /categorias — navegação por DEPARTAMENTO (fonte única: data/taxonomy.ts).
// 33 categorias organizadas em 6 verticais por intenção de uso.
// ─────────────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [search, setSearch] = useState("");
  const { hash } = useLocation();

  usePageMeta({
    title: "Soluções — BrasUX Soluções Tecnológicas",
    description: `Explore as ${categories.length} soluções do BrasUX em ${departments.length} lojas especializadas. Landing pages, apps, white label, IA, dados, engenharia e consultorias.`,
    canonical: canonicalUrl("/categorias"),
  });

  // rola até a âncora do departamento (#comida, #mercado…) ao chegar via DepartmentCard
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

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
        style={{ background: "linear-gradient(135deg,#001640 0%,#002776 35%,#001a4e 65%,#003d1a 100%)" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#002776] opacity-60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-12 h-48 w-48 rounded-full bg-[#16a34a] opacity-25 blur-3xl" />
        <div className="pointer-events-none absolute right-40 bottom-4 h-32 w-32 rounded-full bg-[#1351b4] opacity-20 blur-2xl" />
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
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg,#86efac,#4ade80)" }}>
                Categorias
              </span>
            </h1>
            <p className="mt-2 text-sm text-faint">
              {categories.length} categorias em {departments.length} departamentos · encontre o que precisa em segundos
            </p>
          </div>

          {/* Busca */}
          <div className="flex w-full items-center gap-2 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-sm transition-all focus-within:border-[#4ade80]/35 focus-within:bg-white/12 sm:max-w-xs">
            <Search size={14} className="shrink-0 text-[#4ade80]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar categoria…"
              className="flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-muted"
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Limpar busca" className="text-muted transition-colors hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Atalhos de departamento (âncoras) */}
        <div className="relative z-10 mt-5 flex flex-wrap items-center gap-2 border-t border-white/8 pt-5">
          {departments.map((dep) => (
            <a
              key={dep.key}
              href={`#${dep.key}`}
              className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/6 px-3 py-1 text-[11px] font-medium text-white/65 transition-colors hover:bg-white/12 hover:text-white"
            >
              <span>{dep.emoji}</span>
              <span>{dep.label}</span>
              <span className="font-black text-white/35">·</span>
              <span className="font-black text-white/50">{dep.slugs.length}</span>
            </a>
          ))}
        </div>
      </section>

      {/* ── CONTEÚDO ──────────────────────────────────────────────────────── */}
      {isSearching ? (
        <SearchResults query={search} filtered={filtered} onClear={() => setSearch("")} />
      ) : (
        <div className="space-y-10">
          {departments.map((dep) => (
            <div key={dep.key} id={dep.key} className="scroll-mt-24">
              <DepartmentHeader department={dep} />
              <div className="mt-4 grid grid-cols-3 gap-3">
                {getCategoriesOf(dep).map((cat) => (
                  <CategoryTile key={cat.id} category={cat} variant="image" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Cabeçalho de departamento ────────────────────────────────────────────────

function DepartmentHeader({ department }: { department: Department }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line-subtle bg-surface px-5 py-4 shadow-sm">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(135deg,${department.accent}08 0%,transparent 55%)` }}
      />
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-2xl" style={{ background: department.accent }} />

      <div className="relative flex items-center gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm"
          style={{ background: `${department.accent}14`, border: `1.5px solid ${department.accent}28` }}
        >
          {department.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black text-content">{department.label}</h2>
          <p className="mt-0.5 text-[11px] text-faint">{department.description}</p>
        </div>
        <div
          className="shrink-0 rounded-full px-3 py-1 text-[11px] font-black"
          style={{ background: `${department.accent}12`, color: department.accent }}
        >
          {department.slugs.length} {department.slugs.length === 1 ? "categoria" : "categorias"}
        </div>
      </div>
    </div>
  );
}

// ── Resultados de busca ───────────────────────────────────────────────────────

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
        <p className="text-sm text-muted">
          <strong className="text-content">{filtered.length}</strong>{" "}
          resultado{filtered.length !== 1 ? "s" : ""} para{" "}
          <strong className="text-content">"{query}"</strong>
        </p>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-black text-muted shadow-sm transition-colors hover:text-content"
        >
          <X size={11} /> Limpar busca
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface p-14 text-center">
          <span className="text-5xl">🔍</span>
          <p className="mt-4 text-lg font-black text-content">Nenhuma categoria encontrada</p>
          <p className="mt-1.5 text-sm text-muted">Tente buscar por "restaurante", "eletrônico" ou "serviço"</p>
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
            <CategoryTile key={cat.id} category={cat} variant="image" />
          ))}
        </div>
      )}
    </div>
  );
}
