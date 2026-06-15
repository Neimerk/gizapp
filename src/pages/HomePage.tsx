import { useEffect, useState } from "react";
import {
  Bike,
  Clock3,
  Star,
  ArrowRight,
  Store as StoreIcon,
  ChevronRight,
  Sparkles,
  Zap,
  MapPin,
  Package,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  getStores,
  getStoreProducts,
  getProductImageUrl,
  type Store,
  type StoreProduct,
} from "../services/gizApi";
import { categories } from "../data/categories";
import { categoryIcons } from "../data/categoryIcons";
import { formatBRL } from "../utils/format";
import ProductImage from "../components/ui/ProductImage";
import StoreLogo from "../components/ui/StoreLogo";

const catColors = [
  "from-[#7c3aed] to-[#6d28d9]",
  "from-[#2563eb] to-[#1d4ed8]",
  "from-[#0f172a] to-[#1e293b]",
  "from-[#ec4899] to-[#db2777]",
  "from-[#f59e0b] to-[#d97706]",
  "from-[#10b981] to-[#059669]",
];

export default function HomePage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingStores, setLoadingStores] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const storesData = await getStores();
        setStores(storesData.filter((s) => s.active));
        if (storesData.length > 0) {
          const prods = await getStoreProducts({ storeId: storesData[0].id });
          setProducts(prods.slice(0, 12));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingProducts(false);
        setLoadingStores(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-10">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden rounded-3xl bg-[#0f172a] p-8 md:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#7c3aed] opacity-25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-16 h-64 w-64 rounded-full bg-[#2563eb] opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute right-48 bottom-0 h-48 w-48 rounded-full bg-[#ec4899] opacity-10 blur-3xl" />

        <div className="relative z-10 flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
          {/* Left: text */}
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <Sparkles size={13} className="text-[#ffd400]" />
              <span className="text-xs font-bold uppercase tracking-widest text-white">
                GizApp — Entrega rápida
              </span>
            </div>
            <h1 className="mt-5 text-4xl font-black leading-tight text-white md:text-5xl lg:text-6xl">
              Tudo perto de você,<br />
              <span className="bg-gradient-to-r from-[#a855f7] to-[#60a5fa] bg-clip-text text-transparent">
                em minutos.
              </span>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-[#94a3b8]">
              Restaurantes, mercado, bebidas, farmácia e muito mais — entregue na sua porta com rapidez e sem complicação.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/buscar"
                className="flex items-center gap-2 rounded-2xl bg-[#7c3aed] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#7c3aed]/40 transition-transform hover:scale-[1.02]"
              >
                <Package size={16} /> Ver produtos
              </Link>
              <Link
                to="/lojas"
                className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-6 py-3 text-sm font-black text-white backdrop-blur-sm transition-colors hover:bg-white/15"
              >
                <StoreIcon size={16} /> Ver lojas
              </Link>
            </div>
          </div>

          {/* Right: stats + logo */}
          <div className="flex shrink-0 flex-col items-center gap-6">
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-[#7c3aed] to-[#2563eb] shadow-2xl shadow-[#7c3aed]/40">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#0f172a]">
                <Zap size={44} className="fill-[#ffd400] text-[#ffd400]" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {[
                { icon: <Bike size={16} className="text-[#a855f7]" />, value: "15min", label: "entrega" },
                { icon: <Clock3 size={16} className="text-[#60a5fa]" />, value: "24h", label: "disponível" },
                { icon: <Star size={16} className="text-[#ffd400]" />, value: "5.0", label: "avaliação" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/8 p-4 backdrop-blur-sm">
                  {s.icon}
                  <p className="text-xl font-black text-white">{s.value}</p>
                  <span className="text-[10px] text-[#94a3b8]">{s.label}</span>
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
        <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
          {categories.map((cat, i) => (
            <Link
              key={cat.id}
              to={`/categorias/${cat.slug}`}
              className="group flex flex-col items-center gap-2"
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-md transition-transform group-hover:scale-105 ${catColors[i % catColors.length]}`}
              >
                <span className="text-2xl">{categoryIcons[cat.slug] ?? "✨"}</span>
              </div>
              <span className="text-center text-[10px] font-black uppercase tracking-wide text-[#475569] line-clamp-1">
                {cat.name}
              </span>
            </Link>
          ))}
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
                <div className="h-16 rounded-2xl bg-[#f1f5f9]" />
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
        <div className="relative overflow-hidden rounded-3xl bg-[#0f172a] p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#7c3aed] opacity-30 blur-3xl" />
          <div className="relative z-10 flex items-start gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#7c3aed]">
              <StoreIcon size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-white">Tem uma loja?</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">
                Venda pelo GizApp sem comissão por pedido. Catálogo pronto, só informe o preço.
              </p>
              <a
                href="http://localhost:5175"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.02]"
              >
                Quero vender <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </div>

        {/* Courier CTA */}
        <div className="flex items-start gap-5 rounded-3xl border border-[#e2e8f0] bg-white p-8">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#7c3aed]/10">
            <Bike size={24} className="text-[#7c3aed]" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-black text-[#0f172a]">Quer fazer entregas?</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#64748b]">
              Qualquer veículo — a pé, bike, moto, carro. Receba por PIX a cada corrida.
            </p>
            <a
              href="http://localhost:5175"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0f172a] px-5 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.02]"
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
      className="group flex flex-col overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex h-40 items-center justify-center bg-[#f8fafc] p-3">
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
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-[#0f172a] py-2 text-xs font-black text-white group-hover:bg-[#7c3aed] transition-colors">
          <StoreIcon size={12} /> Ver loja
        </div>
      </div>
    </Link>
  );
}

function StoreCard({ store }: { store: Store }) {
  const initial = store.name.charAt(0).toUpperCase();
  const deliveryFeeText =
    Number(store.deliveryFee) === 0
      ? "Grátis"
      : formatBRL(Number(store.deliveryFee));

  return (
    <Link
      to={`/lojas/${store.id}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      {/* Banner */}
      <div
        className="relative h-24"
        style={{
          background:
            "radial-gradient(circle at 80% 30%, rgba(124,58,237,0.4), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
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

        <span className="absolute -bottom-6 left-5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[#7c3aed] font-black text-white shadow-lg text-base">
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

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#0f172a] px-4 py-3 text-sm font-black text-white group-hover:bg-[#7c3aed] transition-colors">
          Ver catálogo
          <ArrowRight size={16} />
        </div>
      </div>
    </Link>
  );
}

function StatBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e8eaf0] bg-[#f8fafc] px-2 py-2">
      <div className="flex items-center gap-1 text-[#94a3b8]">
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-0.5 text-xs font-black text-[#0f172a]">{value}</div>
    </div>
  );
}
