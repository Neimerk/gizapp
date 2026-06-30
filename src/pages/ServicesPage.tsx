import { ArrowRight, ArrowLeft, Mail, CheckCircle2, Code2, BarChart3, Layers, Brain, Target, Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";
import type { FC } from "react";

interface Deliverable {
  title: string;
  desc: string;
}

interface UseCase {
  emoji: string;
  title: string;
  desc: string;
}

interface Highlight {
  emoji: string;
  label: string;
  desc: string;
}

interface ServiceData {
  id: string;
  Icon: FC<{ size?: number; className?: string }>;
  emoji: string;
  navLabel: string;
  title: string;
  subtitle: string;
  description: string;
  expandedDescription: string;
  color: string;
  colorDim: string;
  colorBorder: string;
  gradient: string;
  highlights: Highlight[];
  deliverables: Deliverable[];
  useCases: UseCase[];
  tags: string[];
  idealFor: string;
}

const SERVICES: ServiceData[] = [
  {
    id: "desenvolvimento",
    Icon: Code2,
    emoji: "💻",
    navLabel: "Desenvolvimento",
    title: "Análise e Desenvolvimento de Sistemas",
    subtitle: "Do requisito ao deploy",
    description:
      "Construímos sistemas web, mobile e desktop sob medida — com arquitetura sólida, código limpo e entrega real.",
    expandedDescription:
      "Cada projeto começa com um diagnóstico honesto do que precisa ser construído. Trabalhamos em ciclos curtos com entregas parciais funcionais, mantendo comunicação direta e transparência total sobre progresso, bloqueios e decisões técnicas. Da especificação ao ambiente de produção, com qualidade e velocidade — sem gambiarras que viram dívida técnica no futuro.",
    color: "#3b82f6",
    colorDim: "rgba(59,130,246,0.12)",
    colorBorder: "rgba(59,130,246,0.25)",
    gradient: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)",
    highlights: [
      { emoji: "⚡", label: "Ciclos de 2 semanas", desc: "Entregas parciais funcionais a cada sprint, sem surpresas no final do projeto" },
      { emoji: "🏗️", label: "Arquitetura que escala", desc: "Código projetado para crescer com o negócio, não apenas para funcionar no lançamento" },
      { emoji: "🔒", label: "Qualidade integrada", desc: "Testes automatizados e CI/CD desde a primeira linha — não como etapa final" },
    ],
    deliverables: [
      {
        title: "Levantamento e modelagem de requisitos",
        desc: "Mapeamos fluxos de negócio, entidades, integrações e dependências antes de qualquer linha de código — para construir o sistema certo, não apenas construir certo.",
      },
      {
        title: "Desenvolvimento full-stack (web, mobile, desktop)",
        desc: "Stack adequada ao contexto: React, Node.js, .NET, Flutter, React Native. Escolhemos a tecnologia pelo problema, não pelo modismo.",
      },
      {
        title: "Integração com APIs externas e sistemas legados",
        desc: "Conectamos o novo sistema ao que já existe — ERPs, CRMs, gateways de pagamento, integrações de terceiros — sem quebrar o que funciona.",
      },
      {
        title: "Testes automatizados e pipeline de CI/CD",
        desc: "Cobertura de testes unitários e de integração, deploy automatizado e verificação contínua de qualidade em cada commit.",
      },
      {
        title: "Deploy, monitoramento e manutenção evolutiva",
        desc: "Lançamento em produção com observabilidade, alertas configurados e suporte para a evolução contínua do produto ao longo do tempo.",
      },
    ],
    useCases: [
      { emoji: "🏢", title: "Sistema de gestão interna", desc: "ERP enxuto, CRM ou ferramenta operacional para digitalizar processos e eliminar planilhas que só o criador entende." },
      { emoji: "🛍️", title: "Plataforma SaaS ou marketplace", desc: "Produto digital com múltiplos usuários, fluxo de pagamentos e lógica de negócio que não cabe em uma solução pronta." },
      { emoji: "📱", title: "App mobile para equipe de campo", desc: "Aplicativo para vendedores, técnicos ou entregadores com suporte offline, GPS e sincronização em tempo real." },
    ],
    tags: ["React", "Node.js", ".NET", "Flutter", "PostgreSQL", "Docker", "AWS", "TypeScript"],
    idealFor:
      "Empresas que precisam de um sistema personalizado ou querem digitalizar processos internos sem se limitar a soluções genéricas que não cabem no seu fluxo de trabalho.",
  },
  {
    id: "dados",
    Icon: BarChart3,
    emoji: "📊",
    navLabel: "Dados",
    title: "Análise de Dados",
    subtitle: "Dados que geram decisão",
    description:
      "Transformamos dados brutos em inteligência de negócio — coleta, tratamento, visualização e análise para decisões mais rápidas e fundamentadas.",
    expandedDescription:
      "Dados sem interpretação são ruído. Transformamos suas fontes — planilhas, bancos de dados, APIs, sistemas legados — em dashboards que mostram o que importa para cada nível da empresa. Do operacional ao executivo, cada pessoa vê o dado certo no momento certo, sem precisar saber SQL para isso.",
    color: "#06b6d4",
    colorDim: "rgba(6,182,212,0.12)",
    colorBorder: "rgba(6,182,212,0.25)",
    gradient: "linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)",
    highlights: [
      { emoji: "🎯", label: "KPIs que importam", desc: "Definimos as métricas certas para o seu negócio — não todas as métricas possíveis" },
      { emoji: "📈", label: "Decisões mais rápidas", desc: "Da pergunta à resposta em segundos, com dashboards atualizados em tempo real" },
      { emoji: "🔮", label: "Análise preditiva", desc: "Modelos que antecipam tendências antes que elas virem problemas ou oportunidades perdidas" },
    ],
    deliverables: [
      {
        title: "Mapeamento e coleta de fontes de dados",
        desc: "Inventariamos todas as fontes disponíveis — planilhas, bancos, APIs, arquivos — e definimos a estratégia de coleta mais eficiente para o seu contexto.",
      },
      {
        title: "ETL, limpeza e modelagem de dados",
        desc: "Pipelines de transformação que garantem dados consistentes, confiáveis e prontos para análise — sem duplicatas, lacunas ou inconsistências.",
      },
      {
        title: "Dashboards interativos e relatórios executivos",
        desc: "Visualizações claras no Power BI, Metabase ou ferramenta da sua escolha — com layouts adaptados para cada perfil de usuário e nível hierárquico.",
      },
      {
        title: "KPIs estratégicos e alertas automáticos",
        desc: "Indicadores alinhados com os objetivos do negócio e notificações automáticas quando algo sai do esperado — sem depender de alguém verificar manualmente.",
      },
      {
        title: "Análise preditiva e segmentação de clientes",
        desc: "Modelos de machine learning para prever churn, estimar demanda, segmentar base de clientes e identificar padrões que não aparecem no olhar humano.",
      },
    ],
    useCases: [
      { emoji: "📊", title: "Dashboard de vendas em tempo real", desc: "Visão unificada de performance por produto, região, vendedor e canal — atualizada automaticamente, sem exportar planilha." },
      { emoji: "🎯", title: "Análise de churn de clientes", desc: "Identificação de clientes com risco de cancelamento antes que eles decidam ir embora — com tempo de agir." },
      { emoji: "📦", title: "Previsão de demanda e estoque", desc: "Modelos preditivos para otimizar compras, reduzir ruptura e evitar capital parado em excesso de estoque." },
    ],
    tags: ["Power BI", "Python", "SQL", "Pandas", "ETL", "Metabase", "dbt", "BigQuery"],
    idealFor:
      "Negócios que ainda tomam decisões por intuição ou por quem grita mais alto — e que querem migrar para uma cultura orientada a dados sem precisar montar um time de BI interno.",
  },
  {
    id: "arquitetura",
    Icon: Layers,
    emoji: "🏗️",
    navLabel: "Arquitetura",
    title: "Engenharia e Arquitetura de Software",
    subtitle: "Sistemas que escalam",
    description:
      "Projetamos e revisamos arquiteturas para sistemas que precisam crescer com segurança — estrutura certa desde o início, ou refatoração sem trauma.",
    expandedDescription:
      "Muitos sistemas chegam até nós fraturados: dívida técnica acumulada, arquitetura que não escala mais, código que ninguém quer tocar. Fazemos diagnóstico honesto e traçamos o caminho para modernizar sem parar o negócio. Para projetos novos, desenhamos a fundação certa antes de escrever a primeira linha — evitando os problemas clássicos de quem constrói rápido sem pensar no depois.",
    color: "#f59e0b",
    colorDim: "rgba(245,158,11,0.12)",
    colorBorder: "rgba(245,158,11,0.25)",
    gradient: "linear-gradient(135deg, #b45309 0%, #f59e0b 100%)",
    highlights: [
      { emoji: "🔬", label: "Diagnóstico sem filtro", desc: "Auditoria técnica completa e honesta — você precisa saber o que está acontecendo de verdade" },
      { emoji: "📐", label: "Design para crescimento", desc: "Arquitetura que suporta 10x mais carga sem reescrever o sistema do zero" },
      { emoji: "🛡️", label: "Segurança estrutural", desc: "Autenticação robusta, autorização granular e proteção de dados desde a arquitetura — não como afterthought" },
    ],
    deliverables: [
      {
        title: "Revisão e auditoria de arquitetura existente",
        desc: "Mapeamento completo de pontos de falha, gargalos, dívida técnica e riscos de segurança no sistema atual — com relatório priorizado por impacto.",
      },
      {
        title: "Design de microsserviços e APIs REST / GraphQL",
        desc: "Modelagem de contratos de API, definição de bounded contexts e estratégia de decomposição de serviços com baixo acoplamento e alta coesão.",
      },
      {
        title: "Estratégias de escalabilidade e alta disponibilidade",
        desc: "Padrões de cache, filas de mensagens, balanceamento de carga e design para resiliência a falhas — para o sistema não cair quando mais precisar funcionar.",
      },
      {
        title: "Segurança, autenticação e gestão de permissões",
        desc: "OAuth 2.0, RBAC, proteção contra OWASP Top 10 e conformidade com LGPD integrada à arquitetura — não adicionada depois como patch.",
      },
      {
        title: "Documentação técnica e padronização de código",
        desc: "ADRs, diagramas C4, guias de estilo e convenções para que o time mantenha o padrão e novos devs consigam contribuir rapidamente.",
      },
    ],
    useCases: [
      { emoji: "🔄", title: "Migração de monolito para microsserviços", desc: "Decomposição gradual do sistema legado sem paralisar as operações nem travar o time de produto no processo." },
      { emoji: "🚀", title: "Preparação para escala", desc: "Revisão de arquitetura antes de um evento de crescimento: rodada de investimento, campanha, Black Friday ou expansão." },
      { emoji: "🏢", title: "Padronização de múltiplos sistemas", desc: "Definição de padrões técnicos para times que cresceram rápido e ficaram com stacks e convenções completamente divergentes." },
    ],
    tags: ["Microserviços", "Cloud", "Docker", "Kubernetes", "REST", "GraphQL", "Redis", "RabbitMQ"],
    idealFor:
      "Times que sentem que a arquitetura atual está travando o crescimento do produto — e que precisam de um plano claro para modernizar sem parar o negócio.",
  },
  {
    id: "ia-ml",
    Icon: Brain,
    emoji: "🤖",
    navLabel: "IA & ML",
    title: "Soluções em IA e Machine Learning",
    subtitle: "Inteligência aplicada ao negócio",
    description:
      "Integramos modelos de IA e ML ao seu produto ou processo — de automações simples a agentes autônomos com LLMs. Pragmáticos, sem hype.",
    expandedDescription:
      "IA deixou de ser diferencial e virou necessidade competitiva. Ajudamos sua empresa a integrar modelos de linguagem, automações inteligentes e sistemas preditivos de forma pragmática — sem promessas mirabolantes, com resultado mensurável e custo controlado. Cada solução é calibrada para o problema real, não para o caso de uso mais impressionante no pitch deck.",
    color: "#a855f7",
    colorDim: "rgba(168,85,247,0.12)",
    colorBorder: "rgba(168,85,247,0.25)",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
    highlights: [
      { emoji: "🧠", label: "LLMs em produção", desc: "Integração com GPT-4, Claude, Gemini e modelos open-source com custo e latência sob controle" },
      { emoji: "📚", label: "Base de conhecimento privada", desc: "RAG sobre seus documentos internos — respostas precisas sem vazar dados para terceiros" },
      { emoji: "🤖", label: "Agentes autônomos", desc: "Sistemas que tomam ações, não apenas respondem — workflows complexos automatizados de ponta a ponta" },
    ],
    deliverables: [
      {
        title: "Integração com LLMs (GPT, Claude, Gemini)",
        desc: "Escolha do modelo certo para cada caso de uso, com prompt engineering, fine-tuning e monitoramento de custos por token — para não ter surpresas na fatura.",
      },
      {
        title: "Sistemas RAG para bases de conhecimento privadas",
        desc: "Recuperação semântica sobre documentos internos — PDFs, wikis, e-mails, tickets — com respostas precisas, rastreáveis e que citam a fonte.",
      },
      {
        title: "Modelos preditivos e classificação de dados",
        desc: "Algoritmos supervisionados e não-supervisionados para previsão de demanda, classificação de conteúdo e detecção de anomalias em operações.",
      },
      {
        title: "Automação inteligente via NLP e visão computacional",
        desc: "Extração de informações de textos e imagens, triagem automática de documentos, OCR avançado e roteamento inteligente de fluxos operacionais.",
      },
      {
        title: "Agentes autônomos e pipelines de IA em produção",
        desc: "Sistemas multi-agente com memória persistente, ferramentas integradas e capacidade de executar ações reais — não apenas gerar texto.",
      },
    ],
    useCases: [
      { emoji: "💬", title: "Assistente virtual com base interna", desc: "Chatbot que responde sobre seus produtos, processos e políticas usando apenas seus próprios documentos — sem alucinar." },
      { emoji: "📄", title: "Classificação automática de documentos", desc: "Triagem de contratos, pedidos ou tickets com categorização, extração de campos e roteamento automático para o time certo." },
      { emoji: "📉", title: "Detecção de anomalias em tempo real", desc: "Monitoramento de transações, logs ou métricas com alertas automáticos para comportamentos fora do padrão." },
    ],
    tags: ["LLMs", "RAG", "Python", "LangChain", "OpenAI", "Claude API", "TensorFlow", "Agents"],
    idealFor:
      "Empresas que querem automatizar tarefas repetitivas, criar experiências mais inteligentes ou usar IA para tomar melhores decisões — sem precisar contratar um time de ML interno.",
  },
  {
    id: "consultoria",
    Icon: Target,
    emoji: "🎯",
    navLabel: "Consultoria",
    title: "Consultoria em Tecnologia",
    subtitle: "Direção técnica estratégica",
    description:
      "Apoio especializado para escolhas que definem o futuro do produto — stack, arquitetura, equipe, roadmap. Clareza técnica sem viés de fornecedor.",
    expandedDescription:
      "Às vezes o maior valor não é código: é ter alguém com experiência real para apontar o caminho certo antes de gastar tempo e dinheiro no errado. Trabalhamos com fundadores e CTOs para dar clareza técnica sem conflito de interesse — não vendemos horas de desenvolvimento vinculadas ao diagnóstico, então nossa recomendação é sempre pelo que é melhor para você.",
    color: "#22c55e",
    colorDim: "rgba(34,197,94,0.12)",
    colorBorder: "rgba(34,197,94,0.25)",
    gradient: "linear-gradient(135deg, #15803d 0%, #22c55e 100%)",
    highlights: [
      { emoji: "🎯", label: "Sem viés de fornecedor", desc: "Recomendamos o que é melhor para o seu problema, não o que nos interessa vender em seguida" },
      { emoji: "🔍", label: "Diagnóstico profundo", desc: "Análise técnica completa do produto, time e processos antes de qualquer recomendação" },
      { emoji: "🗺️", label: "Saída com plano de ação", desc: "Não apenas um relatório de problemas — um roadmap priorizado e acionável" },
    ],
    deliverables: [
      {
        title: "Diagnóstico técnico completo do produto ou time",
        desc: "Avaliação de código, arquitetura, processos de desenvolvimento, performance e riscos técnicos — com tudo priorizado por impacto no negócio.",
      },
      {
        title: "Definição e revisão de stack tecnológica",
        desc: "Análise das opções disponíveis com recomendação fundamentada — considerando custo total, curva de aprendizado do time, escala futura e riscos de vendor lock-in.",
      },
      {
        title: "Roadmap de produto e priorização técnica",
        desc: "Sequenciamento de iniciativas técnicas alinhado com os objetivos de negócio e a capacidade real do time — sem wishful thinking.",
      },
      {
        title: "Mentoria para times de desenvolvimento",
        desc: "Sessões regulares com líderes técnicos e desenvolvedores para elevação consistente do nível técnico e da cultura de qualidade.",
      },
      {
        title: "Code review e padrões de qualidade",
        desc: "Revisão estruturada do código existente com feedback acionável e definição de padrões que o time consegue manter de forma autônoma.",
      },
    ],
    useCases: [
      { emoji: "💰", title: "Due diligence técnica", desc: "Avaliação independente de produto, código e time para investidores, processos de M&A ou decisão de aquisição de tecnologia." },
      { emoji: "🧭", title: "Definição de stack para novo produto", desc: "Escolha de tecnologias, cloud, banco de dados e ferramentas antes de começar a construir — para não precisar refazer depois." },
      { emoji: "👥", title: "Mentoria contínua de time técnico", desc: "Acompanhamento regular de devs e tech leads para acelerar crescimento profissional e elevar a qualidade do que é entregue." },
    ],
    tags: ["Diagnóstico", "Roadmap", "Mentoria", "Code Review", "Stack", "Estratégia", "LGPD"],
    idealFor:
      "Fundadores e CTOs que precisam de um segundo olhar antes de tomar decisões técnicas críticas — e que valorizam honestidade acima de conforto.",
  },
  {
    id: "empreendedorismo",
    Icon: Lightbulb,
    emoji: "💡",
    navLabel: "Empreendedorismo",
    title: "Projetos, Ideias e Empreendedorismo",
    subtitle: "Da ideia ao primeiro usuário",
    description:
      "Acompanhamos fundadores desde a validação da ideia até o lançamento do MVP — execução real, sem burocracia, foco em aprendizado rápido.",
    expandedDescription:
      "Ter uma ideia boa é o começo. O desafio real é validá-la com velocidade, construir o MVP certo — sem desperdiçar recursos no que não importa ainda — e chegar ao primeiro usuário real antes de ficar sem fôlego. Acompanhamos fundadores nessa jornada com execução técnica, visão de produto e experiência concreta com o que funciona e o que não funciona no mercado brasileiro.",
    color: "#ec4899",
    colorDim: "rgba(236,72,153,0.12)",
    colorBorder: "rgba(236,72,153,0.25)",
    gradient: "linear-gradient(135deg, #be185d 0%, #ec4899 100%)",
    highlights: [
      { emoji: "🚀", label: "MVP em semanas", desc: "Produto funcional em mãos de usuários reais em 4 a 8 semanas — não meses de planejamento" },
      { emoji: "✅", label: "Validação antes do código", desc: "Confirmamos que o problema existe e que as pessoas pagam por ele antes de desenvolver qualquer coisa" },
      { emoji: "📣", label: "Primeiros usuários reais", desc: "Estratégia concreta de go-to-market para os primeiros 100 usuários — não apenas o lançamento técnico" },
    ],
    deliverables: [
      {
        title: "Validação de ideia e mapeamento de mercado",
        desc: "Entrevistas com potenciais usuários, análise de competidores e validação da proposta de valor antes de qualquer linha de código — para não construir o produto errado.",
      },
      {
        title: "Prototipagem rápida (wireframe → protótipo funcional)",
        desc: "Do rascunho em papel ao protótipo navegável para testar com usuários reais e alinhar a visão de produto com quem vai usar.",
      },
      {
        title: "Desenvolvimento do MVP em ciclos curtos",
        desc: "Construção do produto mínimo viável com o menor escopo possível para chegar ao aprendizado real mais rápido — sem funcionalidades que ninguém pediu.",
      },
      {
        title: "Pitch deck técnico para investidores",
        desc: "Narrativa técnica clara, defensável e adaptada para o nível de entendimento de investidores — anjo, seed ou série A.",
      },
      {
        title: "Go-to-market e estratégia de primeiros usuários",
        desc: "Plano de aquisição dos primeiros 100 usuários: canais, mensagens, métricas de sucesso e o que fazer com o feedback que vai chegar.",
      },
    ],
    useCases: [
      { emoji: "💡", title: "SaaS de nicho validado rápido", desc: "Produto B2B para um segmento específico — validado, construído e lançado em menos de 2 meses, sem queimar runway." },
      { emoji: "🛒", title: "Marketplace ou plataforma bilateral", desc: "Produto que conecta dois lados — com estratégia de cold start e validação de ambos os lados antes do desenvolvimento." },
      { emoji: "📚", title: "Plataforma educacional ou de conteúdo", desc: "Produto de aprendizado ou comunidade com modelo de monetização testado e validado antes de escalar." },
    ],
    tags: ["MVP", "Startup", "Pitch", "Validação", "Produto", "Go-to-market", "Lean", "Discovery"],
    idealFor:
      "Empreendedores com uma ideia sólida que precisam de um parceiro técnico para tirar do papel sem gastar uma fortuna construindo a coisa errada.",
  },
];

