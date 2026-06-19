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
import BrasUXLogo from "../components/ui/BrasUXLogo";
import { Link } from "react-router-dom";

import {
  getStores,
  getStoreProducts,
  queryKeys,
  type Store,
  type StoreProduct,
} from "../services/gizApi";
import { categories } from "../data/categories";

const SELLER_URL = "https://lojas.brasux.com.br";
const DELIVERY_URL = "https://entregas.brasux.com.br";
import { categoryIcons } from "../data/categoryIcons";
import { formatBRL } from "../utils/format";
import ProductImage from "../components/ui/ProductImage";
import StoreLogo from "../components/ui/StoreLogo";

const catGradients = [
  "from-[#16a34a] to-[#15803d]",
  "from-[#002776] to-[#001640]",
  "from-[#0f172a] to-[#1e293b]",
  "from-[#ec4899] to-[#be185d]",
  "from-[#f59e0b] to-[#b45309]",
  "from-[#1351b4] to-[#002776]",
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
        style={{ background: "linear-gradient(135deg, #001640 0%, #002776 30%, #001a4e 65%, #00361a 100%)" }}
      >
        {/* Animated gradient blobs */}
        <div className="blob-a pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#002776] blur-3xl" />
        <div className="blob-b pointer-events-none absolute -bottom-16 left-16 h-64 w-64 rounded-full bg-[#16a34a] blur-3xl" />
        <div className="blob-c pointer-events-none absolute right-48 bottom-0 h-48 w-48 rounded-full bg-[#1351b4] blur-3xl" />

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
              <Sparkles size={12} className="text-[#4ade80]" />
              <span className="text-[11px] font-black uppercase tracking-widest text-white/90">
                BrasUX Shopping
              </span>
            </div>
            <h1 className="mt-5 text-4xl font-black leading-[1.1] text-white md:text-5xl lg:text-6xl">
              O Shopping Brasileiro<br />
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: "linear-gradient(135deg, #86efac 0%, #4ade80 45%, #60a5fa 100%)",
                }}
              >
                de Soluções Tech.
              </span>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-[#94a3b8]">
              Educação, IA, Desenvolvimento, Gestão, Dados, APIs e Marketplace — tudo em um único ecossistema digital.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/buscar"
                className="flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #16a34a 0%, #0d6e9a 60%, #1351b4 100%)",
                  boxShadow: "0 8px 24px rgba(0,39,118,0.45)",
                }}
              >
                <Package size={16} /> Explorar soluções
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
            <BrasUXLogo
              size={108}
              style={{
                filter: "drop-shadow(0 12px 32px rgba(22,163,74,0.55))",
                borderRadius: "28px",
              }}
            />

            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <Bike size={15} className="text-[#4ade80]" />, value: "15min", label: "entrega" },
                { icon: <Clock3 size={15} className="text-[#34d399]" />, value: "24h", label: "disponível" },
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
          <MapPin size={14} className="text-[#16a34a]" />
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
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br shadow-lg transition-all duration-200 group-hover:scale-110 group-hover:shadow-xl ${catGradients[i % catGradients.length]}`}
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
          color="#16a34a"
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
          color="#0f766e"
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

      {/* ── PROMO SIMULENEM ── */}
      <section>
        <a
          href="https://simulenem.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex flex-col overflow-hidden rounded-3xl md:flex-row md:items-center"
          style={{ background: "linear-gradient(135deg, #001640 0%, #002776 40%, #003d1a 100%)" }}
        >
          {/* Blobs */}
          <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-[#16a34a] opacity-30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 right-20 h-40 w-40 rounded-full bg-[#002776] opacity-35 blur-3xl" />

          {/* Grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative z-10 flex flex-1 flex-col gap-4 p-8 md:p-10">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#16a34a]/30 bg-[#16a34a]/10 px-3 py-1.5">
              <span className="text-sm">📝</span>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#4ade80]">
                BrasUX Educação
              </span>
            </div>

            <div>
              <h2 className="text-3xl font-black text-white md:text-4xl">
                Simule o ENEM{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(135deg, #86efac, #4ade80)" }}
                >
                  agora mesmo.
                </span>
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#94a3b8]">
                Questões comentadas, gabarito instantâneo e ranking nacional. Prepare-se para o ENEM com simulados gratuitos.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white transition-all group-hover:scale-[1.03]"
                style={{
                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                  boxShadow: "0 8px 24px rgba(22,163,74,0.45)",
                }}
              >
                Fazer simulado grátis <ArrowRight size={15} />
              </span>
              <span className="text-xs text-[#64748b]">simulenem.com</span>
            </div>
          </div>

          {/* Right emoji */}
          <div className="relative z-10 flex items-center justify-center px-8 pb-8 md:pb-0 md:pr-10">
            <span
              className="flex h-24 w-24 items-center justify-center rounded-3xl text-5xl"
              style={{
                background: "rgba(22,163,74,0.15)",
                border: "1px solid rgba(22,163,74,0.25)",
              }}
            >
              🎓
            </span>
          </div>
        </a>
      </section>

      {/* ── PROMO NOTAON ── */}
      <section>
        <a
          href="https://cursonotaon.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex flex-col overflow-hidden rounded-3xl md:flex-row md:items-center"
          style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e3a5f 100%)" }}
        >
          <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-[#818cf8] opacity-25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 right-20 h-40 w-40 rounded-full bg-[#6366f1] opacity-20 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative z-10 flex flex-1 flex-col gap-4 p-8 md:p-10">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#818cf8]/30 bg-[#818cf8]/10 px-3 py-1.5">
              <span className="text-sm">🎯</span>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#a5b4fc]">
                BrasUX Educação
              </span>
            </div>

            <div>
              <h2 className="text-3xl font-black text-white md:text-4xl">
                Tire nota{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(135deg, #c7d2fe, #818cf8)" }}
                >
                  1000 no ENEM.
                </span>
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#94a3b8]">
                Curso completo com videoaulas, material didático e correção de redação. Do zero à nota máxima.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white transition-all group-hover:scale-[1.03]"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  boxShadow: "0 8px 24px rgba(99,102,241,0.45)",
                }}
              >
                Conhecer o curso <ArrowRight size={15} />
              </span>
              <span className="text-xs text-[#64748b]">cursonotaon.com.br</span>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-center px-8 pb-8 md:pb-0 md:pr-10">
            <span
              className="flex h-24 w-24 items-center justify-center rounded-3xl text-5xl"
              style={{
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.25)",
              }}
            >
              🎯
            </span>
          </div>
        </a>
      </section>

      {/* ── PROMO BRASUX CAIXA ── */}
      <section>
        <a
          href="https://brasux-caixa-livre.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex flex-col overflow-hidden rounded-3xl md:flex-row md:items-center"
          style={{ background: "linear-gradient(135deg, #022c22 0%, #064e3b 40%, #065f46 100%)" }}
        >
          {/* Blobs */}
          <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-[#10b981] opacity-25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 right-20 h-40 w-40 rounded-full bg-[#34d399] opacity-20 blur-3xl" />

          {/* Grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative z-10 flex flex-1 flex-col gap-4 p-8 md:p-10">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-3 py-1.5">
              <span className="text-sm">🧾</span>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#6ee7b7]">
                BrasUX Comercial
              </span>
            </div>

            <div>
              <h2 className="text-3xl font-black text-white md:text-4xl">
                PDV para o seu{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(135deg, #6ee7b7, #34d399)" }}
                >
                  negócio.
                </span>
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#94a3b8]">
                Caixa e gestão comercial completos — vendas, estoque, fluxo de caixa e dashboard. Simples, poderoso e acessível.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-[#022c22] transition-all group-hover:scale-[1.03]"
                style={{
                  background: "linear-gradient(135deg, #34d399, #10b981)",
                  boxShadow: "0 8px 24px rgba(16,185,129,0.45)",
                }}
              >
                Conhecer o Caixa <ArrowRight size={15} />
              </span>
              <span className="text-xs text-[#64748b]">caixa.brasux.com.br</span>
            </div>
          </div>

          {/* Right icon */}
          <div className="relative z-10 flex items-center justify-center px-8 pb-8 md:pb-0 md:pr-10">
            <span
              className="flex h-24 w-24 items-center justify-center rounded-3xl text-5xl"
              style={{
                background: "rgba(16,185,129,0.15)",
                border: "1px solid rgba(16,185,129,0.25)",
              }}
            >
              🧾
            </span>
          </div>
        </a>
      </section>

      {/* ── PROMO BRASUX SERVIÇOS ── */}
      <section>
        <Link
          to="/servicos"
          className="group relative flex flex-col overflow-hidden rounded-3xl md:flex-row md:items-center"
          style={{ background: "linear-gradient(135deg, #0d0a1e 0%, #1a0938 40%, #0a1628 100%)" }}
        >
          {/* Blobs */}
          <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-[#7c3aed] opacity-25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 right-20 h-40 w-40 rounded-full bg-[#06b6d4] opacity-20 blur-3xl" />

          {/* Grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative z-10 flex flex-1 flex-col gap-4 p-8 md:p-10">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-3 py-1.5">
              <span className="text-sm">⚡</span>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#c4b5fd]">
                BrasUX Serviços
              </span>
            </div>

            <div>
              <h2 className="text-3xl font-black text-white md:text-4xl">
                Soluções tech para o{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(135deg, #c4b5fd, #67e8f9)" }}
                >
                  seu negócio.
                </span>
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#94a3b8]">
                IA, dados, arquitetura de software, desenvolvimento e consultoria. Da ideia à solução, do código ao impacto.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white transition-all group-hover:scale-[1.03]"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  boxShadow: "0 8px 24px rgba(124,58,237,0.45)",
                }}
              >
                Ver todos os serviços <ArrowRight size={15} />
              </span>
            </div>
          </div>

          {/* Right icon */}
          <div className="relative z-10 flex items-center justify-center px-8 pb-8 md:pb-0 md:pr-10">
            <span
              className="flex h-24 w-24 items-center justify-center rounded-3xl text-5xl"
              style={{
                background: "rgba(124,58,237,0.15)",
                border: "1px solid rgba(124,58,237,0.25)",
              }}
            >
              🚀
            </span>
          </div>
        </Link>
      </section>

      {/* ── PROMO LANDING PAGE ── */}
      <section>
        <a
          href="https://produtos.brasux.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex flex-col overflow-hidden rounded-3xl md:flex-row md:items-center"
          style={{ background: "linear-gradient(135deg, #0c0a00 0%, #1c1400 40%, #0f1a00 100%)" }}
        >
          {/* Blobs */}
          <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-[#f59e0b] opacity-20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 right-20 h-40 w-40 rounded-full bg-[#84cc16] opacity-15 blur-3xl" />

          {/* Grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative z-10 flex flex-1 flex-col gap-4 p-8 md:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-1.5">
                <span className="text-sm">🌐</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-[#fcd34d]">
                  BrasUX Web
                </span>
              </div>
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #84cc16)",
                  boxShadow: "0 4px 16px rgba(245,158,11,0.4)",
                }}
              >
                <span className="text-[11px] font-black text-[#0c0a00]">apenas R$ 499</span>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-black text-white md:text-4xl">
                Landing Page +{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(135deg, #fcd34d, #84cc16)" }}
                >
                  botão WhatsApp.
                </span>
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#94a3b8]">
                Site profissional, responsivo e pronto para converter — com botão direto pro seu WhatsApp. Entrega em até 5 dias úteis.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-[#0c0a00] transition-all group-hover:scale-[1.03]"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #84cc16)",
                  boxShadow: "0 8px 24px rgba(245,158,11,0.45)",
                }}
              >
                Quero minha landing page <ArrowRight size={15} />
              </span>
              <span className="text-xs text-[#64748b]">produtos.brasux.com.br</span>
            </div>
          </div>

          {/* Right icon */}
          <div className="relative z-10 flex items-center justify-center px-8 pb-8 md:pb-0 md:pr-10">
            <div className="flex flex-col items-center gap-3">
              <span
                className="flex h-24 w-24 items-center justify-center rounded-3xl text-5xl"
                style={{
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.25)",
                }}
              >
                🌐
              </span>
              <div
                className="flex items-center gap-2 rounded-2xl px-4 py-2"
                style={{
                  background: "rgba(37,211,102,0.12)",
                  border: "1px solid rgba(37,211,102,0.25)",
                }}
              >
                <span className="text-lg">💬</span>
                <span className="text-sm font-black text-[#25d166]">WhatsApp</span>
              </div>
            </div>
          </div>
        </a>
      </section>

      {/* ── CTAs ── */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Seller CTA */}
        <div
          className="relative overflow-hidden rounded-3xl p-8"
          style={{ background: "linear-gradient(135deg, #001640 0%, #002776 50%, #003d1a 100%)" }}
        >
          <div className="blob-a pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#16a34a] opacity-25 blur-3xl" />
          <div className="relative z-10 flex items-start gap-5">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #16a34a, #15803d)",
                boxShadow: "0 6px 20px rgba(22,163,74,0.4)",
              }}
            >
              <StoreIcon size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-white">Tem uma loja?</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">
                Venda pelo BrasUX sem comissão por pedido. Catálogo pronto, só informe o preço.
              </p>
              <a
                href={SELLER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.03]"
                style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
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
            style={{ background: "rgba(22,163,74,0.1)" }}
          >
            <Bike size={24} className="text-[#16a34a]" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-black text-[#0f172a]">Quer fazer entregas?</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#64748b]">
              Qualquer veículo — a pé, bike, moto, carro. Receba por PIX a cada corrida.
            </p>
            <a
              href={DELIVERY_URL}
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
  color = "#16a34a",
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
      to={`/lojas/${product.storeId}/produto/${product.id}`}
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
            <p className="text-base font-black text-[#16a34a]">
              {formatBRL(Number(product.price))}
            </p>
          )}
        </div>
        <div
          className="mt-3 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black text-white transition-all group-hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)" }}
        >
          Ver produto
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
            "radial-gradient(circle at 80% 30%, rgba(0,39,118,0.55), transparent 55%), linear-gradient(135deg, #0a1628 0%, #001640 100%)",
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
            background: "linear-gradient(135deg, #16a34a, #15803d)",
            boxShadow: "0 4px 16px rgba(22,163,74,0.5)",
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
