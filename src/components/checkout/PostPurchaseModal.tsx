import { CheckCircle2, Package, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { clearGuestSession, mergeGuestToAccount } from "../../services/guestSession";

type Props = {
  orderId:       string;
  trackingCode?: string;
  defaultEmail?: string;
  guestToken?:   string;
  onClose:       () => void;
};

export function PostPurchaseModal({
  orderId,
  trackingCode,
  defaultEmail = "",
  guestToken,
  onClose,
}: Props) {
  const [email,    setEmail]    = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [merged,   setMerged]   = useState<{ orders: number; addresses: number } | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setError("Informe um e-mail válido e senha de ao menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // 1. Cria conta
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password });
      if (signUpErr) { setError(signUpErr.message); return; }

      // 2. Merge dos dados de convidado para a nova conta
      if (guestToken && signUpData.session?.access_token) {
        try {
          const result = await mergeGuestToAccount(
            signUpData.session.access_token,
            guestToken,
          );
          setMerged({ orders: result.ordersMerged, addresses: result.addressesMerged });
        } catch {
          // Merge falhou mas conta criada — não bloqueia o usuário
          setMerged({ orders: 0, addresses: 0 });
        }
      }

      clearGuestSession();
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-subtle text-muted"
          aria-label="Fechar"
        >
          <X size={14} />
        </button>

        {done ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f0fdf4]">
              <CheckCircle2 size={32} className="text-[#16a34a]" />
            </div>
            <div>
              <p className="text-lg font-black text-content">Conta criada!</p>
              <p className="mt-1 text-xs text-muted">
                Verifique seu e-mail para confirmar.
                {merged && merged.orders > 0
                  ? ` Seu pedido foi vinculado à sua conta automaticamente.`
                  : " Seus próximos pedidos serão salvos automaticamente."}
              </p>
            </div>
            {trackingCode && (
              <Link
                to={`/acompanhar/${trackingCode}`}
                onClick={onClose}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-subtle py-3 text-sm font-black text-muted"
              >
                <Package size={15} /> Rastrear pedido →
              </Link>
            )}
            <button
              onClick={onClose}
              className="w-full rounded-2xl bg-[#16a34a] py-3 text-sm font-black text-white"
            >
              Continuar
            </button>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-black uppercase tracking-widest text-faint">
              Pedido #{orderId.slice(0, 8).toUpperCase()}
            </p>
            <h2 className="mt-1 text-lg font-black text-content">
              Crie sua conta para rastrear
            </h2>
            <p className="mt-1 text-xs text-muted">
              Acumule cashback, salve seus endereços e acompanhe todos os seus pedidos.
            </p>

            <form onSubmit={handleSignUp} className="mt-4 flex flex-col gap-3">
              <input
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-content placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40"
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Senha (mín. 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-content placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40"
                autoComplete="new-password"
              />
              {error && <p className="text-xs text-[#dc2626]">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#6366f1] py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {loading ? "Criando conta..." : "Criar conta grátis"}
              </button>
            </form>

            {trackingCode && (
              <Link
                to={`/acompanhar/${trackingCode}`}
                onClick={onClose}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-subtle py-2.5 text-xs font-black text-muted"
              >
                <Package size={13} /> Rastrear sem conta →
              </Link>
            )}

            <button
              onClick={onClose}
              className="mt-2 w-full text-center text-xs font-semibold text-muted underline underline-offset-2"
            >
              Continuar sem conta →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
