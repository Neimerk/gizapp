import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { useCartStore } from "../stores/cartStore";
import { formatBRL } from "../utils/format";

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const increaseItem = useCartStore((s) => s.increaseItem);
  const decreaseItem = useCartStore((s) => s.decreaseItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalItems = useCartStore((s) => s.totalItems());
  const totalPrice = useCartStore((s) => s.totalPrice());

  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <>
      <div className="space-y-4 pb-36 md:pb-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-[#16a34a]">BrasUX</p>
            <h1 className="text-2xl font-black text-content">Carrinho</h1>
          </div>
          {items.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { clearCart(); setConfirmClear(false); }}
                  className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-3 py-1.5 text-xs font-black text-[#e11d48]"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-black text-muted"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-3 py-1.5 text-xs font-black text-[#e11d48]"
              >
                Limpar
              </button>
            )
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#16a34a]/10">
              <ShoppingCart size={40} className="text-[#16a34a]" />
            </div>
            <h2 className="mt-6 text-xl font-black text-content">
              Seu carrinho está vazio
            </h2>
            <p className="mt-2 text-sm text-muted">
              Adicione produtos de uma loja para continuar.
            </p>
            <Link
              to="/"
              className="mt-6 rounded-2xl bg-[#16a34a] px-6 py-3 text-sm font-black text-white"
            >
              Explorar lojas
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {/* ITEMS — swipe left para remover */}
            {items.map((item) => (
              <SwipeItem key={item.id} onDelete={() => removeItem(item.id)}>
                <div className="flex gap-3 p-3">
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    className="h-20 w-20 shrink-0 rounded-xl object-cover bg-subtle"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />

                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div>
                      <h3 className="text-sm font-black text-content line-clamp-2 leading-tight">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-muted line-clamp-1">
                          {item.description}
                        </p>
                      )}
                      <p className="mt-1 text-sm font-black text-[#16a34a]">
                        {formatBRL(item.promotionalPrice ?? item.price)}
                      </p>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1 rounded-xl bg-subtle-2 p-1">
                        <button
                          onClick={() => decreaseItem(item.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface shadow-sm"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-7 text-center text-sm font-black text-content">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => increaseItem(item.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface shadow-sm"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fff1f2] text-[#e11d48]"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </SwipeItem>
            ))}

            {/* SUMMARY */}
            <div className="rounded-3xl bg-[#0f172a] p-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted">
                Resumo
              </h2>

              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-sm text-faint">
                  <span>{totalItems} {totalItems === 1 ? "item" : "itens"}</span>
                  <strong className="text-white">{formatBRL(totalPrice)}</strong>
                </div>
                <div className="flex justify-between text-sm text-faint">
                  <span>Taxa de entrega</span>
                  <strong className="text-white">no checkout</strong>
                </div>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4 flex items-center justify-between">
                <span className="text-base font-bold text-faint">Total</span>
                <span className="text-2xl font-black text-white">
                  {formatBRL(totalPrice)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky checkout CTA — sempre visível no mobile independente do scroll */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pb-[88px] pt-3 md:px-8 md:pb-4">
            <div>
              <p className="text-[11px] text-muted">
                {totalItems} {totalItems === 1 ? "item" : "itens"}
              </p>
              <p className="text-xl font-black text-content">{formatBRL(totalPrice)}</p>
            </div>
            <Link
              to="/checkout"
              className="shrink-0 rounded-2xl bg-linear-to-r from-[#16a34a] to-[#2563eb] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-[#16a34a]/30"
            >
              Finalizar compra →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

// ── Swipe para remover (deslize para a esquerda) ────────────────

function SwipeItem({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const REVEAL = 80;

  const [offset, _setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const offsetRef = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const baseOffset = useRef(0);
  const axis = useRef<"h" | "v" | null>(null);
  const foregroundRef = useRef<HTMLDivElement>(null);

  function setOffset(v: number) {
    offsetRef.current = v;
    _setOffset(v);
  }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    baseOffset.current = offsetRef.current;
    axis.current = null;
    setAnimating(false);
  }

  // touchmove registrado como non-passive para poder chamar preventDefault()
  // e bloquear scroll vertical durante swipe horizontal
  useEffect(() => {
    const el = foregroundRef.current;
    if (!el) return;

    const handleMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      if (!axis.current) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6)
          axis.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        return;
      }
      if (axis.current === "v") return;

      e.preventDefault();
      setOffset(Math.max(-REVEAL - 10, Math.min(0, baseOffset.current + dx)));
    };

    el.addEventListener("touchmove", handleMove, { passive: false });
    return () => el.removeEventListener("touchmove", handleMove);
  }, []);

  function onTouchEnd() {
    setAnimating(true);
    setOffset(offsetRef.current < -(REVEAL / 2) ? -REVEAL : 0);
    axis.current = null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line-subtle bg-surface shadow-sm">
      {/* Zona de remoção (atrás) */}
      <div className="absolute inset-y-0 right-0 flex w-20 flex-col items-center justify-center rounded-r-2xl bg-[#e11d48]">
        <button
          onClick={onDelete}
          className="flex h-full w-full flex-col items-center justify-center gap-1 text-white"
        >
          <Trash2 size={18} />
          <span className="text-[10px] font-black">Remover</span>
        </button>
      </div>

      {/* Conteúdo do item (frente) */}
      <div
        ref={foregroundRef}
        className={`bg-surface ${animating ? "transition-transform duration-200 ease-out" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
