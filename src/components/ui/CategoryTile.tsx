// ─────────────────────────────────────────────────────────────────────────────
// CategoryTile — átomo ÚNICO de categoria. Substitui as 3 renderizações
// duplicadas (Home / CategoriesPage / busca). Qualquer ajuste visual de
// categoria acontece só aqui.
//
//  variant="image"   → tile quadrado com a foto /categorias/{slug}.webp (browse)
//  variant="compact" → ícone em chip com gradiente de acento (carrosséis/rails)
// ─────────────────────────────────────────────────────────────────────────────

import { Link } from "react-router-dom";
import type { Category } from "../../data/categories";
import { getAccent, categoryIcons } from "../../data/taxonomy";

type Variant = "image" | "compact";

interface CategoryTileProps {
  category: Category;
  variant?: Variant;
  /** sobrescreve o acento herdado do departamento, se necessário */
  accent?: string;
  className?: string;
}

export default function CategoryTile({
  category,
  variant = "image",
  accent,
  className = "",
}: CategoryTileProps) {
  const color = accent ?? getAccent(category.slug);
  const to = `/categorias/${category.slug}`;

  if (variant === "compact") {
    const emoji = categoryIcons[category.slug] ?? "✨";
    return (
      <Link
        to={to}
        aria-label={category.name}
        className={`group flex shrink-0 flex-col items-center gap-2.5 ${className}`}
      >
        <div
          className="relative flex h-18 w-18 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-110"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${color}E6, ${color}99 60%, ${color}66 100%)`,
            boxShadow: `0 4px 18px ${color}59, 0 1px 3px rgba(0,0,0,0.25)`,
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-2xl"
            style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.12), transparent)" }}
          />
          <span className="relative text-[32px] drop-shadow-sm">{emoji}</span>
        </div>
        <span className="w-18 text-center text-[10px] font-black uppercase leading-tight tracking-wide text-muted line-clamp-2">
          {category.name}
        </span>
      </Link>
    );
  }

  // variant === "image"
  return (
    <Link to={to} aria-label={category.name} className={`group flex flex-col items-center gap-2.5 ${className}`}>
      <div
        className="relative w-full overflow-hidden rounded-3xl shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl"
        style={{ aspectRatio: "1 / 1" }}
      >
        <img
          src={`/categorias/${category.slug}.webp`}
          alt={category.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]"
          loading="lazy"
          decoding="async"
        />
        {/* faixa de acento no rodapé do tile — vincula visualmente ao departamento */}
        <div
          className="absolute inset-x-0 bottom-0 h-1"
          style={{ background: color }}
        />
        <div className="absolute inset-0 rounded-3xl bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
      </div>
      <h3 className="text-center text-xs font-black uppercase leading-tight tracking-wide text-content line-clamp-2">
        {category.name}
      </h3>
    </Link>
  );
}
