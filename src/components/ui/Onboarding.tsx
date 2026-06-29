import { useState, useEffect } from "react";
import { ArrowRight, X } from "lucide-react";

const KEY = "brasux-onboarded";

const STEPS = [
  {
    icon: "🛒",
    title: "Bem-vindo ao BrasUX!",
    description:
      "O shopping brasileiro de soluções tech — educação, IA, desenvolvimento, dados e muito mais.",
    color: "from-[#001640] to-[#002776]",
  },
  {
    icon: "🔍",
    title: "Busque e filtre",
    description:
      "Use a barra de busca, filtre por categoria e preço, e ordene os resultados como quiser.",
    color: "from-[#0f172a] to-[#1e293b]",
  },
  {
    icon: "🏪",
    title: "Explore as lojas",
    description:
      "Cada loja tem seu catálogo completo. Veja produtos, avaliações e tempo de entrega.",
    color: "from-[#003d1a] to-[#002776]",
  },
  {
    icon: "❤️",
    title: "Salve seus favoritos",
    description:
      "Toque no ♥ em produtos e lojas para salvar. Acesse tudo em Conta → Favoritos.",
    color: "from-[#7f1d1d] to-[#1e293b]",
  },
  {
    icon: "📦",
    title: "Acompanhe em tempo real",
    description:
      "Seus pedidos têm rastreamento ao vivo com mapa. Ative notificações para não perder nada.",
    color: "from-[#164e63] to-[#0f172a]",
  },
];

export default function Onboarding() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(KEY)) {
      setShow(true);
    }
  }, []);

  function finish() {
    localStorage.setItem(KEY, "1");
    setShow(false);
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else finish();
  }

  if (!show) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={finish}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-t-3xl sm:rounded-3xl shadow-2xl">
        {/* Colored header */}
        <div className={`bg-gradient-to-br ${current.color} px-8 pb-12 pt-8 text-center`}>
          <button
            onClick={finish}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white"
          >
            <X size={15} />
          </button>

          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white/15 text-5xl">
            {current.icon}
          </div>

          {/* Step dots */}
          <div className="mt-5 flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-surface" : "w-1.5 bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="-mt-8 rounded-t-3xl bg-surface px-8 pb-8 pt-7">
          <h2 className="text-xl font-black text-content">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{current.description}</p>

          <div className="mt-6 flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 rounded-2xl border border-line py-3 text-sm font-black text-muted"
              >
                Anterior
              </button>
            )}
            <button
              onClick={next}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#16a34a] py-3 text-sm font-black text-white shadow-lg shadow-green-200"
            >
              {step < STEPS.length - 1 ? (
                <>Próximo <ArrowRight size={15} /></>
              ) : (
                "Começar 🚀"
              )}
            </button>
          </div>

          <button
            onClick={finish}
            className="mt-3 w-full text-center text-xs text-faint"
          >
            Pular tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
