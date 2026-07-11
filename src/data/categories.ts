export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
}

export const categories: Category[] = [
  // ── Fábrica de Landing Pages ──────────────────────────────
  { id: 1,  name: "Landing Page",           slug: "landing-page",          icon: "rocket" },
  { id: 2,  name: "One Page",               slug: "one-page",              icon: "layout-template" },
  { id: 3,  name: "Página de Captura",      slug: "pagina-captura",        icon: "target" },
  { id: 4,  name: "Página de Vendas",       slug: "pagina-vendas",         icon: "badge-dollar-sign" },
  { id: 5,  name: "Página Institucional",   slug: "pagina-institucional",  icon: "building-2" },
  { id: 6,  name: "Página para Clínicas",   slug: "pagina-clinica",        icon: "heart-pulse" },
  { id: 7,  name: "Página Profissional",    slug: "pagina-profissional",   icon: "briefcase" },

  // ── Fábrica de Aplicativos ────────────────────────────────
  { id: 10, name: "App Delivery",           slug: "app-delivery",          icon: "bike" },
  { id: 11, name: "App Marketplace",        slug: "app-marketplace",       icon: "store" },
  { id: 12, name: "App Restaurante",        slug: "app-restaurante",       icon: "utensils" },
  { id: 13, name: "App Barbearia",          slug: "app-barbearia",         icon: "scissors" },
  { id: 14, name: "App Clínica",            slug: "app-clinica",           icon: "stethoscope" },
  { id: 15, name: "App Academia",           slug: "app-academia",          icon: "dumbbell" },
  { id: 16, name: "App ERP",               slug: "app-erp",               icon: "bar-chart-2" },
  { id: 17, name: "App CRM",               slug: "app-crm",               icon: "users" },
  { id: 18, name: "App EAD",               slug: "app-ead",               icon: "graduation-cap" },
  { id: 19, name: "App Agendamento",        slug: "app-agendamento",       icon: "calendar-check" },

  // ── White Label ───────────────────────────────────────────
  { id: 20, name: "Marketplace",            slug: "wl-marketplace",        icon: "store" },
  { id: 21, name: "Delivery",              slug: "wl-delivery",           icon: "truck" },
  { id: 22, name: "E-commerce",            slug: "wl-ecommerce",          icon: "shopping-cart" },
  { id: 23, name: "PDV / Caixa",           slug: "wl-pdv",               icon: "receipt" },
  { id: 24, name: "ERP Empresarial",        slug: "wl-erp",               icon: "layout-dashboard" },
  { id: 25, name: "Sistema Escolar",        slug: "wl-escola",             icon: "school" },
  { id: 26, name: "Sistema Clínica",        slug: "wl-clinica",            icon: "heart-pulse" },
  { id: 27, name: "Sistema Jurídico",       slug: "wl-juridico",           icon: "scale" },
  { id: 28, name: "Sistema Imobiliário",    slug: "wl-imobiliario",        icon: "home" },
  { id: 29, name: "Sistema Financeiro",     slug: "wl-financeiro",         icon: "landmark" },

  // ── Inteligência Artificial ────────────────────────────────
  { id: 30, name: "Chatbots",              slug: "chatbots",              icon: "bot" },
  { id: 31, name: "Assistentes IA",         slug: "assistentes-ia",        icon: "brain" },
  { id: 32, name: "Automação",             slug: "automacao-ia",          icon: "zap" },
  { id: 33, name: "IA para Atendimento",   slug: "ia-atendimento",        icon: "message-circle" },
  { id: 34, name: "IA para Marketing",     slug: "ia-marketing",          icon: "megaphone" },
  { id: 35, name: "IA para RH",            slug: "ia-rh",                icon: "users-round" },
  { id: 36, name: "IA para Vendas",        slug: "ia-vendas",             icon: "trending-up" },
  { id: 37, name: "IA para Saúde",         slug: "ia-saude",              icon: "activity" },

  // ── Engenharia de Software ────────────────────────────────
  { id: 40, name: "Arquitetura",           slug: "arquitetura",           icon: "layers" },
  { id: 41, name: "Modernização",          slug: "modernizacao",          icon: "refresh-cw" },
  { id: 42, name: "Migração de Sistemas",  slug: "migracao-sistemas",     icon: "move-right" },
  { id: 43, name: "Auditoria de Software", slug: "auditoria-software",    icon: "shield-check" },
  { id: 44, name: "Refatoração",           slug: "refatoracao",           icon: "code-2" },
  { id: 45, name: "Performance",           slug: "performance-dev",        icon: "gauge" },
  { id: 46, name: "Consultoria Técnica",   slug: "consultoria-tecnica",   icon: "lightbulb" },

  // ── UX/UI Design ──────────────────────────────────────────
  { id: 50, name: "Design System",         slug: "design-system",         icon: "palette" },
  { id: 51, name: "Protótipos",            slug: "prototipos",            icon: "pen-tool" },
  { id: 52, name: "UI Interfaces",         slug: "ui-interfaces",         icon: "monitor" },
  { id: 53, name: "UX Research",           slug: "ux-research",           icon: "search" },
  { id: 54, name: "Design de Apps",        slug: "design-apps",           icon: "smartphone" },
  { id: 55, name: "Design de Dashboards",  slug: "design-dashboard",      icon: "layout-dashboard" },

  // ── Engenharia de Dados ────────────────────────────────────
  { id: 60, name: "Data Warehouse",        slug: "data-warehouse",        icon: "database" },
  { id: 61, name: "ETL / Pipelines",       slug: "etl-pipelines",         icon: "git-branch" },
  { id: 62, name: "Data Lake",             slug: "data-lake",             icon: "cloud" },
  { id: 63, name: "Big Data",              slug: "big-data",              icon: "server" },
  { id: 64, name: "Integração de Dados",   slug: "integracao-dados",      icon: "link" },

  // ── Análise de Dados ───────────────────────────────────────
  { id: 70, name: "Business Intelligence", slug: "business-intelligence", icon: "bar-chart-3" },
  { id: 71, name: "Dashboards",            slug: "dashboards-bi",         icon: "pie-chart" },
  { id: 72, name: "Machine Learning",      slug: "machine-learning",      icon: "cpu" },
  { id: 73, name: "Análise Preditiva",     slug: "analise-preditiva",     icon: "telescope" },
  { id: 74, name: "KPIs e Indicadores",    slug: "kpis-indicadores",      icon: "trending-up" },
  { id: 75, name: "Segmentação",           slug: "segmentacao-clientes",  icon: "filter" },

  // ── Consultoria ────────────────────────────────────────────
  { id: 80, name: "Consultoria Tecnológica", slug: "consultoria-tecnologica", icon: "lightbulb" },
  { id: 81, name: "Transformação Digital",   slug: "transformacao-digital",   icon: "sparkles" },
  { id: 82, name: "Cloud",                  slug: "cloud-consultoria",        icon: "cloud" },
  { id: 83, name: "DevOps",                 slug: "devops-consultoria",       icon: "git-merge" },
  { id: 84, name: "Segurança Digital",       slug: "seguranca-digital",        icon: "shield" },
  { id: 85, name: "IA Estratégica",          slug: "ia-consultoria",           icon: "brain" },
  { id: 86, name: "Produto Digital",         slug: "produto-digital",          icon: "package" },

  // ── Produtos Digitais ─────────────────────────────────────
  { id: 90, name: "Templates Web",          slug: "templates-web",         icon: "layout-template" },
  { id: 91, name: "UI Kits",               slug: "ui-kits",               icon: "component" },
  { id: 92, name: "Componentes React",      slug: "componentes-react",     icon: "atom" },
  { id: 93, name: "Boilerplates",           slug: "boilerplates",          icon: "code" },
  { id: 94, name: "APIs e SDKs",            slug: "apis-sdks",             icon: "plug" },
  { id: 95, name: "Plugins",               slug: "plugins",               icon: "puzzle" },
  { id: 96, name: "Temas",                 slug: "temas",                 icon: "paint-bucket" },
];
