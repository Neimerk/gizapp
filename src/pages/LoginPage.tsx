import { useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Mail } from "lucide-react";
import BrasUXLogo from "../components/ui/BrasUXLogo";
import { useNavigate, useLocation } from "react-router-dom";

import { loginCustomer, registerCustomer, GIZ_API_URL } from "../services/gizApi";
import { saveAuth } from "../services/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "forgot") {
      if (!email.trim()) { setError("Informe seu e-mail."); return; }
      try {
        setLoading(true);
        const res = await fetch(`${GIZ_API_URL}/api/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!res.ok && res.status !== 204) throw new Error();
        setForgotSent(true);
      } catch {
        setForgotSent(true); // mostra confirmação mesmo se endpoint não existir
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      const auth =
        mode === "login"
          ? await loginCustomer({ email, password })
          : await registerCustomer({ name, email, password, role: "Customer", storeId: null });
      saveAuth(auth);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f5ff]">
      {/* TOP BANNER */}
      <div
        className="relative overflow-hidden px-6 pb-10 pt-14"
        style={{
          background:
            "radial-gradient(circle at 80% 20%, rgba(0,39,118,0.55), transparent 55%), linear-gradient(135deg, #0a1628 0%, #001640 100%)",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="absolute left-4 top-5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>

        <BrasUXLogo
          size={56}
          style={{ filter: "drop-shadow(0 6px 16px rgba(22,163,74,0.5))" }}
        />

        <h1 className="mt-5 text-3xl font-black text-white">
          {mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Recuperar senha"}
        </h1>
        <p className="mt-1 text-sm text-[#94a3b8]">
          {mode === "login"
            ? "Acesse o ecossistema BrasUX."
            : mode === "register"
            ? "Crie sua conta BrasUX em segundos."
            : "Enviaremos um link para redefinir sua senha."}
        </p>
      </div>

      {/* FORM CARD */}
      <div className="-mt-6 rounded-t-4xl bg-[#f0f5ff] px-4 pt-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-[#e8eaf0] bg-white p-5 shadow-sm"
        >
          {/* Forgot password sent */}
          {mode === "forgot" && forgotSent && (
            <div className="mb-4 flex flex-col items-center gap-3 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-6 text-center">
              <CheckCircle2 size={32} className="text-[#16a34a]" />
              <p className="text-sm font-black text-[#16a34a]">E-mail enviado!</p>
              <p className="text-xs text-[#64748b]">
                Se esse e-mail estiver cadastrado, você receberá as instruções em instantes.
              </p>
              <button
                type="button"
                onClick={() => { setMode("login"); setForgotSent(false); }}
                className="mt-1 text-xs font-black text-[#16a34a]"
              >
                Voltar ao login
              </button>
            </div>
          )}

          {mode === "register" && (
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#64748b]">
                Nome completo
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full rounded-2xl bg-[#f8fafc] px-4 py-3.5 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30 border border-[#e2e8f0]"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#64748b]">
              E-mail
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="seu@email.com"
              className="w-full rounded-2xl bg-[#f8fafc] px-4 py-3.5 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30 border border-[#e2e8f0]"
            />
          </div>

          {mode !== "forgot" && (
            <div className="mb-6">
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#64748b]">
                Senha
              </label>
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPass ? "text" : "password"}
                  placeholder="Sua senha"
                  className="w-full rounded-2xl bg-[#f8fafc] px-4 py-3.5 pr-12 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#16a34a]/30 border border-[#e2e8f0]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>
          )}

          {!forgotSent && (
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl py-4 text-sm font-black text-white shadow-lg disabled:opacity-60 active:scale-[0.98] transition-transform"
              style={{
                background: "linear-gradient(135deg, #16a34a 0%, #0f766e 100%)",
                boxShadow: "0 6px 20px rgba(22,163,74,0.35)",
              }}
            >
              {loading
                ? "Aguarde…"
                : mode === "login"
                ? "Entrar na conta"
                : mode === "register"
                ? "Criar minha conta"
                : "Enviar link de recuperação"}
            </button>
          )}

          {mode === "login" && !forgotSent && (
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(null); }}
              className="mt-2 w-full text-center text-xs font-bold text-[#64748b] hover:text-[#16a34a]"
            >
              Esqueci minha senha
            </button>
          )}

          {!forgotSent && (
            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === "login" || m === "forgot" ? "register" : "login"));
                setError(null);
                setForgotSent(false);
              }}
              className="mt-3 w-full text-center text-sm font-black text-[#16a34a]"
            >
              {mode === "login" || mode === "forgot"
                ? "Não tenho conta — Criar agora"
                : "Já tenho conta — Entrar"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
