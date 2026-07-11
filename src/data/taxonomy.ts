// ─────────────────────────────────────────────────────────────────────────────
// taxonomy.ts — FONTE ÚNICA DE VERDADE da taxonomia do BrasUX Soluções.
//
// As categorias de `categories.ts` são os átomos (id/name/slug/icon).
// Aqui agrupamos esses átomos nas 10 LOJAS/DEPARTAMENTOS do shopping digital.
//
// Home, /categorias, CategoryPage, Footer e cadastro de loja
// devem consumir ESTE arquivo.
// ─────────────────────────────────────────────────────────────────────────────

import { categories, type Category } from "./categories";
import { categoryIcons } from "./categoryIcons";

export interface Department {
  key: string;
  label: string;
  description: string;
  emoji: string;
  accent: string;
  slugs: string[];
}

// ── As 10 Lojas do BrasUX ───────────────────────────────────────────────────

export const departments: Department[] = [
  {
    key: "landing-pages",
    label: "Landing Pages",
    description: "Sites e páginas de alta conversão entregues em 5 dias úteis",
    emoji: "🚀",
    accent: "#16a34a",
    slugs: ["landing-page", "one-page", "pagina-captura", "pagina-vendas", "pagina-institucional", "pagina-clinica", "pagina-profissional"],
  },
  {
    key: "aplicativos",
    label: "Aplicativos",
    description: "Apps mobile e web sob medida para qualquer segmento",
    emoji: "📱",
    accent: "#2563eb",
    slugs: ["app-delivery", "app-marketplace", "app-restaurante", "app-barbearia", "app-clinica", "app-academia", "app-erp", "app-crm", "app-ead", "app-agendamento"],
  },
  {
    key: "white-label",
    label: "White Label",
    description: "Sistemas prontos, com sua marca, para vender como seu",
    emoji: "🏷️",
    accent: "#7c3aed",
    slugs: ["wl-marketplace", "wl-delivery", "wl-ecommerce", "wl-pdv", "wl-erp", "wl-escola", "wl-clinica", "wl-juridico", "wl-imobiliario", "wl-financeiro"],
  },
  {
    key: "inteligencia-artificial",
    label: "Inteligência Artificial",
    description: "Chatbots, automações e soluções de IA para o seu negócio",
    emoji: "🤖",
    accent: "#0d9488",
    slugs: ["chatbots", "assistentes-ia", "automacao-ia", "ia-atendimento", "ia-marketing", "ia-rh", "ia-vendas", "ia-saude"],
  },
  {
    key: "engenharia-software",
    label: "Engenharia de Software",
    description: "Arquitetura, modernização, auditoria e performance de sistemas",
    emoji: "⚙️",
    accent: "#ea580c",
    slugs: ["arquitetura", "modernizacao", "migracao-sistemas", "auditoria-software", "refatoracao", "performance-dev", "consultoria-tecnica"],
  },
  {
    key: "ux-ui-design",
    label: "UX/UI Design",
    description: "Design system, protótipos e interfaces de nível Stripe/Linear",
    emoji: "🎨",
    accent: "#e11d48",
    slugs: ["design-system", "prototipos", "ui-interfaces", "ux-research", "design-apps", "design-dashboard"],
  },
  {
    key: "engenharia-dados",
    label: "Engenharia de Dados",
    description: "Pipelines, Data Warehouse, ETL e integração de dados em escala",
    emoji: "🏛️",
    accent: "#0369a1",
    slugs: ["data-warehouse", "etl-pipelines", "data-lake", "big-data", "integracao-dados"],
  },
  {
    key: "analise-dados",
    label: "Análise de Dados",
    description: "BI, dashboards, ML, análise preditiva e insights estratégicos",
    emoji: "📊",
    accent: "#9333ea",
    slugs: ["business-intelligence", "dashboards-bi", "machine-learning", "analise-preditiva", "kpis-indicadores", "segmentacao-clientes"],
  },
  {
    key: "consultoria",
    label: "Consultoria",
    description: "Transformação digital, cloud, DevOps, segurança e estratégia",
    emoji: "💡",
    accent: "#b45309",
    slugs: ["consultoria-tecnologica", "transformacao-digital", "cloud-consultoria", "devops-consultoria", "seguranca-digital", "ia-consultoria", "produto-digital"],
  },
  {
    key: "produtos-digitais",
    label: "Produtos Digitais",
    description: "Templates, UI Kits, componentes, APIs e boilerplates prontos",
    emoji: "🧩",
    accent: "#0f766e",
    slugs: ["templates-web", "ui-kits", "componentes-react", "boilerplates", "apis-sdks", "plugins", "temas"],
  },
];

// ── Índices derivados ─────────────────────────────────────────────────────────

const categoryBySlug = new Map<string, Category>(categories.map((c) => [c.slug, c]));

const departmentBySlug = new Map<string, Department>();
for (const dep of departments) {
  for (const slug of dep.slugs) departmentBySlug.set(slug, dep);
}

// ── API pública ──────────────────────────────────────────────────────────────

export function getCategory(slug: string): Category | undefined {
  return categoryBySlug.get(slug);
}

export function getDepartmentOf(slug: string): Department | undefined {
  return departmentBySlug.get(slug);
}

export function getAccent(slug: string): string {
  return departmentBySlug.get(slug)?.accent ?? "#64748b";
}

export function getCategoriesOf(dep: Department): Category[] {
  return dep.slugs
    .map((slug) => categoryBySlug.get(slug))
    .filter((c): c is Category => Boolean(c));
}

export function getDepartment(key: string): Department | undefined {
  return departments.find((d) => d.key === key);
}

// ── Guarda de integridade (DEV only) ─────────────────────────────────────────

if (import.meta.env.DEV) {
  const mapped = new Set(departments.flatMap((d) => d.slugs));
  const orphans = categories.filter((c) => !mapped.has(c.slug)).map((c) => c.slug);
  if (orphans.length) {
    console.warn(`[taxonomy] ${orphans.length} categoria(s) sem departamento:`, orphans.join(", "));
  }
  const counts = new Map<string, number>();
  for (const dep of departments) for (const s of dep.slugs) counts.set(s, (counts.get(s) ?? 0) + 1);
  const dupes = [...counts].filter(([, n]) => n > 1).map(([s]) => s);
  if (dupes.length) console.warn(`[taxonomy] categoria(s) em mais de um departamento:`, dupes.join(", "));

  const unknown = [...departmentBySlug.keys()].filter((s) => !categoryBySlug.has(s));
  if (unknown.length) console.warn(`[taxonomy] slug(s) inexistente(s) em categories.ts:`, unknown.join(", "));
}

export { categoryIcons };
