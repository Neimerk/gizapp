import {
  ArrowLeft, CheckCircle2, CreditCard, Loader2, MapPin,
  Plus, ReceiptText, ShoppingBag, Star, Tag, Trash2, User, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  createOrder, getStoreById, getAvailableCoupons,
  queryKeys, type PublicCoupon,
} from "../services/gizApi";
import { useDeliveryFee } from "../hooks/useDeliveryFee";
import {
  createPixCharge, createCardCharge, createBoletoCharge, notifyOrderPlaced,
  pollPixStatus, pollPaymentStatus,
  type PixResult, type CardResult, type BoletoResult,
} from "../services/asaasApi";
import { useCartStore } from "../stores/cartStore";
import { usePointsStore } from "../stores/pointsStore";
import { useToastStore } from "../stores/toastStore";
import { getAuth } from "../services/auth";
import { createGuestSession, getGuestToken } from "../services/guestSession";
import { useCepLookup } from "../hooks/useCepLookup";
import { useSavedAddresses, type SavedAddress } from "../hooks/useSavedAddresses";
import { useCoupon } from "../hooks/useCoupon";
import { formatBRL } from "../utils/format";
import { PostPurchaseModal } from "../components/checkout/PostPurchaseModal";

// ── Tipos ──────────────────────────────────────────────────────

type TrackingInfo = { trackingCode?: string };

type PaymentMethod = "pix" | "card" | "boleto";

type CardData = {
  number: string;
  name: string;
  expiration: string;
  cvv: string;
  cpf: string;
};

type PaymentResult =
  | ({ method: "pix";    orderId: string } & Omit<PixResult, "chargeId">)
  | ({ method: "boleto"; orderId: string } & Omit<BoletoResult, "chargeId">)
  | ({ method: "card";   orderId: string; confirmed: boolean; error?: string });

type WizardStep = 1 | 2 | 3;

// ── Constantes / helpers ────────────────────────────────────────

const CHECKOUT_KEY = "brasux-checkout";
const ORDERS_KEY   = "brasux-orders";
const EMPTY_CARD: CardData = { number: "", name: "", expiration: "", cvv: "", cpf: "" };
const EMPTY_ADDR: Omit<SavedAddress, "id"> = {
  label: "", phone: "", cep: "", address: "", number: "", complement: "", neighborhood: "", city: "",
};

