import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, SearchX } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";

export default function NotFoundPage() {
  const navigate = useNavigate();
  usePageMeta({
    title: "Página não encontrada",
    description: "O endereço que você acessou não existe ou foi removido do BrasUX Shopping.",
    robots: "noindex,nofollow",
  });

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-subtle-2">
        <SearchX size={40} className="text-faint" />
      </div>
      <p className="mt-6 text-6xl font-black text-content">404</p>
      <h1 className="mt-2 text-xl font-black text-content">Página não encontrada</h1>
      <p className="mt-2 text-sm text-muted">
        O endereço que você acessou não existe ou foi removido.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-5 py-3 text-sm font-black text-content shadow-sm transition-colors hover:border-[#16a34a]/30"
        >
          <ArrowLeft size={15} /> Voltar
        </button>
        <Link
          to="/"
          className="flex items-center gap-2 rounded-2xl bg-[#16a34a] px-5 py-3 text-sm font-black text-white shadow-lg shadow-green-200 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <Home size={15} /> Ir para o início
        </Link>
      </div>
    </div>
  );
}
