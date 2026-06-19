import {
  ArrowLeft,
  Heart,
  Home,
  Loader2,
  LogOut,
  Mail,
  Shield,
  Smartphone,
  Star,
  Store as StoreIcon,
  Trash2,
  User,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useCepLookup } from "../hooks/useCepLookup";

import { getAuth, logout } from "../services/auth";
import { updateMyProfile, getMyProfile, getProductImageUrl } from "../services/gizApi";
import { useFavoritesStore } from "../stores/favoritesStore";
import { usePointsStore } from "../stores/pointsStore";
import { formatBRL } from "../utils/format";

const ACCOUNT_KEY = "brasux-account";

type AccountForm = {
  name: string;
  cpf: string;
  email: string;
  phone: string;
  cep: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  pixKey: string;
};

const EMPTY: AccountForm = {
  name: "", cpf: "", email: "", phone: "",
  cep: "", address: "", number: "", complement: "", neighborhood: "",
  pixKey: "",
};

function load(): AccountForm {
  try {
    const saved = localStorage.getItem(ACCOUNT_KEY);
    return saved ? { ...EMPTY, ...JSON.parse(saved) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

const num = (v: string) => v.replace(/\D/g, "");
const fmtCPF = (v: string) =>
  num(v).slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
const fmtPhone = (v: string) =>
  num(v).slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
const fmtCEP = (v: string) => num(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");

export default function AccountPage() {
  const navigate = useNavigate();
  const auth = getAuth();
  const favProducts = useFavoritesStore((s) => s.products);
  const favStores = useFavoritesStore((s) => s.stores);
  const toggleProduct = useFavoritesStore((s) => s.toggleProduct);
  const toggleStore = useFavoritesStore((s) => s.toggleStore);
  const points = usePointsStore((s) => s.points);
  const pointsHistory = usePointsStore((s) => s.history);
  const [form, setForm] = useState<AccountForm>(() => ({
    ...load(),
    name: load().name || auth?.name || "",
    email: load().email || auth?.email || "",
  }));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { lookup: lookupCep, loading: cepLoading, error: cepError } = useCepLookup();

  // Carrega dados do Supabase ao montar e mescla com localStorage
  useEffect(() => {
    getMyProfile().then((profile) => {
      if (!profile) return;
      const local = load();
      setForm((prev) => ({
        ...prev,
        name: profile.name || prev.name,
        email: profile.email || prev.email,
        phone: profile.phone ? fmtPhone(profile.phone) : prev.phone,
        cpf: profile.cpf ? fmtCPF(profile.cpf) : prev.cpf,
        cep: profile.zipCode ? fmtCEP(profile.zipCode) : prev.cep,
        address: profile.address || prev.address,
        number: profile.addressNumber || prev.number,
        complement: profile.addressComplement || prev.complement,
        neighborhood: profile.neighborhood || prev.neighborhood,
        pixKey: local.pixKey || prev.pixKey,
      }));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function update(key: keyof AccountForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCepChange(raw: string) {
    const v = fmtCEP(raw);
    update("cep", v);
    const data = await lookupCep(v);
    if (data) {
      setForm((f) => ({
        ...f,
        cep: v,
        address: data.logradouro || f.address,
        neighborhood: data.bairro || f.neighborhood,
      }));
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    // Always persist locally (covers payment fields and offline use)
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(form));

    if (auth) {
      try {
        const updated = await updateMyProfile({
          name: form.name || undefined,
          phone: num(form.phone) || undefined,
          cpf: num(form.cpf) || undefined,
          zipCode: num(form.cep) || undefined,
          address: form.address || undefined,
          addressNumber: form.number || undefined,
          addressComplement: form.complement || undefined,
          neighborhood: form.neighborhood || undefined,
        });
        // atualiza nome no authStore se mudou
        if (updated.name !== auth.name) {
          const { useAuthStore } = await import("../stores/authStore");
          useAuthStore.setState((s) => s.user ? { user: { ...s.user, name: updated.name } } : {});
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Erro ao salvar no servidor.");
      }
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleLogout() {
    await logout();
    localStorage.removeItem("brasux-orders");
    navigate("/login");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a]"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">
            BrasUX
          </p>
          <h1 className="text-xl font-black text-[#0f172a]">Minha conta</h1>
        </div>
      </div>

      {/* PROFILE BANNER */}
      <div
        className="relative overflow-hidden rounded-3xl p-5"
        style={{
          background:
            "radial-gradient(circle at 80% 20%, rgba(22,163,74,0.4), transparent 50%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            <User size={30} className="text-[#4ade80]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-white truncate">
              {auth ? auth.name : "Bem-vindo!"}
            </h2>
            <p className="text-sm text-[#94a3b8] truncate">
              {auth ? auth.email : "Complete seu cadastro"}
            </p>
            {auth && (
              <span className="mt-1 inline-flex items-center rounded-full bg-[#16a34a]/30 px-2.5 py-0.5 text-[10px] font-bold text-[#c4b5fd]">
                {auth.role}
              </span>
            )}
          </div>
        </div>

        {auth?.role === "Admin" && (
          <a
            href="/admin"
            className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg, #002776, #001640)" }}
          >
            <Shield size={16} /> Painel Admin
          </a>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/favoritos"
            className="flex items-center gap-2 rounded-xl bg-red-500/80 px-4 py-2.5 text-sm font-black text-white active:scale-95 transition-transform"
          >
            <Heart size={16} /> Favoritos
            {(favProducts.length + favStores.length) > 0 && (
              <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-black">
                {favProducts.length + favStores.length}
              </span>
            )}
          </Link>
          {auth && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-black text-white active:scale-95 transition-transform"
            >
              <LogOut size={16} /> Sair da conta
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {/* DADOS PESSOAIS */}
        <SectionCard icon={<User size={16} className="text-[#16a34a]" />} title="Dados pessoais">
          <Field label="Nome completo">
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Seu nome"
              className={inputCls}
            />
          </Field>
          <Field label="CPF">
            <input
              value={form.cpf}
              onChange={(e) => update("cpf", fmtCPF(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              className={inputCls}
            />
          </Field>
        </SectionCard>

        {/* CONTATO */}
        <SectionCard icon={<Mail size={16} className="text-[#2563eb]" />} title="Contato">
          <Field label="E-mail">
            <input
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="seu@email.com"
              type="email"
              className={inputCls}
            />
          </Field>
          <Field label="Celular">
            <input
              value={form.phone}
              onChange={(e) => update("phone", fmtPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              inputMode="numeric"
              className={inputCls}
            />
          </Field>
        </SectionCard>

        {/* ENDEREÇO */}
        <SectionCard icon={<Home size={16} className="text-[#ec4899]" />} title="Endereço de entrega">
          <Field label="CEP">
            <div className="relative">
              <input
                value={form.cep}
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
          </Field>
          <Field label="Rua / Avenida">
            <input
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Nome da rua"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Número">
              <input
                value={form.number}
                onChange={(e) => update("number", e.target.value)}
                placeholder="123"
                className={inputCls}
              />
            </Field>
            <Field label="Complemento">
              <input
                value={form.complement}
                onChange={(e) => update("complement", e.target.value)}
                placeholder="Apto, bloco…"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Bairro">
            <input
              value={form.neighborhood}
              onChange={(e) => update("neighborhood", e.target.value)}
              placeholder="Nome do bairro"
              className={inputCls}
            />
          </Field>
        </SectionCard>

        {/* PONTOS */}
        <SectionCard icon={<Star size={16} className="text-[#f59e0b]" />} title="Programa de pontos">
          <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-[#0f172a] to-[#002776] px-5 py-4">
            <div>
              <p className="text-xs font-bold text-white/60">Seus pontos</p>
              <p className="text-3xl font-black text-white">{points.toLocaleString("pt-BR")}</p>
              <p className="mt-0.5 text-[10px] text-white/40">1 ponto = R$ 1 gasto</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f59e0b]/20">
              <Star size={28} className="text-[#f59e0b]" />
            </div>
          </div>
          {pointsHistory.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Histórico recente</p>
              {pointsHistory.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-xl bg-[#f8fafc] px-3 py-2">
                  <div>
                    <p className="text-xs font-bold text-[#0f172a]">{entry.description}</p>
                    <p className="text-[10px] text-[#94a3b8]">
                      {new Date(entry.date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-black ${
                      entry.amount > 0 ? "text-[#16a34a]" : "text-red-500"
                    }`}
                  >
                    {entry.amount > 0 ? "+" : ""}{entry.amount} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* FAVORITOS */}
        {(favProducts.length > 0 || favStores.length > 0) && (
          <SectionCard icon={<Heart size={16} className="text-red-500" />} title="Favoritos">
            {favStores.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8] flex items-center gap-1">
                  <StoreIcon size={10} /> Lojas
                </p>
                {favStores.map((store) => (
                  <div key={store.id} className="flex items-center gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                    <Link to={`/lojas/${store.id}`} className="flex flex-1 items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#16a34a] text-xs font-black text-white">
                        {store.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#0f172a]">{store.name}</p>
                        <p className="text-xs text-[#64748b]">{store.category.split(",")[0]}</p>
                      </div>
                    </Link>
                    <button
                      onClick={() => toggleStore(store)}
                      className="shrink-0 rounded-lg p-1.5 text-[#cbd5e1] hover:text-red-500"
                      aria-label="Remover dos favoritos"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {favProducts.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                  Produtos
                </p>
                {favProducts.map((product) => (
                  <div key={product.id} className="flex items-center gap-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                    <Link
                      to={`/lojas/${product.storeId}/produto/${product.id}`}
                      className="flex flex-1 items-center gap-3 min-w-0"
                    >
                      {product.imageUrl ? (
                        <img
                          src={getProductImageUrl(product.imageUrl)}
                          alt={product.name}
                          className="h-10 w-10 shrink-0 rounded-xl object-cover bg-white"
                          onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f5f9] text-xl">
                          🛍️
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#0f172a]">{product.name}</p>
                        <p className="text-xs font-bold text-[#16a34a]">
                          {formatBRL(Number(product.promotionalPrice ?? product.price))}
                        </p>
                      </div>
                    </Link>
                    <button
                      onClick={() => toggleProduct(product)}
                      className="shrink-0 rounded-lg p-1.5 text-[#cbd5e1] hover:text-red-500"
                      aria-label="Remover dos favoritos"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* PIX */}
        <SectionCard icon={<Smartphone size={16} className="text-[#16a34a]" />} title="Chave Pix">
          <Field label="Chave Pix">
            <input
              value={form.pixKey}
              onChange={(e) => update("pixKey", e.target.value)}
              placeholder="CPF, e-mail, celular ou chave aleatória"
              className={inputCls}
            />
          </Field>
        </SectionCard>

        {/* SAVE */}
        {saveError && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
            {saveError}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 ${
            saved
              ? "bg-[#16a34a] shadow-green-200"
              : "bg-gradient-to-r from-[#16a34a] to-[#2563eb] shadow-[#16a34a]/30"
          }`}
        >
          {saving ? (
            <><Loader2 size={16} className="animate-spin" /> Salvando…</>
          ) : saved ? (
            "✓ Salvo com sucesso!"
          ) : (
            "Salvar cadastro"
          )}
        </button>

      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30 placeholder:text-[#cbd5e1]";

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f8fafc]">
          {icon}
        </div>
        <h2 className="text-sm font-black text-[#0f172a]">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
        {label}
      </label>
      {children}
    </div>
  );
}
