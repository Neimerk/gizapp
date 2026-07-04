import { lazy, Suspense, useEffect, useState } from "react";
import { ArrowLeft, Clock3, LogIn, Package, ReceiptText, RefreshCw } from "lucide-react";

const MapTrack = lazy(() => import("../components/ui/MapTrack"));
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getMyOrders, getProductImageUrl, queryKeys, upsertReview, type Order } from "../services/gizApi";
import { logger } from "../utils/logger";
import type { CourierPosition } from "../components/ui/MapTrack";
import { ordersConnection, startOrdersConnection } from "../services/signalr";
import { formatBRL } from "../utils/format";
import { useAuthStore } from "../stores/authStore";
import { supabase } from "../lib/supabase";

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
  const auth = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [autoReviewOrder, setAutoReviewOrder] = useState<Order | null>(null);

  const { data: orders = [], isLoading: loading, isFetching: refreshing, refetch } = useQuery({
    queryKey: queryKeys.myOrders(),
    queryFn: getMyOrders,
    enabled: !!auth,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!auth) return;

    requestNotificationPermission();

    // Supabase Realtime: escuta INSERT e UPDATE na tabela orders filtrado pelo usuário
    const channel = supabase
      .channel(`orders:customer:${auth.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `customer_id=eq.${auth.id}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.myOrders() }); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `customer_id=eq.${auth.id}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.myOrders() }); }
      )
      .subscribe();

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
          if (updated.status === 4 && updated.items.length > 0) {
            const alreadyRated = localStorage.getItem(`brasux-rating-${updated.id}`);
            if (!alreadyRated) {
              setTimeout(() => setAutoReviewOrder(updated), 1500);
            }
          }
        });
      } catch (e) {
        logger.error("SignalR:", e);
      }
    }
    setupSignalR();

    return () => {
      supabase.removeChannel(channel);
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
        <h2 className="mt-6 text-xl font-black text-content">Entre para ver seus pedidos</h2>
        <p className="mt-2 text-sm text-muted">
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
            <h1 className="text-xl font-black text-content">Meus pedidos</h1>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={refreshing}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface"
        >
          <RefreshCw size={16} className={`text-muted ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-3xl bg-surface p-5 shadow-sm">
                <div className="h-5 w-1/3 rounded bg-subtle-2 animate-pulse" />
                <div className="mt-3 h-8 w-1/2 rounded bg-subtle-2 animate-pulse" />
                <div className="mt-4 h-10 rounded-xl bg-subtle-2 animate-pulse" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#16a34a]/10">
              <ReceiptText size={40} className="text-[#16a34a]" />
            </div>
            <h2 className="mt-6 text-xl font-black text-content">Nenhum pedido ainda</h2>
            <p className="mt-2 text-sm text-muted">Seus pedidos aparecerão aqui em tempo real.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>

      {autoReviewOrder && (
        <AutoReviewModal
          order={autoReviewOrder}
          onClose={() => setAutoReviewOrder(null)}
        />
      )}
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
                    : "border-line bg-surface"
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

function RatingSection({ orderId, firstStoreProductId }: { orderId: string; firstStoreProductId?: string }) {
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
          <p className="mt-1 text-xs italic text-muted">"{existing.comment}"</p>
        )}
      </div>
    );
  }

  async function handleSave() {
    if (!selected) return;
    const rating: OrderRating = { stars: selected, comment: comment.trim() || undefined };
    saveRating(orderId, rating);
    setSaved(true);
    setSubmitted(true);
    if (firstStoreProductId) {
      try {
        await upsertReview(firstStoreProductId, selected, comment.trim() || undefined);
      } catch { /* silencioso — localStorage já salvou */ }
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-subtle p-4">
      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-faint">
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
            className="mt-3 w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-content outline-none focus:ring-2 focus:ring-[#16a34a]/30 placeholder:text-[#cbd5e1]"
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

/* ── AUTO REVIEW MODAL ── */

function AutoReviewModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!selected) return;
    saveRating(order.id, { stars: selected, comment: comment.trim() || undefined });
    setSubmitted(true);
    setTimeout(onClose, 1500);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-t-3xl bg-surface p-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="text-5xl">🎉</span>
            <p className="text-lg font-black text-content">Obrigado pela avaliação!</p>
            <p className="text-sm text-muted">Seu feedback ajuda outros compradores.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f0fdf4]">
                <span className="text-xl">📦</span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">Pedido entregue!</p>
                <h3 className="font-black text-content">Como foi sua experiência?</h3>
              </div>
            </div>
            {order.storeName && (
              <p className="mb-4 text-sm text-muted">
                Avalie sua compra em <strong className="text-content">{order.storeName}</strong>
              </p>
            )}
            <div className="mb-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setSelected(star)}
                  className="text-4xl transition-transform hover:scale-110 focus:outline-none"
                  aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
                >
                  <span className={star <= (hovered || selected) ? "text-yellow-400" : "text-[#e2e8f0]"}>★</span>
                </button>
              ))}
            </div>
            {selected > 0 && (
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Deixe um comentário (opcional)…"
                rows={2}
                className="mb-4 w-full resize-none rounded-2xl border border-line bg-subtle px-4 py-3 text-sm text-content outline-none focus:ring-2 focus:ring-[#16a34a]/30 placeholder:text-[#cbd5e1]"
              />
            )}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-2xl border border-line py-3 text-sm font-black text-muted"
              >
                Agora não
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selected}
                className="flex-1 rounded-2xl py-3 text-sm font-black text-white disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
              >
                Avaliar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── ORDER CARD ── */

