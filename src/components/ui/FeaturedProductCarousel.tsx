import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { Link } from "react-router-dom";

import { formatBRL } from "../../utils/format";
import ProductImage from "./ProductImage";
import StoreLogo from "./StoreLogo";
import type { StoreProduct } from "../../services/gizApi";

const INTERVAL_MS = 4500;

interface Props {
  products: StoreProduct[];
}

export default function FeaturedProductCarousel({ products }: Props) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused]   = useState(false);
  const touchX = useRef(0);
  const total  = products.length;

  const go = (idx: number) => setCurrent(((idx % total) + total) % total);

  useEffect(() => {
    if (paused || total <= 1) return;
    const id = setInterval(() => setCurrent((c) => (c + 1) % total), INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, total]);

  if (total === 0) return null;

  const p = products[current];

  return (
    <div
      className="relative mx-auto w-full max-w-sm select-none overflow-hidden rounded-3xl"
      style={{
        background: "linear-gradient(145deg, #0f172a 0%, #1a2540 60%, #0f1f1a 100%)",
        boxShadow: "0 12px 48px rgba(0,0,0,0.45), 0 4px 16px rgba(22,163,74,0.15)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const diff = touchX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) go(diff > 0 ? current + 1 : current - 1);
      }}
    >
      {/* Blobs decorativos */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#16a34a]/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-[#2563eb]/10 blur-3xl" />

      <Link to={`/lojas/${p.storeId}/produto/${p.id}`} className="relative z-10 block">
        {/* Header: loja + badge */}
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-black text-white"
              style={{ background: "linear-gradient(135deg, #16a34a, #166534)" }}
            >
              <StoreLogo name={p.storeName ?? "L"} />
            </div>
            <span className="text-sm font-black text-white">
              {p.storeName ?? "Loja"}
            </span>
          </div>
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black"
            style={{
              borderColor: "rgba(74,222,128,0.35)",
              background:  "rgba(22,163,74,0.18)",
              color: "#4ade80",
            }}
          >
            <Star size={9} fill="currentColor" /> Destaque
          </span>
        </div>

        {/* Imagem do produto */}
        <div className="flex h-52 items-center justify-center bg-surface p-6">
          <ProductImage
            imageUrl={p.imageUrl}
            alt={p.imageAlt || p.name}
            category={p.category}
            containerClassName="h-40 w-full"
            className="h-40 w-full object-contain drop-shadow-2xl transition-transform duration-500 hover:scale-105"
          />
        </div>

        {/* Info do produto */}
        <div className="px-5 pb-2 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
            {p.category}{p.brand ? ` · ${p.brand}` : ""}
          </p>
          <h3 className="mt-1 text-lg font-black leading-tight text-white line-clamp-2">
            {p.name}
          </h3>

          <div className="mt-3 flex items-end gap-3">
            {p.promotionalPrice ? (
              <>
                <span className="text-2xl font-black text-[#4ade80]">
                  {formatBRL(Number(p.promotionalPrice))}
                </span>
                <span className="mb-0.5 text-sm font-bold text-white/30 line-through">
                  {formatBRL(Number(p.price))}
                </span>
                <span
                  className="mb-0.5 rounded-full px-2 py-0.5 text-[10px] font-black text-[#4ade80]"
                  style={{ background: "rgba(22,163,74,0.2)" }}
                >
                  {Math.round((1 - Number(p.promotionalPrice) / Number(p.price)) * 100)}% off
                </span>
              </>
            ) : (
              <span className="text-2xl font-black text-white">
                {formatBRL(Number(p.price))}
              </span>
            )}
          </div>

          <div
            className="mt-4 flex items-center justify-center rounded-2xl py-3.5 text-sm font-black text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #16a34a, #15803d)",
              boxShadow: "0 6px 20px rgba(22,163,74,0.35)",
            }}
          >
            Ver produto
          </div>
        </div>
      </Link>

      {/* Dots de navegação */}
      {total > 1 && (
        <div className="relative z-10 flex items-center justify-center gap-2 py-4">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`Produto ${i + 1}`}
              className="rounded-full bg-surface transition-all"
              style={{
                width:   i === current ? 20 : 6,
                height:  6,
                opacity: i === current ? 0.9 : 0.25,
              }}
            />
          ))}
        </div>
      )}

      {/* Barra de progresso */}
      {total > 1 && !paused && (
        <div
          key={current}
          className="absolute bottom-0 left-0 z-20 h-0.5 bg-[#16a34a]/60"
          style={{ animation: `featuredProgress ${INTERVAL_MS}ms linear` }}
        />
      )}
      <style>{`
        @keyframes featuredProgress {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </div>
  );
}
