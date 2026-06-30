import { useState, useEffect, useCallback } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { brasuxSolutions } from "../../data/brasuxSolutions";

// ─────────────────────────────────────────────────────────────────────────────
// HeroCarousel — vitrine futurista do ecossistema BrasUX. Cada slide é uma
// solução (data/brasuxSolutions.ts) e redireciona para o produto ao clicar.
// O "tema" do hero (glow, gradiente, acento) muda por solução.
// ─────────────────────────────────────────────────────────────────────────────

const AUTO_MS = 6000;

// extrai o primeiro hex do gradiente Tailwind da solução p/ usar em glow/órbitas
function accentOf(gradient: string): string {
  return gradient.match(/#[0-9a-fA-F]{6}/)?.[0] ?? "#16a34a";
}

export default function HeroCarousel() {
  const items = brasuxSolutions;
  const n = items.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = items[i];
  const accent = accentOf(active.gradient);

  const go = useCallback((idx: number) => setI(((idx % n) + n) % n), [n]);

  // auto-avanço (pausa no hover/foco e respeita reduced-motion)
  useEffect(() => {
    if (paused) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), AUTO_MS);
    return () => clearInterval(t);
  }, [paused, n, i]);

  // navegação por teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, i]);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Soluções do ecossistema BrasUX"
      className="relative overflow-hidden rounded-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      style={{ background: "linear-gradient(135deg,#020617 0%,#001640 38%,#001226 100%)" }}
    >
      {/* grade técnica */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.7) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.7) 1px,transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      {/* glow que troca de cor por solução */}
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full blur-3xl transition-[background] duration-700"
        style={{ background: accent, opacity: 0.4 }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full blur-3xl transition-[background] duration-700"
        style={{ background: "#002776", opacity: 0.5 }}
      />
      {/* linha de scan superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className="relative z-10 grid items-center gap-8 p-7 sm:p-10 md:grid-cols-[1.15fr_0.85fr] md:gap-6 lg:p-12 min-h-[420px] sm:min-h-[460px] lg:min-h-[500px]">
        {/* ── TEXTO (troca por slide) ── */}
        <div key={`txt-${i}`} className="hero-in">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
              {active.badge}
            </span>
          </div>

          <h1 className="mt-5 text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl">
            {active.name}
          </h1>

          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/55 sm:text-base">
            {active.description}
          </p>

          {active.price && (
            <div className="mt-5 flex items-baseline gap-2">
              <span className="text-sm font-medium text-white/50">por apenas</span>
              <span
                className="text-4xl font-black tracking-tight sm:text-5xl"
                style={{
                  background: "linear-gradient(135deg, #fcd34d 0%, #f59e0b 60%, #84cc16 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 18px rgba(252,211,77,0.55))",
                }}
              >
                {active.price}
              </span>
            </div>
          )}

          {active.id === "brasux-shopping" ? (
            <p className="mt-6 text-xl font-black text-white sm:text-2xl" style={{ textShadow: `0 0 24px ${accent}99` }}>
              Compre ou venda com a BrasUX.
            </p>
          ) : (
            <a
              href={active.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-7 inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${accent}, #001a4e 130%)`, boxShadow: `0 10px 30px -6px ${accent}66` }}
            >
              Acessar {active.name.split(" ")[0]}
              <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          )}
        </div>

        {/* ── VISUAL DIREITO: imagem real ou órbitas futuristas ── */}
        {active.cardImage ? (
          /* placeholder para manter o grid — a imagem é posicionada em absolute */
          <div className="hidden md:block" aria-hidden="true" />
        ) : (
          <a
            href={active.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Acessar ${active.name}`}
            className="relative mx-auto hidden aspect-square w-full max-w-[260px] items-center justify-center md:flex"
          >
            {/* moldura HUD (cantos) */}
            {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "left-0 bottom-0 border-l-2 border-b-2", "right-0 bottom-0 border-r-2 border-b-2"].map((c) => (
              <span key={c} className={`absolute h-6 w-6 ${c}`} style={{ borderColor: `${accent}99` }} />
            ))}
            {/* órbitas */}
            <span className="absolute inset-4 rounded-full border border-white/10" />
            <span className="absolute inset-10 rounded-full border border-dashed" style={{ borderColor: `${accent}55` }} />
            {/* esfera com gradiente da solução */}
            <div
              key={`orb-${i}`}
              className={`hero-in relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br ${active.gradient}`}
              style={{ boxShadow: `0 0 60px -8px ${accent}, inset 0 2px 12px rgba(255,255,255,0.25)` }}
            >
              <span className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/25 to-transparent" />
              <span className="relative text-5xl drop-shadow">{active.icon}</span>
            </div>
          </a>
        )}
      </div>

      {/* ── IMAGEM DO CARD (absoluta, lado direito, full-height) ── */}
      {active.cardImage && (
        active.id !== "brasux-shopping" ? (
          <a
            key={`img-${i}`}
            href={active.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Acessar ${active.name}`}
            className="hero-in pointer-events-none absolute right-0 top-0 hidden h-full w-[55%] overflow-hidden rounded-r-3xl md:block"
            style={{ pointerEvents: "auto" }}
          >
            <img
              src={active.cardImage}
              alt=""
              className="h-full w-full object-cover object-center"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-y-0 left-0 w-36 bg-gradient-to-r from-black/80 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
          </a>
        ) : (
          <div
            key={`img-${i}`}
            className="hero-in pointer-events-none absolute right-0 top-0 hidden h-full w-[55%] overflow-hidden rounded-r-3xl md:block"
          >
            <img
              src={active.cardImage}
              alt=""
              className="h-full w-full object-cover object-center"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-y-0 left-0 w-36 bg-gradient-to-r from-black/80 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        )
      )}

      {/* ── HUD INFERIOR: contador + indicadores + setas ── */}
      <div className="relative z-10 flex items-center gap-4 border-t border-white/10 px-7 py-4 sm:px-10 lg:px-12">
        <span className="font-mono text-xs font-bold tabnum text-white/45">
          {String(i + 1).padStart(2, "0")}
          <span className="text-white/25"> / {String(n).padStart(2, "0")}</span>
        </span>

        {/* indicadores-segmento (clicáveis) */}
        <div className="flex flex-1 items-center gap-1.5">
          {items.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => go(idx)}
              aria-label={`Ir para ${s.name}`}
              className="group relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                style={{
                  width: idx === i ? "100%" : "0%",
                  background: idx === i ? accent : "transparent",
                  boxShadow: idx === i ? `0 0 10px ${accent}` : "none",
                }}
              />
              <span className="absolute inset-0 rounded-full bg-white/0 transition-colors group-hover:bg-white/15" />
            </button>
          ))}
        </div>

        {/* setas */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => go(i - 1)}
            aria-label="Solução anterior"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => go(i + 1)}
            aria-label="Próxima solução"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
