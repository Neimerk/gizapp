import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowRight, CheckCircle2, Eye, EyeOff, Loader2,
  Package, ShoppingBag, Star, Store, TrendingUp, Zap,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import BrasUXLogo from "../components/ui/BrasUXLogo";

// ── Helpers ───────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function callRegisterSeller(name: string, email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/register-seller`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erro ao criar conta.");
  return data as { ok: boolean; userId: string };
}

// ── Benefícios ────────────────────────────────────────────────

const BENEFITS = [
  { icon: <ShoppingBag size={20} className="text-[#16a34a]" />, title: "Alcance nacional",        text: "Exponha seus produtos para compradores em todo o Brasil." },
  { icon: <Zap          size={20} className="text-[#f59e0b]" />, title: "Zero burocracia",         text: "Crie sua loja em minutos, sem contratos ou mensalidade." },
  { icon: <TrendingUp   size={20} className="text-[#2563eb]" />, title: "Painel completo",         text: "Gerencie pedidos, produtos e saque seus ganhos com Pix." },
  { icon: <Star         size={20} className="text-[#9333ea]" />, title: "Avaliações reais",        text: "Construa reputação com avaliações verificadas de compradores." },
  { icon: <Package      size={20} className="text-[#ea580c]" />, title: "Catálogo de imagens",     text: "Banco com mais de 1.200 fotos de produtos prontas para usar." },
  { icon: <Store        size={20} className="text-[#0891b2]" />, title: "Entrega integrada",       text: "Entregadores parceiros já conectados à sua loja automaticamente." },
];

// ── Componente principal ──────────────────────────────────────

export default function SellerPortalPage() {
  const navigate    = useNavigate();
  const [mode, setMode] = useState<"landing" | "register" | "login">("landing");

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <Link to="/" className="flex items-center gap-2.5">
          <BrasUXLogo size={36} />
          <span className="text-lg font-black text-white">
            Bras<span className="text-[#16a34a]">UX</span>
            <span className="ml-1.5 text-xs font-bold text-[#16a34a] opacity-80">para Lojistas</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {mode !== "login" && (
            <button
              onClick={() => setMode("login")}
              className="text-sm font-bold text-[#94a3b8] hover:text-white transition-colors"
            >
              Já tenho conta
            </button>
          )}
          <Link
            to="/"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 transition-colors"
          >
            Ver marketplace
          </Link>
        </div>
      </header>

      {mode === "landing" && <LandingSection onStart={() => setMode("register")} onLogin={() => setMode("login")} />}
      {mode === "register" && <RegisterForm onSuccess={() => navigate("/minha-loja")} onLoginClick={() => setMode("login")} />}
      {mode === "login"    && <LoginForm    onSuccess={() => navigate("/minha-loja")} onRegisterClick={() => setMode("register")} />}
    </div>
  );
}

// ── Landing ───────────────────────────────────────────────────

function LandingSection({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  return (
    <main className="px-6 py-12 md:px-12">
      {/* Hero */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#16a34a]/30 bg-[#16a34a]/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#4ade80]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4ade80]" />
          Marketplace Aberto para Lojistas
        </div>

        <h1 className="text-4xl font-black leading-tight text-white md:text-6xl">
          Venda para o Brasil<br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #16a34a, #4ade80)" }}
          >
            sem complicação
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base text-[#94a3b8]">
          Crie sua loja no BrasUX em menos de 5 minutos. Gerencie produtos, pedidos e entregas em um único painel. Saque seus ganhos via Pix a qualquer hora.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={onStart}
            className="flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-black text-white transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 8px 32px rgba(22,163,74,0.4)" }}
          >
            Criar minha loja grátis <ArrowRight size={18} />
          </button>
          <button
            onClick={onLogin}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-base font-black text-white hover:bg-white/10 transition-colors"
          >
            Já tenho loja — entrar
          </button>
        </div>

        <p className="mt-4 text-xs text-[#475569]">
          Gratuito para começar · Sem contrato · Pix instantâneo
        </p>
      </div>

      {/* Benefícios */}
      <div className="mx-auto mt-20 max-w-5xl">
        <p className="mb-8 text-center text-xs font-black uppercase tracking-widest text-[#475569]">
          Por que vender no BrasUX?
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.06]"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                {b.icon}
              </div>
              <p className="mb-1 font-black text-white">{b.title}</p>
              <p className="text-sm text-[#64748b]">{b.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA final */}
      <div className="mx-auto mt-20 max-w-xl text-center">
        <div className="rounded-3xl border border-[#16a34a]/20 bg-[#16a34a]/5 p-8">
          <p className="text-2xl font-black text-white">Pronto para vender?</p>
          <p className="mt-2 text-sm text-[#64748b]">Junte-se aos lojistas que já estão vendendo no BrasUX.</p>
          <button
            onClick={onStart}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
          >
            Começar agora — é grátis <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </main>
  );
}

