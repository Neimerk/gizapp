import { useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

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
    <div className="space-y-4">
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
          {/* ITEMS */}
          {items.map((item) => (
            <div
              key={item.id}
              className="flex gap-3 rounded-2xl border border-line-subtle bg-surface p-3 shadow-sm"
            >
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

            <Link
              to="/checkout"
              className="mt-4 flex w-full items-center justify-center rounded-2xl bg-linear-to-r from-[#16a34a] to-[#2563eb] py-4 text-sm font-black text-white shadow-lg shadow-[#16a34a]/30"
            >
              Finalizar compra
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
