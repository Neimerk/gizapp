import { useEffect, useState, useMemo } from "react";
import { ArrowRight, Bike, Clock3, Star } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { getStores, getProductImageUrl, type Store } from "../services/gizApi";
import { categoryIcons } from "../data/categoryIcons";
import { categories as masterCategories } from "../data/categories";
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
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  const categorySlug = slug ?? "";
  const master = masterCategories.find((c) => c.slug === categorySlug);
  const icon = categoryIcons[categorySlug] ?? "✨";
  const label = master?.name ?? categorySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  useEffect(() => {
    setLoading(true);
    getStores()
      .then((data) => setStores(data.filter((s) => s.active)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => stores.filter((s) => storeHasCategory(s, categorySlug)),
    [stores, categorySlug]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl shadow-md"
          style={{
            background:
              "radial-gradient(circle at 70% 30%, rgba(124,58,237,0.5), transparent 60%), linear-gradient(135deg,#0f172a,#1e293b)",
          }}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#7c3aed]">Categoria</p>
          <h1 className="mt-0.5 text-3xl font-black text-[#0f172a]">{label}</h1>
          {!loading && (
            <p className="mt-0.5 text-sm text-[#64748b]">
              {filtered.length} {filtered.length === 1 ? "loja disponível" : "lojas disponíveis"}
            </p>
          )}
        </div>
      </div>

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
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-2.5 text-sm font-black text-white"
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
      className="group flex flex-col overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* Banner */}
      <div
        className="relative h-28"
        style={{
          background:
            "radial-gradient(circle at 80% 30%, rgba(124,58,237,0.4), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
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
        <span className="absolute -bottom-6 left-5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[#7c3aed] font-black text-white shadow-lg text-base">
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

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#0f172a] px-4 py-3 text-sm font-black text-white transition-colors group-hover:bg-[#7c3aed]">
          Ver loja
          <ArrowRight size={16} />
        </div>
      </div>
    </Link>
  );
}
