import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Package, Plus, Pencil, Trash2, Store as StoreIcon,
  Loader2, ToggleLeft, ToggleRight, Image as ImageIcon,
  ChevronDown, ChevronUp, LayoutDashboard, ClipboardList,
  TrendingUp, AlertTriangle, Phone, MapPin, CreditCard, RefreshCw,
  Locate, Star, Wallet, Clock3, MessageCircle, Zap,
  ArrowDownCircle, ArrowUpCircle, BadgePercent, Crown, CheckCircle2,
  CircleDollarSign, TrendingDown, Ban,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

import { useCepLookup } from "../hooks/useCepLookup";
import { getBrowserPosition, geocodeAddress } from "../utils/geo";
import {
  getMyStore, createStore, updateStore,
  getMyStoreProducts, createStoreProduct, updateStoreProduct, deleteStoreProduct,
  getStoreOrders, sellerUpdateOrderStatus, sendPushToUser,
  getStoreOpeningHours, updateStoreOpeningHours, DEFAULT_OPENING_HOURS,
  queryKeys,
  type Store, type StoreProduct, type Order,
  type StorePayload, type StoreProductPayload,
  type OpeningHours, type DayHours,
} from "../services/gizApi";
import { supabase } from "../lib/supabase";
import { formatBRL } from "../utils/format";
import ImagePicker from "../components/seller/ImagePicker";
import { useToastStore } from "../stores/toastStore";
import { useMyWallet, useMySubscription } from "../hooks/useWallet";
import { useWithdrawals } from "../hooks/useWithdrawal";
import { PLAN_CONFIG } from "../types/payment";
import type { PixKeyType, WalletTransaction } from "../types/payment";

// ── Helpers ────────────────────────────────────────────────────

