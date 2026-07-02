import { useEffect, useState } from "react";
import {
  ArrowLeft, Bike, CheckCircle2, CircleDollarSign, Clock3, Loader2, MapPin, Navigation,
  Phone, Package, TrendingUp, Wallet, RefreshCw, AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

import {
  getAvailableDeliveries, acceptDelivery, getMyDeliveries, updateDeliveryStatus,
  getCourierEarningsSummary, updateCourierLocation, queryKeys,
  type AvailableDelivery, type Delivery,
} from "../services/gizApi";
import { useMyWallet } from "../hooks/useWallet";
import {
  requestWithdrawal, getMyWithdrawals as getPaymentWithdrawals, paymentQueryKeys,
} from "../services/paymentApi";
import type { PixKeyType } from "../types/payment";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import { useToastStore } from "../stores/toastStore";
import { usePageMeta } from "../hooks/usePageMeta";
import { formatBRL, fmtCPF, fmtCNPJ, validateCPF, validateCNPJ } from "../utils/format";

type Tab = "available" | "active" | "earnings";

const PIX_KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: "cpf",    label: "CPF" },
  { value: "cnpj",   label: "CNPJ" },
  { value: "email",  label: "E-mail" },
  { value: "phone",  label: "Celular" },
  { value: "random", label: "Aleatória" },
];

function applyPixKeyMask(value: string, type: PixKeyType): string {
  if (type === "cpf")  return fmtCPF(value);
  if (type === "cnpj") return fmtCNPJ(value);
  return value;
}

function validatePixKey(value: string, type: PixKeyType): string | null {
  if (type === "cpf"  && value && !validateCPF(value))  return "CPF inválido.";
  if (type === "cnpj" && value && !validateCNPJ(value)) return "CNPJ inválido.";
  return null;
}

// ── Helpers ────────────────────────────────────────────────────

