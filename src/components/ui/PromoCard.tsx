import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface PromoCardProps {
  href?: string;
  to?: string;
  /** Quando true: ocupa min-h-screen, sem bordas arredondadas (hero fullscreen) */
  fullScreen?: boolean;
  background: string;
  blobAColor: string;
  blobAOpacity?: number;
  blobBColor: string;
  blobBOpacity?: number;
  badgeEmoji: string;
  badgeLabel: string;
  badgeTextColor: string;
  badgeBorderColor: string;
  badgeBgColor: string;
  extraBadge?: ReactNode;
  titleBefore: string;
  titleHighlight: string;
  titleHighlightGradient: string;
  description: string;
  ctaLabel: string;
  ctaBackground: string;
  ctaTextColor?: string;
  ctaShadow?: string;
  domainLabel?: string;
  iconEmoji?: string;
  iconBg?: string;
  iconBorder?: string;
  iconExtra?: ReactNode;
  /** Ilustração SVG — exibida no painel direito */
  illustration?: ReactNode;
  /** Imagem real que preenche metade do card (right side, object-cover) */
  imageUrl?: string;
  /** Centraliza todo o conteúdo (sem split esquerda/direita) */
  centered?: boolean;
}

const GRID_OVERLAY = {
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
};

export default function PromoCard({
  href,
  to,
  fullScreen = false,
  background,
  blobAColor,
  blobAOpacity = 0.25,
  blobBColor,
  blobBOpacity = 0.2,
  badgeEmoji,
  badgeLabel,
  badgeTextColor,
  badgeBorderColor,
  badgeBgColor,
  extraBadge,
  titleBefore,
  titleHighlight,
  titleHighlightGradient,
  description,
  ctaLabel,
  ctaBackground,
  ctaTextColor = "white",
  ctaShadow,
  domainLabel,
  iconEmoji,
  iconBg,
  iconBorder,
  iconExtra,
  illustration,
  imageUrl,
  centered = false,
}: PromoCardProps) {
  const hasImage = !!imageUrl;


  const inner = (
    <>
      {/* Blobs de fundo */}
      <div
        className={`pointer-events-none absolute rounded-full blur-3xl ${
          fullScreen
            ? "-left-20 -top-20 h-[36rem] w-[36rem]"
            : "-left-10 -top-10 h-48 w-48"
        }`}
        style={{ background: blobAColor, opacity: blobAOpacity }}
      />
      <div
        className={`pointer-events-none absolute rounded-full blur-3xl ${
          fullScreen
            ? "-bottom-20 right-10 h-[28rem] w-[28rem]"
            : "-bottom-10 right-20 h-40 w-40"
        }`}
        style={{ background: blobBColor, opacity: blobBOpacity }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={GRID_OVERLAY}
      />

      {/* ── Conteúdo de texto (lado esquerdo) ── */}
      <div
        className={`relative z-20 flex flex-1 flex-col ${
          fullScreen ? "gap-6 p-10 md:p-16 lg:p-24" : "gap-4 p-8 md:p-10"
        } ${hasImage ? "md:max-w-[50%]" : ""} items-center text-center ${centered ? "justify-center" : ""}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5"
            style={{ border: `1px solid ${badgeBorderColor}`, background: badgeBgColor }}
          >
            <span className={fullScreen ? "text-base" : "text-sm"}>{badgeEmoji}</span>
            <span
              className={`font-black uppercase tracking-widest ${fullScreen ? "text-sm" : "text-[11px]"}`}
              style={{ color: badgeTextColor }}
            >
              {badgeLabel}
            </span>
          </div>
          {extraBadge}
        </div>

        <div>
          <h2
            className={`font-black text-white leading-[1.05] tracking-tight ${
              fullScreen
                ? "text-5xl md:text-6xl lg:text-7xl"
                : "text-3xl md:text-4xl"
            }`}
          >
            {titleBefore}{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: titleHighlightGradient }}
            >
              {titleHighlight}
            </span>
          </h2>
          <p
            className={`mt-3 leading-relaxed text-white/70 ${
              fullScreen ? "text-base md:text-lg max-w-xl" : "text-sm max-w-md text-faint"
            }`}
          >
            {description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {to ? (
            <Link
              to={to}
              className={`inline-flex items-center gap-2 font-black transition-all hover:scale-[1.03] ${
                fullScreen ? "rounded-2xl px-8 py-4 text-base" : "rounded-2xl px-6 py-3 text-sm"
              }`}
              style={{ background: ctaBackground, boxShadow: ctaShadow, color: ctaTextColor }}
            >
              {ctaLabel} <ArrowRight size={fullScreen ? 18 : 15} />
            </Link>
          ) : (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 font-black transition-all hover:scale-[1.03] ${
                fullScreen ? "rounded-2xl px-8 py-4 text-base" : "rounded-2xl px-6 py-3 text-sm"
              }`}
              style={{ background: ctaBackground, boxShadow: ctaShadow, color: ctaTextColor }}
            >
              {ctaLabel} <ArrowRight size={fullScreen ? 18 : 15} />
            </a>
          )}
          {domainLabel && (
            <span className={`text-white/40 ${fullScreen ? "text-sm" : "text-xs"}`}>
              {domainLabel}
            </span>
          )}
        </div>
      </div>

      {/* ── Painel direito ── */}
      {hasImage ? (
        <>
          {/* Mobile: imagem em bloco abaixo do texto */}
          <div className="relative h-52 w-full overflow-hidden md:hidden">
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            {/* Fade topo para blend com o card */}
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/55 to-transparent" />
            {/* Ilustração por cima */}
            {illustration && (
              <div className="absolute bottom-0 right-0 z-10 pointer-events-none select-none">
                {illustration}
              </div>
            )}
          </div>

          {/* Desktop: imagem preenche metade direita em absolute */}
          <div className="absolute right-0 top-0 hidden h-full w-1/2 overflow-hidden md:block">
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            {/* Fade esquerda para blend com o texto */}
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-black/65 to-transparent" />
            {/* Grade por cima da imagem (mantém identidade visual) */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.04]"
              style={GRID_OVERLAY}
            />
            {/* Ilustração por cima */}
            {illustration && (
              <div className="absolute bottom-0 right-0 z-10 pointer-events-none select-none opacity-90">
                {illustration}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Painel direito apenas com ilustração SVG */
        <div className="relative z-10 flex items-end justify-center px-6 pb-0 md:pr-8">
          {illustration ? (
            <div className="pointer-events-none select-none opacity-95">
              {illustration}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 pb-8 md:pb-0">
              <span
                className="flex h-24 w-24 items-center justify-center rounded-3xl text-5xl"
                style={{ background: iconBg, border: `1px solid ${iconBorder}` }}
              >
                {iconEmoji}
              </span>
              {iconExtra}
            </div>
          )}
        </div>
      )}
    </>
  );

  /* Card wrapper — não clicável; apenas o botão CTA é link */
  const cls = [
    "relative flex overflow-hidden",
    centered
      ? "flex-col items-center justify-center"
      : "flex-col md:flex-row md:items-center",
    fullScreen
      ? "min-h-screen"
      : `rounded-3xl${hasImage ? " md:min-h-[280px]" : ""}`,
  ].join(" ");

  return (
    <div className={cls} style={{ background }}>
      {inner}
    </div>
  );
}
