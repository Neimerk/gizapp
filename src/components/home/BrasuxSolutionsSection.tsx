import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PromoCard from "../ui/PromoCard";
import {
  IllustrationEnem,
  IllustrationNota1000,
  IllustrationPDV,
  IllustrationServicos,
  IllustrationLandingPage,
} from "../ui/PromoIllustrations";

const AUTO_MS = 8000;

// Cada slide é um ReactElement já montado; o carrossel apenas os exibe
const SLIDES = [
  <PromoCard
    key="pdv"
    fullScreen
    href="https://caixa.brasux.store"
    background="linear-gradient(135deg, #022c22 0%, #064e3b 40%, #065f46 100%)"
    blobAColor="#10b981"
    blobBColor="#34d399"
    badgeEmoji="🧾"
    badgeLabel="BrasUX Comercial"
    badgeTextColor="#6ee7b7"
    badgeBorderColor="rgba(16,185,129,0.30)"
    badgeBgColor="rgba(16,185,129,0.10)"
    titleBefore="PDV para o seu"
    titleHighlight="negócio."
    titleHighlightGradient="linear-gradient(135deg, #6ee7b7, #34d399)"
    description="Caixa e gestão comercial completos — vendas, estoque, fluxo de caixa e dashboard. Simples, poderoso e acessível."
    ctaLabel="Conhecer o Caixa"
    ctaBackground="linear-gradient(135deg, #34d399, #10b981)"
    ctaShadow="0 8px 24px rgba(16,185,129,0.45)"
    ctaTextColor="#022c22"
    imageUrl="/card-pdv.webp"
    illustration={<IllustrationPDV />}
    domainLabel="caixa.brasux.com.br"
  />,

  <PromoCard
    key="servicos"
    fullScreen
    to="/servicos"
    background="linear-gradient(135deg, #0d0a1e 0%, #1a0938 40%, #0a1628 100%)"
    blobAColor="#7c3aed"
    blobBColor="#06b6d4"
    badgeEmoji="⚡"
    badgeLabel="BrasUX Serviços"
    badgeTextColor="#c4b5fd"
    badgeBorderColor="rgba(124,58,237,0.30)"
    badgeBgColor="rgba(124,58,237,0.10)"
    titleBefore="Soluções tech para o"
    titleHighlight="seu negócio."
    titleHighlightGradient="linear-gradient(135deg, #c4b5fd, #67e8f9)"
    description="IA, dados, arquitetura de software, desenvolvimento e consultoria. Da ideia à solução, do código ao impacto."
    ctaLabel="Ver todos os serviços"
    ctaBackground="linear-gradient(135deg, #7c3aed, #4f46e5)"
    ctaShadow="0 8px 24px rgba(124,58,237,0.45)"
    imageUrl="/card-ti.webp"
    illustration={<IllustrationServicos />}
  />,

  <PromoCard
    key="lp"
    fullScreen
    centered
    href="https://produtos.brasux.com.br"
    background="linear-gradient(135deg, #0c0a00 0%, #1c1400 40%, #0f1a00 100%)"
    blobAColor="#f59e0b"
    blobAOpacity={0.2}
    blobBColor="#84cc16"
    blobBOpacity={0.15}
    badgeEmoji="🌐"
    badgeLabel="BrasUX Web"
    badgeTextColor="#fcd34d"
    badgeBorderColor="rgba(245,158,11,0.30)"
    badgeBgColor="rgba(245,158,11,0.10)"
    extraBadge={
      <div className="flex flex-col gap-1.5">
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{ background: "linear-gradient(135deg, #f59e0b, #84cc16)", boxShadow: "0 4px 16px rgba(245,158,11,0.4)" }}
        >
          <span className="text-[11px] font-black text-[#0c0a00]">🏷️ BrasUX Web</span>
        </div>
        <div
          className="inline-flex flex-col rounded-2xl px-4 py-2.5"
          style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.30)" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#fcd34d]/70">a partir de</span>
          <span
            className="text-2xl font-black"
            style={{ background: "linear-gradient(135deg, #fcd34d, #84cc16)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            R$ 499,00
          </span>
        </div>
      </div>
    }
    titleBefore="Landing Page +"
    titleHighlight="botão WhatsApp."
    titleHighlightGradient="linear-gradient(135deg, #fcd34d, #84cc16)"
    description="Site profissional, responsivo e pronto para converter — com botão direto pro seu WhatsApp. Entrega em até 5 dias úteis."
    ctaLabel="Quero minha landing page"
    ctaBackground="linear-gradient(135deg, #f59e0b, #84cc16)"
    ctaShadow="0 8px 24px rgba(245,158,11,0.45)"
    ctaTextColor="#0c0a00"
    illustration={<IllustrationLandingPage />}
    domainLabel="produtos.brasux.com.br"
  />,

  <PromoCard
    key="enem"
    fullScreen
    href="https://simulenem.com"
    background="linear-gradient(135deg, #001640 0%, #002776 40%, #003d1a 100%)"
    blobAColor="#16a34a"
    blobAOpacity={0.3}
    blobBColor="#002776"
    blobBOpacity={0.35}
    badgeEmoji="📝"
    badgeLabel="BrasUX Educação"
    badgeTextColor="#4ade80"
    badgeBorderColor="rgba(22,163,74,0.30)"
    badgeBgColor="rgba(22,163,74,0.10)"
    titleBefore="Simule o ENEM"
    titleHighlight="agora mesmo."
    titleHighlightGradient="linear-gradient(135deg, #86efac, #4ade80)"
    description="Questões comentadas, gabarito instantâneo e ranking nacional. Prepare-se para o ENEM com simulados gratuitos."
    ctaLabel="Fazer simulado grátis"
    ctaBackground="linear-gradient(135deg, #16a34a, #15803d)"
    ctaShadow="0 8px 24px rgba(22,163,74,0.45)"
    imageUrl="/card-simulenem.webp"
    illustration={<IllustrationEnem />}
    domainLabel="simulenem.com"
  />,

  <PromoCard
    key="notaon"
    fullScreen
    href="https://cursonotaon.com.br"
    background="linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e3a5f 100%)"
    blobAColor="#818cf8"
    blobBColor="#6366f1"
    badgeEmoji="🎯"
    badgeLabel="BrasUX Educação"
    badgeTextColor="#a5b4fc"
    badgeBorderColor="rgba(129,140,248,0.30)"
    badgeBgColor="rgba(129,140,248,0.10)"
    titleBefore="Tire nota"
    titleHighlight="1000 no ENEM."
    titleHighlightGradient="linear-gradient(135deg, #c7d2fe, #818cf8)"
    description="Curso completo com videoaulas, material didático e correção de redação. Do zero à nota máxima."
    ctaLabel="Conhecer o curso"
    ctaBackground="linear-gradient(135deg, #6366f1, #4f46e5)"
    ctaShadow="0 8px 24px rgba(99,102,241,0.45)"
    imageUrl="/card-notaon.webp"
    illustration={<IllustrationNota1000 />}
    domainLabel="cursonotaon.com.br"
  />,
];

