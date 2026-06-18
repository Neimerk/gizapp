import { useState } from "react";
import { ArrowLeft, Heart, Store as StoreIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useFavoritesStore } from "../stores/favoritesStore";
import { getProductImageUrl } from "../services/gizApi";
import { formatBRL } from "../utils/format";

type Tab = "lojas" | "produtos";

export default function FavoritesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("produtos");

  const favProducts = useFavoritesStore((s) => s.products);
  const favStores = useFavoritesStore((s) => s.stores);
  const toggleProduct = useFavoritesStore((s) => s.toggleProduct);
  const toggleStore = useFavoritesStore((s) => s.toggleStore);

  const total = favProducts.length + favStores.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a]"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">BrasUX</p>
          <h1 className="text-xl font-black text-[#0f172a]">Favoritos</h1>
        </div>
        {total > 0 && (
          <span className="ml-auto rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-black text-white">
            {total}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["produtos", "lojas"] as Tab[]).map((t) => {
          const count = t === "produtos" ? favProducts.length : favStores.length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-black transition-colors ${
                tab === t
                  ? "bg-[#0f172a] text-white"
                  : "border border-[#e2e8f0] bg-white text-[#64748b]"
              }`}
            >
              {t === "produtos" ? "🛍️" : "🏪"}
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    tab === t ? "bg-white/20 text-white" : "bg-[#f1f5f9] text-[#64748b]"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {tab === "produtos" && (
        <>
          {favProducts.length === 0 ? (
            <EmptyState
              icon={<Heart size={36} className="text-[#94a3b8]" />}
              title="Nenhum produto favorito"
              description="Toque no ♥ em qualquer produto para salvar aqui."
              linkTo="/buscar"
              linkLabel="Explorar produtos"
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {favProducts.map((product) => (
                <div
                  key={product.id}
                  className="group relative flex flex-col overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Remove favorite */}
                  <button
                    onClick={() => toggleProduct(product)}
                    className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
                    aria-label="Remover dos favoritos"
                  >
                    <span className="text-sm leading-none">♥</span>
                  </button>

                  <Link to={`/lojas/${product.storeId}/produto/${product.id}`} className="flex flex-col">
                    {/* Image */}
                    <div className="flex h-36 items-center justify-center bg-[#f8fafc] p-3">
                      {product.imageUrl ? (
                        <img
                          src={getProductImageUrl(product.imageUrl)}
                          alt={product.name}
                          className="h-28 w-full object-contain transition-transform group-hover:scale-105"
                          onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                        />
                      ) : (
                        <span className="text-4xl">🛍️</span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-3">
                      <p className="truncate text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
                        {product.category}
                      </p>
                      <h3 className="mt-0.5 flex-1 text-xs font-black leading-tight text-[#0f172a] line-clamp-2">
                        {product.name}
                      </h3>
                      <p className="mt-2 text-sm font-black text-[#16a34a]">
                        {formatBRL(Number(product.promotionalPrice ?? product.price))}
                      </p>
                      <div className="mt-2 flex items-center justify-center rounded-xl bg-[#0f172a] py-1.5 text-[10px] font-black text-white transition-colors group-hover:bg-[#16a34a]">
                        Ver produto
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "lojas" && (
        <>
          {favStores.length === 0 ? (
            <EmptyState
              icon={<StoreIcon size={36} className="text-[#94a3b8]" />}
              title="Nenhuma loja favorita"
              description="Toque no ♥ no banner de uma loja para salvar aqui."
              linkTo="/lojas"
              linkLabel="Explorar lojas"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favStores.map((store) => (
                <div
                  key={store.id}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Banner */}
                  <div
                    className="relative h-24"
                    style={{
                      background:
                        "radial-gradient(circle at 80% 30%, rgba(0,39,118,0.55), transparent 55%), linear-gradient(135deg, #0a1628 0%, #001640 100%)",
                    }}
                  >
                    <button
                      onClick={() => toggleStore(store)}
                      className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
                      aria-label="Remover dos favoritos"
                    >
                      <span className="text-sm leading-none">♥</span>
                    </button>
                    <span
                      className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${
                        store.isOpen
                          ? "border-green-700/40 bg-green-900/30 text-green-400"
                          : "border-white/15 bg-white/10 text-[#94a3b8]"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${store.isOpen ? "bg-green-400" : "bg-[#94a3b8]"}`} />
                      {store.isOpen ? "Aberto" : "Fechado"}
                    </span>
                    <span
                      className="absolute -bottom-5 left-4 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-white"
                      style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
                    >
                      {store.name.charAt(0)}
                    </span>
                  </div>

                  <Link to={`/lojas/${store.id}`} className="flex flex-1 flex-col px-4 pb-4 pt-8">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#94a3b8]">
                      {store.category.split(",")[0]}
                    </p>
                    <h3 className="mt-0.5 font-black text-[#0f172a]">{store.name}</h3>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: "Entrega", value: `${store.deliveryTimeMin}-${store.deliveryTimeMax}min` },
                        {
                          label: "Taxa",
                          value: Number(store.deliveryFee) === 0 ? "Grátis" : formatBRL(Number(store.deliveryFee)),
                        },
                        { label: "Nota", value: `⭐ ${Number(store.rating).toFixed(1)}` },
                      ].map((s) => (
                        <div key={s.label} className="rounded-xl bg-[#f8fafc] px-2 py-1.5" style={{ border: "1px solid #f1f5f9" }}>
                          <p className="text-[9px] font-bold uppercase tracking-wide text-[#94a3b8]">{s.label}</p>
                          <p className="text-[10px] font-black text-[#0f172a]">{s.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-center rounded-xl bg-[#0f172a] py-2 text-xs font-black text-white transition-colors group-hover:bg-[#16a34a]">
                      Ver catálogo
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({
  icon, title, description, linkTo, linkLabel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  linkTo: string;
  linkLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#f1f5f9]">
        {icon}
      </div>
      <h2 className="mt-5 text-lg font-black text-[#0f172a]">{title}</h2>
      <p className="mt-1.5 text-sm text-[#64748b]">{description}</p>
      <Link
        to={linkTo}
        className="mt-6 rounded-2xl bg-[#16a34a] px-6 py-3 text-sm font-black text-white"
      >
        {linkLabel}
      </Link>
    </div>
  );
}
