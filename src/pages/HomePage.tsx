import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { useJsonLd } from "../hooks/useJsonLd";
import { buildOrganizationSchema, buildWebSiteSchema, buildFaqSchema, HOME_FAQS, canonicalUrl } from "../lib/seo";
import { useGeolocation } from "../hooks/useGeolocation";
import { haversineKm } from "../utils/geo";
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
import BannerCarousel from "../components/ui/BannerCarousel";
import { Link } from "react-router-dom";

import {
  getStores,
  getFeaturedProducts,
  getFeaturedByStore,
  getActiveBanners,
  getProducts,
  getMyOrders,
  queryKeys,
  type StoreProduct,
} from "../services/gizApi";
import FeaturedCarousel from "../components/ui/FeaturedCarousel";
import { useAuthStore } from "../stores/authStore";
import { categories } from "../data/categories";
import { formatBRL } from "../utils/format";

const SELLER_URL = "https://brasux.store";
const DELIVERY_URL = "https://entregas.brasux.com.br";
import { categoryIcons } from "../data/categoryIcons";
import PromoCard from "../components/ui/PromoCard";
import {
  IllustrationEnem,
  IllustrationNota1000,
  IllustrationPDV,
  IllustrationServicos,
  IllustrationLandingPage,
} from "../components/ui/PromoIllustrations";
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
  usePageMeta({
    title: "Shopping Brasileiro de Soluções Tecnológicas",
    description:
      "BrasUX Shopping — restaurantes, mercado, farmácia, eletrônicos, serviços e muito mais com entrega rápida em todo o Brasil.",
    canonical: canonicalUrl("/"),
  });

  const homeSchemas = useMemo(
    () => [buildOrganizationSchema(), buildWebSiteSchema(), buildFaqSchema([...HOME_FAQS])],
    []
  );
  useJsonLd(homeSchemas);

  const { position } = useGeolocation();

  const { data: banners = [] } = useQuery({
    queryKey: queryKeys.banners(),
    queryFn:  getActiveBanners,
    staleTime: 5 * 60 * 1000,
  });

  const { data: stores = [], isLoading: loadingStores } = useQuery({
    queryKey: queryKeys.stores(),
    queryFn: getStores,
    select: (data) => data.filter((s) => s.active),
  });

  const { data: featuredProducts = [] } = useQuery({
    queryKey: queryKeys.featuredProducts(),
    queryFn:  getFeaturedProducts,
    staleTime: 5 * 60 * 1000,
  });

  const { data: featuredStores = [], isLoading: loadingFeaturedStores } = useQuery({
    queryKey: queryKeys.featuredByStore(),
    queryFn:  getFeaturedByStore,
    staleTime: 5 * 60 * 1000,
  });

  const { data: newestProducts = [] } = useQuery({
    queryKey: ["products", "newest"],
    queryFn: () => getProducts({ sort: "newest", pageSize: 6, available: true }),
    select: (d) => d.items,
    staleTime: 5 * 60 * 1000,
  });

  const storesSorted = useMemo(() => {
    const withDist = stores.map((s) => ({
      ...s,
      distanceKm:
        position && s.lat != null && s.lng != null
          ? haversineKm(position.lat, position.lng, s.lat, s.lng)
          : undefined as number | undefined,
    }));
    return position
      ? [...withDist].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
      : withDist;
  }, [stores, position]);

  const authUser = useAuthStore((s) => s.user);

  const { data: recentOrders = [] } = useQuery({
    queryKey: ["orders", "my", "home"],
    queryFn: getMyOrders,
    enabled: !!authUser,
    staleTime: 2 * 60 * 1000,
    select: (orders) => orders.filter((o) => o.status === 4).slice(0, 5),
  });

  const recentProducts = useMemo(() => {
    const seen = new Set<string>();
    const products: Array<{
      storeProductId: string;
      productName: string;
      imageUrl?: string;
      unitPrice: number;
      storeId: string;
      storeName?: string;
    }> = [];
    for (const order of recentOrders) {
      for (const item of order.items) {
        if (!seen.has(item.storeProductId)) {
          seen.add(item.storeProductId);
          products.push({
            storeProductId: item.storeProductId,
            productName: item.productName,
            imageUrl: item.imageUrl,
            unitPrice: item.unitPrice,
            storeId: order.storeId,
            storeName: order.storeName,
          });
        }
      }
    }
    return products.slice(0, 8);
  }, [recentOrders]);

  const flashSaleProducts = useMemo(
    () => featuredProducts.filter((p) => p.promotionalPrice !== null && p.promotionalPrice !== undefined),
    [featuredProducts],
  );

  return (
    <div className="space-y-10">

      {/* ── BANNER CAROUSEL ── */}
      {banners.length > 0 && <BannerCarousel banners={banners} />}

      {/* ── COMPRE DE NOVO ── */}
      {authUser && recentProducts.length > 0 && (
        <section>
          <SectionHeader
            label="seu histórico"
            title="Compre de novo"
            linkTo="/pedidos"
            linkLabel="Ver pedidos"
            color="#6366f1"
          />
          <div className="-mx-4 mt-5 overflow-x-auto px-4 scrollbar-hide">
            <div className="flex gap-4 pb-2">
              {recentProducts.map((p) => (
                <Link
                  key={p.storeProductId}
                  to={`/lojas/${p.storeId}/produto/${p.storeProductId}`}
                  className="group flex w-36 shrink-0 flex-col overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex h-28 items-center justify-center overflow-hidden rounded-t-3xl bg-[#f8fafc] p-3">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.productName}
                        className="h-20 w-full object-contain transition-transform group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="text-3xl">🛍️</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 p-2.5">
                    <p className="line-clamp-2 text-[11px] font-black leading-tight text-[#0f172a]">
                      {p.productName}
                    </p>
                    {p.storeName && (
                      <p className="text-[9px] text-[#94a3b8]">{p.storeName}</p>
                    )}
                    <p className="mt-1 text-xs font-black text-[#16a34a]">
                      {formatBRL(p.unitPrice)}
                    </p>
                    <div className="mt-1.5 flex items-center justify-center gap-1 rounded-xl bg-[#6366f1]/10 py-1.5 text-[10px] font-black text-[#6366f1] transition-colors group-hover:bg-[#6366f1] group-hover:text-white">
                      🔁 Pedir novamente
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden rounded-3xl p-8 md:p-12"
        style={{ background: "linear-gradient(135deg, #001640 0%, #002776 30%, #001a4e 65%, #00361a 100%)" }}
      >
        <div className="blob-a pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#002776] blur-3xl" />
        <div className="blob-b pointer-events-none absolute -bottom-16 left-16 h-64 w-64 rounded-full bg-[#16a34a] blur-3xl" />
        <div className="blob-c pointer-events-none absolute right-48 bottom-0 h-48 w-48 rounded-full bg-[#1351b4] blur-3xl" />

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <img
          src="/home.webp"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-auto object-cover opacity-65"
          style={{ zIndex: 2 }}
        />

        <div className="relative z-10 flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
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

          <div className="flex shrink-0 flex-col items-center gap-6">
            <div className="mt-36 grid grid-cols-3 gap-3">
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

        <div className="relative z-10 mt-8 flex items-center gap-2 border-t border-white/10 pt-6">
          <MapPin size={14} className="text-[#16a34a]" />
          <span className="text-sm text-[#94a3b8]">
            {position
              ? <>Entregando em <span className="font-bold text-white">sua localização</span> · lojas ordenadas por distância</>
              : <>Entregando em <span className="font-bold text-white">todo o Brasil</span></>
            }
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
                <span className="w-16 text-center text-[10px] font-black uppercase leading-tight tracking-wide text-[#475569] line-clamp-2">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FLASH SALE ── */}
      {flashSaleProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 rounded-2xl px-3 py-1.5 text-sm font-black text-white"
                style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)" }}
              >
                ⚡ Flash Sale
              </div>
              <FlashSaleTimer />
            </div>
            <Link to="/buscar" className="flex items-center gap-1 text-sm font-black text-[#dc2626]">
              Ver todas <ChevronRight size={16} />
            </Link>
          </div>
          <div className="-mx-4 mt-5 overflow-x-auto px-4 scrollbar-hide">
            <div className="flex gap-4 pb-2">
              {flashSaleProducts.map((p) => (
                <FlashSaleCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── LOJAS EM DESTAQUE ── */}
      {(featuredStores.length > 0 || loadingFeaturedStores) && (
        <section>
          <SectionHeader
            label="ofertas"
            title="Lojas em destaque"
            linkTo="/lojas/destaque"
            linkLabel="Ver mais"
            color="#16a34a"
          />
          <div className="mt-5">
            {loadingFeaturedStores ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-72 animate-pulse rounded-3xl bg-white shadow-sm" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {featuredStores.slice(0, 3).map((store) => (
                    <FeaturedCarousel key={store.storeId} store={store} />
                  ))}
                </div>
                {featuredStores.length > 3 && (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {featuredStores.slice(3, 6).map((store) => (
                      <FeaturedCarousel key={store.storeId} store={store} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* ── MAIS POPULARES ── */}
      {featuredProducts.length > 0 && (
        <section>
          <SectionHeader label="trending" title="Mais populares" linkTo="/buscar" linkLabel="Ver todos" color="#dc2626" />
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {featuredProducts.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                to={`/lojas/${p.storeId}/produto/${p.id}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-32 items-center justify-center bg-[#f8fafc] p-3">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="h-24 w-full object-contain transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-4xl">🛍️</div>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-xs font-black leading-tight text-[#0f172a]">{p.name}</p>
                  {p.storeName && <p className="mt-0.5 text-[10px] text-[#94a3b8]">{p.storeName}</p>}
                  <div className="mt-2">
                    {p.promotionalPrice ? (
                      <p className="text-sm font-black text-[#16a34a]">{formatBRL(p.promotionalPrice)}</p>
                    ) : p.price ? (
                      <p className="text-sm font-black text-[#16a34a]">{formatBRL(p.price)}</p>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── LOJAS ── */}
      <section>
        <SectionHeader
          label={position ? "perto de você" : "lojas"}
          title={position ? "Lojas próximas" : "Lojas abertas agora"}
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
        ) : storesSorted.length === 0 ? (
          <p className="mt-4 text-sm text-[#64748b]">Nenhuma loja disponível.</p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {storesSorted.slice(0, 6).map((store) => (
              <StoreCard key={store.id} store={store} distanceKm={store.distanceKm} />
            ))}
          </div>
        )}
      </section>

      {/* ── NOVIDADES ── */}
      {newestProducts.length > 0 && (
        <section>
          <SectionHeader label="novo" title="Novidades" linkTo="/buscar" linkLabel="Ver todas" color="#7c3aed" />
          <div className="-mx-4 mt-5 overflow-x-auto px-4 scrollbar-hide">
            <div className="flex gap-4 pb-2">
              {newestProducts.map((p) => (
                <Link
                  key={p.id}
                  to={`/lojas/${p.storeId}/produto/${p.id}`}
                  className="flex w-36 shrink-0 flex-col overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative flex h-28 items-center justify-center bg-[#f8fafc] p-2">
                    <span className="absolute left-2 top-2 rounded-lg bg-[#7c3aed] px-1.5 py-0.5 text-[9px] font-black text-white">
                      NOVO
                    </span>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="h-20 w-full object-contain" loading="lazy" />
                    ) : (
                      <div className="text-3xl">✨</div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-[11px] font-black leading-tight text-[#0f172a]">{p.name}</p>
                    {p.price && <p className="mt-1 text-xs font-black text-[#16a34a]">{formatBRL(p.price)}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

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
          imageUrl="/card-simulenem.webp"
          illustration={<IllustrationEnem />}
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
          imageUrl="/card-notaon.webp"
          illustration={<IllustrationNota1000 />}
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
          imageUrl="/card-pdv.webp"
          illustration={<IllustrationPDV />}
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
          imageUrl="/card-ti.webp"
          illustration={<IllustrationServicos />}
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
            <div className="flex flex-col gap-1.5">
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #84cc16)",
                  boxShadow: "0 4px 16px rgba(245,158,11,0.4)",
                }}
              >
                <span className="text-[11px] font-black text-[#0c0a00]">🏷️ BrasUX Web</span>
              </div>
              <div
                className="inline-flex flex-col rounded-2xl px-4 py-2.5"
                style={{
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.30)",
                }}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#fcd34d]/70">
                  a partir de
                </span>
                <span
                  className="text-2xl font-black"
                  style={{
                    background: "linear-gradient(135deg, #fcd34d, #84cc16)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  R$ 499,00
                </span>
              </div>
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
          imageUrl="/card-lp.webp"
          illustration={<IllustrationLandingPage />}
          domainLabel="produtos.brasux.com.br"
        />
      </section>

      {/* ── CTAs ── */}
      <section className="grid gap-4 md:grid-cols-2">
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

function FlashSaleTimer() {
  const [time, setTime] = useState(() => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 0);
    return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
  });

  useEffect(() => {
    const id = setInterval(() => setTime((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const h = String(Math.floor(time / 3600)).padStart(2, "0");
  const m = String(Math.floor((time % 3600) / 60)).padStart(2, "0");
  const s = String(time % 60).padStart(2, "0");

  return (
    <div className="flex items-center gap-1">
      {[h, m, s].map((v, i) => (
        <span key={i}>
          <span className="rounded-lg bg-[#0f172a] px-2 py-1 font-mono text-sm font-black text-white">{v}</span>
          {i < 2 && <span className="mx-0.5 font-black text-[#64748b]">:</span>}
        </span>
      ))}
    </div>
  );
}

function FlashSaleCard({ product }: { product: StoreProduct }) {
  const discount = product.promotionalPrice
    ? Math.round(((product.price - product.promotionalPrice) / product.price) * 100)
    : 0;

  return (
    <Link
      to={`/lojas/${product.storeId}/produto/${product.id}`}
      className="group flex w-40 shrink-0 flex-col overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative flex h-32 items-center justify-center bg-[#f8fafc] p-3">
        {discount > 0 && (
          <span className="absolute right-2 top-2 rounded-xl bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
            -{discount}%
          </span>
        )}
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-24 w-full object-contain" loading="lazy" />
        ) : (
          <div className="text-4xl">🛍️</div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <p className="line-clamp-2 text-xs font-black leading-tight text-[#0f172a]">{product.name}</p>
        <p className="text-[10px] text-[#94a3b8] line-through">{formatBRL(product.price)}</p>
        <p className="text-sm font-black text-red-500">{formatBRL(product.promotionalPrice!)}</p>
      </div>
    </Link>
  );
}
