import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CategoryScrollTab = {
  slug: string;
  icon?: string;
  label: string;
  count?: number;
};

interface Props {
  tabs: CategoryScrollTab[];
  activeSlug: string;
  onSelect: (slug: string) => void;
  allLabel?: string;
  allCount?: number;
}

export default function CategoryScroll({
  tabs,
  activeSlug,
  onSelect,
  allLabel = "Todos",
  allCount,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    el?.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el?.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [tabs]);

  function scroll(dir: "left" | "right") {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -240 : 240, behavior: "smooth" });
  }

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => scroll("left")}
        aria-hidden={!canLeft}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e2e8f0] bg-white shadow-sm transition-all ${
          canLeft ? "opacity-100 hover:border-[#7c3aed]/30 hover:text-[#7c3aed]" : "pointer-events-none opacity-0"
        }`}
      >
        <ChevronLeft size={16} />
      </button>

      <div
        ref={scrollRef}
        className="flex flex-1 gap-2 overflow-x-auto pb-1 scrollbar-none"
        onScroll={updateArrows}
      >
        <button
          onClick={() => onSelect("")}
          className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition-colors ${
            activeSlug === ""
              ? "bg-[#0f172a] text-white"
              : "border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
          }`}
        >
          {allLabel}
          {allCount !== undefined && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                activeSlug === "" ? "bg-white/20 text-white" : "bg-[#f1f5f9] text-[#64748b]"
              }`}
            >
              {allCount}
            </span>
          )}
        </button>

        {tabs.map((tab) => (
          <button
            key={tab.slug}
            onClick={() => onSelect(tab.slug)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition-colors ${
              activeSlug === tab.slug
                ? "bg-[#7c3aed] text-white"
                : "border border-[#e2e8f0] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
            }`}
          >
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  activeSlug === tab.slug ? "bg-white/20 text-white" : "bg-[#f1f5f9] text-[#64748b]"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={() => scroll("right")}
        aria-hidden={!canRight}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e2e8f0] bg-white shadow-sm transition-all ${
          canRight ? "opacity-100 hover:border-[#7c3aed]/30 hover:text-[#7c3aed]" : "pointer-events-none opacity-0"
        }`}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
