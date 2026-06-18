import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, SearchX } from "lucide-react";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#f1f5f9]">
        <SearchX size={40} className="text-[#94a3b8]" />
      </div>
      <p className="mt-6 text-6xl font-black text-[#0f172a]">404</p>
      <h1 className="mt-2 text-xl font-black text-[#0f172a]">Página não encontrada</h1>
      <p className="mt-2 text-sm text-[#64748b]">
        O endereço que você acessou não existe ou foi removido.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-5 py-3 text-sm font-black text-[#0f172a] shadow-sm transition-colors hover:border-[#16a34a]/30"
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
