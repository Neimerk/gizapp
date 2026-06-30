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
    id: "brasux-shopping",
    name: "BrasUX Shopping",
    description: "Marketplace com lojas locais, restaurantes, mercados, farmácias e muito mais — entrega rápida em todo o Brasil.",
    url: "https://shopping.brasux.com.br",
    categorySlug: "shopping",
    icon: "🛍️",
    badge: "BrasUX Shopping",
    gradient: "from-[#002776] to-[#16a34a]",
    cardImage: "/home.webp",
    highlight: "Mais de 30 categorias · Lojistas e entregadores parceiros",
  },
  {
    id: "brasux-caixa",
    name: "BrasUX Caixa",
    description: "PDV e gestão comercial completos — vendas, estoque, fluxo de caixa e dashboard. Simples, poderoso e acessível.",
    url: "https://brasux-caixa-livre.vercel.app",
    categorySlug: "servicos",
    icon: "🧾",
    badge: "BrasUX Comercial",
    gradient: "from-[#064e3b] to-[#022c22]",
    cardImage: "/card-pdv.webp",
    highlight: "Plano inicial gratuito · Sem fidelidade · Acesse agora",
  },
  {
    id: "fabrica-landing-pages",
    name: "Fábrica de Landing Pages BrasUX",
    description: "Landing Page + botão WhatsApp — entrega em até 5 dias úteis.",
    price: "R$ 499,00",
    url: "https://produtos.brasux.com.br/",
    categorySlug: "servicos",
    icon: "🚀",
    badge: "BrasUX Dev",
    gradient: "from-[#16a34a] to-[#0f766e]",
    cardImage: "/card-lp.webp",
  },
  {
    id: "notaon",
    name: "Curso NotaOn",
    description: "Preparação completa para o ENEM com aulas, simulados e correção personalizada de redação.",
    url: "https://cursonotaon.com.br",
    categorySlug: "cursos-online",
    icon: "🎓",
    badge: "BrasUX Edu",
    gradient: "from-[#16a34a] to-[#15803d]",
    cardImage: "/card-notaon.webp",
    highlight: "Videoaulas · Material didático · Correção de redação",
  },
  {
    id: "simulenm",
    name: "SimulENEM",
    description: "Simulados do ENEM com gabarito comentado, ranking nacional e estatísticas de desempenho.",
    url: "https://simulenem.com",
    categorySlug: "cursos-online",
    icon: "📝",
    badge: "BrasUX Edu",
    gradient: "from-[#0f766e] to-[#134e4a]",
    cardImage: "/card-simulenem.webp",
    highlight: "Gratuito · Ranking nacional · Gabarito comentado",
  },
  {
    id: "simulaioab",
    name: "SimulaiOAB",
    description: "Simulados para a prova da OAB com questões comentadas por ordem e fase.",
    url: "https://simulaioab.com",
    categorySlug: "cursos-online",
    icon: "⚖️",
    badge: "BrasUX Edu",
    gradient: "from-[#1d4ed8] to-[#1e3a8a]",
    cardImage: "/card-simulaioab.webp",
    highlight: "1ª e 2ª fase · Questões comentadas · Resultado imediato",
  },
  {
    id: "brasux-ti",
    name: "BrasUX Serviços Digitais",
    description: "Sites, sistemas, IA e automações — soluções tech sob medida para o seu negócio crescer no digital.",
    url: "https://servicos.brasux.com.br",
    categorySlug: "servicos",
    icon: "⚡",
    badge: "BrasUX Dev",
    gradient: "from-[#7c3aed] to-[#312e81]",
    cardImage: "/card-ti.webp",
    highlight: "Desenvolvimento · Dados · IA · Arquitetura · Consultoria",
  },
];
