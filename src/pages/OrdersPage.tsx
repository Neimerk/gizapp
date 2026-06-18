import { useEffect, useState } from "react";
import { ArrowLeft, Clock3, LogIn, Package, ReceiptText, RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getMyOrders, getProductImageUrl, queryKeys, type Order } from "../services/gizApi";
import { ordersConnection, startOrdersConnection } from "../services/signalr";
import { formatBRL } from "../utils/format";
import { getAuth } from "../services/auth";

const STATUS_STEPS = [
  { status: 0, label: "Recebido" },
  { status: 1, label: "Aceito" },
  { status: 2, label: "Preparando" },
  { status: 3, label: "Saindo" },
  { status: 4, label: "Entregue" },
];

const STATUS_LABEL: Record<number, string> = {
  0: "Pedido recebido",
  1: "Pedido aceito",
  2: "Preparando",
  3: "Saiu para entrega",
  4: "Entregue",
  5: "Cancelado",
};

const STATUS_COLOR: Record<number, string> = {
  0: "bg-yellow-100 text-yellow-700 border-yellow-200",
  1: "bg-purple-100 text-purple-700 border-purple-200",
  2: "bg-blue-100 text-blue-700 border-blue-200",
  3: "bg-orange-100 text-orange-700 border-orange-200",
  4: "bg-green-100 text-green-700 border-green-200",
  5: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_DOT: Record<number, string> = {
  0: "bg-yellow-400",
  1: "bg-purple-500",
  2: "bg-blue-500",
  3: "bg-orange-400",
  4: "bg-green-500",
  5: "bg-red-500",
};

const PAYMENT_LABEL: Record<string, string> = {
  pix: "Pix",
  card: "Cartão de crédito",
};

/* ── RATING HELPERS ── */

type OrderRating = { stars: number; comment?: string };

function getRating(orderId: string): OrderRating | null {
  try {
    return JSON.parse(localStorage.getItem(`brasux-rating-${orderId}`) ?? "null");
  } catch {
    return null;
  }
}

function saveRating(orderId: string, rating: OrderRating) {
  localStorage.setItem(`brasux-rating-${orderId}`, JSON.stringify(rating));
}

/* ── NOTIFICATION HELPER ── */

async function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

function showOrderNotification(order: Order) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;

  const label = STATUS_LABEL[order.status] ?? "Status atualizado";
  new Notification("BrasUX — Pedido atualizado", {
    body: `${label} · ${formatBRL(Number(order.total))}`,
    icon: "/logo-brasux.webp",
    badge: "/favicon.svg",
  });
}

/* ── PAGE ── */