function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const [courierPosition, setCourierPosition] = useState<CourierPosition | null>(null);
  const isCancelled = order.status === 5;
  const isDelivered = order.status === 4;
  const isInTransit = order.status === 3;

  // Listen for courier location updates for this specific order
  useEffect(() => {
    if (!isInTransit) return;
    const handler = (data: { orderId: string; lat: number; lng: number }) => {
      if (data.orderId === order.id) setCourierPosition({ lat: data.lat, lng: data.lng });
    };
    ordersConnection.on("CourierLocationUpdated", handler);
    return () => { ordersConnection.off("CourierLocationUpdated", handler); };
  }, [order.id, isInTransit]);

  return (
    <div className="overflow-hidden rounded-3xl border border-line-subtle bg-surface shadow-sm">
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
          <div className="flex items-center gap-1.5 text-xs text-muted">
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
          <div className="mt-3 space-y-4 border-t border-subtle-2 pt-3">
            {/* ITEMS */}
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-subtle p-3">
                  <img
                    src={getProductImageUrl(item.imageUrl)}
                    alt={item.productName}
                    className="h-14 w-14 rounded-xl object-cover bg-surface shrink-0"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-content line-clamp-1">{item.productName}</h3>
                    <p className="text-xs text-muted">{item.quantity}× {formatBRL(item.unitPrice)}</p>
                  </div>
                  <span className="text-sm font-black text-[#16a34a] shrink-0">
                    {formatBRL(item.totalPrice)}
                  </span>
                </div>
              ))}
            </div>

            {/* MAPA (status >= Saindo) */}
            {(isInTransit || isDelivered) && (
              <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-subtle-2" />}>
                <MapTrack
                  deliveryAddress={order.deliveryAddress}
                  deliveryNumber={order.deliveryNumber}
                  deliveryNeighborhood={order.deliveryNeighborhood}
                  courierPosition={courierPosition}
                />
              </Suspense>
            )}

            {/* ENDEREÇO */}
            {!isInTransit && !isDelivered && (
              <div className="rounded-2xl border border-line bg-subtle px-4 py-3">
                <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-faint">Entrega</p>
                <p className="text-sm font-black text-content">
                  {order.deliveryAddress}, {order.deliveryNumber}
                  {order.deliveryComplement ? ` — ${order.deliveryComplement}` : ""}
                </p>
                <p className="text-xs text-muted">{order.deliveryNeighborhood}</p>
              </div>
            )}

            {/* TOTAIS + PAGAMENTO */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted">
                <span>Subtotal</span>
                <strong>{formatBRL(order.subtotal)}</strong>
              </div>
              <div className="flex justify-between text-xs text-muted">
                <span>Entrega</span>
                <strong>
                  {Number(order.deliveryFee) === 0 ? "Grátis" : formatBRL(order.deliveryFee)}
                </strong>
              </div>
              <div className="flex justify-between text-xs text-muted">
                <span>Pagamento</span>
                <strong>{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</strong>
              </div>
              <div className="flex justify-between border-t border-subtle-2 pt-1.5">
                <span className="text-sm font-black text-content">Total</span>
                <span className="text-base font-black text-[#16a34a]">{formatBRL(order.total)}</span>
              </div>
            </div>

            {/* AVALIAÇÃO (só após entrega) */}
            {isDelivered && (
              <RatingSection
                orderId={order.id}
                firstStoreProductId={order.items[0]?.storeProductId}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