function slugify(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const CATEGORIES = [
  "Restaurante", "Mercearia", "Bebidas", "Farmácia", "Pet Shop", "Padaria",
  "Hortifruti", "Conveniência", "Açougue", "Floricultura", "Tabacaria", "Tecnologia", "Outros",
];

// ── Configuração de status ──────────────────────────────────────

const STATUS_CFG = {
  0: { label: "Aguardando pagamento", bg: "bg-yellow-50",  text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-400", next: null },
  1: { label: "Pago — aceitar",       bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-200",   dot: "bg-blue-500",   next: "Iniciar preparo"  },
  2: { label: "Preparando",           bg: "bg-orange-50",  text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500", next: "Saiu para entrega" },
  3: { label: "Saiu para entrega",    bg: "bg-purple-50",  text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500", next: "Confirmar entrega" },
  4: { label: "Entregue",             bg: "bg-green-50",   text: "text-green-700",  border: "border-green-200",  dot: "bg-green-400",  next: null },
  5: { label: "Cancelado",            bg: "bg-red-50",     text: "text-red-600",    border: "border-red-200",    dot: "bg-red-400",    next: null },
} as const;

const PAYMENT_CFG: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "Aguardando pagamento", color: "text-yellow-600" },
  CONFIRMED: { label: "Pago ✓",              color: "text-green-600"  },
  RECEIVED:  { label: "Recebido ✓",          color: "text-green-600"  },
  DECLINED:  { label: "Recusado",            color: "text-red-500"    },
  REFUNDED:  { label: "Estornado",           color: "text-gray-500"   },
};

type Tab = "painel" | "pedidos" | "produtos" | "loja" | "financeiro";

// ══════════════════════════════════════════════════════════════
// PRODUCT MODAL
// ══════════════════════════════════════════════════════════════

type ProductFormData = {
  name: string; category: string; subCategory: string; brand: string;
  description: string; imageUrl: string; imageAlt: string;
  price: string; promotionalPrice: string; stock: string;
  available: boolean; featured: boolean;
};

const EMPTY_PRODUCT: ProductFormData = {
  name: "", category: "", subCategory: "", brand: "", description: "",
  imageUrl: "", imageAlt: "", price: "", promotionalPrice: "", stock: "0",
  available: true, featured: false,
};

function ProductModal({
  storeId, product, featuredCount, onSave, onClose,
}: {
  storeId: string;
  product?: StoreProduct | null;
  featuredCount: number;
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ProductFormData>(
    product
      ? {
          name: product.name, category: product.category,
          subCategory: product.subCategory ?? "", brand: product.brand ?? "",
          description: product.description ?? "", imageUrl: product.imageUrl ?? "",
          imageAlt: product.imageAlt ?? "", price: String(product.price),
          promotionalPrice: product.promotionalPrice ? String(product.promotionalPrice) : "",
          stock: String(product.stock), available: product.available,
          featured: product.featured ?? false,
        }
      : EMPTY_PRODUCT,
  );
  const [saving, setSaving] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const showToast = useToastStore((s) => s.show);

  function set(key: keyof ProductFormData, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleGenerateDescription() {
    if (!form.name.trim()) { setError("Preencha o nome do produto antes de gerar a descrição."); return; }
    setGeneratingDesc(true);
    setError(null);
    await new Promise((r) => setTimeout(r, 600));
    const desc = generateDescription(form.name, form.category || "Outros", form.brand || undefined);
    set("description", desc);
    setGeneratingDesc(false);
    showToast("Descrição gerada!", "success");
  }

  async function handleSave() {
    if (!form.name.trim())     { setError("Nome é obrigatório."); return; }
    if (!form.category.trim()) { setError("Categoria é obrigatória."); return; }
    if (!form.price || isNaN(Number(form.price))) { setError("Preço inválido."); return; }
    setSaving(true); setError(null);
    const payload: StoreProductPayload = {
      name: form.name.trim(), slug: slugify(form.name), category: form.category,
      subCategory: form.subCategory || undefined, brand: form.brand || undefined,
      description: form.description || undefined, imageUrl: form.imageUrl || undefined,
      imageAlt: form.imageAlt || form.name, price: Number(form.price),
      promotionalPrice: form.promotionalPrice ? Number(form.promotionalPrice) : null,
      stock: Number(form.stock) || 0, available: form.available, featured: form.featured,
    };
    try {
      if (product) {
        await updateStoreProduct(product.id, storeId, payload);
        showToast("Produto atualizado!", "success");
      } else {
        await createStoreProduct(storeId, payload);
        showToast("Produto adicionado!", "success");
      }
      onSave(); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center" onClick={onClose}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div
          className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
          style={{ maxHeight: "92vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[#f1f5f9] p-5">
            <h2 className="text-lg font-black text-[#0f172a]">{product ? "Editar produto" : "Novo produto"}</h2>
            <button onClick={onClose} className="rounded-xl bg-[#f1f5f9] p-2 text-[#64748b]">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className={lbl}>Imagem do produto</label>
              <button
                type="button" onClick={() => setShowPicker(true)}
                className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-[#e2e8f0] bg-[#f8fafc] p-4 hover:border-[#16a34a]/50"
              >
                {form.imageUrl
                  ? <img src={form.imageUrl} alt={form.imageAlt} className="h-16 w-16 rounded-xl object-contain bg-white" />
                  : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#e2e8f0]"><ImageIcon size={24} className="text-[#94a3b8]" /></div>
                }
                <div className="text-left">
                  <p className="font-black text-[#0f172a] text-sm">{form.imageUrl ? "Trocar imagem" : "Escolher imagem"}</p>
                  <p className="text-xs text-[#94a3b8]">Banco BrasUX · Upload · URL</p>
                </div>
              </button>
            </div>

            <div>
              <label className={lbl}>Nome do produto *</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Coca-Cola 350ml" className={inp} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Categoria *</label>
                <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inp}>
                  <option value="">Selecione…</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Subcategoria</label>
                <input value={form.subCategory} onChange={(e) => set("subCategory", e.target.value)} placeholder="Ex: Refrigerante" className={inp} />
              </div>
            </div>

            <div>
              <label className={lbl}>Marca</label>
              <input value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Ex: Coca-Cola" className={inp} />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className={lbl} style={{ marginBottom: 0 }}>Descrição</label>
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={generatingDesc || !form.name.trim()}
                  className="flex items-center gap-1 rounded-lg bg-[#7c3aed]/10 px-2 py-1 text-[10px] font-black text-[#7c3aed] transition-colors hover:bg-[#7c3aed]/20 disabled:opacity-40"
                >
                  {generatingDesc ? <><Loader2 size={10} className="animate-spin" /> Gerando…</> : <>✨ Gerar com IA</>}
                </button>
              </div>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Descreva o produto…" className={`${inp} resize-none`} />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className={lbl}>Preço (R$) *</label>
                <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0,00" className={inp} />
              </div>
              <div>
                <label className={lbl}>Preço promocional</label>
                <input type="number" step="0.01" min="0" value={form.promotionalPrice} onChange={(e) => set("promotionalPrice", e.target.value)} placeholder="0,00" className={inp} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={lbl}>Estoque</label>
                <input type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} className={inp} />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
              <button type="button" onClick={() => set("available", !form.available)} className={form.available ? "text-[#16a34a]" : "text-[#94a3b8]"}>
                {form.available ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
              <div>
                <p className="text-sm font-black text-[#0f172a]">{form.available ? "Disponível para venda" : "Indisponível"}</p>
                <p className="text-xs text-[#94a3b8]">Controla se aparece na loja</p>
              </div>
            </div>

            {/* Toggle destaque */}
            {(() => {
              const atLimit = featuredCount >= 3 && !form.featured;
              return (
                <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                  form.featured
                    ? "border-[#f59e0b]/40 bg-[#fffbeb]"
                    : atLimit
                    ? "border-[#e2e8f0] bg-[#f8fafc] opacity-60"
                    : "border-[#e2e8f0] bg-[#f8fafc]"
                }`}>
                  <button
                    type="button"
                    disabled={atLimit}
                    onClick={() => !atLimit && set("featured", !form.featured)}
                    className={form.featured ? "text-[#f59e0b]" : "text-[#94a3b8]"}
                  >
                    {form.featured ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <Star size={13} className={form.featured ? "text-[#f59e0b]" : "text-[#94a3b8]"} fill={form.featured ? "currentColor" : "none"} />
                      <p className="text-sm font-black text-[#0f172a]">
                        {form.featured ? "Produto em destaque ⭐" : "Marcar como destaque"}
                      </p>
                    </div>
                    <p className="text-xs text-[#94a3b8]">
                      {atLimit
                        ? `Limite de 3 destaques atingido — remova um antes de adicionar.`
                        : `Aparece no carrossel da Home BrasUX (máx. 3 por loja)`}
                    </p>
                  </div>
                </div>
              );
            })()}

            {error && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}
          </div>

          <div className="border-t border-[#f1f5f9] p-4">
            <button
              onClick={handleSave} disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
            >
              {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando…</> : "Salvar produto"}
            </button>
          </div>
        </div>
      </div>

      {showPicker && (
        <ImagePicker
          storeId={storeId}
          value={form.imageUrl}
          onChange={(url, alt) => { set("imageUrl", url); if (alt) set("imageAlt", alt); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// STORE FORM
// ══════════════════════════════════════════════════════════════

function StoreForm({ store, onSave }: { store?: Store | null; onSave: (s: Store) => void }) {
  const [form, setForm] = useState({
    name:            store?.name ?? "",
    category:        store?.category ?? "",
    description:     store?.description ?? "",
    whatsapp:        store?.whatsapp ?? "",
    phone:           store?.phone ?? "",
    deliveryFee:     store?.deliveryFee != null ? String(store.deliveryFee) : "0",
    deliveryTimeMin: store?.deliveryTimeMin != null ? String(store.deliveryTimeMin) : "30",
    deliveryTimeMax: store?.deliveryTimeMax != null ? String(store.deliveryTimeMax) : "60",
    isOpen:          store?.isOpen ?? true,
    // Endereço
    zipCode:         store?.zipCode ?? "",
    address:         store?.address ?? "",
    number:          store?.number ?? "",
    neighborhood:    store?.neighborhood ?? "",
    city:            store?.city ?? "",
    state:           store?.state ?? "",
    // Coordenadas
    lat:             store?.lat ?? null as number | null,
    lng:             store?.lng ?? null as number | null,
  });
  const [saving,       setSaving]       = useState(false);
  const [geoLoading,   setGeoLoading]   = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const showToast = useToastStore((s) => s.show);
  const { lookup: lookupCep, loading: cepLoading } = useCepLookup();

  function set(key: keyof typeof form, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const fmtCEP = (v: string) => v.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");

  async function handleCepChange(raw: string) {
    const v = fmtCEP(raw);
    setForm((f) => ({ ...f, zipCode: v }));
    if (v.replace("-", "").length === 8) {
      const data = await lookupCep(v);
      if (data) {
        setForm((f) => ({
          ...f,
          zipCode:      v,
          address:      data.logradouro || f.address,
          neighborhood: data.bairro     || f.neighborhood,
          city:         data.localidade || f.city,
          state:        data.uf         || f.state,
        }));
      }
    }
  }

  async function handleDetectLocation() {
    setGeoLoading(true);
    try {
      const pos = await getBrowserPosition();
      setForm((f) => ({ ...f, lat: pos.lat, lng: pos.lng }));
      showToast("Localização detectada com sucesso!", "success");
    } catch {
      // Tenta geocodificar pelo endereço como fallback
      if (form.address) {
        const pos = await geocodeAddress({
          address:      form.address,
          neighborhood: form.neighborhood,
          city:         form.city,
          state:        form.state,
        });
        if (pos) {
          setForm((f) => ({ ...f, lat: pos.lat, lng: pos.lng }));
          showToast("Localização obtida pelo endereço.", "success");
        } else {
          showToast("Não foi possível obter a localização. Tente novamente.", "error");
        }
      } else {
        showToast("Permita o acesso à localização ou preencha o endereço.", "error");
      }
    } finally {
      setGeoLoading(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Nome da loja é obrigatório."); return; }
    if (!form.category)    { setError("Categoria é obrigatória."); return; }
    setSaving(true); setError(null);

    // Auto-geocodifica se endereço preenchido mas sem coords
    let lat = form.lat;
    let lng = form.lng;
    if (!lat && form.address && form.city) {
      const pos = await geocodeAddress({ address: form.address, neighborhood: form.neighborhood, city: form.city, state: form.state });
      if (pos) { lat = pos.lat; lng = pos.lng; }
    }

    const payload: StorePayload = {
      name: form.name.trim(), slug: slugify(form.name), category: form.category,
      description: form.description || undefined, whatsapp: form.whatsapp || undefined,
      phone: form.phone || undefined, deliveryFee: Number(form.deliveryFee) || 0,
      deliveryTimeMin: Number(form.deliveryTimeMin) || 30,
      deliveryTimeMax: Number(form.deliveryTimeMax) || 60,
      isOpen: form.isOpen, active: true,
      zipCode: form.zipCode || undefined, address: form.address || undefined,
      number: form.number || undefined, neighborhood: form.neighborhood || undefined,
      city: form.city || undefined, state: form.state || undefined,
      lat, lng,
    };
    try {
      const saved = store ? await updateStore(store.id, payload) : await createStore(payload);
      showToast(store ? "Loja atualizada!" : "Loja criada!", "success");
      onSave(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[#e8eaf0] bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <StoreIcon size={16} className="text-[#16a34a]" />
        <h2 className="font-black text-[#0f172a]">{store ? "Dados da loja" : "Criar minha loja"}</h2>
      </div>

      <div>
        <label className={lbl}>Nome da loja *</label>
        <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Mercadinho do João" className={inp} />
      </div>
      <div>
        <label className={lbl}>Categoria *</label>
        <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inp}>
          <option value="">Selecione…</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className={lbl}>Descrição</label>
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Apresente sua loja…" className={`${inp} resize-none`} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>WhatsApp</label>
          <input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(00) 00000-0000" className={inp} />
        </div>
        <div>
          <label className={lbl}>Telefone</label>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(00) 0000-0000" className={inp} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className={lbl}>Taxa entrega (R$)</label>
          <input type="number" min="0" step="0.50" value={form.deliveryFee} onChange={(e) => set("deliveryFee", e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>Tempo mín (min)</label>
          <input type="number" min="5" value={form.deliveryTimeMin} onChange={(e) => set("deliveryTimeMin", e.target.value)} className={inp} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={lbl}>Tempo máx (min)</label>
          <input type="number" min="5" value={form.deliveryTimeMax} onChange={(e) => set("deliveryTimeMax", e.target.value)} className={inp} />
        </div>
      </div>

      {/* ── Endereço e Localização ─── */}
      <div className="rounded-2xl border border-[#e8eaf0] bg-[#f8fafc] p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <MapPin size={14} className="text-[#16a34a]" />
          <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
            Endereço e Localização
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>CEP</label>
            <div className="relative">
              <input
                value={form.zipCode}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                inputMode="numeric"
                className={`${inp} ${cepLoading ? "pr-9" : ""}`}
              />
              {cepLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#94a3b8]" />}
            </div>
          </div>
          <div>
            <label className={lbl}>Número</label>
            <input value={form.number} onChange={(e) => set("number", e.target.value)} placeholder="123" className={inp} />
          </div>
        </div>

        <div>
          <label className={lbl}>Rua / Avenida</label>
          <input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Nome da rua" className={inp} />
        </div>

        <div>
          <label className={lbl}>Bairro</label>
          <input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} placeholder="Nome do bairro" className={inp} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Cidade</label>
            <input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="São Paulo" className={inp} />
          </div>
          <div>
            <label className={lbl}>Estado</label>
            <input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="SP" maxLength={2} className={inp} />
          </div>
        </div>

        {/* Botão de geolocalização */}
        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={geoLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#16a34a]/30 bg-[#f0fdf4] py-2.5 text-sm font-black text-[#16a34a] disabled:opacity-60"
        >
          <Locate size={15} className={geoLoading ? "animate-spin" : ""} />
          {geoLoading ? "Detectando…" : form.lat ? "Atualizar localização" : "Detectar localização"}
        </button>

        {form.lat && form.lng && (
          <p className="text-center text-[11px] text-[#16a34a] font-bold">
            ✓ Localização registrada ({form.lat.toFixed(4)}, {form.lng.toFixed(4)})
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
        <button type="button" onClick={() => set("isOpen", !form.isOpen)} className={form.isOpen ? "text-[#16a34a]" : "text-[#94a3b8]"}>
          {form.isOpen ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
        </button>
        <div>
          <p className="text-sm font-black text-[#0f172a]">{form.isOpen ? "Loja aberta" : "Loja fechada"}</p>
          <p className="text-xs text-[#94a3b8]">Clientes podem fazer pedidos agora?</p>
        </div>
      </div>

      {error && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}

      <button
        onClick={handleSave} disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
      >
        {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando…</> : store ? "Salvar alterações" : "Criar loja"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const h = Math.floor(mins / 60);
  return `há ${h}h${mins % 60 > 0 ? ` ${mins % 60}min` : ""}`;
}

function whatsappUrl(phone: string, orderId: string): string {
  const num = phone.replace(/\D/g, "");
  if (!num || num.length < 8) return "";
  const msg = encodeURIComponent(`Olá! Sobre o pedido #${orderId.slice(0, 8).toUpperCase()} via BrasUX 🛍️`);
  return `https://wa.me/55${num}?text=${msg}`;
}

function isUrgentOrder(order: Order): boolean {
  return order.status === 1 && (Date.now() - new Date(order.createdAt).getTime()) > 15 * 60 * 1000;
}

function playNewOrderSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const beeps = [
      { freq: 880,  start: 0,    duration: 0.12 },
      { freq: 1047, start: 0.15, duration: 0.12 },
      { freq: 1319, start: 0.30, duration: 0.18 },
    ];
    beeps.forEach(({ freq, start, duration }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration + 0.05);
    });
  } catch {
    // AudioContext não suportado — silencia
  }
}

function generateDescription(name: string, category: string, brand?: string): string {
  const b = brand ? ` da ${brand}` : "";
  const templates: Record<string, string[]> = {
    "Tecnologia":    [`${name}${b} — performance confiável para o seu dia a dia. Ideal para quem busca qualidade e praticidade em tecnologia.`, `Conheça o ${name}: solução tecnológica${b} com excelente custo-benefício.`],
    "Restaurante":   [`${name} — preparado com ingredientes selecionados para garantir sabor e qualidade em cada detalhe.`, `Experimente o ${name}: tradição e sabor em cada porção.`],
    "Farmácia":      [`${name}${brand ? ` — ${brand}` : ""}: qualidade e segurança para sua saúde e bem-estar.`],
    "Mercearia":     [`${name}${brand ? ` da marca ${brand}` : ""} — produto de qualidade para o seu lar.`],
    "Padaria":       [`${name} — fresquinho e feito com cuidado. Sabor que conquista do café da manhã ao lanche da tarde.`],
    "Bebidas":       [`${name}${b} — refrescante e saboroso. Perfeito para qualquer momento do seu dia.`],
    "Pet Shop":      [`${name}${b} — cuidado e carinho para o seu animal de estimação.`],
    "Hortifruti":    [`${name} — fresco, nutritivo e selecionado com cuidado para a sua alimentação saudável.`],
  };
  const list = templates[category] ?? [`${name}${b}. Produto de qualidade com excelente custo-benefício.`];
  return list[Math.floor(Math.random() * list.length)];
}

// ══════════════════════════════════════════════════════════════
// STORE HOURS PANEL
// ══════════════════════════════════════════════════════════════

const DAY_LABELS: Record<keyof OpeningHours, string> = {
  seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta",
  sex: "Sexta",   sab: "Sábado", dom: "Domingo",
};

function StoreHoursPanel({
  storeId,
  initialHours,
}: {
  storeId: string;
  initialHours: OpeningHours | null;
}) {
  const showToast = useToastStore((s) => s.show);
  const [hours, setHours] = useState<OpeningHours>(initialHours ?? DEFAULT_OPENING_HOURS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialHours) setHours(initialHours);
  }, [initialHours]);

  function updateDay(day: keyof OpeningHours, patch: Partial<DayHours>) {
    setHours((h) => ({ ...h, [day]: { ...h[day], ...patch } }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateStoreOpeningHours(storeId, hours);
      showToast("Horários salvos!", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[#e8eaf0] bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Clock3 size={16} className="text-[#2563eb]" />
        <h2 className="font-black text-[#0f172a]">Horários de funcionamento</h2>
      </div>
      <p className="text-xs text-[#64748b]">
        Configure os horários de abertura e fechamento por dia da semana.
      </p>

      <div className="space-y-3">
        {(Object.keys(DAY_LABELS) as (keyof OpeningHours)[]).map((day) => {
          const d = hours[day];
          return (
            <div
              key={day}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                d.enabled ? "border-[#e2e8f0] bg-white" : "border-[#e2e8f0] bg-[#f8fafc] opacity-60"
              }`}
            >
              <button
                type="button"
                onClick={() => updateDay(day, { enabled: !d.enabled })}
                className={d.enabled ? "text-[#16a34a]" : "text-[#94a3b8]"}
              >
                {d.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
              <p className="w-20 shrink-0 text-sm font-black text-[#0f172a]">{DAY_LABELS[day]}</p>
              {d.enabled ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="time"
                    value={d.open}
                    onChange={(e) => updateDay(day, { open: e.target.value })}
                    className="flex-1 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30"
                  />
                  <span className="text-xs text-[#94a3b8]">até</span>
                  <input
                    type="time"
                    value={d.close}
                    onChange={(e) => updateDay(day, { close: e.target.value })}
                    className="flex-1 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30"
                  />
                </div>
              ) : (
                <span className="flex-1 text-xs font-bold text-[#94a3b8]">Fechado</span>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
      >
        {saving
          ? <><Loader2 size={16} className="animate-spin" /> Salvando…</>
          : "Salvar horários"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// FINANCEIRO TAB
// ══════════════════════════════════════════════════════════════

// ── Helpers financeiros ─────────────────────────────────────

function txIcon(tx: WalletTransaction) {
  if (tx.direction === "out") return <ArrowUpCircle size={16} className="text-red-500" />;
  if (tx.status === "held")   return <Clock3 size={16} className="text-yellow-500" />;
  return <ArrowDownCircle size={16} className="text-green-500" />;
}

function txColor(tx: WalletTransaction): string {
  if (tx.direction === "out") return "text-red-600";
  if (tx.status === "held")   return "text-yellow-600";
  return "text-green-600";
}

function txSign(tx: WalletTransaction): string {
  return tx.direction === "out" ? "−" : "+";
}

const PIX_KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: "cpf",    label: "CPF" },
  { value: "cnpj",   label: "CNPJ" },
  { value: "email",  label: "E-mail" },
  { value: "phone",  label: "Celular" },
  { value: "random", label: "Aleatória" },
];

// ══════════════════════════════════════════════════════════════
// FINANCEIRO TAB — Carteira, Extrato, Saque, Assinatura
// ══════════════════════════════════════════════════════════════

function FinanceiroTab({ orders }: { orders: Order[] }) {
  const showToast = useToastStore((s) => s.show);

  const { wallet, statement, isLoading: walletLoading, refetch: refetchWallet } = useMyWallet();
  const { data: subscription } = useMySubscription();
  const { withdrawals, isRequesting, pendingTotal, paidTotal, request: requestWd } = useWithdrawals();

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pixKey, setPixKey]         = useState(() => localStorage.getItem("seller-pix-key") ?? "");
  const [pixKeyType, setPixKeyType]  = useState<PixKeyType>(() => (localStorage.getItem("seller-pix-key-type") as PixKeyType) ?? "cpf");
  const [activeSection, setActiveSection] = useState<"overview" | "statement" | "withdraw">("overview");

  useEffect(() => {
    if (pixKey)     localStorage.setItem("seller-pix-key", pixKey);
  }, [pixKey]);
  useEffect(() => {
    localStorage.setItem("seller-pix-key-type", pixKeyType);
  }, [pixKeyType]);

  const paid        = orders.filter((o) => o.status >= 1 && o.status < 5);
  const totalOrders = paid.length;
  const planCfg     = subscription ? PLAN_CONFIG[subscription.plan] : PLAN_CONFIG.free;
  const commPct     = Math.round((planCfg.commissionRate) * 100);

  const availableBRL = wallet?.balance.available ?? 0;
  const heldBRL      = wallet?.balance.held ?? 0;

  const amount    = Number(withdrawAmount.replace(",", "."));
  const canWithdraw = isFinite(amount) && amount >= 10 && amount <= availableBRL && pixKey.trim().length > 0;

  async function handleWithdraw() {
    try {
      await requestWd({ amount, pixKey: pixKey.trim(), pixKeyType });
      setWithdrawAmount("");
      refetchWallet();
      showToast("Saque solicitado com sucesso! Processamos em até 24h úteis.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erro ao solicitar saque.", "error");
    }
  }

  if (walletLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[#16a34a]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Plano de assinatura ───────────────────────────────── */}
      <div
        className="rounded-3xl p-5 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${planCfg.color}dd, ${planCfg.color})` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown size={18} />
            <span className="text-xs font-black uppercase tracking-widest opacity-80">Plano atual</span>
          </div>
          <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-black">
            {planCfg.label}
          </span>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-3xl font-black">
              {planCfg.monthlyPrice > 0 ? formatBRL(planCfg.monthlyPrice) + "/mês" : "Gratuito"}
            </p>
            <p className="mt-1 text-xs opacity-75">
              Comissão BrasUX: <span className="font-black">{commPct}%</span> sobre produtos
            </p>
          </div>
          {subscription?.status === "overdue" && (
            <span className="flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-black">
              <Ban size={10} /> Em atraso
            </span>
          )}
          {subscription?.status === "trial" && (
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-black">
              <CheckCircle2 size={10} /> Trial ativo
            </span>
          )}
        </div>
      </div>

      {/* ── Saldo da carteira ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <CircleDollarSign size={14} className="text-green-600" />
            <p className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8]">Disponível para saque</p>
          </div>
          <p className="text-2xl font-black text-green-600">{formatBRL(availableBRL)}</p>
        </div>
        <div className="rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock3 size={14} className="text-yellow-500" />
            <p className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8]">Aguardando entrega</p>
          </div>
          <p className="text-2xl font-black text-yellow-600">{formatBRL(heldBRL)}</p>
        </div>
        <div className="rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={14} className="text-blue-500" />
            <p className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8]">Pedidos pagos</p>
          </div>
          <p className="text-2xl font-black text-[#0f172a]">{totalOrders}</p>
        </div>
        <div className="rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={14} className="text-[#64748b]" />
            <p className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8]">Total sacado</p>
          </div>
          <p className="text-2xl font-black text-[#0f172a]">{formatBRL(paidTotal)}</p>
        </div>
      </div>

      {/* ── Navegação de seções ───────────────────────────────── */}
      <div className="flex gap-2">
        {(["overview", "statement", "withdraw"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${
              activeSection === s
                ? "bg-[#0f172a] text-white shadow-sm"
                : "bg-[#f1f5f9] text-[#64748b]"
            }`}
          >
            {s === "overview" ? "Resumo" : s === "statement" ? "Extrato" : "Saque"}
          </button>
        ))}
      </div>

      {/* ── SEÇÃO: Extrato ─────────────────────────────────────── */}
      {activeSection === "statement" && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
            Extrato — últimas {statement.length} movimentações
          </p>
          {statement.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-[#e2e8f0] bg-white p-10 text-center">
              <CircleDollarSign size={28} className="text-[#cbd5e1]" />
              <p className="font-black text-[#0f172a]">Sem movimentações ainda</p>
              <p className="text-sm text-[#64748b]">O extrato aparece após o primeiro pedido pago.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#f1f5f9] rounded-2xl border border-[#e8eaf0] bg-white overflow-hidden">
              {statement.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 p-3.5">
                  <div className="flex-shrink-0">{txIcon(tx)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-[#0f172a]">{tx.description}</p>
                    <p className="text-[10px] text-[#94a3b8]">
                      {new Date(tx.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                      {tx.status === "held" && " · Aguardando entrega"}
                    </p>
                  </div>
                  <p className={`text-sm font-black ${txColor(tx)}`}>
                    {txSign(tx)}{formatBRL(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SEÇÃO: Saque ──────────────────────────────────────── */}
      {activeSection === "withdraw" && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-[#e8eaf0] bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-[#16a34a]" />
              <h2 className="font-black text-[#0f172a]">Solicitar saque via Pix</h2>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-3">
              <BadgePercent size={14} className="mt-0.5 flex-shrink-0 text-blue-600" />
              <p className="text-xs text-blue-700">
                Saldo disponível: <span className="font-black">{formatBRL(availableBRL)}</span>.
                Mínimo R$ 10,00. Processado em até 24h úteis.
              </p>
            </div>

            <div>
              <label className={lbl}>Tipo de chave Pix</label>
              <select
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value as PixKeyType)}
                className={inp}
              >
                {PIX_KEY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={lbl}>Chave Pix</label>
              <input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder={
                  pixKeyType === "cpf"    ? "000.000.000-00"    :
                  pixKeyType === "cnpj"   ? "00.000.000/0000-00" :
                  pixKeyType === "email"  ? "seu@email.com"     :
                  pixKeyType === "phone"  ? "+55 11 99999-9999" :
                  "Cole a chave aleatória"
                }
                className={inp}
              />
            </div>

            <div>
              <label className={lbl}>Valor a sacar (R$)</label>
              <input
                type="number" min="10" step="0.01" max={availableBRL}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Mínimo: 10,00"
                className={inp}
              />
              {amount > availableBRL && (
                <p className="mt-1 text-xs text-red-500">Valor superior ao saldo disponível.</p>
              )}
            </div>

            <button
              onClick={handleWithdraw}
              disabled={isRequesting || !canWithdraw}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
            >
              {isRequesting
                ? <><Loader2 size={15} className="animate-spin" /> Solicitando…</>
                : <><Wallet size={15} /> Solicitar Saque Pix</>
              }
            </button>
          </div>

          {/* Histórico de saques */}
          {withdrawals.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                Histórico de saques
              </p>
              <div className="space-y-2">
                {withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-2xl border border-[#e8eaf0] bg-white p-3">
                    <div>
                      <p className="text-sm font-black text-[#0f172a]">{formatBRL(w.amountGross)}</p>
                      <p className="text-[10px] text-[#94a3b8]">{w.pixKey} ({w.pixKeyType.toUpperCase()})</p>
                      <p className="text-[10px] text-[#94a3b8]">
                        {new Date(w.createdAt).toLocaleDateString("pt-BR")}
                        {w.processedAt && ` · Pago ${new Date(w.processedAt).toLocaleDateString("pt-BR")}`}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                      w.status === "paid"       ? "bg-green-50 text-green-700"   :
                      w.status === "failed"     ? "bg-red-50 text-red-600"       :
                      w.status === "processing" ? "bg-blue-50 text-blue-700"     :
                                                  "bg-yellow-50 text-yellow-700"
                    }`}>
                      {w.status === "paid"       ? "Pago"       :
                       w.status === "failed"     ? "Falhou"     :
                       w.status === "processing" ? "Processando" :
                       w.status === "cancelled"  ? "Cancelado"  : "Pendente"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SEÇÃO: Resumo ─────────────────────────────────────── */}
      {activeSection === "overview" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-sm space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Como funciona o split</p>
            {[
              { icon: <CircleDollarSign size={14} className="text-green-600" />, label: "Você recebe", desc: `Valor dos produtos menos ${commPct}% de comissão BrasUX` },
              { icon: <Wallet size={14} className="text-purple-600" />,          label: "Entregador recebe", desc: "100% da taxa de entrega — BrasUX não retém nada" },
              { icon: <BadgePercent size={14} className="text-blue-600" />,      label: "BrasUX recebe", desc: `${commPct}% sobre produtos + taxa operacional do comprador` },
              { icon: <Clock3 size={14} className="text-yellow-500" />,          label: "Liberação", desc: "Saldo liberado para saque após confirmação da entrega" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
                <div>
                  <p className="text-sm font-black text-[#0f172a]">{item.label}</p>
                  <p className="text-xs text-[#64748b]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Saques pendentes */}
          {pendingTotal > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 p-3">
              <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-700">
                <span className="font-black">{formatBRL(pendingTotal)}</span> em saques pendentes de processamento.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mini gráfico de barras ────────────────────────────────────

function MiniBarChart({ orders }: { orders: Order[] }) {
  const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const now = new Date();

  const data = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toDateString();
    const count = orders.filter(
      (o) => new Date(o.createdAt).toDateString() === dayStr && o.status >= 1 && o.status < 5,
    ).length;
    return { label: DAY_LABELS[d.getDay()], count };
  });

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
        Pedidos — últimos 7 dias
      </p>
      <div className="flex h-20 items-end gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[9px] font-bold text-[#64748b]">{d.count > 0 ? d.count : ""}</span>
            <div
              className="w-full rounded-t-lg transition-all duration-500"
              style={{
                height: `${Math.max(4, (d.count / max) * 60)}px`,
                background: d.count === 0 ? "#f1f5f9" : "linear-gradient(180deg, #16a34a, #15803d)",
              }}
            />
            <span className="text-[8px] font-bold text-[#94a3b8]">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PAINEL TAB
// ══════════════════════════════════════════════════════════════

function PainelTab({ orders, products, store }: { orders: Order[]; products: StoreProduct[]; store: Store }) {
  const today  = new Date().toDateString();
  const paid     = orders.filter((o) => o.status >= 1 && o.status < 5);
  const pending  = orders.filter((o) => o.status === 1);          // pago, aguardando seller
  const today_o  = orders.filter((o) => new Date(o.createdAt).toDateString() === today);
  const lowStock = products.filter((p) => p.available && p.stock > 0 && p.stock <= 3);
  const outStock = products.filter((p) => p.available && p.stock === 0);

  const totalRevenue = paid.reduce((s, o) => s + o.total, 0);

  const avgOrderValue = paid.length > 0 ? totalRevenue / paid.length : 0;
  const hasUrgent = orders.some(isUrgentOrder);

  const metrics = [
    { label: "Receita total",     value: formatBRL(totalRevenue), icon: <TrendingUp size={18} />,    accent: false },
    { label: "Ticket médio",      value: formatBRL(avgOrderValue), icon: <Star size={18} />,          accent: false },
    { label: "Pedidos hoje",      value: String(today_o.length),  icon: <ClipboardList size={18} />, accent: false },
    { label: "Aguardando ação",   value: String(pending.length),  icon: <AlertTriangle size={18} />, accent: pending.length > 0 },
  ];

  return (
    <div className="space-y-5">
      {/* Alerta de urgência — pedidos aguardando aceite > 15 min */}
      {hasUrgent && (
        <div className="flex items-center gap-3 rounded-2xl border border-orange-300 bg-orange-50 p-4 animate-pulse">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100">
            <Zap size={18} className="text-orange-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-orange-700">Pedidos aguardando há mais de 15 min!</p>
            <p className="text-xs text-orange-600">Aceite os pedidos para não perder clientes.</p>
          </div>
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`rounded-2xl border p-4 ${m.accent ? "border-orange-200 bg-orange-50" : "border-[#e8eaf0] bg-white"} shadow-sm`}
          >
            <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${m.accent ? "bg-orange-100 text-orange-600" : "bg-[#16a34a]/10 text-[#16a34a]"}`}>
              {m.icon}
            </div>
            <p className={`text-2xl font-black ${m.accent ? "text-orange-600" : "text-[#0f172a]"}`}>{m.value}</p>
            <p className="text-[11px] font-medium text-[#64748b] mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Gráfico de pedidos por dia */}
      <MiniBarChart orders={orders} />

      {/* Status da loja */}
      <div className="rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Status da loja</p>
          <p className="mt-0.5 font-black text-[#0f172a]">{store.name}</p>
          <p className="text-xs text-[#64748b]">{products.length} produto{products.length !== 1 ? "s" : ""} · {store.category}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${store.isOpen ? "bg-green-50 text-green-700" : "bg-[#f1f5f9] text-[#64748b]"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${store.isOpen ? "bg-green-500" : "bg-[#94a3b8]"}`} />
          {store.isOpen ? "Aberta" : "Fechada"}
        </span>
      </div>

      {/* Alertas de estoque */}
      {(lowStock.length > 0 || outStock.length > 0) && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-500" />
            <p className="text-sm font-black text-orange-700">Alertas de estoque</p>
          </div>
          {outStock.map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <span className="text-xs text-orange-700 truncate">{p.name}</span>
              <span className="text-[10px] font-black text-red-600 bg-red-50 rounded-full px-2 py-0.5">Sem estoque</span>
            </div>
          ))}
          {lowStock.map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <span className="text-xs text-orange-700 truncate">{p.name}</span>
              <span className="text-[10px] font-black text-orange-600 bg-orange-100 rounded-full px-2 py-0.5">{p.stock} restantes</span>
            </div>
          ))}
        </div>
      )}

      {/* Últimos pedidos */}
      {orders.length > 0 && (
        <div>
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Últimos pedidos</p>
          <div className="space-y-2">
            {orders.slice(0, 5).map((o) => {
              const cfg    = STATUS_CFG[o.status as keyof typeof STATUS_CFG] ?? STATUS_CFG[0];
              const urgent = isUrgentOrder(o);
              return (
                <div key={o.id} className={`flex items-center justify-between rounded-xl border p-3 ${urgent ? "border-orange-200 bg-orange-50" : "border-[#e8eaf0] bg-white"}`}>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-black text-[#0f172a]">#{o.id.slice(0, 8).toUpperCase()}</p>
                      {urgent && <span className="text-[9px] font-black text-orange-600 bg-orange-100 rounded-full px-1.5 py-0.5">URGENTE</span>}
                    </div>
                    <p className="text-[11px] text-[#64748b]">{o.customerName} · {formatBRL(o.total)} · {timeAgo(o.createdAt)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {orders.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-[#e2e8f0] bg-white p-10 text-center">
          <ClipboardList size={32} className="mx-auto text-[#cbd5e1]" />
          <p className="mt-3 font-black text-[#0f172a]">Nenhum pedido ainda</p>
          <p className="mt-1 text-sm text-[#64748b]">Quando os clientes fizerem pedidos, eles aparecerão aqui.</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PEDIDOS TAB
// ══════════════════════════════════════════════════════════════

type FilterStatus = "all" | 0 | 1 | 2 | 3 | 4 | 5;

const FILTER_TABS: { key: FilterStatus; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: 1,     label: "Aceitar" },
  { key: 2,     label: "Preparando" },
  { key: 3,     label: "Entrega" },
  { key: 4,     label: "Entregues" },
];

function PedidosTab({
  orders, storeId, onRefetch,
}: {
  orders: Order[];
  storeId: string;
  onRefetch: () => void;
}) {
  const queryClient = useQueryClient();
  const showToast   = useToastStore((s) => s.show);
  const [filter, setFilter]       = useState<FilterStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Real-time: novos pedidos chegam instantaneamente
  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`seller-orders-${storeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.storeOrders(storeId) });
          showToast("🆕 Novo pedido chegou!", "success");
          playNewOrderSound();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.storeOrders(storeId) }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [storeId, queryClient, showToast]);

  const advanceMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: number; customerId?: string }) =>
      sellerUpdateOrderStatus(orderId, storeId, status),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storeOrders(storeId) });
      // Notifica comprador quando pedido sai para entrega ou é entregue
      if (vars.customerId) {
        if (vars.status === 3) {
          sendPushToUser(vars.customerId, "🛵 Seu pedido saiu para entrega!", "Acompanhe o rastreamento em Pedidos.", "/pedidos");
        } else if (vars.status === 4) {
          sendPushToUser(vars.customerId, "✅ Pedido entregue!", "Seu pedido foi entregue. Avalie o produto!", "/pedidos");
        }
      }
    },
    onError: () => showToast("Erro ao atualizar pedido.", "error"),
  });

  async function handleCancel(orderId: string) {
    setCancelling(orderId);
    try {
      await sellerUpdateOrderStatus(orderId, storeId, 5);
      queryClient.invalidateQueries({ queryKey: queryKeys.storeOrders(storeId) });
    } catch {
      showToast("Erro ao cancelar pedido.", "error");
    } finally {
      setCancelling(null);
    }
  }

  const rawFiltered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  // Pedidos aguardando aceite aparecem do mais antigo para o mais novo (maior urgência primeiro)
  const filtered = filter === 1 || filter === "all"
    ? [...rawFiltered].sort((a, b) => {
        if (a.status === 1 && b.status !== 1) return -1;
        if (a.status !== 1 && b.status === 1) return 1;
        if (a.status === 1 && b.status === 1) return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
    : rawFiltered;

  const pendingCount = orders.filter((o) => o.status === 1).length;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTER_TABS.map((f) => (
          <button
            key={String(f.key)}
            onClick={() => setFilter(f.key)}
            className={`relative shrink-0 rounded-xl px-4 py-2 text-xs font-black transition-colors ${
              filter === f.key
                ? "bg-[#0f172a] text-white"
                : "border border-[#e2e8f0] bg-white text-[#64748b]"
            }`}
          >
            {f.label}
            {f.key === 1 && pendingCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={onRefetch}
          className="shrink-0 flex items-center gap-1 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-[#64748b] hover:text-[#16a34a]"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-[#e2e8f0] bg-white p-12 text-center">
          <ClipboardList size={32} className="mx-auto text-[#cbd5e1]" />
          <p className="mt-3 font-black text-[#0f172a]">
            {filter === "all" ? "Nenhum pedido ainda" : "Nenhum pedido nesta categoria"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const cfg        = STATUS_CFG[order.status as keyof typeof STATUS_CFG] ?? STATUS_CFG[0];
            const nextStatus = order.status + 1 as keyof typeof STATUS_CFG;
            const nextLabel  = cfg.next;
            const paymentCfg = PAYMENT_CFG[order.paymentStatus] ?? PAYMENT_CFG.PENDING;
            const isExpanded = expandedId === order.id;

            const urgent = isUrgentOrder(order);
            return (
              <div key={order.id} className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition-all ${urgent ? "border-orange-300 shadow-orange-100" : "border-[#e8eaf0]"}`}>
                {/* Linha compacta (sempre visível) */}
                <div
                  className="flex cursor-pointer items-center gap-3 p-4"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  {/* Status dot */}
                  <div className={`h-3 w-3 shrink-0 rounded-full ${urgent ? "animate-pulse bg-orange-500" : cfg.dot}`} />

                  {/* Info principal */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-[#0f172a]">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      {urgent && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-700">
                          ⚡ URGENTE
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#64748b] truncate">
                      {order.customerName} · {order.items.length} {order.items.length === 1 ? "item" : "itens"} · {timeAgo(order.createdAt)}
                    </p>
                  </div>

                  {/* Total + chevron */}
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-black text-[#0f172a]">{formatBRL(order.total)}</span>
                    {isExpanded ? <ChevronUp size={15} className="text-[#94a3b8]" /> : <ChevronDown size={15} className="text-[#94a3b8]" />}
                  </div>
                </div>

                {/* Detalhes expandidos */}
                {isExpanded && (
                  <div className="border-t border-[#f1f5f9] bg-[#f8fafc] p-4 space-y-4">
                    {/* Itens do pedido */}
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Itens</p>
                      <div className="space-y-1.5">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex justify-between">
                            <span className="text-xs text-[#0f172a]">{item.quantity}× {item.productName}</span>
                            <span className="text-xs font-bold text-[#0f172a]">{formatBRL(item.totalPrice)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Valores */}
                    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-3 space-y-1">
                      <div className="flex justify-between text-xs text-[#64748b]">
                        <span>Subtotal</span><span>{formatBRL(order.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-[#64748b]">
                        <span>Entrega</span><span>{order.deliveryFee === 0 ? "Grátis" : formatBRL(order.deliveryFee)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black text-[#0f172a] border-t border-[#f1f5f9] pt-1">
                        <span>Total</span><span>{formatBRL(order.total)}</span>
                      </div>
                    </div>

                    {/* Cliente + endereço */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-[#64748b]">
                        <Phone size={12} />
                        <span>{order.customerName} — {order.customerPhone}</span>
                        {whatsappUrl(order.customerPhone, order.id) && (
                          <a
                            href={whatsappUrl(order.customerPhone, order.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="ml-auto flex items-center gap-1 rounded-lg bg-green-50 border border-green-200 px-2 py-1 text-[10px] font-black text-green-700 hover:bg-green-100"
                          >
                            <MessageCircle size={11} /> WhatsApp
                          </a>
                        )}
                      </div>
                      <div className="flex items-start gap-2 text-xs text-[#64748b]">
                        <MapPin size={12} className="mt-0.5 shrink-0" />
                        <span>
                          {order.deliveryAddress}, {order.deliveryNumber}
                          {order.deliveryComplement ? ` — ${order.deliveryComplement}` : ""} · {order.deliveryNeighborhood}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#64748b]">
                        <CreditCard size={12} />
                        <span className="capitalize">{order.paymentMethod}</span>
                        <span className={`font-bold ${paymentCfg.color}`}>{paymentCfg.label}</span>
                      </div>
                    </div>

                    {/* Data */}
                    <p className="text-[10px] text-[#94a3b8]">
                      Pedido em {new Date(order.createdAt).toLocaleString("pt-BR")}
                    </p>

                    {/* Ações */}
                    {order.status < 4 && order.status !== 5 && (
                      <div className="flex gap-2 pt-1">
                        {nextLabel && nextStatus <= 4 && (
                          <button
                            onClick={() => advanceMutation.mutate({ orderId: order.id, status: nextStatus, customerId: order.customerId })}
                            disabled={advanceMutation.isPending}
                            className="flex-1 rounded-2xl py-2.5 text-xs font-black text-white disabled:opacity-60"
                            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
                          >
                            {advanceMutation.isPending && advanceMutation.variables?.orderId === order.id
                              ? "Atualizando…"
                              : nextLabel}
                          </button>
                        )}
                        {order.status !== 0 && (
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={cancelling === order.id}
                            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-black text-red-600 disabled:opacity-50"
                          >
                            {cancelling === order.id ? <Loader2 size={13} className="animate-spin" /> : "Cancelar"}
                          </button>
                        )}
                      </div>
                    )}

                    {order.status === 4 && (
                      <div className="flex items-center gap-2 rounded-2xl bg-green-50 border border-green-200 p-3">
                        <span className="text-base">✅</span>
                        <p className="text-xs font-black text-green-700">Pedido entregue com sucesso!</p>
                      </div>
                    )}

                    {order.status === 5 && (
                      <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200 p-3">
                        <span className="text-base">❌</span>
                        <p className="text-xs font-black text-red-600">Pedido cancelado.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN SELLER PAGE
// ══════════════════════════════════════════════════════════════

export default function SellerPage() {
  const navigate    = useNavigate();
  const showToast   = useToastStore((s) => s.show);
  const queryClient = useQueryClient();

  const [store, setStore]           = useState<Store | null | undefined>(undefined);
  const [activeTab, setActiveTab]   = useState<Tab>("painel");
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [productModal, setProductModal]   = useState<{ open: boolean; product?: StoreProduct | null }>({ open: false });
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  // Carrega a loja do seller
  useEffect(() => {
    getMyStore().then(setStore);
  }, []);

  const storeId = store?.id ?? "";

  // Produtos (TanStack Query)
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: queryKeys.myStoreProducts(storeId),
    queryFn: () => getMyStoreProducts(storeId),
    enabled: !!storeId,
  });

  // Pedidos (TanStack Query + polling 30s)
  const { data: orders = [], refetch: refetchOrders } = useQuery({
    queryKey: queryKeys.storeOrders(storeId),
    queryFn: () => getStoreOrders(storeId),
    enabled: !!storeId,
    refetchInterval: 30_000,
  });

  // Horários de funcionamento da loja
  const { data: openingHours = null } = useQuery({
    queryKey: queryKeys.storeHours(storeId),
    queryFn: () => getStoreOpeningHours(storeId),
    enabled: !!storeId,
  });

  const pendingOrders = orders.filter((o) => o.status === 1).length;

  const handleToggleAvailable = useCallback(async (p: StoreProduct) => {
    try {
      await updateStoreProduct(p.id, storeId, { available: !p.available });
      queryClient.invalidateQueries({ queryKey: queryKeys.myStoreProducts(storeId) });
    } catch {
      showToast("Erro ao atualizar.", "error");
    }
  }, [storeId, queryClient, showToast]);

  const handleDeleteProduct = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await deleteStoreProduct(id, storeId);
      queryClient.invalidateQueries({ queryKey: queryKeys.myStoreProducts(storeId) });
      showToast("Produto removido.", "success");
    } catch {
      showToast("Erro ao remover produto.", "error");
    } finally {
      setDeletingId(null);
    }
  }, [storeId, queryClient, showToast]);

  // Loading inicial da loja
  if (store === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#16a34a]" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "painel",      label: "Painel",      icon: <LayoutDashboard size={16} /> },
    { key: "pedidos",     label: "Pedidos",     icon: <ClipboardList size={16} />,  badge: pendingOrders },
    { key: "produtos",    label: "Produtos",    icon: <Package size={16} /> },
    { key: "loja",        label: "Loja",        icon: <StoreIcon size={16} /> },
    { key: "financeiro",  label: "Financeiro",  icon: <Wallet size={16} /> },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a]"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">BrasUX</p>
          <h1 className="text-xl font-black text-[#0f172a] truncate">
            {store ? store.name : "Minha loja"}
          </h1>
        </div>
        {store && activeTab === "loja" && (
          <button
            onClick={() => setShowStoreForm((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-black text-[#0f172a]"
          >
            <Pencil size={14} />
            {showStoreForm ? "Fechar" : "Editar"}
          </button>
        )}
      </div>

      {/* Sem loja ainda */}
      {!store && (
        <StoreForm onSave={(s) => { setStore(s); setActiveTab("produtos"); }} />
      )}

      {/* App com tabs */}
      {store && (
        <>
          {/* Tab navigation */}
          <div className="flex gap-1 rounded-2xl border border-[#e8eaf0] bg-[#f8fafc] p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition-all ${
                  activeTab === t.key
                    ? "bg-white text-[#0f172a] shadow-sm"
                    : "text-[#64748b] hover:text-[#0f172a]"
                }`}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
                {t.badge !== undefined && t.badge > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Painel */}
          {activeTab === "painel" && (
            <PainelTab orders={orders} products={products} store={store} />
          )}

          {/* Pedidos */}
          {activeTab === "pedidos" && (
            <PedidosTab
              orders={orders}
              storeId={storeId}
              onRefetch={() => refetchOrders()}
            />
          )}

          {/* Produtos */}
          {activeTab === "produtos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-[#0f172a]">
                  {products.length} produto{products.length !== 1 ? "s" : ""}
                </p>
                <button
                  onClick={() => setProductModal({ open: true, product: null })}
                  className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black text-white"
                  style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
                >
                  <Plus size={16} /> Adicionar
                </button>
              </div>

              {loadingProducts ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-[#16a34a]" />
                </div>
              ) : products.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-[#e2e8f0] bg-white p-16 text-center">
                  <Package size={40} className="mx-auto text-[#cbd5e1]" />
                  <p className="mt-4 font-black text-[#0f172a]">Nenhum produto ainda</p>
                  <p className="mt-1 text-sm text-[#64748b]">Adicione seu primeiro produto para começar a vender.</p>
                  <button
                    onClick={() => setProductModal({ open: true, product: null })}
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white"
                    style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
                  >
                    <Plus size={16} /> Adicionar produto
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {products.map((p) => (
                    <div key={p.id} className="overflow-hidden rounded-3xl border border-[#e8eaf0] bg-white shadow-sm">
                      <div className="flex items-center gap-4 p-4">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#f8fafc]">
                          {p.imageUrl
                            ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-contain p-1" />
                            : <div className="flex h-full w-full items-center justify-center"><ImageIcon size={20} className="text-[#cbd5e1]" /></div>
                          }
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-black text-[#0f172a] text-sm">{p.name}</h3>
                            {p.featured && (
                              <span className="shrink-0 rounded-full bg-[#fffbeb] border border-[#f59e0b]/30 px-2 py-0.5 text-[9px] font-bold text-[#b45309]">⭐ Destaque</span>
                            )}
                            {!p.available && (
                              <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[9px] font-bold uppercase text-[#94a3b8]">Inativo</span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#94a3b8]">{p.category}{p.brand ? ` · ${p.brand}` : ""}</p>
                          <div className="mt-1 flex items-center gap-2">
                            {p.promotionalPrice ? (
                              <>
                                <span className="text-[10px] text-[#94a3b8] line-through">{formatBRL(p.price)}</span>
                                <span className="text-sm font-black text-[#16a34a]">{formatBRL(p.promotionalPrice)}</span>
                              </>
                            ) : (
                              <span className="text-sm font-black text-[#16a34a]">{formatBRL(p.price)}</span>
                            )}
                            <span className="text-[10px] text-[#94a3b8]">· estoque: {p.stock}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => handleToggleAvailable(p)}
                            className={p.available ? "text-[#16a34a]" : "text-[#cbd5e1]"}
                            title={p.available ? "Desativar" : "Ativar"}
                          >
                            {p.available ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                          </button>
                          <button onClick={() => setProductModal({ open: true, product: p })} className="rounded-xl p-2 text-[#64748b] hover:bg-[#f1f5f9]">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)} className="rounded-xl p-2 text-[#64748b] hover:bg-[#f1f5f9]">
                            {expandedProduct === p.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </div>
                      </div>
                      {expandedProduct === p.id && (
                        <div className="border-t border-[#f1f5f9] bg-[#f8fafc] px-4 pb-4 pt-3">
                          {p.description && <p className="mb-3 text-sm text-[#64748b]">{p.description}</p>}
                          <button
                            onClick={() => handleDeleteProduct(p.id)}
                            disabled={deletingId === p.id}
                            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-600 disabled:opacity-50"
                          >
                            {deletingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            Remover produto
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Loja */}
          {activeTab === "loja" && (
            <div className="space-y-4">
              {/* Resumo da loja quando form fechado */}
              {!showStoreForm && (
                <div
                  className="relative overflow-hidden rounded-3xl p-5"
                  style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
                      style={{ background: "rgba(22,163,74,0.2)", border: "1px solid rgba(22,163,74,0.3)" }}
                    >
                      🏪
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="truncate text-lg font-black text-white">{store.name}</h2>
                      <p className="text-sm text-[#94a3b8]">{store.category}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${store.isOpen ? "bg-green-900/40 text-green-400" : "bg-white/10 text-[#94a3b8]"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${store.isOpen ? "bg-green-400" : "bg-[#94a3b8]"}`} />
                          {store.isOpen ? "Aberta" : "Fechada"}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-[#94a3b8]">
                          {products.length} produto{products.length !== 1 ? "s" : ""}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-[#94a3b8]">
                          {store.deliveryFee === 0 ? "Entrega grátis" : `Entrega ${formatBRL(store.deliveryFee)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showStoreForm && (
                <StoreForm
                  store={store}
                  onSave={(s) => { setStore(s); setShowStoreForm(false); }}
                />
              )}

              {/* Horários de funcionamento */}
              <StoreHoursPanel storeId={storeId} initialHours={openingHours} />
            </div>
          )}

          {/* Financeiro */}
          {activeTab === "financeiro" && (
            <FinanceiroTab orders={orders} />
          )}
        </>
      )}

      {/* Product Modal */}
      {productModal.open && store && (
        <ProductModal
          storeId={store.id}
          product={productModal.product}
          featuredCount={products.filter((p) => p.featured && p.id !== productModal.product?.id).length}
          onSave={() => queryClient.invalidateQueries({ queryKey: queryKeys.myStoreProducts(storeId) })}
          onClose={() => setProductModal({ open: false })}
        />
      )}
    </div>
  );
}

// ── CSS ────────────────────────────────────────────────────────
const inp = "w-full rounded-xl bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30 placeholder:text-[#cbd5e1]";
const lbl = "mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]";
