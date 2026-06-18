import { Link } from "react-router-dom";
import { GitCompareArrows, X } from "lucide-react";
import { useCompareStore } from "../../stores/compareStore";
import { getProductImageUrl } from "../../services/gizApi";
import { formatBRL } from "../../utils/format";

export default function CompareBar() {
  const products = useCompareStore((s) => s.products);
  const remove = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);

  if (products.length === 0) return null;

  return (
    <div
      className="fixed left-1/2 z-50 -translate-x-1/2"
      style={{ bottom: "88px" }}
    >
      <div
        className="flex items-center gap-2 rounded-2xl px-3 py-2 shadow-2xl"
        style={{
          background: "rgba(15,23,42,0.96)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <GitCompareArrows size={16} className="shrink-0 text-[#4ade80]" />

        {/* Product thumbnails */}
        <div className="flex items-center gap-1.5">
          {products.map((p) => (
            <div key={p.id} className="relative">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white/10">
                {p.imageUrl ? (
                  <img
                    src={getProductImageUrl(p.imageUrl)}
                    alt={p.name}
                    className="h-8 w-8 object-contain"
                  />
                ) : (
                  <span className="text-sm">🛍️</span>
                )}
              </div>
              <button
                onClick={() => remove(p.id)}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white"
              >
                <X size={9} />
              </button>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: 3 - products.length }).map((_, i) => (
            <div
              key={i}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-dashed border-white/20"
            >
              <span className="text-[10px] text-white/30">+</span>
            </div>
          ))}
        </div>

        <div className="h-5 w-px bg-white/15" />

        <div className="hidden text-xs text-white/60 sm:block">
          {products.length}/3
        </div>

        {products.length >= 2 ? (
          <Link
            to="/comparar"
            className="rounded-xl bg-[#16a34a] px-3 py-1.5 text-xs font-black text-white transition-opacity hover:opacity-90"
          >
            Comparar
          </Link>
        ) : (
          <span className="text-[10px] text-white/40">
            Selecione {2 - products.length} mais
          </span>
        )}

        <button
          onClick={clear}
          className="rounded-lg p-1 text-white/30 hover:text-white/70"
          aria-label="Limpar comparação"
        >
          <X size={14} />
        </button>
      </div>

      {/* Price preview */}
      {products.length >= 2 && (
        <div className="mt-1.5 flex justify-center gap-3">
          {products.map((p) => (
            <span key={p.id} className="text-[10px] font-black text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]">
              {formatBRL(Number(p.promotionalPrice ?? p.price))}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
