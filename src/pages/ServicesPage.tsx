import { ArrowRight, Mail, CheckCircle2, Code2, BarChart3, Layers, Brain, Target, Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";
import type { FC } from "react";

const SERVICES = [
  {
    id: "desenvolvimento",
    Icon: Code2,
    emoji: "💻",
    title: "Análise e Desenvolvimento de Sistemas",
    subtitle: "Do requisito ao deploy",
    description:
      "Construímos sistemas web, mobile e desktop sob medida — com arquitetura sólida, código limpo e entrega real. Do primeiro rascunho ao ambiente de produção.",
    color: "#3b82f6",
    colorDim: "rgba(59,130,246,0.14)",
    colorBorder: "rgba(59,130,246,0.28)",
    gradient: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)",
    glow: "0 0 32px rgba(59,130,246,0.28)",
    deliverables: [
      "Levantamento e modelagem de requisitos",
      "Desenvolvimento full-stack (web, mobile e desktop)",
      "Integração com APIs externas e sistemas legados",
      "Testes automatizados, CI/CD e boas práticas DevOps",
      "Deploy, monitoramento e manutenção evolutiva",
    ],
    tags: ["React", "Node.js", ".NET", "Flutter", "PostgreSQL"],
    idealFor: "Empresas que precisam de um sistema personalizado ou querem digitalizar processos internos.",
  },
  {
    id: "dados",
    Icon: BarChart3,
    emoji: "📊",
    title: "Análise de Dados",
    subtitle: "Dados que geram decisão",
    description:
      "Transformamos dados brutos em inteligência de negócio. Coleta, tratamento, visualização e análise para que você tome decisões com clareza e velocidade.",
    color: "#06b6d4",
    colorDim: "rgba(6,182,212,0.14)",
    colorBorder: "rgba(6,182,212,0.28)",
    gradient: "linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)",
    glow: "0 0 32px rgba(6,182,212,0.28)",
    deliverables: [
      "Mapeamento e coleta de fontes de dados",
      "ETL, limpeza e modelagem de dados",
      "Dashboards interativos e relatórios executivos",
      "KPIs estratégicos e alertas automáticos",
      "Análise preditiva e segmentação de clientes",
    ],
    tags: ["Power BI", "Python", "SQL", "Pandas", "ETL"],
    idealFor: "Negócios que querem parar de decidir por intuição e começar a decidir por dados.",
  },
  {
    id: "arquitetura",
    Icon: Layers,
    emoji: "🏗️",
    title: "Engenharia e Arquitetura de Software",
    subtitle: "Sistemas que escalam",
    description:
      "Projetamos e revisamos arquiteturas para sistemas que precisam crescer com segurança. Estrutura certa desde o início — ou refatoração sem trauma.",
    color: "#f59e0b",
    colorDim: "rgba(245,158,11,0.14)",
    colorBorder: "rgba(245,158,11,0.28)",
    gradient: "linear-gradient(135deg, #b45309 0%, #f59e0b 100%)",
    glow: "0 0 32px rgba(245,158,11,0.28)",
    deliverables: [
      "Revisão e auditoria de arquitetura existente",
      "Design de microsserviços e APIs REST / GraphQL",
      "Estratégias de escalabilidade e alta disponibilidade",
      "Segurança, autenticação e gestão de permissões",
      "Documentação técnica e padronização de código",
    ],
    tags: ["Microserviços", "Cloud", "Docker", "Kubernetes", "REST"],
    idealFor: "Times que sentem que a arquitetura atual está travando o crescimento do produto.",
  },
  {
    id: "ia-ml",
    Icon: Brain,
    emoji: "🤖",
    title: "Soluções em IA e Machine Learning",
    subtitle: "Inteligência aplicada ao negócio",
    description:
      "Integramos modelos de IA e ML ao seu produto ou processo — de automações simples a agentes autônomos com LLMs. Pragmáticos, sem hype.",
    color: "#a855f7",
    colorDim: "rgba(168,85,247,0.14)",
    colorBorder: "rgba(168,85,247,0.28)",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
    glow: "0 0 32px rgba(168,85,247,0.28)",
    deliverables: [
      "Integração com LLMs (GPT, Claude, Gemini)",
      "Sistemas RAG para bases de conhecimento privadas",
      "Modelos preditivos e classificação de dados",
      "Automação inteligente via NLP e visão computacional",
      "Agentes autônomos e pipelines de IA em produção",
    ],
    tags: ["LLMs", "RAG", "Python", "TensorFlow", "Agents"],
    idealFor: "Empresas que querem automatizar tarefas repetitivas ou criar experiências com IA.",
  },
  {
    id: "consultoria",
    Icon: Target,
    emoji: "🎯",
    title: "Consultoria em Tecnologia",
    subtitle: "Direção técnica estratégica",
    description:
      "Apoio especializado para escolhas que definem o futuro do seu produto — stack, arquitetura, equipe, roadmap. Clareza técnica sem viés de fornecedor.",
    color: "#22c55e",
    colorDim: "rgba(34,197,94,0.14)",
    colorBorder: "rgba(34,197,94,0.28)",
    gradient: "linear-gradient(135deg, #15803d 0%, #22c55e 100%)",
    glow: "0 0 32px rgba(34,197,94,0.28)",
    deliverables: [
      "Diagnóstico técnico completo do produto ou time",
      "Definição e revisão de stack tecnológica",
      "Roadmap de produto e priorização técnica",
      "Mentoria para times de desenvolvimento",
      "Code review e padrões de qualidade de código",
    ],
    tags: ["Diagnóstico", "Roadmap", "Mentoria", "Code Review"],
    idealFor: "Fundadores e CTOs que precisam de um segundo olhar antes de tomar decisões críticas.",
  },
  {
    id: "empreendedorismo",
    Icon: Lightbulb,
    emoji: "💡",
    title: "Projetos, Ideias e Empreendedorismo",
    subtitle: "Da ideia ao primeiro usuário",
    description:
      "Acompanhamos fundadores desde a validação da ideia até o lançamento do MVP. Execução real, sem burocracia, com foco em aprendizado rápido.",
    color: "#ec4899",
    colorDim: "rgba(236,72,153,0.14)",
    colorBorder: "rgba(236,72,153,0.28)",
    gradient: "linear-gradient(135deg, #be185d 0%, #ec4899 100%)",
    glow: "0 0 32px rgba(236,72,153,0.28)",
    deliverables: [
      "Validação de ideia e mapeamento de mercado",
      "Prototipagem rápida (wireframe → protótipo funcional)",
      "Desenvolvimento do MVP em ciclos curtos",
      "Pitch deck técnico para investidores",
      "Go-to-market e estratégia de primeiros usuários",
    ],
    tags: ["MVP", "Startup", "Pitch", "Validação", "Produto"],
    idealFor: "Empreendedores com uma ideia sólida que precisam de um time técnico para tirar do papel.",
  },
];

