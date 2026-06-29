import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useJsonLd } from "../../hooks/useJsonLd";
import { buildBreadcrumbSchema } from "../../lib/seo";

export interface BreadcrumbItem {
  name: string;
  path: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

// Renders breadcrumb nav UI and injects BreadcrumbList JSON-LD.
// First item is always Home; pass remaining items as `items`.
export default function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  const all = [{ name: "Início", path: "/" }, ...items];
  useJsonLd(buildBreadcrumbSchema(all));

  return (
    <nav aria-label="Navegação estrutural" className={`flex items-center gap-1 text-xs text-faint ${className}`}>
      {all.map((crumb, i) => {
        const isLast = i === all.length - 1;
        return (
          <span key={crumb.path} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="shrink-0 text-[#cbd5e1]" />}
            {isLast ? (
              <span className="font-bold text-muted line-clamp-1">{crumb.name}</span>
            ) : i === 0 ? (
              <Link to="/" className="flex items-center gap-1 hover:text-[#16a34a]" aria-label="Início">
                <Home size={12} />
              </Link>
            ) : (
              <Link to={crumb.path} className="hover:text-[#16a34a] hover:underline line-clamp-1">
                {crumb.name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
