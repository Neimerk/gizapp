import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { getFeaturedByStore, queryKeys } from "../services/gizApi";
import FeaturedCarousel from "../components/ui/FeaturedCarousel";
import { usePageMeta } from "../hooks/usePageMeta";

export default function FeaturedStoresPage() {
  usePageMeta({
    title: "Lojas em destaque — BrasUX Shopping",
    description: "Confira as lojas em destaque no BrasUX Shopping com os melhores produtos selecionados.",
  });

  const { data: featuredStores = [], isLoading } = useQuery({
    queryKey: queryKeys.featuredByStore(),
    queryFn: getFeaturedByStore,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-content"
        >
          <ArrowLeft size={15} /> Início
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-50">
            <Star size={20} className="fill-yellow-400 text-yellow-400" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-[#16a34a]">Ofertas</p>
            <h1 className="text-2xl font-black text-content">Lojas em destaque</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted">
          Produtos selecionados pelas lojas parceiras do BrasUX Shopping.
        </p>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-3xl bg-surface shadow-sm" />
          ))}
        </div>
      ) : featuredStores.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-line bg-surface p-16 text-center">
          <Star size={32} className="mx-auto mb-4 text-[#cbd5e1]" />
          <p className="font-black text-content">Nenhuma loja em destaque ainda</p>
          <p className="mt-1 text-sm text-muted">As lojas parceiras aparecerão aqui em breve.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredStores.map((store) => (
            <FeaturedCarousel key={store.storeId} store={store} />
          ))}
        </div>
      )}
    </div>
  );
}
