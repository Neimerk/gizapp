import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface PromoCardProps {
  href?: string;
  to?: string;
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
  iconEmoji: string;
  iconBg: string;
  iconBorder: string;
  iconExtra?: ReactNode;
}

const GRID_OVERLAY = {
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
};

export default function PromoCard({
  href,
  to,
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
}: PromoCardProps) {
  const inner = (
    <>
      <div
        className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full blur-3xl"
        style={{ background: blobAColor, opacity: blobAOpacity }}
      />
      <div
        className="pointer-events-none absolute -bottom-10 right-20 h-40 w-40 rounded-full blur-3xl"
        style={{ background: blobBColor, opacity: blobBOpacity }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={GRID_OVERLAY}
      />

      <div className="relative z-10 flex flex-1 flex-col gap-4 p-8 md:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5"
            style={{ border: `1px solid ${badgeBorderColor}`, background: badgeBgColor }}
          >
            <span className="text-sm">{badgeEmoji}</span>
            <span
              className="text-[11px] font-black uppercase tracking-widest"
              style={{ color: badgeTextColor }}
            >
              {badgeLabel}
            </span>
          </div>
          {extraBadge}
        </div>

        <div>
          <h2 className="text-3xl font-black text-white md:text-4xl">
            {titleBefore}{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: titleHighlightGradient }}
            >
              {titleHighlight}
            </span>
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[#94a3b8]">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black transition-all group-hover:scale-[1.03]"
            style={{ background: ctaBackground, boxShadow: ctaShadow, color: ctaTextColor }}
          >
            {ctaLabel} <ArrowRight size={15} />
          </span>
          {domainLabel && (
            <span className="text-xs text-[#64748b]">{domainLabel}</span>
          )}
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-center px-8 pb-8 md:pb-0 md:pr-10">
        <div className="flex flex-col items-center gap-3">
          <span
            className="flex h-24 w-24 items-center justify-center rounded-3xl text-5xl"
            style={{ background: iconBg, border: `1px solid ${iconBorder}` }}
          >
            {iconEmoji}
          </span>
          {iconExtra}
        </div>
      </div>
    </>
  );

  const cls =
    "group relative flex flex-col overflow-hidden rounded-3xl md:flex-row md:items-center";

  if (to) {
    return (
      <Link to={to} className={cls} style={{ background }}>
        {inner}
      </Link>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={{ background }}>
      {inner}
    </a>
  );
}