// ─── Carrossel com loop infinito ──────────────────────────────────────────────
// Track: [clone_último, slide0, …, slideN, clone_primeiro]

export default function BrasuxSolutionsSection() {
  const n = SLIDES.length;

  const [current, setCurrent]   = useState(1);
  const [animated, setAnimated] = useState(true);
  const [paused, setPaused]     = useState(false);
  const touchX                  = useRef(0);
  const afterSnapRef            = useRef(false);

  const rawIdx =
    current === 0     ? n - 1 :
    current === n + 1 ? 0     :
    current - 1;
  const realIdx = Math.min(Math.max(rawIdx, 0), n - 1);

  const next = useCallback(() => setCurrent((c) => c + 1), []);
  const prev = useCallback(() => setCurrent((c) => c - 1), []);
  const goTo = useCallback((idx: number) => setCurrent(idx + 1), []);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (!document.hidden) timer = setInterval(next, AUTO_MS); };
    const onVisibility = () => {
      if (document.hidden) { clearInterval(timer); timer = undefined; }
      else { afterSnapRef.current = false; setAnimated(true); setCurrent((c) => Math.min(Math.max(c, 1), n)); start(); }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [paused, next, n]);

  const handleTransitionEnd = useCallback(() => {
    if (current === 0)     { afterSnapRef.current = true; setAnimated(false); setCurrent(n); }
    else if (current === n + 1) { afterSnapRef.current = true; setAnimated(false); setCurrent(1); }
  }, [current, n]);

  useEffect(() => {
    if (!animated && afterSnapRef.current) {
      const id = requestAnimationFrame(() => requestAnimationFrame(() => {
        setAnimated(true);
        afterSnapRef.current = false;
      }));
      return () => cancelAnimationFrame(id);
    }
  }, [animated]);

  // track = [clone_último, ...slides, clone_primeiro]
  const track = [SLIDES[n - 1], ...SLIDES, SLIDES[0]];

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Produtos e soluções BrasUX"
      className="relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const diff = touchX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
      }}
    >
      {/* Faixa deslizante */}
      <div
        className="flex will-change-transform"
        style={{
          transform: `translateX(-${current * 100}%)`,
          transition: animated ? "transform 500ms ease-in-out" : "none",
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {track.map((slide, idx) => (
          <div
            key={`slide-${idx}`}
            className="w-full flex-shrink-0"
            aria-hidden={idx - 1 !== realIdx}
          >
            {slide}
          </div>
        ))}
      </div>

      {/* ── Navegação: arrows ── */}
      <button
        onClick={prev}
        aria-label="Card anterior"
        className="absolute left-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={next}
        aria-label="Próximo card"
        className="absolute right-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
      >
        <ChevronRight size={18} />
      </button>

      {/* ── Navegação: dots ── */}
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            aria-label={`Ir para o slide ${idx + 1}`}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: idx === realIdx ? "2rem" : "0.5rem",
              background: idx === realIdx ? "white" : "rgba(255,255,255,0.35)",
            }}
          />
        ))}
      </div>

      {/* ── Contador ── */}
      <div className="absolute bottom-6 right-6 z-20 font-mono text-xs font-bold tabnum text-white/40">
        {String(realIdx + 1).padStart(2, "0")}
        <span className="text-white/20"> / {String(n).padStart(2, "0")}</span>
      </div>
    </section>
  );
}