// ── Cadastro ──────────────────────────────────────────────────

function RegisterForm({ onSuccess, onLoginClick }: { onSuccess: () => void; onLoginClick: () => void }) {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [done, setDone]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Senha mínima: 8 caracteres."); return; }
    setLoading(true);
    setError(null);
    try {
      // 1. Cria conta de seller via Edge Function
      await callRegisterSeller(name.trim(), email.trim(), password);

      // 2. Faz login automaticamente
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInErr || !data.user) throw new Error("Conta criada! Faça login para continuar.");

      // 3. Atualiza estado global de auth
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, role, store_id")
        .eq("id", data.user.id)
        .single();

      useAuthStore.setState({
        user: {
          id:      data.user.id,
          name:    profile?.name ?? name.trim(),
          email:   data.user.email ?? email,
          role:    "Seller",
          storeId: profile?.store_id ?? null,
        },
        initialized: true,
      });

      setDone(true);
      setTimeout(onSuccess, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-black text-white">Crie sua conta</h2>
          <p className="mt-2 text-sm text-[#64748b]">Gratuito · Sem cartão de crédito</p>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-[#16a34a]/30 bg-[#16a34a]/10 p-8 text-center">
            <CheckCircle2 size={40} className="text-[#4ade80]" />
            <p className="font-black text-white">Conta criada com sucesso!</p>
            <p className="text-sm text-[#64748b]">Redirecionando para o painel…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={lbl}>Seu nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="João Silva"
                required
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joao@suaempresa.com.br"
                required
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Senha</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  className={`${inp} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-white"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-2xl border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm font-bold text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Criando conta…</> : "Criar minha conta grátis"}
            </button>

            <p className="text-center text-xs text-[#475569]">
              Ao criar sua conta, você concorda com nossa{" "}
              <Link to="/privacidade" className="text-[#16a34a] hover:underline">
                Política de Privacidade
              </Link>
            </p>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-[#475569]">
          Já tem conta?{" "}
          <button onClick={onLoginClick} className="font-black text-[#16a34a] hover:underline">
            Entrar
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────

function LoginForm({ onSuccess, onRegisterClick }: { onSuccess: () => void; onRegisterClick: () => void }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password,
      });
      if (signInErr || !data.user) throw new Error("E-mail ou senha inválidos.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, role, store_id")
        .eq("id", data.user.id)
        .single();

      if (profile?.role !== "seller" && profile?.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("Esta conta não tem acesso ao painel de lojistas.");
      }

      const roleMap: Record<string, "Admin" | "Seller"> = { admin: "Admin", seller: "Seller" };
      useAuthStore.setState({
        user: {
          id:      data.user.id,
          name:    profile.name,
          email:   data.user.email ?? email,
          role:    roleMap[profile.role] ?? "Seller",
          storeId: profile.store_id ?? null,
        },
        initialized: true,
      });

      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-black text-white">Entrar na sua loja</h2>
          <p className="mt-2 text-sm text-[#64748b]">Painel exclusivo para lojistas BrasUX</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={lbl}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>Senha</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                required
                className={`${inp} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-white"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-2xl border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm font-bold text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Entrando…</> : "Entrar no painel"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#475569]">
          Ainda não tem loja?{" "}
          <button onClick={onRegisterClick} className="font-black text-[#16a34a] hover:underline">
            Criar conta grátis
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Estilos compartilhados ────────────────────────────────────

const inp = "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-semibold text-white outline-none placeholder:text-[#475569] focus:border-[#16a34a]/50 focus:ring-2 focus:ring-[#16a34a]/20 transition-colors";
const lbl = "mb-1.5 block text-xs font-black uppercase tracking-wide text-[#475569]";
