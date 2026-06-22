import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const CONSENT_KEY = "brasux-cookie-consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[200] border-t border-[#e2e8f0] bg-white p-4 shadow-2xl md:bottom-6 md:left-6 md:right-auto md:max-w-sm md:rounded-2xl md:border"
      role="region"
      aria-label="Aviso de cookies"
    >
      <p className="text-sm font-bold text-[#0f172a]">🍪 Usamos cookies</p>
      <p className="mt-1 text-xs text-[#64748b]">
        Utilizamos cookies essenciais para autenticação e preferências.{" "}
        <Link to="/privacidade" className="text-[#16a34a] underline underline-offset-2">
          Política de Privacidade
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={accept}
          className="flex-1 rounded-xl bg-[#16a34a] py-2 text-xs font-black text-white"
        >
          Aceitar
        </button>
        <button
          onClick={decline}
          className="flex-1 rounded-xl border border-[#e2e8f0] py-2 text-xs font-black text-[#64748b]"
        >
          Recusar
        </button>
      </div>
    </div>
  );
}
