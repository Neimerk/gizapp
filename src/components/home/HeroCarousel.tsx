import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { brasuxSolutions, type BrasUXSolution } from "../../data/brasuxSolutions";

// ─── Carrossel com loop infinito ──────────────────────────────────────────────
// Track: [clone_último, slide0, slide1, …, slideN, clone_primeiro]
// Quando o usuário chega nos clones, faz-se snap silencioso para o slide real.

const AUTO_MS = 6000;

function accentOf(gradient: string): string {
  return gradient.match(/#[0-9a-fA-F]{6}/)?.[0] ?? "#16a34a";
}

const GRID_BG = {
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.7) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.7) 1px,transparent 1px)",
  backgroundSize: "44px 44px",
};

export default function HeroCarousel() {
  const items = brasuxSolutions;
  const n = items.length;

  // current é o índice na track (1-based: 0 = clone_último, n+1 = clone_primeiro)
  const [current, setCurrent]       = useState(1);
  const [animated, setAnimated]     = useState(true);
  const [paused, setPaused]         = useState(false);
  const touchX                      = useRef(0);
  const afterSnapRef                = useRef(false);

  // índice real (0..n-1) para HUD e glow
  const realIdx =
    current === 0     ? n - 1 :
    current === n + 1 ? 0     :
    current - 1;

  const active = items[realIdx];
  const accent = accentOf(active.gradient);

  // avança/recua na track
  const next = useCallback(() => setCurrent((c) => c + 1), []);
  const prev = useCallback(() => setCurrent((c) => c - 1), []);

  // vai direto para um slide real
  const goTo = useCallback((idx: number) => setCurrent(idx + 1), []);

  // auto-avanço
  useEffect(() => {
    if (paused) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(next, AUTO_MS);
    return () => clearInterval(t);
  }, [paused, next]);

  // teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft")  prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // snap silencioso quando atinge os clones
  const handleTransitionEnd = useCallback(() => {
    if (current === 0) {
      afterSnapRef.current = true;
      setAnimated(false);
      setCurrent(n);
    } else if (current === n + 1) {
      afterSnapRef.current = true;
      setAnimated(false);
      setCurrent(1);
    }
  }, [current, n]);

  // religa animação logo após o snap (2 frames garantem que o DOM aplicou a posição)
  useEffect(() => {
    if (!animated && afterSnapRef.current) {
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setAnimated(true);
          afterSnapRef.current = false;
        })
      );
      return () => cancelAnimationFrame(id);
    }
  }, [animated]);

  // track = [clone_último, ...items, clone_primeiro]
  const track: BrasUXSolution[] = [items[n - 1], ...items, items[0]];

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Soluções do ecossistema BrasUX"
      className="relative overflow-hidden rounded-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const diff = touchX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
      }}
      style={{ background: "linear-gradient(135deg,#020617 0%,#001640 38%,#001226 100%)" }}
    >
      {/* Decorações globais */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={GRID_BG} />
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full blur-3xl transition-[background] duration-700"
        style={{ background: accent, opacity: 0.4 }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "#002776", opacity: 0.5 }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      {/* Faixa deslizante */}
      <div
        className="flex will-change-transform"
        style={{
          transform: `translateX(-${current * 100}%)`,
          transition: animated ? "transform 500ms ease-in-out" : "none",
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {track.map((item, idx) => (
          <Slide key={`${item.id}-${idx}`} item={item} active={idx - 1 === realIdx} />
        ))}
      </div>

      {/* HUD inferior */}
      <div className="relative z-10 flex items-center gap-4 border-t border-white/10 px-7 py-4 sm:px-10 lg:px-12">
        <span className="font-mono text-xs font-bold tabnum text-white/45">
          {String(realIdx + 1).padStart(2, "0")}
          <span className="text-white/25"> / {String(n).padStart(2, "0")}</span>
        </span>

        <div className="flex flex-1 items-center gap-1.5">
          {items.map((s, idx) => {
            const a = accentOf(s.gradient);
            return (
              <button
                key={s.id}
                onClick={() => goTo(idx)}
                aria-label={`Ir para ${s.name}`}
                className="group relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                  style={{
                    width: idx === realIdx ? "100%" : "0%",
                    background: idx === realIdx ? a : "transparent",
                    boxShadow: idx === realIdx ? `0 0 10px ${a}` : "none",
                  }}
                />
                <span className="absolute inset-0 rounded-full bg-white/0 transition-colors group-hover:bg-white/15" />
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={prev}
            aria-label="Solução anterior"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={next}
            aria-label="Próxima solução"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Slide individual ─────────────────────────────────────────────────────────

function Slide({ item, active }: { item: BrasUXSolution; active: boolean }) {
  const accent = accentOf(item.gradient);

  return (
    <div className="relative w-full flex-shrink-0" aria-hidden={!active}>
      <div className="relative z-10 grid items-center gap-4 p-5 sm:p-6 md:grid-cols-[1.15fr_0.85fr] md:gap-6 lg:p-8">
        {/* Texto */}
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
              {item.badge}
            </span>
          </div>

          <h2 className="mt-4 text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-4xl lg:text-5xl">
            {item.name}
          </h2>

          <p className="mt-3 max-w-md text-base leading-relaxed text-white/55">
            {item.description}
          </p>

          {item.price && (
            <div className="mt-4 flex items-baseline gap-2">
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
                {item.price}
              </span>
            </div>
          )}

          {item.id === "brasux-shopping" ? (
            <p className="mt-4 text-lg font-black text-white sm:text-xl" style={{ textShadow: `0 0 24px ${accent}99` }}>
              Compre ou venda com a BrasUX.
            </p>
          ) : (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${accent}, #001a4e 130%)`, boxShadow: `0 10px 30px -6px ${accent}66` }}
            >
              Acessar {item.name.split(" ")[0]}
              <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          )}
        </div>

        {/* Visual direito */}
        {item.cardImage ? (
          <div className="hidden md:block" aria-hidden="true" />
        ) : (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Acessar ${item.name}`}
            className="relative mx-auto hidden aspect-square w-full max-w-[260px] items-center justify-center md:flex"
          >
            {["left-0 top-0 border-l-2 border-t-2","right-0 top-0 border-r-2 border-t-2","left-0 bottom-0 border-l-2 border-b-2","right-0 bottom-0 border-r-2 border-b-2"].map((c) => (
              <span key={c} className={`absolute h-6 w-6 ${c}`} style={{ borderColor: `${accent}99` }} />
            ))}
            <span className="absolute inset-4 rounded-full border border-white/10" />
            <span className="absolute inset-10 rounded-full border border-dashed" style={{ borderColor: `${accent}55` }} />
            <div
              className={`relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br ${item.gradient}`}
              style={{ boxShadow: `0 0 60px -8px ${accent}, inset 0 2px 12px rgba(255,255,255,0.25)` }}
            >
              <span className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/25 to-transparent" />
              <span className="relative text-5xl drop-shadow">{item.icon}</span>
            </div>
          </a>
        )}
      </div>

      {/* Imagem absoluta (lado direito) */}
      {item.cardImage && (
        item.id !== "brasux-shopping" ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Acessar ${item.name}`}
            className="absolute right-0 top-0 hidden h-full w-[55%] overflow-hidden rounded-r-3xl md:block"
          >
            <img src={item.cardImage} alt="" className="h-full w-full object-cover object-center" loading="lazy" decoding="async" />
            <div className="absolute inset-y-0 left-0 w-36 bg-gradient-to-r from-black/80 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
          </a>
        ) : (
          <div className="absolute right-0 top-0 hidden h-full w-[55%] overflow-hidden rounded-r-3xl md:block">
            <img src={item.cardImage} alt="" className="h-full w-full object-cover object-center" loading="lazy" decoding="async" />
            <div className="absolute inset-y-0 left-0 w-36 bg-gradient-to-r from-black/80 to-transparent" />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        )
      )}
    </div>
  );
}
