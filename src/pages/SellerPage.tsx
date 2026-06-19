import { useState, useEffect } from "react";
import {
  ArrowLeft, Package, Plus, Pencil, Trash2, Store as StoreIcon,
  Loader2, ToggleLeft, ToggleRight, Image as ImageIcon, ChevronDown, ChevronUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import {
  getMyStore, createStore, updateStore,
  getMyStoreProducts, createStoreProduct, updateStoreProduct, deleteStoreProduct,
  type Store, type StoreProduct, type StorePayload, type StoreProductPayload,
} from "../services/gizApi";
import { formatBRL } from "../utils/format";
import ImagePicker from "../components/seller/ImagePicker";
import { useToastStore } from "../stores/toastStore";

function slugify(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const CATEGORIES = ["Restaurante", "Mercearia", "Bebidas", "Farmácia", "Pet Shop", "Padaria", "Hortifruti", "Conveniência", "Açougue", "Floricultura", "Tabacaria", "Tecnologia", "Outros"];

/* ── PRODUCT FORM ─────────────────────────────────────────── */

type ProductFormData = {
  name: string;
  category: string;
  subCategory: string;
  brand: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  price: string;
  promotionalPrice: string;
  stock: string;
  available: boolean;
};

const EMPTY_PRODUCT: ProductFormData = {
  name: "", category: "", subCategory: "", brand: "", description: "",
  imageUrl: "", imageAlt: "", price: "", promotionalPrice: "", stock: "0", available: true,
};

function ProductModal({
  storeId,
  product,
  onSave,
  onClose,
}: {
  storeId: string;
  product?: StoreProduct | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ProductFormData>(
    product
      ? {
          name: product.name,
          category: product.category,
          subCategory: product.subCategory ?? "",
          brand: product.brand ?? "",
          description: product.description ?? "",
          imageUrl: product.imageUrl ?? "",
          imageAlt: product.imageAlt ?? "",
          price: String(product.price),
          promotionalPrice: product.promotionalPrice ? String(product.promotionalPrice) : "",
          stock: String(product.stock),
          available: product.available,
        }
      : EMPTY_PRODUCT
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const addToast = useToastStore((s) => s.add);

  function set(key: keyof ProductFormData, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Nome é obrigatório."); return; }
    if (!form.category.trim()) { setError("Categoria é obrigatória."); return; }
    if (!form.price || isNaN(Number(form.price))) { setError("Preço inválido."); return; }
    setSaving(true);
    setError(null);
    const payload: StoreProductPayload = {
      name: form.name.trim(),
      slug: slugify(form.name),
      category: form.category,
      subCategory: form.subCategory || undefined,
      brand: form.brand || undefined,
      description: form.description || undefined,
      imageUrl: form.imageUrl || undefined,
      imageAlt: form.imageAlt || form.name,
      price: Number(form.price),
      promotionalPrice: form.promotionalPrice ? Number(form.promotionalPrice) : null,
      stock: Number(form.stock) || 0,
      available: form.available,
    };
    try {
      if (product) {
        await updateStoreProduct(product.id, payload);
        addToast("Produto atualizado!", "success");
      } else {
        await createStoreProduct(storeId, payload);
        addToast("Produto adicionado!", "success");
      }
      onSave();
      onClose();
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
            <h2 className="text-lg font-black text-[#0f172a]">
              {product ? "Editar produto" : "Novo produto"}
            </h2>
            <button onClick={onClose} className="rounded-xl bg-[#f1f5f9] p-2 text-[#64748b]">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Imagem */}
            <div>
              <label className={labelCls}>Imagem do produto</label>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-[#e2e8f0] bg-[#f8fafc] p-4 transition-colors hover:border-[#16a34a]/50"
              >
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt={form.imageAlt} className="h-16 w-16 rounded-xl object-contain bg-white" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#e2e8f0]">
                    <ImageIcon size={24} className="text-[#94a3b8]" />
                  </div>
                )}
                <div className="text-left">
                  <p className="font-black text-[#0f172a] text-sm">
                    {form.imageUrl ? "Trocar imagem" : "Escolher imagem"}
                  </p>
                  <p className="text-xs text-[#94a3b8]">Banco BrasUX · Upload · URL</p>
                </div>
              </button>
            </div>

            <div>
              <label className={labelCls}>Nome do produto *</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Coca-Cola 350ml Lata" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Categoria *</label>
                <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
                  <option value="">Selecione…</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Subcategoria</label>
                <input value={form.subCategory} onChange={(e) => set("subCategory", e.target.value)} placeholder="Ex: Refrigerante" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Marca</label>
              <input value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Ex: Coca-Cola" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Descreva o produto…"
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Preço (R$) *</label>
                <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0,00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Preço promocional</label>
                <input type="number" step="0.01" min="0" value={form.promotionalPrice} onChange={(e) => set("promotionalPrice", e.target.value)} placeholder="0,00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Estoque</label>
                <input type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
              <button
                type="button"
                onClick={() => set("available", !form.available)}
                className={form.available ? "text-[#16a34a]" : "text-[#94a3b8]"}
              >
                {form.available ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
              <div>
                <p className="text-sm font-black text-[#0f172a]">
                  {form.available ? "Disponível para venda" : "Indisponível"}
                </p>
                <p className="text-xs text-[#94a3b8]">Controla se aparece na loja</p>
              </div>
            </div>

            {error && (
              <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>
            )}
          </div>

          <div className="border-t border-[#f1f5f9] p-4">
            <button
              onClick={handleSave}
              disabled={saving}
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

/* ── STORE FORM ───────────────────────────────────────────── */

function StoreForm({
  store,
  onSave,
}: {
  store?: Store | null;
  onSave: (s: Store) => void;
}) {
  const [form, setForm] = useState({
    name: store?.name ?? "",
    category: store?.category ?? "",
    description: store?.description ?? "",
    whatsapp: store?.whatsapp ?? "",
    phone: store?.phone ?? "",
    deliveryFee: store?.deliveryFee != null ? String(store.deliveryFee) : "0",
    deliveryTimeMin: store?.deliveryTimeMin != null ? String(store.deliveryTimeMin) : "30",
    deliveryTimeMax: store?.deliveryTimeMax != null ? String(store.deliveryTimeMax) : "60",
    isOpen: store?.isOpen ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addToast = useToastStore((s) => s.add);

  function set(key: keyof typeof form, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Nome da loja é obrigatório."); return; }
    if (!form.category) { setError("Categoria é obrigatória."); return; }
    setSaving(true);
    setError(null);
    const payload: StorePayload = {
      name: form.name.trim(),
      slug: slugify(form.name),
      category: form.category,
      description: form.description || undefined,
      whatsapp: form.whatsapp || undefined,
      phone: form.phone || undefined,
      deliveryFee: Number(form.deliveryFee) || 0,
      deliveryTimeMin: Number(form.deliveryTimeMin) || 30,
      deliveryTimeMax: Number(form.deliveryTimeMax) || 60,
      isOpen: form.isOpen,
      active: true,
    };
    try {
      const saved = store
        ? await updateStore(store.id, payload)
        : await createStore(payload);
      addToast(store ? "Loja atualizada!" : "Loja criada!", "success");
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
        <label className={labelCls}>Nome da loja *</label>
        <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Mercadinho do João" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Categoria *</label>
        <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
          <option value="">Selecione…</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label className={labelCls}>Descrição</label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          placeholder="Apresente sua loja…"
          className={`${inputCls} resize-none`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>WhatsApp</label>
          <input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(00) 00000-0000" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Telefone</label>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(00) 0000-0000" className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Taxa entrega (R$)</label>
          <input type="number" min="0" step="0.50" value={form.deliveryFee} onChange={(e) => set("deliveryFee", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Tempo mín (min)</label>
          <input type="number" min="5" value={form.deliveryTimeMin} onChange={(e) => set("deliveryTimeMin", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Tempo máx (min)</label>
          <input type="number" min="5" value={form.deliveryTimeMax} onChange={(e) => set("deliveryTimeMax", e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
        <button
          type="button"
          onClick={() => set("isOpen", !form.isOpen)}
          className={form.isOpen ? "text-[#16a34a]" : "text-[#94a3b8]"}
        >
          {form.isOpen ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
        </button>
        <div>
          <p className="text-sm font-black text-[#0f172a]">{form.isOpen ? "Loja aberta" : "Loja fechada"}</p>
          <p className="text-xs text-[#94a3b8]">Clientes podem fazer pedidos agora?</p>
        </div>
      </div>

      {error && (
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
      >
        {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando…</> : store ? "Salvar alterações" : "Criar loja"}
      </button>
    </div>
  );
}

/* ── MAIN PAGE ────────────────────────────────────────────── */

export default function SellerPage() {
  const navigate = useNavigate();
  const auth = useAuthStore((s) => s.user);
  const addToast = useToastStore((s) => s.add);

  const [store, setStore] = useState<Store | null | undefined>(undefined);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [productModal, setProductModal] = useState<{ open: boolean; product?: StoreProduct | null }>({ open: false });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  // Carrega a loja do seller
  useEffect(() => {
    getMyStore().then((s) => {
      setStore(s);
      if (s) loadProducts(s.id);
    });
  }, []);

  async function loadProducts(storeId: string) {
    setLoadingProducts(true);
    try {
      const ps = await getMyStoreProducts(storeId);
      setProducts(ps);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function handleDeleteProduct(id: string) {
    setDeletingId(id);
    try {
      await deleteStoreProduct(id);
      setProducts((ps) => ps.filter((p) => p.id !== id));
      addToast("Produto removido.", "info");
    } catch {
      addToast("Erro ao remover produto.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleAvailable(p: StoreProduct) {
    try {
      const updated = await updateStoreProduct(p.id, { available: !p.available });
      setProducts((ps) => ps.map((x) => (x.id === p.id ? updated : x)));
    } catch {
      addToast("Erro ao atualizar.", "error");
    }
  }

  if (store === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#16a34a]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a]"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">BrasUX</p>
          <h1 className="text-xl font-black text-[#0f172a]">Minha loja</h1>
        </div>
        {store && (
          <button
            onClick={() => setShowStoreForm((v) => !v)}
            className="ml-auto flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-black text-[#0f172a] hover:bg-[#f8fafc]"
          >
            <Pencil size={14} />
            {showStoreForm ? "Fechar" : "Editar loja"}
            {showStoreForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Sem loja */}
      {!store && (
        <StoreForm
          onSave={(s) => {
            setStore(s);
            loadProducts(s.id);
          }}
        />
      )}

      {/* Editar loja */}
      {store && showStoreForm && (
        <StoreForm
          store={store}
          onSave={(s) => {
            setStore(s);
            setShowStoreForm(false);
          }}
        />
      )}

      {/* Resumo da loja */}
      {store && !showStoreForm && (
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
              <div className="mt-2 flex gap-2">
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

      {/* Produtos */}
      {store && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-[#0f172a]">Produtos</h2>
            <button
              onClick={() => setProductModal({ open: true, product: null })}
              className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black text-white"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
            >
              <Plus size={16} /> Adicionar produto
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
                <div
                  key={p.id}
                  className="rounded-3xl border border-[#e8eaf0] bg-white overflow-hidden shadow-sm"
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Imagem */}
                    <div className="h-14 w-14 shrink-0 rounded-2xl bg-[#f8fafc] overflow-hidden">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="h-full w-full object-contain p-1" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon size={20} className="text-[#cbd5e1]" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-black text-[#0f172a] text-sm">{p.name}</h3>
                        {!p.available && (
                          <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[9px] font-bold uppercase text-[#94a3b8]">
                            Inativo
                          </span>
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

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => handleToggleAvailable(p)}
                        className={p.available ? "text-[#16a34a]" : "text-[#cbd5e1]"}
                        title={p.available ? "Desativar" : "Ativar"}
                      >
                        {p.available ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                      </button>
                      <button
                        onClick={() => setProductModal({ open: true, product: p })}
                        className="rounded-xl p-2 text-[#64748b] hover:bg-[#f1f5f9]"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}
                        className="rounded-xl p-2 text-[#64748b] hover:bg-[#f1f5f9]"
                      >
                        {expandedProduct === p.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded */}
                  {expandedProduct === p.id && (
                    <div className="border-t border-[#f1f5f9] bg-[#f8fafc] px-4 pb-4 pt-3">
                      {p.description && (
                        <p className="mb-3 text-sm text-[#64748b]">{p.description}</p>
                      )}
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        disabled={deletingId === p.id}
                        className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-600 hover:bg-red-100 disabled:opacity-50"
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

      {/* Product Modal */}
      {productModal.open && store && (
        <ProductModal
          storeId={store.id}
          product={productModal.product}
          onSave={() => loadProducts(store.id)}
          onClose={() => setProductModal({ open: false })}
        />
      )}
    </div>
  );
}

const inputCls = "w-full rounded-xl bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30 placeholder:text-[#cbd5e1]";
const labelCls = "mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]";
