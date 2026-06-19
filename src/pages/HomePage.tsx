import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Bike,
  Clock3,
  Star,
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
  queryKeys,
} from "../services/gizApi";
import { getFeaturedByStore } from "../services/shoppingSupabase";
import FeaturedCarousel from "../components/ui/FeaturedCarousel";
import { categories } from "../data/categories";

const SELLER_URL = "https://lojas.brasux.com.br";
const DELIVERY_URL = "https://entregas.brasux.com.br";
import { categoryIcons } from "../data/categoryIcons";
import PromoCard from "../components/ui/PromoCard";
import ProductCard from "../components/product/ProductCard";
import StoreCard from "../components/store/StoreCard";

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

  const { data: featuredByStore = [], isLoading: loadingFeatured } = useQuery({
    queryKey: ["featuredByStore"],
    queryFn: getFeaturedByStore,
    staleTime: 0,
    refetchInterval: 60_000,
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

      {/* ── PRODUTOS EM DESTAQUE — substitui grade de produtos ── */}
      <section>
        <SectionHeader
          label="ofertas"
          title="Produtos em destaque"
          linkTo="/buscar"
          linkLabel="Ver mais"
          color="#16a34a"
        />
        {loadingFeatured ? (
          <div className="mt-5 space-y-4">
            <div className="h-52 animate-pulse rounded-3xl bg-white shadow-sm" />
          </div>
        ) : featuredByStore.length === 0 ? (
          <p className="mt-4 text-sm text-[#64748b]">Nenhum produto em destaque no momento.</p>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredByStore.map(({ store, products: fps }) => (
              <FeaturedCarousel key={store.id} store={store} products={fps} />
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

      {/* ── PROMOS ── */}
      <section>
        <PromoCard
          href="https://simulenem.com"
          background="linear-gradient(135deg, #001640 0%, #002776 40%, #003d1a 100%)"
          blobAColor="#16a34a"
          blobAOpacity={0.3}
          blobBColor="#002776"
          blobBOpacity={0.35}
          badgeEmoji="📝"
          badgeLabel="BrasUX Educação"
          badgeTextColor="#4ade80"
          badgeBorderColor="rgba(22,163,74,0.30)"
          badgeBgColor="rgba(22,163,74,0.10)"
          titleBefore="Simule o ENEM"
          titleHighlight="agora mesmo."
          titleHighlightGradient="linear-gradient(135deg, #86efac, #4ade80)"
          description="Questões comentadas, gabarito instantâneo e ranking nacional. Prepare-se para o ENEM com simulados gratuitos."
          ctaLabel="Fazer simulado grátis"
          ctaBackground="linear-gradient(135deg, #16a34a, #15803d)"
          ctaShadow="0 8px 24px rgba(22,163,74,0.45)"
          iconEmoji="🎓"
          iconBg="rgba(22,163,74,0.15)"
          iconBorder="rgba(22,163,74,0.25)"
          domainLabel="simulenem.com"
        />
      </section>

      <section>
        <PromoCard
          href="https://cursonotaon.com.br"
          background="linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e3a5f 100%)"
          blobAColor="#818cf8"
          blobBColor="#6366f1"
          badgeEmoji="🎯"
          badgeLabel="BrasUX Educação"
          badgeTextColor="#a5b4fc"
          badgeBorderColor="rgba(129,140,248,0.30)"
          badgeBgColor="rgba(129,140,248,0.10)"
          titleBefore="Tire nota"
          titleHighlight="1000 no ENEM."
          titleHighlightGradient="linear-gradient(135deg, #c7d2fe, #818cf8)"
          description="Curso completo com videoaulas, material didático e correção de redação. Do zero à nota máxima."
          ctaLabel="Conhecer o curso"
          ctaBackground="linear-gradient(135deg, #6366f1, #4f46e5)"
          ctaShadow="0 8px 24px rgba(99,102,241,0.45)"
          iconEmoji="🎯"
          iconBg="rgba(99,102,241,0.15)"
          iconBorder="rgba(99,102,241,0.25)"
          domainLabel="cursonotaon.com.br"
        />
      </section>

      <section>
        <PromoCard
          href="https://brasux-caixa-livre.vercel.app"
          background="linear-gradient(135deg, #022c22 0%, #064e3b 40%, #065f46 100%)"
          blobAColor="#10b981"
          blobBColor="#34d399"
          badgeEmoji="🧾"
          badgeLabel="BrasUX Comercial"
          badgeTextColor="#6ee7b7"
          badgeBorderColor="rgba(16,185,129,0.30)"
          badgeBgColor="rgba(16,185,129,0.10)"
          titleBefore="PDV para o seu"
          titleHighlight="negócio."
          titleHighlightGradient="linear-gradient(135deg, #6ee7b7, #34d399)"
          description="Caixa e gestão comercial completos — vendas, estoque, fluxo de caixa e dashboard. Simples, poderoso e acessível."
          ctaLabel="Conhecer o Caixa"
          ctaBackground="linear-gradient(135deg, #34d399, #10b981)"
          ctaShadow="0 8px 24px rgba(16,185,129,0.45)"
          ctaTextColor="#022c22"
          iconEmoji="🧾"
          iconBg="rgba(16,185,129,0.15)"
          iconBorder="rgba(16,185,129,0.25)"
          domainLabel="caixa.brasux.com.br"
        />
      </section>

      <section>
        <PromoCard
          to="/servicos"
          background="linear-gradient(135deg, #0d0a1e 0%, #1a0938 40%, #0a1628 100%)"
          blobAColor="#7c3aed"
          blobBColor="#06b6d4"
          badgeEmoji="⚡"
          badgeLabel="BrasUX Serviços"
          badgeTextColor="#c4b5fd"
          badgeBorderColor="rgba(124,58,237,0.30)"
          badgeBgColor="rgba(124,58,237,0.10)"
          titleBefore="Soluções tech para o"
          titleHighlight="seu negócio."
          titleHighlightGradient="linear-gradient(135deg, #c4b5fd, #67e8f9)"
          description="IA, dados, arquitetura de software, desenvolvimento e consultoria. Da ideia à solução, do código ao impacto."
          ctaLabel="Ver todos os serviços"
          ctaBackground="linear-gradient(135deg, #7c3aed, #4f46e5)"
          ctaShadow="0 8px 24px rgba(124,58,237,0.45)"
          iconEmoji="🚀"
          iconBg="rgba(124,58,237,0.15)"
          iconBorder="rgba(124,58,237,0.25)"
        />
      </section>

      <section>
        <PromoCard
          href="https://produtos.brasux.com.br"
          background="linear-gradient(135deg, #0c0a00 0%, #1c1400 40%, #0f1a00 100%)"
          blobAColor="#f59e0b"
          blobAOpacity={0.2}
          blobBColor="#84cc16"
          blobBOpacity={0.15}
          badgeEmoji="🌐"
          badgeLabel="BrasUX Web"
          badgeTextColor="#fcd34d"
          badgeBorderColor="rgba(245,158,11,0.30)"
          badgeBgColor="rgba(245,158,11,0.10)"
          extraBadge={
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{
                background: "linear-gradient(135deg, #f59e0b, #84cc16)",
                boxShadow: "0 4px 16px rgba(245,158,11,0.4)",
              }}
            >
              <span className="text-[11px] font-black text-[#0c0a00]">apenas R$ 499</span>
            </div>
          }
          titleBefore="Landing Page +"
          titleHighlight="botão WhatsApp."
          titleHighlightGradient="linear-gradient(135deg, #fcd34d, #84cc16)"
          description="Site profissional, responsivo e pronto para converter — com botão direto pro seu WhatsApp. Entrega em até 5 dias úteis."
          ctaLabel="Quero minha landing page"
          ctaBackground="linear-gradient(135deg, #f59e0b, #84cc16)"
          ctaShadow="0 8px 24px rgba(245,158,11,0.45)"
          ctaTextColor="#0c0a00"
          iconEmoji="🌐"
          iconBg="rgba(245,158,11,0.12)"
          iconBorder="rgba(245,158,11,0.25)"
          iconExtra={
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
          }
          domainLabel="produtos.brasux.com.br"
        />
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