const PROCESS = [
  {
    step: "01",
    title: "Diagnóstico",
    desc: "Entendemos o problema, o contexto e os objetivos antes de qualquer linha de código ou proposta. Nenhuma solução é apresentada sem esse passo.",
  },
  {
    step: "02",
    title: "Proposta",
    desc: "Apresentamos escopo, cronograma e investimento detalhados — sem surpresas no meio do caminho. Você sabe exatamente o que será entregue e quando.",
  },
  {
    step: "03",
    title: "Execução",
    desc: "Desenvolvemos em ciclos curtos com entregas parciais, revisões constantes e comunicação direta. Mudanças de requisito são tratadas como parte do processo.",
  },
  {
    step: "04",
    title: "Entrega",
    desc: "Lançamento com documentação completa, transferência de conhecimento e suporte pós-entrega — para garantir o sucesso real, não apenas o técnico.",
  },
];

const FAQ = [
  {
    q: "Qual o prazo médio de um projeto?",
    a: "Depende do escopo, mas trabalhamos com ciclos curtos. MVPs costumam ficar prontos em 4 a 8 semanas. Sistemas mais complexos têm entregas parciais a cada 2 semanas, com visibilidade total do progresso em todos os momentos.",
  },
  {
    q: "Como funciona o primeiro contato?",
    a: "Você nos envia uma mensagem com o que precisa. Em até 48h respondemos com perguntas de qualificação. Se fizer sentido para os dois lados, agendamos uma call de diagnóstico sem compromisso — para entender o problema antes de qualquer proposta.",
  },
  {
    q: "Vocês atendem empresas de qualquer tamanho?",
    a: "Sim. Trabalhamos desde startups em fase de validação até empresas consolidadas que precisam modernizar sistemas críticos. O que muda é o escopo e a abordagem — não a qualidade do trabalho nem o nível de atenção.",
  },
  {
    q: "É possível contratar apenas consultoria, sem desenvolvimento?",
    a: "Absolutamente. Muitos clientes nos contratam apenas para diagnóstico técnico, definição de stack ou revisão de roadmap — sem qualquer compromisso com desenvolvimento posterior. Diagnóstico e execução são serviços independentes.",
  },
  {
    q: "Como é garantida a qualidade do que é entregue?",
    a: "Através de testes automatizados, code review interno, documentação e entregas parciais com validação do cliente a cada ciclo. Você não recebe o produto final só no último dia — acompanha a construção em tempo real.",
  },
];

