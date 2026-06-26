// ─────────────────────────────────────────────────────────────────────────────
// taxonomy.ts — FONTE ÚNICA DE VERDADE da navegação do BrasUX Shopping.
//
// As 33 categorias planas de `categories.ts` continuam sendo os átomos
// (id/name/slug/icon). Aqui agrupamos esses átomos em 6 DEPARTAMENTOS por
// intenção de uso (modelo iFood/Rappi: "modo de uso" no topo, categoria dentro).
//
// Toda a UI — Home, /categorias, CategoryPage, Footer e o cadastro de loja —
// deve consumir ESTE arquivo. Nunca redefinir agrupamentos espalhados pela view.
// ─────────────────────────────────────────────────────────────────────────────

import { categories, type Category } from "./categories";
import { categoryIcons } from "./categoryIcons";

export interface Department {
  /** identificador estável usado em rotas/âncoras (?dep=comida, #comida) */
  key: string;
  /** rótulo exibido ao usuário */
  label: string;
  /** descrição curta de apoio */
  description: string;
  /** emoji de apoio (iconografia definitiva entra no P2 do design system) */
  emoji: string;
  /** cor de acento — ÚNICA fonte de cor por departamento (mata o CAT_THEMES aleatório) */
  accent: string;
  /** slugs de categoria que pertencem a este departamento */
  slugs: string[];
}

// ── Os 6 departamentos ───────────────────────────────────────────────────────
// Ordem = ordem de exibição. Acento = cor estável (sem aleatoriedade por índice).

export const departments: Department[] = [
  {
    key: "comida",
    label: "Comida",
    description: "Restaurantes e delivery pronto para comer agora",
    emoji: "🍽️",
    accent: "#dc2626",
    slugs: ["restaurantes", "lanches", "pizzarias", "acai-sorvetes", "cafeterias", "doces"],
  },
  {
    key: "mercado",
    label: "Mercado",
    description: "Compra do dia a dia: mercearia, hortifruti, açougue e bebidas",
    emoji: "🛒",
    accent: "#16a34a",
    slugs: [
      "mercearia", "hortifruti", "carnes", "padaria", "conveniencia",
      "cervejas", "destilados-e-vinhos", "nao-alcoolicos",
    ],
  },
  {
    key: "saude-beleza",
    label: "Saúde & Beleza",
    description: "Farmácia, cuidados pessoais, fitness, pet e bebês",
    emoji: "💊",
    accent: "#0d9488",
    slugs: ["farmacia", "beleza", "fitness", "petshop", "bebes"],
  },
  {
    key: "casa-construcao",
    label: "Casa & Construção",
    description: "Para sua casa, reforma, ferramentas e automotivo",
    emoji: "🏠",
    accent: "#ea580c",
    slugs: ["casa-cozinha", "utilidades", "ferramentas", "construcao", "automotivo"],
  },
  {
    key: "variedades",
    label: "Variedades",
    description: "Eletrônicos, moda, papelaria, brinquedos e presentes",
    emoji: "📦",
    accent: "#1d4ed8",
    slugs: ["eletronicos", "moda", "papelaria", "brinquedos", "presentes"],
  },
  {
    key: "servicos-cursos",
    label: "Serviços & Cursos",
    description: "Serviços, assistência técnica, cursos on-line e mais",
    emoji: "🛠️",
    accent: "#7c3aed",
    slugs: ["servicos", "assistencia-tecnica", "cursos-online", "outros"],
  },
];

// ── Índices derivados (montados uma vez) ─────────────────────────────────────

const categoryBySlug = new Map<string, Category>(categories.map((c) => [c.slug, c]));

const departmentBySlug = new Map<string, Department>();
for (const dep of departments) {
  for (const slug of dep.slugs) departmentBySlug.set(slug, dep);
}

// ── API pública ──────────────────────────────────────────────────────────────

/** Categoria (átomo) a partir do slug. */
export function getCategory(slug: string): Category | undefined {
  return categoryBySlug.get(slug);
}

/** Departamento dono de uma categoria. */
export function getDepartmentOf(slug: string): Department | undefined {
  return departmentBySlug.get(slug);
}

/** Cor de acento da categoria, herdada do departamento (fallback neutro). */
export function getAccent(slug: string): string {
  return departmentBySlug.get(slug)?.accent ?? "#64748b";
}

/** Categorias (átomos) de um departamento, na ordem definida na taxonomia. */
export function getCategoriesOf(dep: Department): Category[] {
  return dep.slugs
    .map((slug) => categoryBySlug.get(slug))
    .filter((c): c is Category => Boolean(c));
}

/** Departamento por key (ex.: "comida"). */
export function getDepartment(key: string): Department | undefined {
  return departments.find((d) => d.key === key);
}

// ── Guarda de integridade (apenas em DEV) ────────────────────────────────────
// Garante que toda categoria pertence a exatamente UM departamento. Se alguém
// adicionar uma categoria nova em categories.ts e esquecer de mapear aqui, o
// console avisa em desenvolvimento — sem quebrar produção.

if (import.meta.env.DEV) {
  const mapped = new Set(departments.flatMap((d) => d.slugs));
  const orphans = categories.filter((c) => !mapped.has(c.slug)).map((c) => c.slug);
  if (orphans.length) {
    console.warn(
      `[taxonomy] ${orphans.length} categoria(s) sem departamento:`,
      orphans.join(", "),
    );
  }
  const counts = new Map<string, number>();
  for (const dep of departments) for (const s of dep.slugs) counts.set(s, (counts.get(s) ?? 0) + 1);
  const dupes = [...counts].filter(([, n]) => n > 1).map(([s]) => s);
  if (dupes.length) console.warn(`[taxonomy] categoria(s) em mais de um departamento:`, dupes.join(", "));

  const unknown = [...departmentBySlug.keys()].filter((s) => !categoryBySlug.has(s));
  if (unknown.length) console.warn(`[taxonomy] slug(s) inexistente(s) em categories.ts:`, unknown.join(", "));
}

// Reexport utilitário para quem só precisa do emoji por slug.
export { categoryIcons };
