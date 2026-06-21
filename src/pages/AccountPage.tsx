import {
  ArrowLeft,
  Bell, BellOff,
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
import { usePushNotifications } from "../hooks/usePushNotifications";

import { getAuth, logout } from "../services/auth";
import { updateMyProfile, getMyProfile, getProductImageUrl } from "../services/gizApi";
import { useFavoritesStore } from "../stores/favoritesStore";
import { usePointsStore, type PointsEntry } from "../stores/pointsStore";
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

  const [deletingAccount, setDeletingAccount] = useState(false);
  async function handleDeleteAccount() {
    if (!window.confirm("Tem certeza? Esta ação é irreversível. Seus dados serão apagados permanentemente.")) return;
    if (!window.confirm("Confirme novamente: excluir conta e todos os seus dados?")) return;
    setDeletingAccount(true);
    try {
      const { supabase } = await import("../lib/supabase");
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${session?.access_token ?? ""}`,
          },
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao excluir conta.");
      localStorage.clear();
      navigate("/");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao excluir conta.");
    } finally {
      setDeletingAccount(false);
    }
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

        {/* PONTOS + NÍVEL */}
        <SectionCard icon={<Star size={16} className="text-[#f59e0b]" />} title="Programa de pontos BrasUX">
          <LoyaltyWidget points={points} pointsHistory={pointsHistory} />
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

        {/* NOTIFICAÇÕES PUSH */}
        <PushNotificationsCard />

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

        {/* LGPD — Exclusão de conta */}
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-red-600">Zona de perigo</p>
          <p className="mt-1 text-xs text-red-500">
            A exclusão de conta é permanente. Seus dados pessoais serão anonimizados conforme a LGPD.{" "}
            <Link to="/privacidade" className="underline underline-offset-2">Política de Privacidade</Link>
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={deletingAccount}
            className="mt-3 flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-xs font-black text-red-600 hover:bg-red-100 disabled:opacity-60"
          >
            {deletingAccount
              ? <><Loader2 size={13} className="animate-spin" /> Excluindo…</>
              : <><Trash2 size={13} /> Excluir minha conta</>}
          </button>
        </div>

      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30 placeholder:text-[#cbd5e1]";

function PushNotificationsCard() {
  const { status, subscribe, unsubscribe } = usePushNotifications();
  const [loading, setLoading] = useState(false);

  if (status === "unsupported") return null;

  const isOn = status === "subscribed";

  async function toggle() {
    setLoading(true);
    if (isOn) await unsubscribe();
    else      await subscribe();
    setLoading(false);
  }

  return (
    <SectionCard icon={<Bell size={16} className="text-[#16a34a]" />} title="Notificações">
      <div className="flex items-center justify-between rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3.5">
        <div>
          <p className="text-sm font-black text-[#0f172a]">
            {isOn ? "Notificações ativadas ✅" : "Ativar notificações push"}
          </p>
          <p className="mt-0.5 text-xs text-[#64748b]">
            {status === "denied"
              ? "Permissão negada — habilite nas configurações do navegador."
              : isOn
              ? "Você receberá alertas de pedidos e entregas."
              : "Receba alertas quando seu pedido sair para entrega."}
          </p>
        </div>
        {status !== "denied" && (
          <button
            onClick={toggle}
            disabled={loading}
            className={`ml-4 flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition-colors disabled:opacity-50 ${
              isOn
                ? "border border-red-200 bg-red-50 text-red-500"
                : "bg-[#16a34a] text-white"
            }`}
          >
            {loading
              ? <Loader2 size={13} className="animate-spin" />
              : isOn
              ? <><BellOff size={13} /> Desativar</>
              : <><Bell size={13} /> Ativar</>
            }
          </button>
        )}
      </div>
    </SectionCard>
  );
}

// ── LOYALTY WIDGET ──────────────────────────────────────────────

const LEVELS = [
  { name: "Bronze",   min: 0,    max: 499,   emoji: "🥉", color: "#cd7f32", bg: "#fdf2e9" },
  { name: "Prata",    min: 500,  max: 1999,  emoji: "🥈", color: "#9ca3af", bg: "#f9fafb" },
  { name: "Ouro",     min: 2000, max: 4999,  emoji: "🥇", color: "#f59e0b", bg: "#fffbeb" },
  { name: "Diamante", min: 5000, max: 9999,  emoji: "💎", color: "#6366f1", bg: "#eef2ff" },
  { name: "Elite",    min: 10000, max: Infinity, emoji: "👑", color: "#16a34a", bg: "#f0fdf4" },
];

function getLoyaltyLevel(points: number) {
  return LEVELS.findLast((l) => points >= l.min) ?? LEVELS[0];
}

function LoyaltyWidget({
  points,
  pointsHistory,
}: {
  points: number;
  pointsHistory: PointsEntry[];
}) {
  const level = getLoyaltyLevel(points);
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
  const progress = nextLevel
    ? Math.min(100, ((points - level.min) / (nextLevel.min - level.min)) * 100)
    : 100;

  const BADGES = [
    { id: "first", emoji: "🛒", label: "Primeira compra", unlocked: pointsHistory.some((e) => e.amount > 0) },
    { id: "loyal5", emoji: "🔁", label: "5 compras",      unlocked: pointsHistory.filter((e) => e.amount > 0).length >= 5 },
    { id: "big",    emoji: "💰", label: "R$ 500 gastos",  unlocked: points >= 500 },
    { id: "gold",   emoji: "🥇", label: "Nível Ouro",     unlocked: points >= 2000 },
    { id: "dia",    emoji: "💎", label: "Nível Diamante",  unlocked: points >= 5000 },
    { id: "elite",  emoji: "👑", label: "Elite BrasUX",   unlocked: points >= 10000 },
  ];

  return (
    <div className="space-y-4">
      {/* Pontos + nível */}
      <div
        className="relative overflow-hidden rounded-2xl p-5"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #002776 60%, #001a4e 100%)" }}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#f59e0b] opacity-10 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Seus pontos</p>
            <p className="mt-0.5 text-4xl font-black text-white tabnum">{points.toLocaleString("pt-BR")}</p>
            <p className="mt-0.5 text-[10px] text-white/40">1 ponto = R$ 1 de desconto</p>
          </div>
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
            style={{ background: `${level.color}22`, border: `1px solid ${level.color}44` }}
          >
            {level.emoji}
          </div>
        </div>

        {/* Nível atual */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black" style={{ color: level.color }}>{level.name}</span>
            {nextLevel && (
              <span className="text-white/40">
                {nextLevel.min - points} pts para {nextLevel.name} {nextLevel.emoji}
              </span>
            )}
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${level.color}, ${nextLevel?.color ?? level.color})`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Benefícios do nível */}
      <div
        className="rounded-2xl border px-4 py-3"
        style={{ borderColor: `${level.color}33`, background: level.bg }}
      >
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest" style={{ color: level.color }}>
          {level.emoji} Benefícios nível {level.name}
        </p>
        <ul className="space-y-1 text-xs text-[#64748b]">
          {level.name === "Bronze"   && <><li>• Cashback 1× em pontos</li><li>• Acesso a cupons gerais</li></>}
          {level.name === "Prata"    && <><li>• Cashback 1.5× em pontos</li><li>• Frete grátis em compras acima de R$80</li></>}
          {level.name === "Ouro"     && <><li>• Cashback 2× em pontos</li><li>• Frete grátis em compras acima de R$50</li><li>• Acesso antecipado a flash sales</li></>}
          {level.name === "Diamante" && <><li>• Cashback 3× em pontos</li><li>• Frete grátis ilimitado</li><li>• Suporte prioritário</li><li>• Badge exclusivo</li></>}
          {level.name === "Elite"    && <><li>• Cashback 5× em pontos</li><li>• Frete grátis ilimitado</li><li>• Gerente de conta exclusivo</li><li>• Todas as vantagens anteriores</li></>}
        </ul>
      </div>

      {/* Conquistas */}
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Conquistas</p>
        <div className="grid grid-cols-3 gap-2">
          {BADGES.map((b) => (
            <div
              key={b.id}
              className={`flex flex-col items-center gap-1 rounded-2xl border py-3 transition-all ${
                b.unlocked
                  ? "border-[#16a34a]/30 bg-[#f0fdf4]"
                  : "border-[#e2e8f0] bg-[#f8fafc] opacity-40"
              }`}
            >
              <span className="text-xl">{b.unlocked ? b.emoji : "🔒"}</span>
              <p className="text-center text-[9px] font-black leading-tight text-[#64748b]">{b.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Histórico */}
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
              <span className={`text-sm font-black ${entry.amount > 0 ? "text-[#16a34a]" : "text-red-500"}`}>
                {entry.amount > 0 ? "+" : ""}{entry.amount} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
