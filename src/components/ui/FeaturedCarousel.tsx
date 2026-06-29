import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { formatBRL } from "../../utils/format";
import type { FeaturedStore } from "../../services/gizApi";

type Props = {
  store: FeaturedStore;
};

export default function FeaturedCarousel({ store }: Props) {
  const [idx, setIdx] = useState(0);
  const products = store.products;

  useEffect(() => {
    if (products.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % products.length), 3500);
    return () => clearInterval(t);
  }, [products.length]);

  const product = products[idx];
  if (!product) return null;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-3xl bg-surface"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)" }}
    >
      {/* Store header */}
      <Link
        to={`/lojas/${store.storeId}`}
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ background: "linear-gradient(135deg, #001640 0%, #002776 60%, #003d1a 100%)" }}
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[10px] font-black text-white"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
        >
          {store.storeName[0]}
        </div>
        <span className="flex-1 truncate text-xs font-black text-white">{store.storeName}</span>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-yellow-400/20 px-2 py-0.5 text-[9px] font-black text-yellow-300">
          <Star size={8} className="fill-yellow-300" /> Destaque
        </span>
      </Link>

      {/* Product */}
      <Link
        to={`/lojas/${store.storeId}/produto/${product.id}`}
        className="group flex flex-1 flex-col p-4"
      >
        {/* Image */}
        <div className="relative mx-auto mb-3 h-36 w-full overflow-hidden rounded-2xl bg-subtle">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.imageAlt || product.name}
              className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl">📦</div>
          )}
        </div>

        {/* Info */}
        <p className="truncate text-[10px] font-bold uppercase tracking-wide text-faint">
          {product.category}{product.brand ? ` · ${product.brand}` : ""}
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-black leading-tight text-content">
          {product.name}
        </h3>
        <div className="mt-2">
          {product.promotionalPrice ? (
            <>
              <p className="text-[10px] font-bold text-faint line-through">
                {formatBRL(product.price)}
              </p>
              <p className="text-base font-black text-[#16a34a]">
                {formatBRL(product.promotionalPrice)}
              </p>
            </>
          ) : (
            <p className="text-base font-black text-[#16a34a]">{formatBRL(product.price)}</p>
          )}
        </div>
        <div
          className="mt-3 flex items-center justify-center rounded-xl py-2 text-xs font-black text-white transition-opacity group-hover:opacity-85"
          style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)" }}
        >
          Ver produto
        </div>
      </Link>

      {/* Dots */}
      {products.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 border-t border-subtle-2 py-2.5">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Produto ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-4 bg-[#16a34a]" : "w-1.5 bg-[#e2e8f0]"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
