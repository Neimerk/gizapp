import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { loginCustomer, registerCustomer } from "../services/gizApi";
import { saveAuth } from "../services/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      const auth =
        mode === "login"
          ? await loginCustomer({ email, password })
          : await registerCustomer({ name, email, password, role: "Customer", storeId: null });
      saveAuth(auth);
      navigate("/checkout");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f2f7]">
      {/* TOP BANNER */}
      <div
        className="relative overflow-hidden px-6 pb-10 pt-14"
        style={{
          background:
            "radial-gradient(circle at 80% 20%, rgba(124,58,237,0.5), transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="absolute left-4 top-5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#2563eb] shadow-xl">
          <Zap size={28} className="fill-[#ffd400] text-[#ffd400]" />
        </div>

        <h1 className="mt-5 text-3xl font-black text-white">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="mt-1 text-sm text-[#94a3b8]">
          {mode === "login"
            ? "Acesse para finalizar pedidos com segurança."
            : "Crie sua conta GizApp em segundos."}
        </p>
      </div>

      {/* FORM CARD */}
      <div className="-mt-6 rounded-t-[32px] bg-[#f0f2f7] px-4 pt-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-[#e8eaf0] bg-white p-5 shadow-sm"
        >
          {mode === "register" && (
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-[#64748b]">
                Nome completo
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full rounded-2xl bg-[#f8fafc] px-4 py-3.5 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#7c3aed]/30 border border-[#e2e8f0]"
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
              className="w-full rounded-2xl bg-[#f8fafc] px-4 py-3.5 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#7c3aed]/30 border border-[#e2e8f0]"
            />
          </div>

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
                className="w-full rounded-2xl bg-[#f8fafc] px-4 py-3.5 pr-12 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#7c3aed]/30 border border-[#e2e8f0]"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#2563eb] py-4 text-sm font-black text-white shadow-lg shadow-[#7c3aed]/30 disabled:opacity-60 active:scale-[0.98] transition-transform"
          >
            {loading
              ? "Aguarde…"
              : mode === "login"
              ? "Entrar na conta"
              : "Criar minha conta"}
          </button>

          <button
            type="button"
            onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}
            className="mt-4 w-full text-center text-sm font-black text-[#7c3aed]"
          >
            {mode === "login"
              ? "Não tenho conta — Criar agora"
              : "Já tenho conta — Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
