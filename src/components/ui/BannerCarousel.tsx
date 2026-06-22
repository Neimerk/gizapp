import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { type Banner } from "../../services/gizApi";

const INTERVAL_MS = 5000;

interface Props {
  banners: Banner[];
}

export default function BannerCarousel({ banners }: Props) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused]   = useState(false);
  const touchX = useRef(0);

  const total = banners.length;

  const go = (idx: number) => setCurrent(((idx % total) + total) % total);

  // Auto-play
  useEffect(() => {
    if (paused || total <= 1) return;
    const id = setInterval(() => setCurrent((c) => (c + 1) % total), INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, total]);

  if (total === 0) return null;

  const banner = banners[current];

  const cta = banner.link ? (
    banner.link.startsWith("/") ? (
      <Link
        to={banner.link}
        className="mt-4 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
        style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 6px 20px rgba(22,163,74,0.4)" }}
      >
        {banner.linkLabel ?? "Ver mais"}
      </Link>
    ) : (
      <a
        href={banner.link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
        style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 6px 20px rgba(22,163,74,0.4)" }}
      >
        {banner.linkLabel ?? "Ver mais"}
      </a>
    )
  ) : null;

  return (
    <div
      className="relative select-none overflow-hidden rounded-3xl shadow-lg"
      style={{ aspectRatio: "21/9", minHeight: 180 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const diff = touchX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) go(diff > 0 ? current + 1 : current - 1);
      }}
    >
      {/* Slides */}
      {banners.map((b, i) => (
        <div
          key={b.id}
          aria-hidden={i !== current}
          className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: i === current ? 1 : 0, zIndex: i === current ? 1 : 0 }}
        >
          {/* Background image */}
          <img
            src={b.imageUrl}
            alt={b.title}
            className="h-full w-full object-cover"
            draggable={false}
            loading={i === 0 ? "eager" : "lazy"}
            decoding={i === 0 ? "sync" : "async"}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fetchPriority={i === 0 ? ("high" as any) : undefined}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
        </div>
      ))}

      {/* Content (sempre do slide atual, com z-index acima dos slides) */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 sm:p-10">
        {banner.badge && (
          <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white backdrop-blur-sm">
            {banner.badge}
          </span>
        )}
        <h2 className="max-w-lg text-2xl font-black leading-tight text-white drop-shadow-sm sm:text-3xl">
          {banner.title}
        </h2>
        {banner.description && (
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80 drop-shadow-sm">
            {banner.description}
          </p>
        )}
        {cta}
      </div>

      {/* Prev / Next */}
      {total > 1 && (
        <>
          <button
            onClick={() => go(current - 1)}
            aria-label="Banner anterior"
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-sm transition-all hover:bg-black/50"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => go(current + 1)}
            aria-label="Próximo banner"
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur-sm transition-all hover:bg-black/50"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {total > 1 && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`Ir para slide ${i + 1}`}
              className="h-1.5 rounded-full bg-white transition-all"
              style={{ width: i === current ? 24 : 6, opacity: i === current ? 1 : 0.5 }}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      {total > 1 && !paused && (
        <div
          key={current}
          className="absolute bottom-0 left-0 z-20 h-0.5 bg-white/60"
          style={{
            animation: `progressBar ${INTERVAL_MS}ms linear`,
          }}
        />
      )}

      <style>{`
        @keyframes progressBar {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </div>
  );
}
