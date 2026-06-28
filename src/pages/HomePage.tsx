import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { useJsonLd } from "../hooks/useJsonLd";
import { buildOrganizationSchema, buildWebSiteSchema, buildFaqSchema, HOME_FAQS, canonicalUrl } from "../lib/seo";
import { useGeolocation } from "../hooks/useGeolocation";
import { haversineKm } from "../utils/geo";
import BannerCarousel from "../components/ui/BannerCarousel";
import { Link } from "react-router-dom";
import { ChevronDown, MapPin } from "lucide-react";
import AddressPickerModal from "../components/home/AddressPickerModal";
import { useDeliveryAddressStore } from "../stores/deliveryAddressStore";

import {
  getStores,
  getFeaturedProducts,
  getFeaturedByStore,
  getActiveBanners,
  getProducts,
  getMyOrders,
  queryKeys,
} from "../services/gizApi";
import FeaturedCarousel from "../components/ui/FeaturedCarousel";
import { useAuthStore } from "../stores/authStore";
import { departments } from "../data/taxonomy";
import DepartmentCard from "../components/ui/DepartmentCard";
import { formatBRL } from "../utils/format";
import SectionHeader from "../components/home/SectionHeader";
import HeroCarousel from "../components/home/HeroCarousel";
import FlashSaleSection from "../components/home/FlashSale";
import JoinCtaSection from "../components/home/JoinCtaSection";
import StoreCard from "../components/store/StoreCard";

export default function HomePage() {
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const deliveryAddress = useDeliveryAddressStore((s) => s.address);
  const clearDeliveryAddress = useDeliveryAddressStore((s) => s.clearAddress);

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

  // Delivery address takes priority over raw GPS
  const effectivePosition = deliveryAddress ?? position;

  const storesSorted = useMemo(() => {
    const withDist = stores.map((s) => ({
      ...s,
      distanceKm:
        effectivePosition && s.lat != null && s.lng != null
          ? haversineKm(effectivePosition.lat, effectivePosition.lng, s.lat, s.lng)
          : undefined as number | undefined,
    }));
    return effectivePosition
      ? [...withDist].sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
      : withDist;
  }, [stores, effectivePosition]);

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl text-content">
          Shopping <strong className="text-blue-950">Bras</strong>
          <strong className="text-green-500">UX</strong>
        </h1>

        {/* Address activator */}
        <button
          onClick={() => setAddressPickerOpen(true)}
          className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-2.5 text-left transition-all hover:border-[#16a34a]/40 sm:max-w-xs"
        >
          <MapPin size={15} className="shrink-0 text-[#16a34a]" />
          <span className="flex-1 truncate text-sm font-bold text-content">
            {deliveryAddress?.label ?? "Onde você quer receber?"}
          </span>
          <ChevronDown size={13} className="shrink-0 text-faint" />
        </button>
      </div>

      {deliveryAddress && (
        <p className="mt-1 text-xs text-muted">
          Lojas ordenadas por proximidade a{" "}
          <button
            onClick={() => setAddressPickerOpen(true)}
            className="font-bold text-[#16a34a] underline-offset-2 hover:underline"
          >
            {deliveryAddress.label}
          </button>
          {" ·"}{" "}
          <button
            onClick={clearDeliveryAddress}
            className="text-muted hover:text-content"
          >
            Remover
          </button>
        </p>
      )}

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
                  className="group flex w-36 shrink-0 flex-col overflow-hidden rounded-3xl border border-line-subtle bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex h-28 items-center justify-center overflow-hidden rounded-t-3xl bg-subtle p-3">
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
                    <p className="line-clamp-2 text-[11px] font-black leading-tight text-content">
                      {p.productName}
                    </p>
                    {p.storeName && (
                      <p className="text-[9px] text-faint">{p.storeName}</p>
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

      {/* ── HERO: carrossel de soluções do ecossistema ── */}
      <HeroCarousel />

      {/* ── CATEGORIAS (por departamento) ── */}
      <section>
        <SectionHeader
          label="explorar"
          title="Categorias"
          linkTo="/categorias"
          linkLabel="Ver todas"
        />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {departments.map((dep) => (
            <DepartmentCard key={dep.key} department={dep} />
          ))}
        </div>
      </section>

      <FlashSaleSection products={flashSaleProducts} />


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
                  <div key={i} className="h-72 animate-pulse rounded-3xl bg-surface shadow-sm" />
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
                className="group flex flex-col overflow-hidden rounded-3xl border border-line-subtle bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-32 items-center justify-center bg-subtle p-3">
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
                  <p className="line-clamp-2 text-xs font-black leading-tight text-content">{p.name}</p>
                  {p.storeName && <p className="mt-0.5 text-[10px] text-faint">{p.storeName}</p>}
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
          label={effectivePosition ? "perto de você" : "lojas"}
          title={effectivePosition ? "Lojas próximas" : "Lojas abertas agora"}
          linkTo="/lojas"
          linkLabel="Ver todas"
          color="#0f766e"
        />
        {loadingStores ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-3xl bg-surface p-5 shadow-sm">
                <div className="h-28 rounded-2xl bg-subtle-2" />
                <div className="mt-4 h-4 w-1/2 rounded bg-subtle-2" />
                <div className="mt-2 h-3 w-1/3 rounded bg-subtle-2" />
              </div>
            ))}
          </div>
        ) : storesSorted.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nenhuma loja disponível.</p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {storesSorted.slice(0, 6).map((store, i) => (
              <StoreCard key={store.id} store={store} distanceKm={store.distanceKm} index={i} />
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
                  className="flex w-36 shrink-0 flex-col overflow-hidden rounded-3xl border border-line-subtle bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative flex h-28 items-center justify-center bg-subtle p-2">
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
                    <p className="line-clamp-2 text-[11px] font-black leading-tight text-content">{p.name}</p>
                    {p.price && <p className="mt-1 text-xs font-black text-[#16a34a]">{formatBRL(p.price)}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <JoinCtaSection />

      {/* Address picker modal */}
      {addressPickerOpen && (
        <AddressPickerModal onClose={() => setAddressPickerOpen(false)} />
      )}

    </div>
  );
}
