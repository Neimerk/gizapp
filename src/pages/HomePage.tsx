import { useQuery } from "@tanstack/react-query";
import {
  Bike,
  Clock3,
  Star,
  ArrowRight,
  Store as StoreIcon,
  ChevronRight,
  Sparkles,
  MapPin,
  Package,
} from "lucide-react";
import GizLogo from "../components/ui/GizLogo";
import { Link } from "react-router-dom";

import {
  getStores,
  getStoreProducts,
  queryKeys,
  type Store,
  type StoreProduct,
} from "../services/gizApi";
import { categories } from "../data/categories";

const SELLER_URL = (import.meta.env.VITE_SELLER_URL as string | undefined) ?? "http://localhost:5175";
import { categoryIcons } from "../data/categoryIcons";
import { formatBRL } from "../utils/format";
import ProductImage from "../components/ui/ProductImage";
import StoreLogo from "../components/ui/StoreLogo";

const catGradients = [
  "from-[#7c3aed] to-[#5b21b6]",
  "from-[#2563eb] to-[#1d4ed8]",
  "from-[#0f172a] to-[#1e293b]",
  "from-[#ec4899] to-[#be185d]",
  "from-[#f59e0b] to-[#b45309]",
  "from-[#10b981] to-[#047857]",
  "from-[#06b6d4] to-[#0e7490]",
  "from-[#ef4444] to-[#b91c1c]",
];

