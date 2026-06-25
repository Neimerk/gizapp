import { useMemo } from "react";
import { ArrowLeft, ArrowRight, Bike, Clock3, ExternalLink, Star } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import { useJsonLd } from "../hooks/useJsonLd";
import {
  buildItemListSchema,
  buildBreadcrumbSchema,
  buildFaqSchema,
  canonicalUrl,
  SEO,
} from "../lib/seo";
import Breadcrumbs from "../components/seo/Breadcrumbs";
import { useQuery } from "@tanstack/react-query";

import { getStores, getProductImageUrl, queryKeys, type Store } from "../services/gizApi";
import { categoryIcons } from "../data/categoryIcons";
import { categories as masterCategories } from "../data/categories";
import { brasuxSolutions, type BrasUXSolution } from "../data/brasuxSolutions";
import { formatBRL } from "../utils/format";
import StoreLogo from "../components/ui/StoreLogo";

function storeHasCategory(store: Store, slug: string): boolean {
  return store.category
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .some((s) => s === slug || s.includes(slug) || slug.includes(s));
}

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();

  const categorySlug = slug ?? "";
  const master = masterCategories.find((c) => c.slug === categorySlug);
  const icon = categoryIcons[categorySlug] ?? "✨";
  const label = master?.name ?? categorySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const { data: stores = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.stores(),
    queryFn: getStores,
    select: (data) => data.filter((s) => s.active),
  });

  const filtered = useMemo(
    () => stores.filter((s) => storeHasCategory(s, categorySlug)),
    [stores, categorySlug]
  );

  const solutions = brasuxSolutions.filter((s) => s.categorySlug === categorySlug);

  usePageMeta({
    title: `${label} — Lojas e Produtos`,
    description: `Encontre as melhores lojas de ${label} no BrasUX Shopping. ${filtered.length} loja${filtered.length !== 1 ? "s" : ""} disponível${filtered.length !== 1 ? "s" : ""}${solutions.length > 0 ? ` e ${solutions.length} solução${solutions.length !== 1 ? "s" : ""} BrasUX` : ""} com entrega rápida.`,
    canonical: canonicalUrl(`/categorias/${categorySlug}`),
  });

  const categorySchemas = useMemo(() => {
    const storeItems = filtered.map((s) => ({
      name: s.name,
      url: `${SEO.site.domain}/lojas/${s.id}`,
      imageUrl: s.logoUrl ?? undefined,
    }));
    return [
      buildItemListSchema({
        name: `${label} — Lojas no BrasUX`,
        description: `Lojas de ${label} disponíveis no BrasUX Shopping`,
        path: `/categorias/${categorySlug}`,
        items: storeItems,
      }),
      buildBreadcrumbSchema([
        { name: "Início", path: "/" },
        { name: "Categorias", path: "/categorias" },
        { name: label, path: `/categorias/${categorySlug}` },
      ]),
      buildFaqSchema([
        {
          question: `Como encontrar lojas de ${label} perto de mim?`,
          answer: `No BrasUX Shopping, permita sua localização e veja automaticamente as lojas de ${label} mais próximas de você com tempo de entrega estimado.`,
        },
        {
          question: `Qual o tempo de entrega para ${label}?`,
          answer: `O tempo de entrega para ${label} no BrasUX varia de acordo com a loja e sua localização. A maioria das lojas entrega entre 20 e 60 minutos.`,
        },
        {
          question: `Tem frete grátis em ${label}?`,
          answer: `Várias lojas de ${label} no BrasUX oferecem frete grátis. Consulte a taxa de entrega de cada loja ao fazer seu pedido.`,
        },
      ]),
    ];
  }, [filtered, label, categorySlug]);
  useJsonLd(categorySchemas);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { name: "Categorias", path: "/categorias" },
          { name: label, path: `/categorias/${categorySlug}` },
        ]}
      />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/categorias"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:border-[#16a34a]/40 hover:text-[#16a34a]"
        >
          <ArrowLeft size={17} />
        </Link>
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl shadow-md"
          style={{
            background:
              "radial-gradient(circle at 70% 30%, rgba(22,163,74,0.5), transparent 60%), linear-gradient(135deg,#0f172a,#1e293b)",
          }}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">Categoria</p>
          <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">{label}</h1>
          {!loading && (
            <p className="mt-0.5 text-sm text-[#64748b]">
              {filtered.length} {filtered.length === 1 ? "loja disponível" : "lojas disponíveis"}
            </p>
          )}
        </div>
      </div>

      {/* BrasUX Solutions */}
      {solutions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">Soluções BrasUX</span>
            <span className="rounded-full bg-[#16a34a]/10 px-2 py-0.5 text-[10px] font-black text-[#16a34a]">
              {solutions.length}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {solutions.map((s) => (
              <BrasUXSolutionCard key={s.id} solution={s} />
            ))}
          </div>
        </section>
      )}

      {/* Store grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-3xl bg-white p-5 shadow-sm">
              <div className="h-20 rounded-2xl bg-[#f1f5f9]" />
              <div className="mt-10 h-4 w-1/2 rounded bg-[#f1f5f9]" />
              <div className="mt-2 h-3 w-1/3 rounded bg-[#f1f5f9]" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#e2e8f0] bg-white p-16 text-center">
          <span className="text-5xl">{icon}</span>
          <p className="mt-4 text-lg font-black text-[#0f172a]">
            Nenhuma loja nessa categoria ainda
          </p>
          <p className="mt-1 text-sm text-[#64748b]">
            Em breve novos parceiros chegarão aqui.
          </p>
          <Link
            to="/lojas"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-5 py-2.5 text-sm font-black text-white"
          >
            Ver todas as lojas <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((store) => (
            <StoreCard key={store.id} store={store} categorySlug={categorySlug} />
          ))}
        </div>
      )}
    </div>
  );
}

function BrasUXSolutionCard({ solution }: { solution: BrasUXSolution }) {
  return (
    <a
      href={solution.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-3xl transition-all hover:-translate-y-0.5 hover:shadow-xl"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.10)" }}
    >
      <div className={`relative flex items-center gap-4 bg-linear-to-br p-5 ${solution.gradient}`}>
        <span className="text-4xl">{solution.icon}</span>
        <div className="flex-1 min-w-0">
          <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white/90">
            {solution.badge}
          </span>
          <h3 className="mt-1 text-lg font-black text-white leading-tight">{solution.name}</h3>
        </div>
        <ExternalLink size={16} className="shrink-0 text-white/60 transition-colors group-hover:text-white" />
      </div>
      <div className="flex flex-1 flex-col bg-white px-5 pb-5 pt-4">
        <p className="flex-1 text-sm leading-relaxed text-[#64748b]">{solution.description}</p>
        <div className={`mt-4 flex items-center justify-center gap-2 rounded-xl bg-linear-to-r py-2.5 text-xs font-black text-white ${solution.gradient}`}>
          Acessar <ArrowRight size={13} />
        </div>
      </div>
    </a>
  );
}

function StoreCard({ store, categorySlug }: { store: Store; categorySlug: string }) {
  const deliveryFeeText =
    Number(store.deliveryFee) === 0 ? "Grátis" : formatBRL(Number(store.deliveryFee));

  const typeSlugs = store.category.split(",").map((s) => s.trim().toLowerCase());
  const typeLabels = typeSlugs
    .slice(0, 3)
    .map((s) => {
      const m = masterCategories.find((c) => c.slug === s);
      return m ? `${categoryIcons[s] ?? "✨"} ${m.name}` : s;
    });

  return (
    <Link
      to={`/lojas/${store.id}?categoria=${categorySlug}`}
      className="card-hover group flex flex-col overflow-hidden rounded-3xl bg-white"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {/* Banner */}
      <div
        className="relative h-28"
        style={{
          background:
            "radial-gradient(circle at 80% 30%, rgba(22,163,74,0.4), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        }}
      >
        {store.bannerUrl ? (
          <img
            src={getProductImageUrl(store.bannerUrl)}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : null}

        <span
          className={`absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
            store.isOpen
              ? "border-green-700/40 bg-green-900/30 text-green-400"
              : "border-white/15 bg-white/10 text-[#94a3b8]"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${store.isOpen ? "bg-green-400" : "bg-[#94a3b8]"}`} />
          {store.isOpen ? "Aberto" : "Fechado"}
        </span>

        {/* Logo */}
        <span
          className="absolute -bottom-6 left-5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl text-base font-black text-white"
          style={{
            background: "linear-gradient(135deg, #16a34a, #166534)",
            boxShadow: "0 4px 16px rgba(22,163,74,0.45)",
          }}
        >
          <StoreLogo logoUrl={store.logoUrl} name={store.name} />
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-9">
        <h3 className="text-lg font-black text-[#0f172a]">{store.name}</h3>
        {store.description && (
          <p className="mt-1 text-xs leading-relaxed text-[#64748b] line-clamp-2">{store.description}</p>
        )}

        {/* Category type pills */}
        <div className="mt-2 flex flex-wrap gap-1">
          {typeLabels.map((t) => (
            <span key={t} className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold text-[#475569]">
              {t}
            </span>
          ))}
          {typeSlugs.length > 3 && (
            <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold text-[#94a3b8]">
              +{typeSlugs.length - 3}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { icon: <Clock3 size={12} />, label: "Entrega", value: `${store.deliveryTimeMin}-${store.deliveryTimeMax}min` },
            { icon: <Bike size={12} />, label: "Taxa", value: deliveryFeeText },
            { icon: <Star size={12} />, label: "Nota", value: Number(store.rating).toFixed(1) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-[#e8eaf0] bg-[#f8fafc] p-2">
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
          Ver loja
          <ArrowRight size={16} />
        </div>
      </div>
    </Link>
  );
}
