export type BrasUXSolution = {
  id: string;
  name: string;
  description: string;
  url: string;
  categorySlug: string;
  icon: string;
  badge: string;
  gradient: string;
};

export const brasuxSolutions: BrasUXSolution[] = [
  {
    id: "notaon",
    name: "Curso NotaOn",
    description: "Preparação completa para o ENEM com aulas, simulados e correção personalizada de redação.",
    url: "https://cursonotaon.com.br",
    categorySlug: "cursos-online",
    icon: "🎓",
    badge: "BrasUX Edu",
    gradient: "from-[#16a34a] to-[#15803d]",
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
  },
  {
    id: "fabrica-landing-pages",
    name: "Fábrica de Landing Pages BrasUX",
    description: "Landing pages e páginas de produtos de alta conversão desenvolvidas pela BrasUX. Entrega rápida, design profissional.",
    url: "https://produtos.brasux.com.br/",
    categorySlug: "servicos",
    icon: "🚀",
    badge: "BrasUX Dev",
    gradient: "from-[#16a34a] to-[#0f766e]",
  },
];