export default function OrdersPage() {
  const navigate = useNavigate();
  const auth = getAuth();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading: loading, isFetching: refreshing, refetch } = useQuery({
    queryKey: queryKeys.myOrders(),
    queryFn: getMyOrders,
    enabled: !!auth,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!auth) return;

    requestNotificationPermission();

    async function setupSignalR() {
      try {
        await startOrdersConnection();
        ordersConnection.off("OrderCreated");
        ordersConnection.off("OrderStatusUpdated");

        ordersConnection.on("OrderCreated", (order: Order) => {
          queryClient.setQueryData(queryKeys.myOrders(), (cur: Order[] = []) =>
            cur.some((o) => o.id === order.id) ? cur : [order, ...cur]
          );
        });

        ordersConnection.on("OrderStatusUpdated", (updated: Order) => {
          queryClient.setQueryData(queryKeys.myOrders(), (cur: Order[] = []) =>
            cur.map((o) => (o.id === updated.id ? updated : o))
          );
          showOrderNotification(updated);
        });
      } catch (e) {
        console.error("SignalR:", e);
      }
    }
    setupSignalR();

    return () => {
      ordersConnection.off("OrderCreated");
      ordersConnection.off("OrderStatusUpdated");
    };
  }, [auth, queryClient]);

  if (!auth) {
    return (
      <div className="flex flex-col items-center justify-center pt-24 px-4 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#16a34a]/10">
          <ReceiptText size={40} className="text-[#16a34a]" />
        </div>
        <h2 className="mt-6 text-xl font-black text-[#0f172a]">Entre para ver seus pedidos</h2>
        <p className="mt-2 text-sm text-[#64748b]">
          Faça login para acompanhar seus pedidos em tempo real.
        </p>
        <Link
          to="/login"
          state={{ from: "/pedidos" }}
          className="mt-6 flex items-center gap-2 rounded-2xl bg-[#16a34a] px-6 py-3 text-sm font-black text-white"
        >
          <LogIn size={16} /> Entrar na conta
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a]"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">BrasUX</p>
            <h1 className="text-xl font-black text-[#0f172a]">Meus pedidos</h1>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={refreshing}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white"
        >
          <RefreshCw size={16} className={`text-[#64748b] ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="h-5 w-1/3 rounded bg-[#f1f5f9] animate-pulse" />
                <div className="mt-3 h-8 w-1/2 rounded bg-[#f1f5f9] animate-pulse" />
                <div className="mt-4 h-10 rounded-xl bg-[#f1f5f9] animate-pulse" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#16a34a]/10">
              <ReceiptText size={40} className="text-[#16a34a]" />
            </div>
            <h2 className="mt-6 text-xl font-black text-[#0f172a]">Nenhum pedido ainda</h2>
            <p className="mt-2 text-sm text-[#64748b]">Seus pedidos aparecerão aqui em tempo real.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── STATUS TIMELINE ── */

function StatusTimeline({ status }: { status: number }) {
  return (
    <div className="flex items-start">
      {STATUS_STEPS.map((step, idx) => {
        const isCompleted = status >= step.status;
        const isCurrent = status === step.status;
        const isLast = idx === STATUS_STEPS.length - 1;

        return (
          <div key={step.status} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div
                className={`h-3 w-3 shrink-0 rounded-full border-2 transition-all ${
                  isCompleted
                    ? isCurrent
                      ? "scale-125 border-[#16a34a] bg-[#16a34a]"
                      : "border-[#16a34a] bg-[#16a34a]"
                    : "border-[#e2e8f0] bg-white"
                }`}
              />
              {!isLast && (
                <div
                  className={`h-0.5 flex-1 transition-colors ${
                    status > step.status ? "bg-[#16a34a]" : "bg-[#e2e8f0]"
                  }`}
                />
              )}
            </div>
            <p
              className={`mt-1.5 text-[9px] font-black uppercase tracking-wide ${
                isCompleted ? "text-[#16a34a]" : "text-[#cbd5e1]"
              }`}
            >
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ── RATING SECTION ── */

function RatingSection({ orderId }: { orderId: string }) {
  const [saved, setSaved] = useState(false);
  const [existing] = useState(() => getRating(orderId));
  const [hovered, setHovered] = useState(existing?.stars ?? 0);
  const [selected, setSelected] = useState(existing?.stars ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [submitted, setSubmitted] = useState(!!existing);

  if (submitted && existing) {
    return (
      <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-center">
        <p className="text-sm font-black text-[#16a34a]">
          Sua avaliação: {"⭐".repeat(existing.stars)}
        </p>
        {existing.comment && (
          <p className="mt-1 text-xs italic text-[#64748b]">"{existing.comment}"</p>
        )}
      </div>
    );
  }

  function handleSave() {
    if (!selected) return;
    const rating: OrderRating = { stars: selected, comment: comment.trim() || undefined };
    saveRating(orderId, rating);
    setSaved(true);
    setSubmitted(true);
  }

  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
        Avalie sua experiência
      </p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(selected)}
            onClick={() => setSelected(star)}
            className="text-2xl transition-transform hover:scale-125 focus:outline-none"
            aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
          >
            <span className={star <= (hovered || selected) ? "text-yellow-400" : "text-[#e2e8f0]"}>
              ★
            </span>
          </button>
        ))}
      </div>
      {selected > 0 && !saved && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Deixe um comentário (opcional)…"
            rows={2}
            className="mt-3 w-full resize-none rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30 placeholder:text-[#cbd5e1]"
          />
          <button
            onClick={handleSave}
            className="mt-2 w-full rounded-xl bg-[#16a34a] py-2.5 text-xs font-black text-white transition-opacity hover:opacity-90"
          >
            Enviar avaliação
          </button>
        </>
      )}
    </div>
  );
}

/* ── ORDER CARD ── */

function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const isCancelled = order.status === 5;
  const isDelivered = order.status === 4;

  return (
    <div className="overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#16a34a] to-[#2563eb] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <Package size={18} className="text-white" />
            </div>
            <div>
              {order.storeName && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                  {order.storeName}
                </p>
              )}
              <p className="text-xl font-black text-white">
                {formatBRL(Number(order.total))}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black ${STATUS_COLOR[order.status]}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[order.status]}`} />
            {STATUS_LABEL[order.status] ?? "Desconhecido"}
          </span>
        </div>
      </div>

      {/* STATUS TIMELINE */}
      {!isCancelled && (
        <div className="px-4 pt-4 pb-1">
          <StatusTimeline status={order.status} />
        </div>
      )}

      {/* META + EXPAND */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[#64748b]">
            <Clock3 size={13} />
            {new Date(order.createdAt).toLocaleString("pt-BR")}
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-black text-[#16a34a]"
          >
            {open ? "Ocultar detalhes" : "Ver detalhes"}
          </button>
        </div>

        {open && (
          <div className="mt-3 space-y-4 border-t border-[#f1f5f9] pt-3">
            {/* ITEMS */}
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-[#f8fafc] p-3">
                  <img
                    src={getProductImageUrl(item.imageUrl)}
                    alt={item.productName}
                    className="h-14 w-14 rounded-xl object-cover bg-white shrink-0"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-[#0f172a] line-clamp-1">{item.productName}</h3>
                    <p className="text-xs text-[#64748b]">{item.quantity}× {formatBRL(item.unitPrice)}</p>
                  </div>
                  <span className="text-sm font-black text-[#16a34a] shrink-0">
                    {formatBRL(item.totalPrice)}
                  </span>
                </div>
              ))}
            </div>

            {/* ENDEREÇO */}
            <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
              <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">Entrega</p>
              <p className="text-sm font-black text-[#0f172a]">
                {order.deliveryAddress}, {order.deliveryNumber}
                {order.deliveryComplement ? ` — ${order.deliveryComplement}` : ""}
              </p>
              <p className="text-xs text-[#64748b]">{order.deliveryNeighborhood}</p>
            </div>

            {/* TOTAIS + PAGAMENTO */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Subtotal</span>
                <strong>{formatBRL(order.subtotal)}</strong>
              </div>
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Entrega</span>
                <strong>
                  {Number(order.deliveryFee) === 0 ? "Grátis" : formatBRL(order.deliveryFee)}
                </strong>
              </div>
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Pagamento</span>
                <strong>{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</strong>
              </div>
              <div className="flex justify-between border-t border-[#f1f5f9] pt-1.5">
                <span className="text-sm font-black text-[#0f172a]">Total</span>
                <span className="text-base font-black text-[#16a34a]">{formatBRL(order.total)}</span>
              </div>
            </div>

            {/* AVALIAÇÃO (só após entrega) */}
            {isDelivered && <RatingSection orderId={order.id} />}
          </div>
        )}
      </div>
    </div>
  );
}
