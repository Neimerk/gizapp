import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { formatBRL } from "../../utils/format";
import type { FeaturedProduct, ShoppingStore } from "../../services/shoppingSupabase";

type Props = {
  store: ShoppingStore;
  products: FeaturedProduct[];
};

export default function FeaturedCarousel({ store, products }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (products.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % products.length), 3500);
    return () => clearInterval(t);
  }, [products.length]);

  const product = products[idx];
  if (!product) return null;

  return (
    <div
      className="overflow-hidden rounded-3xl bg-white"
      style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)" }}
    >
      {/* Store header */}
      <div
        className="flex items-center gap-3 px-5 py-3.5"
        style={{ background: "linear-gradient(135deg, #001640 0%, #002776 60%, #003d1a 100%)" }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-black text-white"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
        >
          {store.logo_url ? (
            <img src={store.logo_url} alt={store.name} className="h-full w-full object-cover" />
          ) : (
            store.name[0]
          )}
        </div>
        <span className="flex-1 text-sm font-black text-white">{store.name}</span>
        <span className="flex items-center gap-1 rounded-full bg-yellow-400/20 px-2.5 py-1 text-[10px] font-black text-yellow-300">
          <Star size={9} className="fill-yellow-300" /> Destaque
        </span>
      </div>

      {/* Product carousel */}
      <Link to={`/lojas/${store.id}/produto/${product.id}`} className="group block p-4">
        <div className="flex gap-4">
          {/* Image */}
          <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-[#f8fafc]">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.image_alt || product.name}
                className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-3xl">📦</div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
              {product.category}{product.brand ? ` · ${product.brand}` : ""}
            </p>
            <h3 className="mt-1 text-sm font-black text-[#0f172a] line-clamp-2 leading-tight">
              {product.name}
            </h3>
            <div className="mt-2">
              {product.promotional_price ? (
                <>
                  <p className="text-[10px] font-bold text-[#94a3b8] line-through">
                    {formatBRL(product.price)}
                  </p>
                  <p className="text-lg font-black text-[#16a34a]">
                    {formatBRL(product.promotional_price)}
                  </p>
                </>
              ) : (
                <p className="text-lg font-black text-[#16a34a]">{formatBRL(product.price)}</p>
              )}
            </div>
            <div
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black text-white"
              style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)" }}
            >
              Ver produto
            </div>
          </div>
        </div>
      </Link>

      {/* Dots + navigation */}
      {products.length > 1 && (
        <div className="flex items-center justify-between border-t border-[#f1f5f9] px-5 py-3">
          <button
            onClick={() => setIdx((i) => (i - 1 + products.length) % products.length)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
          >
            <ChevronLeft size={14} />
          </button>
          <div className="flex items-center gap-1.5">
            {products.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "w-4 bg-[#16a34a]" : "w-1.5 bg-[#e2e8f0]"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => setIdx((i) => (i + 1) % products.length)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
