export type BrasUXSolution = {
  id: string;
  name: string;
  description: string;
  url: string;
  categorySlug: string;
  icon: string;
  badge: string;
  gradient: string;
  cardImage?: string;
  price?: string;
  highlight?: string;
};

export const brasuxSolutions: BrasUXSolution[] = [
  {
    id: "ComprAI-shopping",
    name: "BrasUX Soluções",
    description: "O Shopping Brasileiro de Soluções Tecnológicas. 10 lojas especializadas, do produto digital ao app enterprise — tudo em um só lugar.",
    url: "https://comprai.store",
    categorySlug: "landing-pages",
    icon: "🛍️",
    badge: "Shopping Tech Brasileiro",
    gradient: "from-[#002776] to-[#16a34a]",
    cardImage: "/home.webp",
    highlight: "Landing Pages · Apps · White Label · IA · Dados · Consultoria",
  },
  {
    id: "fabrica-landing-pages",
    name: "Fábrica de Landing Pages",
    description: "Sites profissionais que convertem: landing pages, páginas de captura, páginas institucionais e muito mais — entrega em até 5 dias úteis.",
    price: "R$ 499,00",
    url: "https://produtos.brasux.com.br/",
    categorySlug: "landing-pages",
    icon: "🚀",
    badge: "Loja 1 · Dev",
    gradient: "from-[#16a34a] to-[#0f766e]",
    cardImage: "/card-lp.webp",
  },
  {
    id: "fabrica-aplicativos",
    name: "Fábrica de Aplicativos",
    description: "Apps mobile e web sob medida: delivery, marketplace, clínica, academia, escola, ERP, CRM e muito mais com tecnologia moderna.",
    url: "https://servicos.brasux.com.br",
    categorySlug: "aplicativos",
    icon: "📱",
    badge: "Loja 2 · Dev",
    gradient: "from-[#2563eb] to-[#1e3a8a]",
    cardImage: "/card-ti.webp",
    highlight: "React Native · Flutter · Next.js · Node.js",
  },
  {
    id: "white-label",
    name: "White Label",
    description: "Sistemas completos prontos para personalizar com sua marca: marketplace, delivery, ERP, PDV, plataforma escolar e muito mais.",
    url: "https://servicos.brasux.com.br",
    categorySlug: "white-label",
    icon: "🏷️",
    badge: "Loja 3 · White Label",
    gradient: "from-[#7c3aed] to-[#312e81]",
    highlight: "Sua marca · Seu preço · Código-fonte incluso",
  },
  {
    id: "inteligencia-artificial",
    name: "Inteligência Artificial",
    description: "Chatbots, assistentes virtuais, automação e IA aplicada — para atendimento, marketing, vendas, RH e saúde.",
    url: "https://servicos.brasux.com.br",
    categorySlug: "inteligencia-artificial",
    icon: "🤖",
    badge: "Loja 4 · IA",
    gradient: "from-[#0d9488] to-[#134e4a]",
    highlight: "GPT-4 · Claude · Automação · RAG · Agentes IA",
  },
  {
    id: "brasux-caixa",
    name: "BrasUX Caixa",
    description: "PDV e gestão comercial completos — vendas, estoque, fluxo de caixa e dashboard. Simples, poderoso e acessível.",
    url: "https://caixa.brasux.store",
    categorySlug: "wl-pdv",
    icon: "🧾",
    badge: "White Label · PDV",
    gradient: "from-[#064e3b] to-[#022c22]",
    cardImage: "/card-pdv.webp",
    highlight: "Plano inicial gratuito · Sem fidelidade · Acesse agora",
  },
  {
    id: "analise-dados",
    name: "Análise de Dados",
    description: "Business Intelligence, dashboards, Machine Learning, análise preditiva e KPIs para transformar seus dados em decisões.",
    url: "https://servicos.brasux.com.br",
    categorySlug: "analise-dados",
    icon: "📊",
    badge: "Loja 8 · Analytics",
    gradient: "from-[#9333ea] to-[#581c87]",
    highlight: "Power BI · Python · dbt · Superset · BigQuery",
  },
];