const PROCESS = [
  {
    step: "01",
    title: "Diagnóstico",
    desc: "Entendemos o problema, o contexto e os objetivos antes de qualquer linha de código ou proposta.",
  },
  {
    step: "02",
    title: "Proposta",
    desc: "Apresentamos escopo, cronograma e investimento detalhados — sem surpresas no meio do caminho.",
  },
  {
    step: "03",
    title: "Execução",
    desc: "Desenvolvemos em ciclos curtos com entregas parciais, revisões e comunicação direta constante.",
  },
  {
    step: "04",
    title: "Entrega",
    desc: "Lançamento com documentação completa e suporte pós-entrega para garantir o sucesso real.",
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

            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#94a3b8]">
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

          {/* Stats */}
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
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#64748b]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVIÇOS ── */}
      <section id="servicos" className="scroll-mt-6">
        <div
          className="relative overflow-hidden rounded-3xl px-6 py-10 md:px-10 md:py-12"
          style={{ background: "linear-gradient(180deg, #07040f 0%, #0d0a1e 100%)" }}
        >
          <div className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-[#7c3aed] opacity-[0.10] blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-[#06b6d4] opacity-[0.10] blur-3xl" />

          <div className="relative z-10 mb-10 text-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#a855f7]">O que fazemos</p>
            <h2 className="mt-2 text-3xl font-black text-white">Seis áreas de atuação</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[#64748b]">
              Cada serviço é executado por especialistas com experiência real em produto, não apenas em teoria.
            </p>
          </div>

          <div className="relative z-10 grid gap-5 md:grid-cols-2">
            {SERVICES.map((svc) => (
              <ServiceCard key={svc.id} svc={svc} />
            ))}
          </div>
        </div>
      </section>

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
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                    boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
                  }}
                >
                  {p.step}
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#64748b]">{p.desc}</p>
                </div>
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
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#64748b]">
                Conta o que você precisa. Nossa equipe analisa, responde rápido e apresenta uma proposta personalizada — sem enrolação.
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
                className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-black text-[#94a3b8] backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white"
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

// ── SERVICE CARD ──────────────────────────────────────────────────────────────

interface ServiceData {
  id: string;
  Icon: FC<{ size?: number; className?: string }>;
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  colorDim: string;
  colorBorder: string;
  gradient: string;
  glow: string;
  deliverables: string[];
  tags: string[];
  idealFor: string;
}

function ServiceCard({ svc }: { svc: ServiceData }) {
  return (
    <div
      className="group flex flex-col gap-5 overflow-hidden rounded-2xl p-7 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${svc.colorBorder}`,
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl transition-all duration-300 group-hover:scale-105"
          style={{
            background: svc.colorDim,
            border: `1px solid ${svc.colorBorder}`,
            boxShadow: svc.glow,
          }}
        >
          {svc.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: svc.color }}>
            {svc.subtitle}
          </p>
          <h3 className="mt-0.5 text-base font-black leading-snug text-white">{svc.title}</h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed text-[#94a3b8]">{svc.description}</p>

      {/* Divider */}
      <div className="h-px w-full" style={{ background: `linear-gradient(90deg, ${svc.colorBorder}, transparent)` }} />

      {/* Deliverables */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#475569]">O que inclui</p>
        <ul className="flex flex-col gap-2">
          {svc.deliverables.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: svc.color }} />
              <span className="text-sm text-[#cbd5e1]">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Ideal for */}
      <div
        className="rounded-xl px-4 py-3"
        style={{ background: svc.colorDim, border: `1px solid ${svc.colorBorder}` }}
      >
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: svc.color }}>
          Ideal para
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[#94a3b8]">{svc.idealFor}</p>
      </div>

      {/* Tags */}
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
    </div>
  );
}
