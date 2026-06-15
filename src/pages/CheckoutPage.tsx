import {
  ArrowLeft,
  CreditCard,
  Loader2,
  MapPin,
  QrCode,
  ReceiptText,
  ShoppingBag,
} from "lucide-react";
import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Link, useNavigate } from "react-router-dom";

import { createOrder, getStoreById, type Store } from "../services/gizApi";
import { useCartStore } from "../stores/cartStore";
import { getAuth } from "../services/auth";
import { useCepLookup } from "../hooks/useCepLookup";
import { useToastStore } from "../stores/toastStore";

type PaymentMethod = "pix" | "card";

type CardData = {
  number: string;
  name: string;
  expiration: string;
  cvv: string;
};

type AddressData = {
  phone: string;
  cep: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
};

const CHECKOUT_KEY = "gizapp-checkout";
const ORDERS_KEY = "gizapp-orders";
const ACCOUNT_KEY = "gizapp-account";
const EMPTY_CARD: CardData = { number: "", name: "", expiration: "", cvv: "" };

const num = (v: string) => v.replace(/\D/g, "");
const fmtCard = (v: string) =>
  num(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
const fmtExp = (v: string) =>
  num(v).slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2");
const fmtCVV = (v: string) => num(v).slice(0, 4);
const fmtPhone = (v: string) =>
  num(v)
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
const fmtCEP = (v: string) =>
  num(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");

function loadCheckout() {
  try {
    return JSON.parse(localStorage.getItem(CHECKOUT_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function loadAddressData(): AddressData {
  try {
    const saved = JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "{}");
    return {
      phone: saved.phone ?? "",
      cep: saved.cep ?? "",
      address: saved.address ?? "",
      number: saved.number ?? "",
      complement: saved.complement ?? "",
      neighborhood: saved.neighborhood ?? "",
    };
  } catch {
    return { phone: "", cep: "", address: "", number: "", complement: "", neighborhood: "" };
  }
}

function getSavedOrderIds(): string[] {
  try {
    const p = JSON.parse(localStorage.getItem(ORDERS_KEY) ?? "[]");
    return Array.isArray(p) ? p.filter((i: unknown) => typeof i === "string") : [];
  } catch {
    return [];
  }
}

function saveOrderId(id?: string) {
  if (!id) throw new Error("Pedido sem ID.");
  const saved = getSavedOrderIds();
  localStorage.setItem(ORDERS_KEY, JSON.stringify([id, ...saved.filter((x) => x !== id)]));
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalItems = useCartStore((s) => s.totalItems());
  const subtotal = useCartStore((s) => s.totalPrice());

  const storeId = items[0]?.storeId ?? "";

  const [store, setStore] = useState<Store | null>(null);
  const [loadingStore, setLoadingStore] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    setLoadingStore(true);
    getStoreById(storeId)
      .then(setStore)
      .catch(console.error)
      .finally(() => setLoadingStore(false));
  }, [storeId]);

  const saved = loadCheckout();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    saved.paymentMethod === "card" ? "card" : "pix"
  );
  const [showCardForm, setShowCardForm] = useState(saved.showCardForm ?? false);
  const [card, setCard] = useState<CardData>({ ...EMPTY_CARD, ...saved.card });
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const [address, setAddress] = useState<AddressData>(loadAddressData);
  const [editingAddress, setEditingAddress] = useState(() => {
    const d = loadAddressData();
    return !(d.address && d.number && d.neighborhood);
  });

  const hasFullAddress = !!(address.address && address.number && address.neighborhood);

  const deliveryFee = store ? Number(store.deliveryFee) : 0;
  const total = subtotal + deliveryFee;

  const cardValid =
    paymentMethod === "pix" ||
    (paymentMethod === "card" &&
      num(card.number).length === 16 &&
      card.name.trim().length > 0 &&
      num(card.expiration).length === 4 &&
      num(card.cvv).length >= 3);

  const pixCode = `00020126580014BR.GOV.BCB.PIX0136GIZAPP-CLIENTE-PIX520400005303986540${total
    .toFixed(2)
    .replace(".", "")}5802BR5920GIZAPP MARKETPLACE6009RIO DE JANEIRO62070503***6304ABCD`;

  useEffect(() => {
    localStorage.setItem(CHECKOUT_KEY, JSON.stringify({ paymentMethod, card, showCardForm }));
  }, [paymentMethod, card, showCardForm]);

  function updateCard(k: keyof CardData, v: string) {
    setCard((c) => ({ ...c, [k]: v }));
  }

  async function copyPix() {
    await navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function confirmAddress() {
    try {
      const existing = JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "{}");
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ ...existing, ...address }));
    } catch {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(address));
    }
    setEditingAddress(false);
  }

  async function handleFinish() {
    const auth = getAuth();
    if (!auth) { navigate("/login", { state: { from: "/checkout" } }); return; }

    try {
      setSaving(true);
      const order = await createOrder({
        storeId,
        customerName: auth.name,
        customerPhone: address.phone || "—",
        deliveryAddress: address.address,
        deliveryNumber: address.number,
        deliveryComplement: address.complement,
        deliveryNeighborhood: address.neighborhood,
        paymentMethod,
        items: items.map((i) => ({ storeProductId: i.storeProductId, quantity: i.quantity })),
      });
      saveOrderId(order.id);
      clearCart();
      navigate("/pedidos");
    } catch (e) {
      useToastStore.getState().show(
        e instanceof Error ? e.message : "Erro ao finalizar pedido."
      );
    } finally {
      setSaving(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f0f2f7] px-4 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#7c3aed]/10">
          <ShoppingBag size={40} className="text-[#7c3aed]" />
        </div>
        <h2 className="mt-6 text-xl font-black text-[#0f172a]">Carrinho vazio</h2>
        <p className="mt-2 text-sm text-[#64748b]">
          Adicione produtos antes de continuar.
        </p>
        <Link
          to="/"
          className="mt-6 rounded-2xl bg-[#7c3aed] px-6 py-3 text-sm font-black text-white"
        >
          Explorar lojas
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f7] pb-32">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-[#e8eaf0] px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a]"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#7c3aed]">
              GizApp
            </p>
            <h1 className="text-xl font-black text-[#0f172a]">Checkout</h1>
          </div>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-3">
        {/* ENDEREÇO */}
        <div className="rounded-3xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#7c3aed]/10">
                <MapPin size={15} className="text-[#7c3aed]" />
              </div>
              <h2 className="text-sm font-black text-[#0f172a]">Endereço de entrega</h2>
            </div>
            {hasFullAddress && !editingAddress && (
              <button
                onClick={() => setEditingAddress(true)}
                className="text-xs font-black text-[#7c3aed]"
              >
                Alterar
              </button>
            )}
          </div>

          {!editingAddress && hasFullAddress ? (
            <div className="rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3">
              {address.cep && (
                <p className="text-[10px] font-bold text-[#94a3b8] mb-0.5">CEP {address.cep}</p>
              )}
              <p className="text-sm font-black text-[#0f172a]">
                {address.address}, {address.number}
                {address.complement ? ` — ${address.complement}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-[#64748b]">{address.neighborhood}</p>
              {address.phone && (
                <p className="mt-1 text-xs text-[#94a3b8]">{address.phone}</p>
              )}
            </div>
          ) : (
            <AddressForm
              value={address}
              onChange={setAddress}
              onConfirm={confirmAddress}
              onCancel={hasFullAddress ? () => setEditingAddress(false) : undefined}
            />
          )}
        </div>

        {/* PAGAMENTO */}
        <div className="rounded-3xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2563eb]/10">
              <CreditCard size={15} className="text-[#2563eb]" />
            </div>
            <h2 className="text-sm font-black text-[#0f172a]">Forma de pagamento</h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPaymentMethod("pix")}
              className={`rounded-2xl py-3 text-sm font-black transition-colors ${
                paymentMethod === "pix"
                  ? "bg-[#0f172a] text-white"
                  : "border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]"
              }`}
            >
              Pix
            </button>
            <button
              onClick={() => { setPaymentMethod("card"); setShowCardForm(true); }}
              className={`rounded-2xl py-3 text-sm font-black transition-colors ${
                paymentMethod === "card"
                  ? "bg-[#0f172a] text-white"
                  : "border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]"
              }`}
            >
              Cartão
            </button>
          </div>

          {paymentMethod === "pix" && (
            <div className="mt-4 rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] p-4 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a]">
                <QrCode size={20} className="text-[#a855f7]" />
              </div>
              <h3 className="mt-2 text-sm font-black text-[#0f172a]">Pix copia e cola</h3>
              <div className="mt-3 flex justify-center rounded-2xl bg-white p-3 border border-[#e2e8f0]">
                <QRCodeCanvas value={pixCode} size={160} />
              </div>
              <p className="mt-3 break-all rounded-xl bg-white border border-[#e2e8f0] p-2.5 text-[10px] font-mono text-[#64748b]">
                {pixCode}
              </p>
              <button
                onClick={copyPix}
                className="mt-3 w-full rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#2563eb] py-3 text-sm font-black text-white"
              >
                {copied ? "✓ Copiado!" : "Copiar código Pix"}
              </button>
            </div>
          )}

          {paymentMethod === "card" && showCardForm && (
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
              {!cardValid && (num(card.number).length > 0 || card.name.length > 0) && (
                <p className="text-xs font-bold text-red-500">Preencha todos os dados do cartão.</p>
              )}
            </div>
          )}
        </div>

        {/* RESUMO */}
        <div className="rounded-3xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#ec4899]/10">
              <ReceiptText size={15} className="text-[#ec4899]" />
            </div>
            <h2 className="text-sm font-black text-[#0f172a]">Resumo do pedido</h2>
          </div>

          <div className="space-y-2.5">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-12 w-12 rounded-xl object-cover bg-[#f8fafc] shrink-0"
                  onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-black text-[#0f172a] line-clamp-1">
                    {item.quantity}× {item.name}
                  </h3>
                  <p className="text-xs text-[#64748b]">
                    R$ {((item.promotionalPrice ?? item.price) * item.quantity)
                      .toFixed(2)
                      .replace(".", ",")}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-[#f1f5f9] pt-4 space-y-2">
            <div className="flex justify-between text-xs text-[#64748b]">
              <span>{totalItems} {totalItems === 1 ? "item" : "itens"}</span>
              <strong>R$ {subtotal.toFixed(2).replace(".", ",")}</strong>
            </div>
            <div className="flex justify-between text-xs text-[#64748b]">
              <span>Entrega</span>
              {loadingStore ? (
                <span className="h-3 w-12 animate-pulse rounded bg-[#f1f5f9]" />
              ) : (
                <strong>
                  {deliveryFee === 0 ? "Grátis" : `R$ ${deliveryFee.toFixed(2).replace(".", ",")}`}
                </strong>
              )}
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-base font-black text-[#0f172a]">Total</span>
              {loadingStore ? (
                <span className="h-5 w-20 animate-pulse rounded bg-[#f1f5f9]" />
              ) : (
                <span className="text-xl font-black text-[#7c3aed]">
                  R$ {total.toFixed(2).replace(".", ",")}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleFinish}
          disabled={saving || !hasFullAddress || editingAddress || !cardValid || loadingStore}
          className="w-full rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#2563eb] py-4 text-sm font-black text-white shadow-xl shadow-[#7c3aed]/30 disabled:opacity-60 active:scale-[0.98] transition-transform"
        >
          {saving
            ? "Enviando pedido…"
            : !hasFullAddress
            ? "Informe o endereço para continuar"
            : !cardValid
            ? "Preencha os dados do cartão"
            : "Confirmar pedido"}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#7c3aed]/30 placeholder:text-[#cbd5e1]";

const labelCls =
  "mb-1 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]";

function AddressForm({
  value,
  onChange,
  onConfirm,
  onCancel,
}: {
  value: AddressData;
  onChange: (v: AddressData) => void;
  onConfirm: () => void;
  onCancel?: () => void;
}) {
  const { lookup: lookupCep, loading: cepLoading, error: cepError } = useCepLookup();

  function update(k: keyof AddressData, v: string) {
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
        address: data.logradouro || value.address,
        neighborhood: data.bairro || value.neighborhood,
      });
    }
  }

  const canConfirm = !!(value.address && value.number && value.neighborhood);

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Celular</label>
        <input
          value={value.phone}
          onChange={(e) => update("phone", fmtPhone(e.target.value))}
          placeholder="(00) 00000-0000"
          inputMode="numeric"
          className={inputCls}
        />
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
          {cepLoading && (
            <Loader2
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#94a3b8]"
            />
          )}
        </div>
        {cepError && (
          <p className="mt-1 text-xs font-bold text-red-500">{cepError}</p>
        )}
      </div>
      <div>
        <label className={labelCls}>
          Rua / Avenida <span className="text-red-400">*</span>
        </label>
        <input
          value={value.address}
          onChange={(e) => update("address", e.target.value)}
          placeholder="Nome da rua"
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>
            Número <span className="text-red-400">*</span>
          </label>
          <input
            value={value.number}
            onChange={(e) => update("number", e.target.value)}
            placeholder="123"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Complemento</label>
          <input
            value={value.complement}
            onChange={(e) => update("complement", e.target.value)}
            placeholder="Apto, bloco…"
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>
          Bairro <span className="text-red-400">*</span>
        </label>
        <input
          value={value.neighborhood}
          onChange={(e) => update("neighborhood", e.target.value)}
          placeholder="Nome do bairro"
          className={inputCls}
        />
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] py-3 text-sm font-black text-[#64748b]"
          >
            Cancelar
          </button>
        )}
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className="flex-1 rounded-2xl bg-[#0f172a] py-3 text-sm font-black text-white disabled:opacity-40"
        >
          Usar este endereço
        </button>
      </div>
    </div>
  );
}