const STATS = [
  { value: "6+", label: "Áreas de atuação" },
  { value: "100%", label: "Foco em resultado" },
  { value: "Ágil", label: "Metodologia" },
  { value: "BR", label: "Time brasileiro" },
];

export default function ServicesPage() {
  return (
    <div className="space-y-6">

      {/* ── VOLTAR ── */}
      <div>
        <Link
          to="/ecossistema"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-muted transition-colors hover:border-white/20 hover:text-white"
        >
          <ArrowLeft size={14} /> Ecossistema BrasUX
        </Link>
      </div>

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden rounded-3xl px-8 py-14 md:px-14 md:py-20"
        style={{ background: "linear-gradient(135deg, #05020f 0%, #130826 40%, #070d1f 100%)" }}
      >
        <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[#7c3aed] opacity-[0.18] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-8 h-64 w-64 rounded-full bg-[#06b6d4] opacity-[0.14] blur-3xl" />
        <div className="pointer-events-none absolute right-48 top-1/2 h-48 w-48 rounded-full bg-[#ec4899] opacity-[0.10] blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative z-10 flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a855f7]" />
              <span className="text-[11px] font-black uppercase tracking-widest text-[#c4b5fd]">
                BrasUX Serviços
              </span>
            </div>

            <h1 className="mt-6 text-4xl font-black leading-[1.08] text-white md:text-5xl lg:text-6xl">
              Soluções tech para{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #c4b5fd 0%, #67e8f9 60%, #86efac 100%)" }}
              >
                o seu negócio.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-faint">
              Da ideia ao impacto — desenvolvimento, dados, IA, arquitetura e consultoria. Time especializado, entrega real, sem burocracia.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="mailto:contato@brasux.com.br"
                className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white transition-all hover:scale-[1.03]"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  boxShadow: "0 8px 28px rgba(124,58,237,0.45)",
                }}
              >
                <Mail size={15} /> Falar com especialista
              </a>
              <a
                href="#servicos"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-6 py-3 text-sm font-black text-white backdrop-blur-sm transition-all hover:bg-white/12"
              >
                Ver serviços <ArrowRight size={15} />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:shrink-0">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center justify-center rounded-2xl px-6 py-5 text-center"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <p className="text-3xl font-black text-white">{s.value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NAV DE SERVIÇOS ── */}
      <div id="servicos" className="-mx-4 scroll-mt-4 overflow-x-auto px-4 scrollbar-hide md:-mx-8 md:px-8">
        <div className="flex gap-2 pb-1">
          {SERVICES.map((svc) => (
            <a
              key={svc.id}
              href={`#${svc.id}`}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black transition-all hover:scale-[1.03]"
              style={{
                background: svc.colorDim,
                border: `1px solid ${svc.colorBorder}`,
                color: svc.color,
              }}
            >
              <span>{svc.emoji}</span>
              {svc.navLabel}
            </a>
          ))}
        </div>
      </div>

      {/* ── SERVIÇOS ── */}
      {SERVICES.map((svc) => (
        <ServiceSection key={svc.id} svc={svc} />
      ))}

      {/* ── PROCESSO ── */}
      <section>
        <div
          className="relative overflow-hidden rounded-3xl px-8 py-12 md:px-12 md:py-14"
          style={{ background: "linear-gradient(135deg, #05020f 0%, #130826 100%)" }}
        >
          <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 rounded-full bg-[#7c3aed] opacity-[0.12] blur-3xl" />

          <div className="relative z-10 mb-10 text-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#a855f7]">Como trabalhamos</p>
            <h2 className="mt-2 text-3xl font-black text-white">Do problema à solução</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
              Cada projeto segue o mesmo processo — independente do tamanho ou da complexidade.
            </p>
          </div>

          <div className="relative z-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS.map((p, i) => (
              <div key={p.step} className="relative flex flex-col gap-4">
                {i < PROCESS.length - 1 && (
                  <div
                    className="absolute right-0 top-5 hidden h-px w-1/2 lg:block"
                    style={{ background: "linear-gradient(90deg, rgba(168,85,247,0.4), transparent)" }}
                  />
                )}
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-white"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                    boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
                  }}
                >
                  {p.step}
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section>
        <div
          className="relative overflow-hidden rounded-3xl px-8 py-12 md:px-12 md:py-14"
          style={{ background: "linear-gradient(180deg, #07040f 0%, #0d0a1e 100%)" }}
        >
          <div className="pointer-events-none absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[#06b6d4] opacity-[0.08] blur-3xl" />

          <div className="relative z-10 mb-10 text-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#06b6d4]">Dúvidas frequentes</p>
            <h2 className="mt-2 text-3xl font-black text-white">Perguntas comuns</h2>
          </div>

          <div className="relative z-10 mx-auto max-w-3xl flex flex-col gap-4">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl p-6"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p className="text-sm font-black text-white">{item.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section>
        <div
          className="relative overflow-hidden rounded-3xl px-8 py-14 text-center md:px-14 md:py-16"
          style={{ background: "linear-gradient(135deg, #05020f 0%, #1a0938 50%, #070d1f 100%)" }}
        >
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-72 w-72 rounded-full bg-[#7c3aed] opacity-[0.18] blur-3xl" />
          </div>
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />

          <div className="relative z-10 flex flex-col items-center gap-6">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
              style={{
                background: "rgba(124,58,237,0.15)",
                border: "1px solid rgba(124,58,237,0.3)",
                boxShadow: "0 0 32px rgba(124,58,237,0.2)",
              }}
            >
              ✉️
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-[#a855f7]">Fale com a gente</p>
              <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
                Tem um projeto em mente?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
                Conta o que você precisa. Nossa equipe analisa, responde rápido e apresenta uma proposta personalizada — sem enrolação e sem compromisso inicial.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <a
                href="mailto:contato@brasux.com.br"
                className="inline-flex items-center gap-2 rounded-2xl px-8 py-3.5 text-sm font-black text-white transition-all hover:scale-[1.03]"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  boxShadow: "0 8px 28px rgba(124,58,237,0.5)",
                }}
              >
                <Mail size={16} /> Entrar em contato
              </a>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-black text-faint backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white"
              >
                Voltar ao início <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

// ── SERVICE SECTION ───────────────────────────────────────────────────────────

function ServiceSection({ svc }: { svc: ServiceData }) {
  return (
    <section id={svc.id} className="scroll-mt-4">
      <div
        className="relative overflow-hidden rounded-3xl px-6 py-12 md:px-10 md:py-14"
        style={{ background: "linear-gradient(180deg, #07040f 0%, #0d0a1e 100%)" }}
      >
        {/* Color glow */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full blur-3xl"
          style={{ background: svc.color, opacity: 0.09 }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-0 h-56 w-56 rounded-full blur-3xl"
          style={{ background: svc.color, opacity: 0.05 }}
        />

        {/* Header */}
        <div className="relative z-10 mb-8 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
              style={{ background: svc.colorDim, border: `1px solid ${svc.colorBorder}` }}
            >
              {svc.emoji}
            </div>
            <span
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: svc.color }}
            >
              {svc.subtitle}
            </span>
          </div>

          <h2 className="text-2xl font-black leading-snug text-white md:text-3xl">{svc.title}</h2>

          <p className="max-w-2xl text-sm font-semibold leading-relaxed text-faint">
            {svc.description}
          </p>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            {svc.expandedDescription}
          </p>
        </div>

        {/* Highlights */}
        <div className="relative z-10 mb-10 grid gap-4 sm:grid-cols-3">
          {svc.highlights.map((h) => (
            <div
              key={h.label}
              className="rounded-2xl p-5"
              style={{ background: svc.colorDim, border: `1px solid ${svc.colorBorder}` }}
            >
              <div className="mb-2 text-xl">{h.emoji}</div>
              <p className="text-sm font-black text-white">{h.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{h.desc}</p>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div
          className="relative z-10 mb-10 h-px w-full"
          style={{ background: `linear-gradient(90deg, ${svc.colorBorder}, transparent)` }}
        />

        {/* Deliverables + Use cases */}
        <div className="relative z-10 mb-10 grid gap-8 md:grid-cols-2">
          {/* Deliverables */}
          <div>
            <p className="mb-5 text-[10px] font-black uppercase tracking-widest text-muted">
              O que inclui
            </p>
            <div className="flex flex-col gap-5">
              {svc.deliverables.map((d) => (
                <div key={d.title} className="flex gap-3">
                  <CheckCircle2
                    size={16}
                    className="mt-0.5 shrink-0"
                    style={{ color: svc.color }}
                  />
                  <div>
                    <p className="text-sm font-black text-white">{d.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{d.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Use cases */}
          <div>
            <p className="mb-5 text-[10px] font-black uppercase tracking-widest text-muted">
              Exemplos de aplicação
            </p>
            <div className="flex flex-col gap-4">
              {svc.useCases.map((uc) => (
                <div
                  key={uc.title}
                  className="rounded-2xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-lg">{uc.emoji}</span>
                    <p className="text-sm font-black text-white">{uc.title}</p>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">{uc.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ideal para */}
        <div
          className="relative z-10 mb-6 rounded-2xl px-5 py-4"
          style={{ background: svc.colorDim, border: `1px solid ${svc.colorBorder}` }}
        >
          <p
            className="mb-1 text-[10px] font-black uppercase tracking-widest"
            style={{ color: svc.color }}
          >
            Ideal para
          </p>
          <p className="text-sm leading-relaxed text-faint">{svc.idealFor}</p>
        </div>

        {/* Tags + CTA */}
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {svc.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wide"
                style={{
                  background: svc.colorDim,
                  color: svc.color,
                  border: `1px solid ${svc.colorBorder}`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
          <a
            href="mailto:contato@brasux.com.br"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white transition-all hover:scale-[1.03]"
            style={{
              background: svc.gradient,
              boxShadow: `0 8px 24px ${svc.colorDim}`,
            }}
          >
            <Mail size={14} /> Falar sobre este serviço
          </a>
        </div>
      </div>
    </section>
  );
}