const num    = (v: string) => v.replace(/\D/g, "");
const fmtCard = (v: string) => num(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
const fmtExp  = (v: string) => num(v).slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2");
const fmtCVV  = (v: string) => num(v).slice(0, 4);
const fmtPhone = (v: string) =>
  num(v).slice(0, 11).replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
const fmtCEP = (v: string) => num(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
const fmtCPF = (v: string) => {
  const n = num(v).slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
};

function loadCheckout() {
  try { return JSON.parse(localStorage.getItem(CHECKOUT_KEY) ?? "{}"); } catch { return {}; }
}

function getSavedOrderIds(): string[] {
  try {
    const p = JSON.parse(localStorage.getItem(ORDERS_KEY) ?? "[]");
    return Array.isArray(p) ? p.filter((i: unknown) => typeof i === "string") : [];
  } catch { return []; }
}

function saveOrderId(id?: string) {
  if (!id) throw new Error("Pedido sem ID.");
  const saved = getSavedOrderIds();
  localStorage.setItem(ORDERS_KEY, JSON.stringify([id, ...saved.filter((x) => x !== id)]));
}

// ── StepIndicator ───────────────────────────────────────────────

function StepIndicator({ step }: { step: WizardStep }) {
  const steps = ["Endereço", "Pagamento", "Revisão"];
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1.5">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black transition-colors ${
            i + 1 < step
              ? "bg-[#16a34a] text-white"
              : i + 1 === step
              ? "bg-[#0f172a] text-white"
              : "bg-subtle-2 text-faint"
          }`}>
            {i + 1 < step ? "✓" : i + 1}
          </div>
          <span className={`hidden sm:block text-[10px] font-bold transition-colors ${
            i + 1 === step ? "text-content" : "text-faint"
          }`}>
            {s}
          </span>
          {i < steps.length - 1 && (
            <div className={`h-0.5 w-5 rounded-full transition-colors ${i + 1 < step ? "bg-[#16a34a]" : "bg-[#e2e8f0]"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────

export default function CheckoutPage() {
  const navigate = useNavigate();
  const items        = useCartStore((s) => s.items);
  const clearCart    = useCartStore((s) => s.clearCart);
  const totalItems   = useCartStore((s) => s.totalItems());
  const subtotal     = useCartStore((s) => s.totalPrice());
  const auth         = getAuth();

  const [guestInfo, setGuestInfo] = useState({ name: "", phone: "", email: "" });
  const [guestToken, setGuestToken] = useState<string | null>(() => getGuestToken());
  const [showPostPurchaseModal, setShowPostPurchaseModal] = useState(false);
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo>({});
  const guestReady = !!auth || guestInfo.name.trim().length >= 2;

  const storeId = items[0]?.storeId ?? "";
  const { data: store } = useQuery({
    queryKey: queryKeys.store(storeId),
    queryFn:  () => getStoreById(storeId),
    enabled:  !!storeId,
  });

  const { data: availableCoupons = [] } = useQuery({
    queryKey: queryKeys.availableCoupons(),
    queryFn: getAvailableCoupons,
    staleTime: 5 * 60 * 1000,
  });

  // Wizard step
  const [step, setStep] = useState<WizardStep>(1);

  // Endereços salvos
  const { addresses, save: saveAddress, remove: removeAddress } = useSavedAddresses();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    () => addresses[0]?.id ?? null,
  );
  const [showAddressForm, setShowAddressForm] = useState(addresses.length === 0);
  const [newAddr, setNewAddr] = useState<Omit<SavedAddress, "id">>(EMPTY_ADDR);
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;

  useEffect(() => {
    if (!selectedAddressId && addresses.length > 0) {
      setSelectedAddressId(addresses[0].id);
      setShowAddressForm(false);
    }
  }, [addresses, selectedAddressId]);

  // Cupom
  const { coupon, error: couponError, applying: applyingCoupon, apply: applyCoupon, remove: removeCoupon, discount } = useCoupon(storeId);
  const [couponInput, setCouponInput] = useState("");

  // Pontos
  const loadPointsFromDB = usePointsStore((s) => s.loadFromDB);
  const availablePoints = usePointsStore((s) => s.points);
  const [pointsToUse, setPointsToUse] = useState(0);

  // Pagamento
  const saved = loadCheckout();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    (["card", "boleto"].includes(saved.paymentMethod) ? saved.paymentMethod : "pix") as PaymentMethod,
  );
  const [card, setCard] = useState<CardData>(EMPTY_CARD);

  // Estado pós-confirmação
  const [saving, setSaving] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [pixConfirmed, setPixConfirmed] = useState(false);
  const [boletoConfirmed, setBoletoConfirmed] = useState(false);

  // Taxa de entrega dinâmica por distância
  const { fee: deliveryFee, distanceKm, loading: loadingFee, source: feeSource } = useDeliveryFee(
    store,
    {
      neighborhood: selectedAddress?.neighborhood,
      city:         selectedAddress?.city,
      cep:          selectedAddress?.cep,
    },
  );
  const discountAmount  = discount(subtotal, deliveryFee);
  const afterCoupon     = subtotal + deliveryFee - discountAmount;
  const maxPoints       = Math.min(availablePoints, Math.floor(afterCoupon));
  const pointsDiscount  = Math.min(pointsToUse, maxPoints);
  const total           = Math.max(0, afterCoupon - pointsDiscount);

  const hasFullAddress = !!(
    selectedAddress?.address && selectedAddress?.number && selectedAddress?.neighborhood
  );

  const cardValid =
    paymentMethod !== "card" || (
      num(card.number).length === 16 &&
      card.name.trim().length > 0 &&
      num(card.expiration).length === 4 &&
      num(card.cvv).length >= 3 &&
      num(card.cpf).length === 11
    );

  useEffect(() => {
    localStorage.setItem(CHECKOUT_KEY, JSON.stringify({ paymentMethod }));
  }, [paymentMethod]);

  // Polling de confirmação Pix — verifica a cada 5s por até 35 minutos (PIX expira em 30)
  useEffect(() => {
    if (!paymentResult || paymentResult.method !== "pix") return;
    const orderId = paymentResult.orderId;
    const gt = auth ? undefined : guestToken ?? undefined;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      try {
        const { status } = await pollPixStatus(orderId, gt);
        if (status === "paid") {
          stopped = true;
          if (auth) loadPointsFromDB().catch(() => null);
          setPixConfirmed(true);
        }
      } catch { /* silencioso */ }
    };

    const timer    = setInterval(poll, 5000);
    const timeout  = setTimeout(() => { stopped = true; clearInterval(timer); }, 35 * 60 * 1000);
    poll();
    return () => { stopped = true; clearInterval(timer); clearTimeout(timeout); };
  }, [paymentResult?.orderId, paymentResult?.method]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling de confirmação Boleto — verifica a cada 30s por até 10 minutos.
  // Cobre pagamentos imediatos em bancos que processam em tempo real.
  // Compensações que levam dias serão notificadas via webhook (e-mail + orders).
  useEffect(() => {
    if (!paymentResult || paymentResult.method !== "boleto") return;
    const orderId = paymentResult.orderId;
    const gt = auth ? undefined : guestToken ?? undefined;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      try {
        const status = await pollPaymentStatus(orderId, gt);
        if (status === "paid") {
          stopped = true;
          if (auth) loadPointsFromDB().catch(() => null);
          setBoletoConfirmed(true);
        }
      } catch { /* silencioso */ }
    };

    const timer   = setInterval(poll, 30_000);
    const timeout = setTimeout(() => { stopped = true; clearInterval(timer); }, 10 * 60 * 1000);
    poll();
    return () => { stopped = true; clearInterval(timer); clearTimeout(timeout); };
  }, [paymentResult?.orderId, paymentResult?.method]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateCard(k: keyof CardData, v: string) {
    setCard((c) => ({ ...c, [k]: v }));
  }

  async function handleSaveAddress() {
    if (!newAddr.address || !newAddr.number || !newAddr.neighborhood) return;
    const saved = await saveAddress({ ...newAddr, label: newAddr.label || "Endereço" });
    setSelectedAddressId(saved.id);
    setNewAddr(EMPTY_ADDR);
    setShowAddressForm(false);
  }

  async function handleFinish() {
    if (auth && auth.role !== "Customer" && auth.role !== "Admin") {
      useToastStore.getState().show("Use uma conta de cliente para finalizar pedidos.");
      return;
    }
    if (!auth && !guestInfo.name.trim()) {
      useToastStore.getState().show("Informe seu nome para continuar.");
      return;
    }
    if (!selectedAddress) { useToastStore.getState().show("Selecione um endereço de entrega."); return; }
    if (!cardValid)        { useToastStore.getState().show("Preencha todos os dados do cartão."); return; }

    try {
      setSaving(true);

      const order = await createOrder(
        {
          storeId,
          customerName:         auth?.name ?? guestInfo.name.trim(),
          customerPhone:        selectedAddress.phone || guestInfo.phone || "—",
          customerEmail:        (auth?.email ?? guestInfo.email.trim()) || undefined,
          deliveryAddress:      selectedAddress.address,
          deliveryNumber:       selectedAddress.number,
          deliveryComplement:   selectedAddress.complement,
          deliveryNeighborhood: selectedAddress.neighborhood,
          paymentMethod,
          items: items.map((i) => ({ storeProductId: i.storeProductId, quantity: i.quantity })),
          deliveryFeeOverride:  feeSource === "distance" ? deliveryFee : undefined,
          couponCode:     coupon?.code,
          pointsDiscount: pointsDiscount > 0 ? pointsDiscount : undefined,
        },
        { guestToken: auth ? undefined : guestToken ?? undefined },
      );

      saveOrderId(order.id);
      notifyOrderPlaced(order.id, auth ? undefined : guestToken);

      // Pontos debitados server-side via spend_points_for_order no webhook de confirmação
      // Não debitar aqui para evitar saldo desatualizado se o pagamento falhar.

      const gt = auth ? undefined : guestToken ?? undefined;
      if (!auth && order.trackingCode) setTrackingInfo({ trackingCode: order.trackingCode });

      if (paymentMethod === "pix") {
        const result: PixResult = await createPixCharge(order.id, gt);
        clearCart();
        removeCoupon();
        setPaymentResult({
          method:         "pix",
          orderId:        order.id,
          paymentId:      result.paymentId,
          pixQrCodeImage: result.pixQrCodeImage,
          pixCode:        result.pixCode,
          expirationDate: result.expirationDate,
        });
        if (!auth) setShowPostPurchaseModal(true);
        return;
      }

      if (paymentMethod === "boleto") {
        const result: BoletoResult = await createBoletoCharge(order.id, gt);
        clearCart();
        removeCoupon();
        setPaymentResult({
          method:        "boleto",
          orderId:       order.id,
          paymentId:     result.paymentId,
          boletoUrl:     result.boletoUrl,
          boletoBarCode: result.boletoBarCode,
          dueDate:       result.dueDate,
        });
        if (!auth) setShowPostPurchaseModal(true);
        return;
      }

      if (paymentMethod === "card") {
        const expParts = num(card.expiration);
        const result: CardResult = await createCardCharge(
          order.id,
          {
            holderName:  card.name,
            number:      num(card.number),
            expiryMonth: expParts.slice(0, 2),
            expiryYear:  `20${expParts.slice(2, 4)}`,
            ccv:         card.cvv,
          },
          {
            name:          auth?.name ?? guestInfo.name.trim(),
            email:         auth?.email ?? guestInfo.email.trim(),
            cpfCnpj:       num(card.cpf),
            postalCode:    num(selectedAddress.cep),
            addressNumber: selectedAddress.number,
            phone:         num(selectedAddress.phone || guestInfo.phone),
          },
          gt,
        );

        clearCart();
        removeCoupon();
        if (result.confirmed) {
          // Pontos creditados server-side pelo webhook. Recarrega saldo local.
          if (auth) loadPointsFromDB().catch(() => null);
          setPaymentResult({ method: "card", orderId: order.id, confirmed: true });
        } else {
          setPaymentResult({
            method:    "card",
            orderId:   order.id,
            confirmed: false,
            error:     result.error ?? "Cartão recusado.",
          });
        }
        if (!auth) setShowPostPurchaseModal(true);
      }
    } catch (e) {
      useToastStore.getState().show(e instanceof Error ? e.message : "Erro ao finalizar pedido.");
    } finally {
      setSaving(false);
    }
  }

  // ── Tela de resultado ──────────────────────────────────────
  if (paymentResult) {
    return (
      <>
        <PaymentResultScreen
          result={paymentResult}
          onContinue={() => auth ? navigate("/pedidos") : navigate("/")}
          pixConfirmed={pixConfirmed}
          boletoConfirmed={boletoConfirmed}
          isGuest={!auth}
          trackingCode={trackingInfo.trackingCode}
        />
        {showPostPurchaseModal && !auth && (
          <PostPurchaseModal
            orderId={paymentResult.orderId}
            trackingCode={trackingInfo.trackingCode}
            defaultEmail={guestInfo.email.trim() || undefined}
            guestToken={guestToken ?? undefined}
            onClose={() => setShowPostPurchaseModal(false)}
          />
        )}
      </>
    );
  }

  // ── Carrinho vazio ─────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#16a34a]/10">
          <ShoppingBag size={40} className="text-[#16a34a]" />
        </div>
        <h2 className="mt-6 text-xl font-black text-content">Carrinho vazio</h2>
        <p className="mt-2 text-sm text-muted">Adicione produtos antes de continuar.</p>
        <Link to="/" className="mt-6 rounded-2xl bg-[#16a34a] px-6 py-3 text-sm font-black text-white">
          Explorar lojas
        </Link>
      </div>
    );
  }

  // ── Header compartilhado ───────────────────────────────────
  const header = (
    <div className="flex items-center gap-3">
      <button
        onClick={() => step > 1 ? setStep((s) => (s - 1) as WizardStep) : navigate(-1)}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a]"
      >
        <ArrowLeft size={18} className="text-white" />
      </button>
      <div className="flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">BrasUX</p>
        <h1 className="text-xl font-black text-content">Checkout</h1>
      </div>
      <StepIndicator step={step} />
    </div>
  );

  // ── Step 1: Endereço ───────────────────────────────────────
  if (step === 1) {
    return (
      <>
      <div className="space-y-4 pb-36 md:pb-0">
        {header}

        {/* Guest info — só aparece quando não logado */}
        {!auth && (
          <div className="rounded-3xl border border-line-subtle bg-surface p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#6366f1]/10">
                  <User size={15} className="text-[#6366f1]" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-content">Suas informações</h2>
                  <p className="text-[10px] text-faint">
                    Compra sem conta.{" "}
                    <Link to="/login" state={{ from: "/checkout" }} className="font-black text-[#6366f1]">
                      Entrar →
                    </Link>
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <input
                value={guestInfo.name}
                onChange={(e) => setGuestInfo((g) => ({ ...g, name: e.target.value }))}
                placeholder="Seu nome completo *"
                className={inputCls}
              />
              <input
                value={guestInfo.phone}
                onChange={(e) => setGuestInfo((g) => ({ ...g, phone: fmtPhone(e.target.value) }))}
                placeholder="Celular (WhatsApp) *"
                inputMode="numeric"
                className={inputCls}
              />
              <input
                value={guestInfo.email}
                onChange={(e) => setGuestInfo((g) => ({ ...g, email: e.target.value }))}
                placeholder="E-mail (opcional)"
                type="email"
                inputMode="email"
                className={inputCls}
              />
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-line-subtle bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#16a34a]/10">
                <MapPin size={15} className="text-[#16a34a]" />
              </div>
              <h2 className="text-sm font-black text-content">Endereço de entrega</h2>
            </div>
            {!showAddressForm && (
              <button
                onClick={() => setShowAddressForm(true)}
                className="flex items-center gap-1 text-xs font-black text-[#16a34a]"
              >
                <Plus size={13} /> Novo
              </button>
            )}
          </div>

          {!showAddressForm && addresses.length > 0 && (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors ${
                    selectedAddressId === addr.id
                      ? "border-[#16a34a]/40 bg-[#f0fdf4]"
                      : "border-line bg-subtle"
                  }`}
                  onClick={() => setSelectedAddressId(addr.id)}
                >
                  <div className="mt-0.5 shrink-0">
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
                        selectedAddressId === addr.id
                          ? "border-[#16a34a] bg-[#16a34a]"
                          : "border-[#cbd5e1]"
                      }`}
                    >
                      {selectedAddressId === addr.id && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    {addr.label && (
                      <p className="text-[10px] font-black uppercase tracking-wide text-[#16a34a]">{addr.label}</p>
                    )}
                    <p className="text-sm font-black text-content">
                      {addr.address}, {addr.number}
                      {addr.complement ? ` — ${addr.complement}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {addr.neighborhood}{addr.city ? `, ${addr.city}` : ""}
                    </p>
                    {addr.phone && <p className="text-xs text-faint">{addr.phone}</p>}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAddress(addr.id);
                      if (selectedAddressId === addr.id) {
                        const rem = addresses.filter((a) => a.id !== addr.id);
                        setSelectedAddressId(rem[0]?.id ?? null);
                      }
                    }}
                    className="shrink-0 rounded-lg p-1 text-[#cbd5e1] hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddressForm && (
            <AddressForm
              value={newAddr}
              onChange={setNewAddr}
              onConfirm={handleSaveAddress}
              onCancel={addresses.length > 0 ? () => setShowAddressForm(false) : undefined}
            />
          )}
        </div>

      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pb-[88px] pt-3 md:px-8 md:pb-4">
          <div>
            <p className="text-[11px] text-muted">{totalItems} {totalItems === 1 ? "item" : "itens"}</p>
            <p className="text-lg font-black text-content">{formatBRL(subtotal)}</p>
          </div>
          <button
            onClick={async () => {
              if (!auth && !guestInfo.name.trim()) {
                useToastStore.getState().show("Informe seu nome para continuar.");
                return;
              }
              if (!hasFullAddress) {
                useToastStore.getState().show("Selecione ou preencha um endereço de entrega.");
                return;
              }
              if (!auth && !guestToken) {
                try {
                  const sess = await createGuestSession({
                    name:  guestInfo.name.trim(),
                    email: guestInfo.email.trim() || undefined,
                    phone: guestInfo.phone.trim() || undefined,
                  });
                  setGuestToken(sess.guestToken);
                } catch (e) {
                  useToastStore.getState().show(e instanceof Error ? e.message : "Erro ao iniciar sessão.");
                  return;
                }
              }
              setStep(2);
            }}
            disabled={!hasFullAddress || !guestReady}
            className="shrink-0 rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#15803d] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-[#16a34a]/30 disabled:opacity-60"
          >
            {hasFullAddress && guestReady ? "Continuar →" : "Preencha os campos"}
          </button>
        </div>
      </div>
      </>
    );
  }

  // ── Step 2: Pagamento ──────────────────────────────────────
  if (step === 2) {
    return (
      <>
      <div className="space-y-4 pb-36 md:pb-0">
        {header}

        <div className="rounded-3xl border border-line-subtle bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2563eb]/10">
              <CreditCard size={15} className="text-[#2563eb]" />
            </div>
            <h2 className="text-sm font-black text-content">Forma de pagamento</h2>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["pix", "card", "boleto"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`rounded-2xl py-3 text-sm font-black transition-colors ${
                  paymentMethod === m
                    ? "bg-[#0f172a] text-white"
                    : "border border-line bg-subtle text-muted"
                }`}
              >
                {m === "pix" ? "Pix" : m === "card" ? "Cartão" : "Boleto"}
              </button>
            ))}
          </div>

          {paymentMethod === "pix" && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-subtle p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0f172a]">
                <span className="text-lg">🔑</span>
              </div>
              <div>
                <p className="text-sm font-black text-content">Pix — pagamento instantâneo</p>
                <p className="text-xs text-muted">QR Code gerado ao confirmar. Expira em 30 minutos.</p>
              </div>
            </div>
          )}

          {paymentMethod === "boleto" && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-subtle p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0f172a]">
                <span className="text-lg">🧾</span>
              </div>
              <div>
                <p className="text-sm font-black text-content">Boleto bancário</p>
                <p className="text-xs text-muted">Vencimento em 3 dias úteis. Pedido confirmado após compensação.</p>
              </div>
            </div>
          )}

          {paymentMethod === "card" && (
            <div className="mt-4 space-y-3">
              <input
                value={card.number}
                onChange={(e) => updateCard("number", fmtCard(e.target.value))}
                placeholder="Número do cartão"
                inputMode="numeric"
                className={inputCls}
              />
              <input
                value={card.name}
                onChange={(e) => updateCard("name", e.target.value)}
                placeholder="Nome impresso no cartão"
                className={inputCls}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={card.expiration}
                  onChange={(e) => updateCard("expiration", fmtExp(e.target.value))}
                  placeholder="MM/AA"
                  inputMode="numeric"
                  className={inputCls}
                />
                <input
                  value={card.cvv}
                  onChange={(e) => updateCard("cvv", fmtCVV(e.target.value))}
                  placeholder="CVV"
                  inputMode="numeric"
                  className={inputCls}
                />
              </div>
              <input
                value={card.cpf}
                onChange={(e) => updateCard("cpf", fmtCPF(e.target.value))}
                placeholder="CPF do titular (000.000.000-00)"
                inputMode="numeric"
                className={inputCls}
              />
              {!cardValid && num(card.number).length > 0 && (
                <p className="text-xs font-bold text-red-500">
                  Preencha todos os dados do cartão e o CPF do titular.
                </p>
              )}
            </div>
          )}
        </div>

      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pb-[88px] pt-3 md:px-8 md:pb-4">
          <div>
            <p className="text-[11px] text-muted">Subtotal</p>
            <p className="text-lg font-black text-content">{formatBRL(subtotal)}</p>
          </div>
          <button
            onClick={() => {
              if (!cardValid) {
                useToastStore.getState().show("Preencha todos os dados do cartão.");
                return;
              }
              setStep(3);
            }}
            disabled={!cardValid}
            className="shrink-0 rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#2563eb] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-[#16a34a]/30 disabled:opacity-60"
          >
            Continuar →
          </button>
        </div>
      </div>
      </>
    );
  }

  // ── Step 3: Revisão ────────────────────────────────────────
  return (
    <>
    <div className="space-y-4 pb-36 md:pb-0">
      {header}

      {/* Cupom */}
      <div className="rounded-3xl border border-line-subtle bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f59e0b]/10">
            <Tag size={15} className="text-[#f59e0b]" />
          </div>
          <h2 className="text-sm font-black text-content">Cupom de desconto</h2>
        </div>

        {/* Cupons disponíveis — clique para aplicar */}
        {availableCoupons.length > 0 && !coupon && (
          <div className="mb-3 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-faint">
              Cupons disponíveis
            </p>
            <div className="flex flex-wrap gap-2">
              {availableCoupons.map((c: PublicCoupon) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCouponInput(c.code);
                    applyCoupon(c.code);
                  }}
                  className="flex items-center gap-2 rounded-2xl border border-[#f59e0b]/40 bg-[#fffbeb] px-3 py-2 text-xs transition-colors hover:border-[#f59e0b]/70 active:scale-95"
                >
                  <Tag size={11} className="text-[#f59e0b]" />
                  <div className="text-left">
                    <p className="font-black text-content">{c.code}</p>
                    <p className="text-[10px] text-muted">{c.label}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {coupon ? (
          <div className="flex items-center justify-between rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#16a34a]" />
              <div>
                <p className="text-sm font-black text-[#16a34a]">{coupon.code}</p>
                <p className="text-xs text-[#16a34a]/70">{coupon.label} aplicado</p>
              </div>
            </div>
            <button onClick={removeCoupon} className="rounded-lg p-1 text-faint hover:text-red-500">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && applyCoupon(couponInput)}
              placeholder="Ou digite o código do cupom"
              className="flex-1 rounded-xl border border-line bg-subtle px-4 py-2.5 text-sm font-bold text-content uppercase outline-none focus:ring-2 focus:ring-[#16a34a]/30 placeholder:text-[#cbd5e1] placeholder:normal-case"
            />
            <button
              onClick={() => applyCoupon(couponInput)}
              disabled={applyingCoupon}
              className="rounded-xl bg-[#0f172a] px-4 py-2.5 text-xs font-black text-white disabled:opacity-60"
            >
              {applyingCoupon ? "…" : "Aplicar"}
            </button>
          </div>
        )}
        {couponError && <p className="mt-2 text-xs font-bold text-red-500">{couponError}</p>}
      </div>

      {/* Pontos */}
      {availablePoints > 0 && (
        <div className="rounded-3xl border border-line-subtle bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f59e0b]/10">
              <Star size={15} className="text-[#f59e0b]" />
            </div>
            <h2 className="text-sm font-black text-content">Usar pontos BrasUX</h2>
          </div>

          <div className="rounded-2xl border border-line bg-subtle px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">Saldo disponível</p>
                <p className="text-lg font-black text-[#f59e0b]">
                  {availablePoints.toLocaleString("pt-BR")} pts
                </p>
                <p className="text-[10px] text-faint">1 ponto = R$ 1,00 de desconto</p>
              </div>
              {pointsDiscount > 0 && (
                <div className="text-right">
                  <p className="text-[10px] text-muted">Desconto</p>
                  <p className="text-base font-black text-[#16a34a]">-{formatBRL(pointsDiscount)}</p>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range" min={0} max={maxPoints} value={pointsToUse}
                onChange={(e) => setPointsToUse(Number(e.target.value))}
                className="flex-1 accent-[#f59e0b]"
              />
              <div className="flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-1.5">
                <input
                  type="number" min={0} max={maxPoints} value={pointsToUse}
                  onChange={(e) => setPointsToUse(Math.min(maxPoints, Math.max(0, Number(e.target.value))))}
                  className="w-16 bg-transparent text-right text-sm font-black text-content outline-none"
                />
                <span className="text-xs text-faint">pts</span>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setPointsToUse(maxPoints)}
                className="rounded-xl bg-[#f59e0b]/10 px-3 py-1.5 text-xs font-black text-[#b45309]"
              >
                Usar todos
              </button>
              {pointsToUse > 0 && (
                <button
                  onClick={() => setPointsToUse(0)}
                  className="rounded-xl bg-subtle-2 px-3 py-1.5 text-xs font-black text-muted"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resumo */}
      <div className="rounded-3xl border border-line-subtle bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#ec4899]/10">
            <ReceiptText size={15} className="text-[#ec4899]" />
          </div>
          <h2 className="text-sm font-black text-content">Resumo do pedido</h2>
        </div>

        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <img
                src={item.image} alt={item.name}
                className="h-12 w-12 shrink-0 rounded-xl object-cover bg-subtle"
                onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-black text-content line-clamp-1">
                  {item.quantity}× {item.name}
                </h3>
                <p className="text-xs text-muted">
                  {formatBRL((item.promotionalPrice ?? item.price) * item.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-subtle-2 pt-4">
          <div className="flex justify-between text-xs text-muted">
            <span>{totalItems} {totalItems === 1 ? "item" : "itens"}</span>
            <strong>{formatBRL(subtotal)}</strong>
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span className="flex items-center gap-1">
              Entrega
              {distanceKm != null && (
                <span className="rounded-full bg-[#f0fdf4] px-1.5 py-0.5 text-[10px] font-bold text-[#16a34a]">
                  {distanceKm.toFixed(1)}km
                </span>
              )}
            </span>
            {loadingFee
              ? <span className="h-3 w-12 animate-pulse rounded bg-subtle-2" />
              : <strong>{deliveryFee === 0 ? "Grátis" : formatBRL(deliveryFee)}</strong>
            }
          </div>
          {coupon && discountAmount > 0 && (
            <div className="flex justify-between text-xs text-[#16a34a]">
              <span className="flex items-center gap-1"><Tag size={11} /> {coupon.code}</span>
              <strong>−{formatBRL(discountAmount)}</strong>
            </div>
          )}
          {pointsDiscount > 0 && (
            <div className="flex justify-between text-xs text-[#f59e0b]">
              <span className="flex items-center gap-1"><Star size={11} /> {pointsDiscount} pontos</span>
              <strong>−{formatBRL(pointsDiscount)}</strong>
            </div>
          )}
          <div className="flex justify-between pt-1">
            <span className="text-base font-black text-content">Total</span>
            {loadingFee
              ? <span className="h-5 w-20 animate-pulse rounded bg-subtle-2" />
              : <span className="text-xl font-black text-[#16a34a]">{formatBRL(total)}</span>
            }
          </div>
        </div>

        {/* Resumo: endereço + pagamento selecionado */}
        <div className="mt-4 space-y-2 border-t border-subtle-2 pt-3">
          {selectedAddress && (
            <div className="flex items-start gap-2 text-xs text-muted">
              <MapPin size={12} className="mt-0.5 shrink-0 text-[#16a34a]" />
              <span>
                {selectedAddress.address}, {selectedAddress.number}
                {selectedAddress.complement ? ` — ${selectedAddress.complement}` : ""}
                {selectedAddress.city ? `, ${selectedAddress.city}` : ""}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted">
            <CreditCard size={12} className="shrink-0 text-[#2563eb]" />
            <span className="font-bold capitalize">{paymentMethod === "pix" ? "Pix" : paymentMethod === "card" ? "Cartão de crédito" : "Boleto bancário"}</span>
          </div>
        </div>
      </div>

    </div>

    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pb-[88px] pt-3 md:px-8 md:pb-4">
        <div>
          <p className="text-[11px] text-muted">Total</p>
          {loadingFee
            ? <span className="mt-0.5 h-5 w-20 animate-pulse rounded bg-subtle-2 block" />
            : <p className="text-xl font-black text-[#16a34a]">{formatBRL(total)}</p>
          }
        </div>
        <button
          onClick={handleFinish}
          disabled={saving || loadingFee}
          className="flex shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#2563eb] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-[#16a34a]/30 disabled:opacity-60"
        >
          {saving
            ? <><Loader2 size={16} className="animate-spin" /> Processando…</>
            : "Confirmar pedido"}
        </button>
      </div>
    </div>
    </>
  );
}

// ── Tela de resultado de pagamento ──────────────────────────────

function GuestOrderBox({
  orderId,
  trackingCode,
}: {
  orderId: string;
  trackingCode?: string;
}) {
  return (
    <div className="w-full rounded-2xl border border-line bg-subtle p-4 text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-faint">
        Guarde o número do seu pedido
      </p>
      <p className="mt-1 font-mono text-xl font-black text-content">
        #{orderId.slice(0, 8).toUpperCase()}
      </p>
      {trackingCode && (
        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-faint">
          Código de rastreamento: <span className="text-content">{trackingCode}</span>
        </p>
      )}
      <p className="mt-1 text-xs text-muted">
        Você pode rastrear seu pedido a qualquer momento com este código.
      </p>
      {trackingCode ? (
        <Link
          to={`/acompanhar/${trackingCode}`}
          className="mt-3 inline-flex items-center gap-1 rounded-xl bg-[#0f172a] px-4 py-2 text-xs font-black text-white"
        >
          Rastrear pedido →
        </Link>
      ) : (
        <Link
          to="/login"
          className="mt-3 inline-flex items-center gap-1 rounded-xl bg-[#6366f1] px-4 py-2 text-xs font-black text-white"
        >
          Criar conta para rastrear →
        </Link>
      )}
    </div>
  );
}

function PaymentResultScreen({
  result,
  onContinue,
  pixConfirmed,
  boletoConfirmed,
  isGuest,
  trackingCode,
}: {
  result: PaymentResult;
  onContinue: () => void;
  pixConfirmed?: boolean;
  boletoConfirmed?: boolean;
  isGuest?: boolean;
  trackingCode?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (result.method === "pix" && pixConfirmed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#f0fdf4]">
          <span className="text-4xl">✅</span>
        </div>
        <div>
          <h2 className="text-xl font-black text-content">Pix confirmado!</h2>
          <p className="mt-2 text-sm text-muted">
            Pagamento recebido. Seu pedido está sendo preparado!
          </p>
        </div>
        {isGuest && <GuestOrderBox orderId={result.orderId} trackingCode={trackingCode} />}
        <button
          onClick={onContinue}
          className="w-full rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#2563eb] py-4 text-sm font-black text-white shadow-lg shadow-[#16a34a]/30"
        >
          {isGuest ? "Voltar ao início" : "Ver meus pedidos"}
        </button>
      </div>
    );
  }

  if (result.method === "card" && !result.confirmed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50">
          <span className="text-4xl">❌</span>
        </div>
        <div>
          <h2 className="text-xl font-black text-content">Pagamento recusado</h2>
          <p className="mt-2 text-sm text-muted">{result.error ?? "Verifique os dados do cartão e tente novamente."}</p>
        </div>
        <div className="w-full space-y-3">
          <p className="text-xs text-faint">
            Seu pedido foi salvo. Você pode tentar pagar novamente pelos seus pedidos.
          </p>
          <button
            onClick={onContinue}
            className="w-full rounded-2xl bg-[#0f172a] py-4 text-sm font-black text-white"
          >
            Ver meus pedidos
          </button>
        </div>
      </div>
    );
  }

  if (result.method === "card" && result.confirmed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#f0fdf4]">
          <span className="text-4xl">✅</span>
        </div>
        <div>
          <h2 className="text-xl font-black text-content">Pagamento aprovado!</h2>
          <p className="mt-2 text-sm text-muted">Seu pedido foi confirmado e o lojista já foi notificado.</p>
        </div>
        {isGuest && <GuestOrderBox orderId={result.orderId} trackingCode={trackingCode} />}
        <button
          onClick={onContinue}
          className="w-full rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#2563eb] py-4 text-sm font-black text-white shadow-lg shadow-[#16a34a]/30"
        >
          {isGuest ? "Voltar ao início" : "Ver meus pedidos"}
        </button>
      </div>
    );
  }

  if (result.method === "pix") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">BrasUX</p>
            <h1 className="text-xl font-black text-content">Pague com Pix</h1>
          </div>
        </div>

        <div className="rounded-3xl border border-line-subtle bg-surface p-6 shadow-sm text-center space-y-4">
          <p className="text-sm text-muted">
            Escaneie o QR Code ou copie o código no seu app de banco.
          </p>

          <div className="flex justify-center">
            <img
              src={`data:image/png;base64,${result.pixQrCodeImage}`}
              alt="QR Code Pix"
              className="h-52 w-52 rounded-2xl border border-line"
            />
          </div>

          <div className="rounded-2xl border border-line bg-subtle p-3">
            <p className="break-all font-mono text-[11px] text-muted leading-relaxed">
              {result.pixCode}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 rounded-xl bg-[#f0fdf4] px-4 py-2.5 text-xs text-[#16a34a]">
            <span className="inline-block h-2 w-2 rounded-full bg-[#16a34a] animate-pulse" />
            Aguardando confirmação automática…
          </div>

          <button
            onClick={() => copy(result.pixCode)}
            className="w-full rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#2563eb] py-3.5 text-sm font-black text-white shadow-lg shadow-[#16a34a]/30"
          >
            {copied ? "✓ Código copiado!" : "Copiar código Pix"}
          </button>

          {result.expirationDate && (
            <p className="text-[11px] text-faint">
              Expira em: {new Date(result.expirationDate).toLocaleString("pt-BR")}
            </p>
          )}
        </div>

        <button
          onClick={onContinue}
          className="w-full rounded-2xl border border-line bg-surface py-3.5 text-sm font-black text-muted"
        >
          Já paguei — ver meus pedidos
        </button>
      </div>
    );
  }

  if (result.method === "boleto" && boletoConfirmed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#f0fdf4]">
          <span className="text-4xl">✅</span>
        </div>
        <div>
          <h2 className="text-xl font-black text-content">Boleto compensado!</h2>
          <p className="mt-2 text-sm text-muted">Pagamento confirmado. Seu pedido está sendo preparado.</p>
        </div>
        {isGuest && <GuestOrderBox orderId={result.orderId} trackingCode={trackingCode} />}
        <button
          onClick={onContinue}
          className="w-full rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#2563eb] py-4 text-sm font-black text-white shadow-lg shadow-[#16a34a]/30"
        >
          {isGuest ? "Voltar ao início" : "Ver meus pedidos"}
        </button>
      </div>
    );
  }

  if (result.method === "boleto") {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">BrasUX</p>
          <h1 className="text-xl font-black text-content">Boleto gerado</h1>
        </div>

        <div className="rounded-3xl border border-line-subtle bg-surface p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-[#fffbeb] border border-[#fde68a] p-4">
            <span className="text-2xl">🧾</span>
            <div>
              <p className="font-black text-[#92400e] text-sm">Vencimento</p>
              <p className="text-[#92400e] text-sm">
                {result.dueDate
                  ? new Date(result.dueDate).toLocaleDateString("pt-BR")
                  : "3 dias úteis"}
              </p>
            </div>
          </div>

          <p className="text-sm text-muted">
            Pague o boleto até o vencimento para confirmar seu pedido.
            Após a compensação bancária (até 3 dias úteis), seu pedido será processado.
          </p>

          {result.boletoBarCode && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-faint">
                Linha digitável
              </p>
              <div className="rounded-xl bg-subtle border border-line p-3">
                <p className="font-mono text-xs text-muted break-all">{result.boletoBarCode}</p>
              </div>
              <button
                onClick={() => copy(result.boletoBarCode!)}
                className="w-full rounded-xl border border-line py-2.5 text-xs font-black text-muted"
              >
                {copied ? "✓ Copiado!" : "Copiar linha digitável"}
              </button>
            </div>
          )}

          {result.boletoUrl && (
            <a
              href={result.boletoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#2563eb] py-3.5 text-sm font-black text-white shadow-lg shadow-[#16a34a]/30"
            >
              Abrir boleto PDF
            </a>
          )}
        </div>

        <button
          onClick={onContinue}
          className="w-full rounded-2xl border border-line bg-surface py-3.5 text-sm font-black text-muted"
        >
          Ver meus pedidos
        </button>
      </div>
    );
  }

  return null;
}

// ── AddressForm ──────────────────────────────────────────────────

const inputCls =
  "w-full rounded-2xl bg-subtle border border-line px-4 py-3 text-sm font-semibold text-content outline-none focus:ring-2 focus:ring-[#16a34a]/30 placeholder:text-[#cbd5e1]";

const labelCls =
  "mb-1 block text-[10px] font-black uppercase tracking-wide text-faint";

function AddressForm({
  value,
  onChange,
  onConfirm,
  onCancel,
}: {
  value: Omit<SavedAddress, "id">;
  onChange: (v: Omit<SavedAddress, "id">) => void;
  onConfirm: () => void;
  onCancel?: () => void;
}) {
  const { lookup: lookupCep, loading: cepLoading, error: cepError } = useCepLookup();

  function update(k: keyof Omit<SavedAddress, "id">, v: string) {
    onChange({ ...value, [k]: v });
  }

  async function handleCepChange(raw: string) {
    const v = fmtCEP(raw);
    onChange({ ...value, cep: v });
    const data = await lookupCep(v);
    if (data) {
      onChange({
        ...value,
        cep: v,
        address:      data.logradouro || value.address,
        neighborhood: data.bairro     || value.neighborhood,
        city:         data.localidade || value.city,
      });
    }
  }

  const canConfirm = !!(value.address && value.number && value.neighborhood);

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Apelido (ex: Casa, Trabalho)</label>
        <input value={value.label} onChange={(e) => update("label", e.target.value)} placeholder="Casa" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Celular</label>
        <input value={value.phone} onChange={(e) => update("phone", fmtPhone(e.target.value))} placeholder="(00) 00000-0000" inputMode="numeric" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>CEP</label>
        <div className="relative">
          <input
            value={value.cep}
            onChange={(e) => handleCepChange(e.target.value)}
            placeholder="00000-000"
            inputMode="numeric"
            className={`${inputCls} ${cepLoading ? "pr-10" : ""}`}
          />
          {cepLoading && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-faint" />}
        </div>
        {cepError && <p className="mt-1 text-xs font-bold text-red-500">{cepError}</p>}
      </div>
      <div>
        <label className={labelCls}>Rua / Avenida <span className="text-red-400">*</span></label>
        <input value={value.address} onChange={(e) => update("address", e.target.value)} placeholder="Nome da rua" className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Número <span className="text-red-400">*</span></label>
          <input value={value.number} onChange={(e) => update("number", e.target.value)} placeholder="123" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Complemento</label>
          <input value={value.complement} onChange={(e) => update("complement", e.target.value)} placeholder="Apto, bloco…" className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Bairro <span className="text-red-400">*</span></label>
        <input value={value.neighborhood} onChange={(e) => update("neighborhood", e.target.value)} placeholder="Nome do bairro" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Cidade</label>
        <input value={value.city} onChange={(e) => update("city", e.target.value)} placeholder="São Paulo" className={inputCls} />
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <button onClick={onCancel} className="flex-1 rounded-2xl border border-line bg-subtle py-3 text-sm font-black text-muted">
            Cancelar
          </button>
        )}
        <button onClick={onConfirm} disabled={!canConfirm} className="flex-1 rounded-2xl bg-[#0f172a] py-3 text-sm font-black text-white disabled:opacity-40">
          Salvar endereço
        </button>
      </div>
    </div>
  );
}
