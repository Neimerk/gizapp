import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { type StoreProduct } from "../../services/gizApi";
import { formatBRL } from "../../utils/format";

export default function FlashSaleSection({ products }: { products: StoreProduct[] }) {
  if (products.length === 0) return null;
  return (
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
                  {products.map((p) => (
                    <FlashSaleCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            </section>
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
          {i < 2 && <span className="mx-0.5 font-black text-muted">:</span>}
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
      className="group flex w-40 shrink-0 flex-col overflow-hidden rounded-3xl border border-line-subtle bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative flex h-32 items-center justify-center bg-subtle p-3">
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
        <p className="line-clamp-2 text-xs font-black leading-tight text-content">{product.name}</p>
        <p className="text-[10px] text-faint line-through">{formatBRL(product.price)}</p>
        <p className="text-sm font-black text-red-500">{formatBRL(product.promotionalPrice!)}</p>
      </div>
    </Link>
  );
}
