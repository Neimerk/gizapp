import { useState } from "react";
import { getProductImageUrl } from "../../services/gizApi";
import { categoryIcons } from "../../data/categoryIcons";

const CATEGORY_PALETTES: Record<string, string> = {
  mercearia:             "from-[#16a34a] to-[#15803d]",
  cervejas:              "from-[#f59e0b] to-[#d97706]",
  "destilados-e-vinhos": "from-[#16a34a] to-[#15803d]",
  "nao-alcoolicos":      "from-[#2563eb] to-[#1d4ed8]",
  farmacia:              "from-[#dc2626] to-[#b91c1c]",
  restaurantes:          "from-[#ea580c] to-[#c2410c]",
  lanches:               "from-[#f97316] to-[#ea580c]",
  pizzarias:             "from-[#ef4444] to-[#dc2626]",
  padaria:               "from-[#b45309] to-[#92400e]",
  doces:                 "from-[#ec4899] to-[#db2777]",
  hortifruti:            "from-[#22c55e] to-[#16a34a]",
  petshop:               "from-[#0ea5e9] to-[#0284c7]",
  beleza:                "from-[#d946ef] to-[#c026d3]",
  eletronicos:           "from-[#6366f1] to-[#4f46e5]",
};

interface Props {
  imageUrl?: string;
  alt?: string;
  category?: string;
  className?: string;
  containerClassName?: string;
  /**
   * "high" para imagens above-the-fold (LCP) — usar apenas na primeira imagem visível.
   * "low" para imagens below-the-fold (default: "auto").
   */
  fetchpriority?: "high" | "low" | "auto";
  /** Se true, não aplica lazy loading (use para LCP). */
  eager?: boolean;
}

export default function ProductImage({
  imageUrl,
  alt,
  category = "",
  className = "",
  containerClassName = "",
  fetchpriority = "auto",
  eager = false,
}: Props) {
  const [error, setError] = useState(false);
  const slug = category.toLowerCase().replace(/\s+/g, "-");
  const emoji = categoryIcons[slug] ?? "📦";
  const palette = CATEGORY_PALETTES[slug] ?? "from-[#475569] to-[#334155]";

  if (error || !imageUrl) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br ${palette} ${containerClassName}`}>
        <span className="text-5xl drop-shadow-md">{emoji}</span>
      </div>
    );
  }

  return (
    <img
      src={getProductImageUrl(imageUrl)}
      alt={alt ?? ""}
      onError={() => setError(true)}
      loading={eager ? "eager" : "lazy"}
      decoding={eager ? "sync" : "async"}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchPriority={fetchpriority as any}
      className={className}
    />
  );
}