export default function HomePage() {
  const { data: stores = [], isLoading: loadingStores } = useQuery({
    queryKey: queryKeys.stores(),
    queryFn: getStores,
    select: (data) => data.filter((s) => s.active),
  });

  const firstStoreId = stores[0]?.id;

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: queryKeys.storeProducts(firstStoreId ?? ""),
    queryFn: () => getStoreProducts({ storeId: firstStoreId! }),
    enabled: !!firstStoreId,
    select: (data) => data.slice(0, 12),
  });

  return (
    <div className="space-y-10">

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden rounded-3xl p-8 md:p-12"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1a1040 60%, #0f172a 100%)" }}
      >
        {/* Animated gradient blobs */}
        <div className="blob-a pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#7c3aed] blur-3xl" />
        <div className="blob-b pointer-events-none absolute -bottom-16 left-16 h-64 w-64 rounded-full bg-[#2563eb] blur-3xl" />
        <div className="blob-c pointer-events-none absolute right-48 bottom-0 h-48 w-48 rounded-full bg-[#ec4899] blur-3xl" />

        {/* Subtle grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
          {/* Left: text */}
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <Sparkles size={12} className="text-[#ffd400]" />
              <span className="text-[11px] font-black uppercase tracking-widest text-white/90">
                GizApp — Entrega rápida
              </span>
            </div>
            <h1 className="mt-5 text-4xl font-black leading-[1.1] text-white md:text-5xl lg:text-6xl">
              Tudo perto de você,<br />
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: "linear-gradient(135deg, #c084fc 0%, #818cf8 50%, #60a5fa 100%)",
                }}
              >
                em minutos.
              </span>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-[#94a3b8]">
              Restaurantes, mercado, bebidas, farmácia e muito mais — entregue na sua porta com rapidez e sem complicação.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/buscar"
                className="flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  boxShadow: "0 8px 24px rgba(124,58,237,0.5)",
                }}
              >
                <Package size={16} /> Ver produtos
              </Link>
              <Link
                to="/lojas"
                className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-6 py-3 text-sm font-black text-white backdrop-blur-sm transition-all hover:bg-white/15 hover:border-white/25"
              >
                <StoreIcon size={16} /> Ver lojas
              </Link>
            </div>
          </div>

          {/* Right: stats */}
          <div className="flex shrink-0 flex-col items-center gap-6">
            <GizLogo
              size={108}
              style={{
                filter: "drop-shadow(0 12px 32px rgba(124,58,237,0.55))",
                borderRadius: "28px",
              }}
            />

            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <Bike size={15} className="text-[#a855f7]" />, value: "15min", label: "entrega" },
                { icon: <Clock3 size={15} className="text-[#60a5fa]" />, value: "24h", label: "disponível" },
                { icon: <Star size={15} className="text-[#ffd400]" />, value: "5.0", label: "avaliação" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-center gap-1.5 rounded-2xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  {s.icon}
                  <p className="text-xl font-black text-white">{s.value}</p>
                  <span className="text-[10px] font-medium text-[#94a3b8]">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Location strip */}
        <div className="relative z-10 mt-8 flex items-center gap-2 border-t border-white/10 pt-6">
          <MapPin size={14} className="text-[#7c3aed]" />
          <span className="text-sm text-[#94a3b8]">
            Entregando em <span className="font-bold text-white">Minha localização</span>
          </span>
        </div>
      </section>

      {/* ── CATEGORIAS ── */}
      <section>
        <SectionHeader
          label="explorar"
          title="Categorias"
          linkTo="/categorias"
          linkLabel="Ver todas"
        />
        <div className="-mx-4 mt-5 overflow-x-auto px-4 scrollbar-hide md:-mx-8 md:px-8">
          <div className="flex gap-4 pb-2">
            {categories.slice(0, 16).map((cat, i) => (
              <Link
                key={cat.id}
                to={`/categorias/${cat.slug}`}
                className="group flex shrink-0 flex-col items-center gap-2.5"
              >
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg transition-all duration-200 group-hover:scale-110 group-hover:shadow-xl ${catGradients[i % catGradients.length]}`}
                  style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.18)" }}
                >
                  <span className="text-3xl">{categoryIcons[cat.slug] ?? "✨"}</span>
                </div>
                <span className="w-16 text-center text-[10px] font-black uppercase tracking-wide text-[#475569] line-clamp-1">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUTOS EM DESTAQUE ── */}
      <section>
        <SectionHeader
          label="ofertas"
          title="Produtos em destaque"
          linkTo="/buscar"
          linkLabel="Ver mais"
          color="#7c3aed"
        />
        {loadingProducts ? (
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-3xl bg-white p-4 shadow-sm">
                <div className="h-32 rounded-2xl bg-[#f1f5f9]" />
                <div className="mt-3 h-3 w-3/4 rounded bg-[#f1f5f9]" />
                <div className="mt-2 h-4 w-1/2 rounded bg-[#f1f5f9]" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="mt-4 text-sm text-[#64748b]">Nenhum produto disponível.</p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* ── LOJAS ── */}
      <section>
        <SectionHeader
          label="perto de você"
          title="Lojas abertas agora"
          linkTo="/lojas"
          linkLabel="Ver todas"
          color="#2563eb"
        />
        {loadingStores ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-3xl bg-white p-5 shadow-sm">
                <div className="h-28 rounded-2xl bg-[#f1f5f9]" />
                <div className="mt-4 h-4 w-1/2 rounded bg-[#f1f5f9]" />
                <div className="mt-2 h-3 w-1/3 rounded bg-[#f1f5f9]" />
              </div>
            ))}
          </div>
        ) : stores.length === 0 ? (
          <p className="mt-4 text-sm text-[#64748b]">Nenhuma loja disponível.</p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.slice(0, 6).map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        )}
      </section>

      {/* ── CTAs ── */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Seller CTA */}
        <div
          className="relative overflow-hidden rounded-3xl p-8"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1a1040 100%)" }}
        >
          <div className="blob-a pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#7c3aed] opacity-35 blur-3xl" />
          <div className="relative z-10 flex items-start gap-5">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
                boxShadow: "0 6px 20px rgba(124,58,237,0.4)",
              }}
            >
              <StoreIcon size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-white">Tem uma loja?</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">
                Venda pelo GizApp sem comissão por pedido. Catálogo pronto, só informe o preço.
              </p>
              <a
                href={SELLER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.03]"
                style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
              >
                Quero vender <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </div>

        {/* Courier CTA */}
        <div className="flex items-start gap-5 rounded-3xl border border-[#e2e8f0] bg-white p-8 shadow-sm">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "rgba(124,58,237,0.1)" }}
          >
            <Bike size={24} className="text-[#7c3aed]" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-black text-[#0f172a]">Quer fazer entregas?</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#64748b]">
              Qualquer veículo — a pé, bike, moto, carro. Receba por PIX a cada corrida.
            </p>
            <a
              href={SELLER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0f172a] px-5 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.03]"
            >
              Ser entregador <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}

// ── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function SectionHeader({
  label,
  title,
  linkTo,
  linkLabel,
  color = "#7c3aed",
}: {
  label: string;
  title: string;
  linkTo: string;
  linkLabel: string;
  color?: string;
}) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest" style={{ color }}>
          {label}
        </p>
        <h2 className="mt-0.5 text-2xl font-black text-[#0f172a]">{title}</h2>
      </div>
      <Link
        to={linkTo}
        className="flex items-center gap-1 text-sm font-black"
        style={{ color }}
      >
        {linkLabel} <ChevronRight size={16} />
      </Link>
    </div>
  );
}

function ProductCard({ product }: { product: StoreProduct }) {
  return (
    <Link
      to={`/lojas/${product.storeId}`}
      className="card-hover group flex flex-col overflow-hidden rounded-3xl bg-white"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div
        className="flex h-40 items-center justify-center p-3"
        style={{ background: "linear-gradient(135deg, #f8fafc, #f1f5f9)" }}
      >
        <ProductImage
          imageUrl={product.imageUrl}
          alt={product.imageAlt || product.name}
          category={product.category}
          containerClassName="h-32 w-full rounded-2xl"
          className="h-32 w-full object-contain transition-transform group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8] truncate">
          {product.category}
        </p>
        <h3 className="mt-1 flex-1 text-sm font-black text-[#0f172a] line-clamp-2 leading-tight">
          {product.name}
        </h3>
        <div className="mt-3">
          {product.promotionalPrice ? (
            <>
              <p className="text-[10px] font-bold text-[#94a3b8] line-through">
                {formatBRL(Number(product.price))}
              </p>
              <p className="text-base font-black text-[#16a34a]">
                {formatBRL(Number(product.promotionalPrice))}
              </p>
            </>
          ) : (
            <p className="text-base font-black text-[#7c3aed]">
              {formatBRL(Number(product.price))}
            </p>
          )}
        </div>
        <div
          className="mt-3 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black text-white transition-all group-hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)" }}
        >
          <StoreIcon size={12} /> Ver loja
        </div>
      </div>
    </Link>
  );
}

function StoreCard({ store }: { store: Store }) {
  const deliveryFeeText =
    Number(store.deliveryFee) === 0
      ? "Grátis"
      : formatBRL(Number(store.deliveryFee));

  return (
    <Link
      to={`/lojas/${store.id}`}
      className="card-hover group flex flex-col overflow-hidden rounded-3xl bg-white"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {/* Banner */}
      <div
        className="relative h-28"
        style={{
          background:
            "radial-gradient(circle at 80% 30%, rgba(124,58,237,0.5), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        }}
      >
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

        <span
          className="absolute -bottom-6 left-5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl text-base font-black text-white"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
            boxShadow: "0 4px 16px rgba(124,58,237,0.5)",
          }}
        >
          <StoreLogo logoUrl={store.logoUrl} name={store.name} />
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-9">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">
          {store.category}
        </p>
        <h3 className="mt-0.5 text-lg font-black text-[#0f172a]">{store.name}</h3>
        {store.description && (
          <p className="mt-1 text-xs text-[#64748b] line-clamp-2 leading-relaxed">{store.description}</p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatBadge icon={<Clock3 size={12} />} label="Entrega" value={`${store.deliveryTimeMin}-${store.deliveryTimeMax}min`} />
          <StatBadge icon={<Bike size={12} />} label="Taxa" value={deliveryFeeText} />
          <StatBadge icon={<Star size={12} />} label="Nota" value={Number(store.rating).toFixed(1)} />
        </div>

        <div
          className="mt-4 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-black text-white transition-opacity group-hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)" }}
        >
          Ver catálogo
          <ArrowRight size={16} />
        </div>
      </div>
    </Link>
  );
}

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f8fafc] px-2 py-2" style={{ border: "1px solid #f1f5f9" }}>
      <div className="flex items-center gap-1 text-[#94a3b8]">
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-0.5 text-xs font-black text-[#0f172a]">{value}</div>
    </div>
  );
}
