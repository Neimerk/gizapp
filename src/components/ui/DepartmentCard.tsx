// ─────────────────────────────────────────────────────────────────────────────
// DepartmentCard — porta de entrada de um departamento (vertical).
// Usado na Home (grade de 6) e como navegação rápida no topo da /categorias.
// Leva para a seção âncora da /categorias (#{key}).
// ─────────────────────────────────────────────────────────────────────────────

import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { type Department, getCategoriesOf } from "../../data/taxonomy";

interface DepartmentCardProps {
  department: Department;
  /** mostra a contagem de categorias no canto */
  showCount?: boolean;
  className?: string;
}

export default function DepartmentCard({
  department,
  showCount = true,
  className = "",
}: DepartmentCardProps) {
  const count = department.slugs.length;
  const preview = getCategoriesOf(department).slice(0, 3).map((c) => c.name).join(" · ");

  return (
    <Link
      to={`/categorias#${department.key}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-line-subtle bg-surface p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${className}`}
    >
      {/* lavagem sutil de acento */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${department.accent}0F 0%, transparent 55%)` }}
      />
      {/* barra de acento à esquerda */}
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: department.accent }} />

      <div className="relative flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-sm"
          style={{ background: `${department.accent}14`, border: `1.5px solid ${department.accent}28` }}
        >
          {department.emoji}
        </div>
        {showCount && (
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-black"
            style={{ background: `${department.accent}12`, color: department.accent }}
          >
            {count}
          </span>
        )}
      </div>

      <div className="relative mt-3">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-black text-content">{department.label}</h3>
          <ChevronRight
            size={15}
            className="text-faint transition-transform duration-200 group-hover:translate-x-0.5"
            style={{ color: department.accent }}
          />
        </div>
        <p className="mt-1 text-[11px] leading-snug text-faint line-clamp-2">{preview}</p>
      </div>
    </Link>
  );
}