function mapsLink(address: string, number: string, neighborhood: string) {
  const q = encodeURIComponent(`${address}, ${number}, ${neighborhood}`);
  return `https://maps.google.com/maps?q=${q}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1)  return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

// ── DeliveryCard (disponíveis) ─────────────────────────────────

function AvailableCard({
  delivery, onAccept, loading,
}: { delivery: AvailableDelivery; onAccept: () => void; loading: boolean }) {
  return (
    <div className="rounded-3xl border border-line-subtle bg-surface shadow-sm overflow-hidden">
      {/* Cabeçalho da loja */}
      <div className="flex items-center gap-3 border-b border-subtle-2 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#16a34a]/10">
          <Package size={18} className="text-[#16a34a]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-faint">Retirar em</p>
          <p className="truncate font-black text-content">{delivery.storeName}</p>
          {delivery.storeAddress && (
            <p className="truncate text-xs text-muted">{delivery.storeAddress}</p>
          )}
        </div>
        <span className="shrink-0 text-[10px] font-bold text-faint">{timeAgo(delivery.createdAt)}</span>
      </div>

      {/* Endereço de entrega */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#2563eb]/10">
          <MapPin size={18} className="text-[#2563eb]" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-faint">Entregar em</p>
          <p className="font-black text-content">
            {delivery.deliveryAddress}, {delivery.deliveryNumber}
          </p>
          <p className="text-xs text-muted">{delivery.deliveryNeighborhood}</p>
        </div>
      </div>

      {/* Resumo financeiro */}
      <div className="flex items-center justify-between border-t border-subtle-2 bg-subtle px-4 py-3">
        <div>
          <p className="text-xs text-muted">Pedido</p>
          <p className="text-sm font-black text-content">{formatBRL(delivery.total)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted">Taxa entrega</p>
          <p className="text-sm font-black text-content">
            {delivery.deliveryFee === 0 ? "—" : formatBRL(delivery.deliveryFee)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Seus ganhos (90%)</p>
          <p className="text-base font-black text-[#16a34a]">{formatBRL(delivery.courierEarnings)}</p>
        </div>
      </div>

      {/* Botão de aceitar */}
      <div className="p-4 pt-0">
        <button
          onClick={onAccept}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 6px 20px rgba(22,163,74,0.35)" }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Bike size={16} />}
          {loading ? "Aceitando…" : "Aceitar entrega"}
        </button>
      </div>
    </div>
  );
}

// ── ActiveDeliveryCard ─────────────────────────────────────────

function ActiveDeliveryPanel({
  delivery, onPickUp, onDeliver, loading,
}: {
  delivery: Delivery;
  onPickUp: () => void;
  onDeliver: () => void;
  loading: boolean;
}) {
  const order = delivery.order;

  const statusSteps = [
    { key: "ACCEPTED",  label: "Aceito",     done: true },
    { key: "PICKED_UP", label: "Retirado",   done: delivery.status === "PICKED_UP" || delivery.status === "DELIVERED" },
    { key: "DELIVERED", label: "Entregue",   done: delivery.status === "DELIVERED" },
  ];

  return (
    <div className="space-y-4">
      {/* Progress stepper */}
      <div className="flex items-center justify-between rounded-3xl border border-line-subtle bg-surface p-4 shadow-sm">
        {statusSteps.map((step, i) => (
          <div key={step.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                step.done ? "border-[#16a34a] bg-[#16a34a]" : "border-line bg-surface"
              }`}>
                {step.done
                  ? <CheckCircle2 size={16} className="text-white" />
                  : <span className="text-[10px] font-black text-faint">{i + 1}</span>
                }
              </div>
              <p className={`text-[10px] font-black ${step.done ? "text-[#16a34a]" : "text-faint"}`}>
                {step.label}
              </p>
            </div>
            {i < statusSteps.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 rounded-full ${step.done ? "bg-[#16a34a]" : "bg-[#e2e8f0]"}`} />
            )}
          </div>
        ))}
      </div>

      {order && (
        <>
          {/* Retirada (loja) */}
          <div className="rounded-3xl border border-line-subtle bg-surface p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Package size={15} className="text-[#16a34a]" />
              <p className="text-[10px] font-black uppercase tracking-widest text-faint">Retirar na loja</p>
            </div>
            <div>
              <p className="font-black text-content">{order.storeName ?? "Loja"}</p>
              {order.storeAddress && <p className="text-xs text-muted">{order.storeAddress}</p>}
            </div>

            {/* Itens do pedido */}
            <div className="rounded-2xl bg-subtle p-3 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-faint mb-2">Itens do pedido</p>
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-xs">
                  <span className="text-content">{item.quantity}× {item.productName}</span>
                  <span className="font-bold text-content">{formatBRL(item.totalPrice)}</span>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t border-line pt-2 text-xs font-black text-content">
                <span>Total</span>
                <span>{formatBRL(order.total)}</span>
              </div>
            </div>

            {order.storeAddress && (
              <a
                href={mapsLink(order.storeAddress, "", order.storeNeighborhood ?? "")}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl border border-[#16a34a]/30 bg-[#f0fdf4] py-2.5 text-sm font-black text-[#16a34a]"
              >
                <Navigation size={15} /> Navegar até a loja
              </a>
            )}
          </div>

          {/* Entrega (cliente) */}
          <div className="rounded-3xl border border-line-subtle bg-surface p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-[#2563eb]" />
              <p className="text-[10px] font-black uppercase tracking-widest text-faint">Entregar ao cliente</p>
            </div>
            <div>
              <p className="font-black text-content">
                {order.deliveryAddress}, {order.deliveryNumber}
                {order.deliveryComplement ? ` — ${order.deliveryComplement}` : ""}
              </p>
              <p className="text-sm text-muted">{order.deliveryNeighborhood}</p>
            </div>

            <div className="flex items-center gap-2 rounded-2xl bg-subtle px-3 py-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#16a34a]/10">
                <span className="text-sm">👤</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-content">{order.customerName}</p>
                <p className="text-xs text-muted">{order.customerPhone}</p>
              </div>
              <a
                href={`tel:${order.customerPhone.replace(/\D/g, "")}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#16a34a] text-white"
              >
                <Phone size={14} />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={mapsLink(order.deliveryAddress, order.deliveryNumber, order.deliveryNeighborhood)}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl border border-[#2563eb]/30 bg-[#eff6ff] py-2.5 text-sm font-black text-[#2563eb]"
              >
                <Navigation size={15} /> Navegar
              </a>
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-subtle border border-line px-3 py-2.5">
                <p className="text-xs font-black text-[#16a34a]">+{formatBRL(delivery.earnings)}</p>
                <p className="text-[10px] text-faint">seus ganhos</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Botões de ação */}
      {delivery.status === "ACCEPTED" && (
        <button
          onClick={onPickUp}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #f59e0b, #b45309)", boxShadow: "0 6px 20px rgba(245,158,11,0.35)" }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
          {loading ? "Atualizando…" : "Peguei o pedido na loja"}
        </button>
      )}

      {delivery.status === "PICKED_UP" && (
        <button
          onClick={onDeliver}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 6px 20px rgba(22,163,74,0.35)" }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {loading ? "Finalizando…" : "Entreguei o pedido! 🎉"}
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COURIER PAGE
// ══════════════════════════════════════════════════════════════

export default function CourierPage() {
  usePageMeta({ title: "Painel do Entregador" });
  const navigate    = useNavigate();
  const user        = useAuthStore((s) => s.user);
  const showToast   = useToastStore((s) => s.show);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("available");
  const [isOnline, setIsOnline]   = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pixKey, setPixKey]         = useState("");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("cpf");
  const [pixKeyError, setPixKeyError] = useState<string | null>(null);

  // Redireciona se não é entregador
  useEffect(() => {
    if (user && user.role !== "Courier" && user.role !== "Admin") navigate("/", { replace: true });
  }, [user, navigate]);

  // Garante que ao sair da página o entregador fica offline (evita estado fantasma no localStorage)
  useEffect(() => {
    return () => { /* intencional: não persiste isOnline — sempre começa offline */ };
  }, []);

  // ── Queries ───────────────────────────────────────────────

  const { wallet, isLoading: walletLoading, refetch: refetchWallet } = useMyWallet();

  const { data: available = [], isLoading: loadingAvailable, refetch: refetchAvailable } = useQuery({
    queryKey: queryKeys.availableDeliveries(),
    queryFn:  getAvailableDeliveries,
    enabled:  isOnline && !!user,
    refetchInterval: isOnline ? 15_000 : false,
  });

  const { data: myDeliveries = [] } = useQuery({
    queryKey: queryKeys.myDeliveries(),
    queryFn:  getMyDeliveries,
    enabled:  !!user,
    refetchInterval: 20_000,
  });

  const { data: earnings } = useQuery({
    queryKey: queryKeys.courierEarnings(),
    queryFn:  getCourierEarningsSummary,
    enabled:  !!user,
  });

  const { data: withdrawals = [], refetch: refetchWithdrawals } = useQuery({
    queryKey: paymentQueryKeys.myWithdrawals(),
    queryFn:  getPaymentWithdrawals,
    enabled:  !!user,
  });

  const activeDelivery = myDeliveries.find((d) => d.status === "ACCEPTED" || d.status === "PICKED_UP") ?? null;
  const historyDeliveries = myDeliveries.filter((d) => d.status === "DELIVERED");

  // Auto-troca para aba ativa se há entrega em andamento
  useEffect(() => {
    if (activeDelivery && activeTab === "available") setActiveTab("active");
  }, [activeDelivery]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GPS tracking quando há entrega ativa ──────────────────
  useEffect(() => {
    if (!activeDelivery || !user) return;
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => updateCourierLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.heading ?? undefined).catch(() => null),
      null,
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 8_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [activeDelivery?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-time: novos pedidos disponíveis ──────────────────
  useEffect(() => {
    if (!isOnline || !user) return;
    const ch = supabase
      .channel("courier-available")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: "status=eq.2" }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.availableDeliveries() });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isOnline, user?.id, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations ────────────────────────────────────────────

  const acceptMutation = useMutation({
    mutationFn: ({ orderId }: { orderId: string }) =>
      acceptDelivery(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.availableDeliveries() });
      queryClient.invalidateQueries({ queryKey: queryKeys.myDeliveries() });
      setActiveTab("active");
      showToast("Entrega aceita! Dirija-se à loja. 🛵", "success");
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Erro ao aceitar.", "error"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "PICKED_UP" | "DELIVERED" | "CANCELLED" }) =>
      updateDeliveryStatus(id, status),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myDeliveries() });
      if (vars.status === "DELIVERED") {
        queryClient.invalidateQueries({ queryKey: queryKeys.courierEarnings() });
        setActiveTab("earnings");
        showToast(`Entrega concluída! +${formatBRL(activeDelivery?.earnings ?? 0)} 🎉`, "success");
      }
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Erro.", "error"),
  });

  const withdrawMutation = useMutation({
    mutationFn: () => requestWithdrawal({
      amount:      Number(withdrawAmount.replace(",", ".")),
      pixKey:      pixKey.trim(),
      pixKeyType,
    }),
    onSuccess: () => {
      setWithdrawAmount(""); setPixKey(""); setPixKeyError(null);
      refetchWithdrawals(); refetchWallet();
      showToast("Saque solicitado! Processaremos em até 24h úteis.", "success");
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Erro ao solicitar saque.", "error"),
  });


  if (!user) return null;

  const tabs = [
    { key: "available" as Tab, label: "Disponíveis", icon: <Bike size={16} />,       badge: isOnline ? available.length : 0 },
    { key: "active" as Tab,    label: "Ativa",        icon: <Navigation size={16} />, badge: activeDelivery ? 1 : 0 },
    { key: "earnings" as Tab,  label: "Ganhos",       icon: <Wallet size={16} /> },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a]">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">BrasUX</p>
          <h1 className="text-xl font-black text-content">Painel do Entregador</h1>
        </div>
        {/* Online/Offline toggle */}
        <button
          onClick={() => setIsOnline((v) => !v)}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition-all ${
            isOnline
              ? "bg-[#16a34a] text-white shadow-lg shadow-[#16a34a]/30"
              : "border border-line bg-surface text-muted"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-surface animate-pulse" : "bg-faint"}`} />
          {isOnline ? "Online" : "Offline"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-line-subtle bg-subtle p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition-all ${
              activeTab === t.key ? "bg-surface text-content shadow-sm" : "text-muted"
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            {t.badge !== undefined && t.badge > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#16a34a] text-[9px] font-black text-white">
                {t.badge > 9 ? "9+" : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Disponíveis ─────────────────────────────────── */}
      {activeTab === "available" && (
        <div className="space-y-4">
          {!isOnline ? (
            <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-line bg-surface p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-subtle-2">
                <Bike size={28} className="text-faint" />
              </div>
              <div>
                <p className="font-black text-content">Você está offline</p>
                <p className="mt-1 text-sm text-muted">Ative o modo online para receber entregas.</p>
              </div>
              <button
                onClick={() => setIsOnline(true)}
                className="rounded-2xl bg-[#16a34a] px-8 py-3 text-sm font-black text-white shadow-lg shadow-[#16a34a]/30"
              >
                Ficar online 🟢
              </button>
            </div>
          ) : loadingAvailable ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-[#16a34a]" />
            </div>
          ) : available.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-line-subtle bg-surface p-12 text-center shadow-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#f0fdf4]">
                <Clock3 size={28} className="text-[#16a34a]" />
              </div>
              <div>
                <p className="font-black text-content">Nenhuma entrega disponível</p>
                <p className="mt-1 text-sm text-muted">Aguarde — novos pedidos aparecem aqui automaticamente.</p>
              </div>
              <button
                onClick={() => refetchAvailable()}
                className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-bold text-muted"
              >
                <RefreshCw size={14} /> Atualizar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-muted">
                  {available.length} entrega{available.length !== 1 ? "s" : ""} disponível
                  {available.length !== 1 ? "ais" : ""}
                </p>
                <button onClick={() => refetchAvailable()} className="text-[#16a34a]">
                  <RefreshCw size={15} />
                </button>
              </div>
              {available.map((d) => (
                <AvailableCard
                  key={d.orderId}
                  delivery={d}
                  loading={acceptMutation.isPending && acceptMutation.variables?.orderId === d.orderId}
                  onAccept={() => acceptMutation.mutate({ orderId: d.orderId })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Entrega Ativa ───────────────────────────────── */}
      {activeTab === "active" && (
        <div className="space-y-4">
          {!activeDelivery ? (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-line-subtle bg-surface p-12 text-center shadow-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#f0fdf4]">
                <Navigation size={28} className="text-[#16a34a]" />
              </div>
              <div>
                <p className="font-black text-content">Nenhuma entrega ativa</p>
                <p className="mt-1 text-sm text-muted">Aceite uma entrega na aba "Disponíveis".</p>
              </div>
              <button
                onClick={() => setActiveTab("available")}
                className="rounded-2xl bg-[#16a34a] px-6 py-3 text-sm font-black text-white"
              >
                Ver disponíveis
              </button>
            </div>
          ) : (
            <ActiveDeliveryPanel
              delivery={activeDelivery}
              loading={statusMutation.isPending}
              onPickUp={() => statusMutation.mutate({ id: activeDelivery.id, status: "PICKED_UP" })}
              onDeliver={() => statusMutation.mutate({ id: activeDelivery.id, status: "DELIVERED" })}
            />
          )}
        </div>
      )}

      {/* ── Tab: Ganhos ──────────────────────────────────────── */}
      {activeTab === "earnings" && (
        <div className="space-y-5">
          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Hoje",        value: formatBRL(earnings?.todayTotal   ?? 0), icon: "☀️" },
              { label: "7 dias",      value: formatBRL(earnings?.weekTotal    ?? 0), icon: "📅" },
              { label: "Total geral", value: formatBRL(earnings?.allTimeTotal ?? 0), icon: "💰" },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl border border-line-subtle bg-surface p-3 text-center shadow-sm">
                <p className="text-lg">{m.icon}</p>
                <p className="mt-1 text-base font-black text-content">{m.value}</p>
                <p className="text-[10px] text-faint">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Histórico de entregas */}
          {historyDeliveries.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-faint">
                Histórico de entregas
              </p>
              <div className="space-y-2">
                {historyDeliveries.slice(0, 10).map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-2xl border border-line-subtle bg-surface p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-50">
                        <CheckCircle2 size={16} className="text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-content">
                          #{d.orderId.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-[10px] text-faint">{timeAgo(d.deliveredAt ?? d.createdAt)}</p>
                      </div>
                    </div>
                    <p className="text-sm font-black text-[#16a34a]">+{formatBRL(d.earnings)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saldo da carteira */}
          {!walletLoading && wallet && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-line-subtle bg-surface p-4 shadow-sm">
                <div className="flex items-center gap-1.5 mb-2">
                  <CircleDollarSign size={13} className="text-[#16a34a]" />
                  <p className="text-[10px] font-black uppercase tracking-wide text-faint">Disponível</p>
                </div>
                <p className="text-xl font-black text-content">{formatBRL(wallet.balance.available)}</p>
              </div>
              <div className="rounded-2xl border border-line-subtle bg-surface p-4 shadow-sm">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock3 size={13} className="text-yellow-500" />
                  <p className="text-[10px] font-black uppercase tracking-wide text-faint">Retido</p>
                </div>
                <p className="text-xl font-black text-yellow-600">{formatBRL(wallet.balance.held)}</p>
              </div>
            </div>
          )}

          {/* Solicitar saque */}
          <div className="rounded-3xl border border-line-subtle bg-surface p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-[#16a34a]" />
              <h2 className="font-black text-content">Solicitar saque Pix</h2>
              {wallet && (
                <span className="ml-auto text-xs text-muted">
                  Disponível: <strong className="text-content">{formatBRL(wallet.balance.available)}</strong>
                </span>
              )}
            </div>

            <div>
              <label className={lbl}>Tipo de chave Pix</label>
              <select
                value={pixKeyType}
                onChange={(e) => {
                  setPixKeyType(e.target.value as PixKeyType);
                  setPixKey(""); setPixKeyError(null);
                }}
                className={inp}
              >
                {PIX_KEY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={lbl}>
                Chave Pix — {PIX_KEY_TYPES.find((t) => t.value === pixKeyType)?.label}
              </label>
              <input
                value={pixKey}
                onChange={(e) => {
                  const masked = applyPixKeyMask(e.target.value, pixKeyType);
                  setPixKey(masked);
                  setPixKeyError(validatePixKey(masked, pixKeyType));
                }}
                onBlur={() => setPixKeyError(validatePixKey(pixKey, pixKeyType))}
                placeholder={
                  pixKeyType === "cpf"    ? "000.000.000-00"     :
                  pixKeyType === "cnpj"   ? "00.000.000/0000-00" :
                  pixKeyType === "email"  ? "seu@email.com"      :
                  pixKeyType === "phone"  ? "+55 (00) 00000-0000":
                  "Chave aleatória (UUID)"
                }
                className={`${inp} ${pixKeyError ? "ring-2 ring-red-400/40 border-red-300" : ""}`}
              />
              {pixKeyError && <p className="mt-1 text-xs text-red-500">{pixKeyError}</p>}
            </div>

            <div>
              <label className={lbl}>Valor (R$) — mínimo R$ 10,00</label>
              <input
                type="number"
                min="10"
                step="0.01"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Ex: 50,00"
                className={inp}
              />
              {wallet && Number(withdrawAmount) > wallet.balance.available && (
                <p className="mt-1 text-xs text-red-500">
                  Valor acima do saldo disponível ({formatBRL(wallet.balance.available)}).
                </p>
              )}
            </div>

            <button
              onClick={() => withdrawMutation.mutate()}
              disabled={
                withdrawMutation.isPending || walletLoading ||
                !withdrawAmount || !pixKey.trim() || !!pixKeyError ||
                Number(withdrawAmount) < 10 ||
                Number(withdrawAmount) > (wallet?.balance.available ?? 0)
              }
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
            >
              {withdrawMutation.isPending
                ? <><Loader2 size={15} className="animate-spin" /> Solicitando…</>
                : <><Wallet size={15} /> Solicitar saque</>
              }
            </button>
          </div>

          {/* Histórico de saques */}
          {withdrawals.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-faint">
                Saques solicitados
              </p>
              <div className="space-y-2">
                {withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-2xl border border-line-subtle bg-surface p-3">
                    <div>
                      <p className="text-xs font-black text-content">{formatBRL(w.amountGross)}</p>
                      <p className="text-[10px] text-faint">{w.pixKey} · {timeAgo(w.createdAt)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                      w.status === "paid"       ? "bg-green-50 text-green-700" :
                      w.status === "failed"     ? "bg-red-50 text-red-600"    :
                      w.status === "processing" ? "bg-blue-50 text-blue-700"  :
                      "bg-yellow-50 text-yellow-700"
                    }`}>
                      {w.status === "paid" ? "Pago" : w.status === "failed" ? "Recusado" : w.status === "processing" ? "Processando" : "Pendente"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {earnings?.deliveriesCount === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-line bg-surface p-10 text-center">
              <AlertCircle size={28} className="text-[#cbd5e1]" />
              <p className="font-black text-content">Nenhuma entrega concluída ainda</p>
              <p className="text-sm text-muted">Complete entregas para ver seus ganhos aqui.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inp = "w-full rounded-xl bg-subtle border border-line px-4 py-3 text-sm font-semibold text-content outline-none focus:ring-2 focus:ring-[#16a34a]/30 placeholder:text-[#cbd5e1]";
const lbl = "mb-1.5 block text-[10px] font-black uppercase tracking-wide text-faint";
