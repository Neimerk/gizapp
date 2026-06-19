import { ArrowRight, Mail } from "lucide-react";
import { Link } from "react-router-dom";

const SERVICES = [
  {
    slug: "analise-desenvolvimento",
    emoji: "💻",
    title: "Análise e Desenvolvimento de Sistemas",
    description:
      "Levantamento de requisitos, modelagem e construção de sistemas web, mobile e desktop sob medida. Da especificação ao deploy, com metodologias ágeis.",
    color: "#2563eb",
    colorBg: "rgba(37,99,235,0.12)",
    colorBorder: "rgba(37,99,235,0.25)",
    gradient: "linear-gradient(135deg, #1d4ed8, #2563eb)",
    tags: ["React", "Node.js", ".NET", "Mobile"],
  },
  {
    slug: "analise-dados",
    emoji: "📊",
    title: "Análise de Dados",
    description:
      "Coleta, tratamento, visualização e interpretação de dados para apoiar decisões estratégicas. Dashboards, relatórios e KPIs que fazem sentido para o seu negócio.",
    color: "#0891b2",
    colorBg: "rgba(8,145,178,0.12)",
    colorBorder: "rgba(8,145,178,0.25)",
    gradient: "linear-gradient(135deg, #0e7490, #0891b2)",
    tags: ["Power BI", "Python", "SQL", "ETL"],
  },
  {
    slug: "engenharia-arquitetura",
    emoji: "🏗️",
    title: "Engenharia e Arquitetura de Software",
    description:
      "Design de sistemas escaláveis, resilientes e seguros. Microsserviços, APIs, bancos de dados, cloud e boas práticas de engenharia para projetos de qualquer porte.",
    color: "#d97706",
    colorBg: "rgba(217,119,6,0.12)",
    colorBorder: "rgba(217,119,6,0.25)",
    gradient: "linear-gradient(135deg, #b45309, #d97706)",
    tags: ["Microserviços", "Cloud", "DevOps", "APIs"],
  },
  {
    slug: "ia-machine-learning",
    emoji: "🤖",
    title: "Soluções em IA e Machine Learning",
    description:
      "Modelos preditivos, NLP, visão computacional e integração com LLMs. Automação inteligente e decisões baseadas em dados para ganhar vantagem competitiva.",
    color: "#7c3aed",
    colorBg: "rgba(124,58,237,0.12)",
    colorBorder: "rgba(124,58,237,0.25)",
    gradient: "linear-gradient(135deg, #6d28d9, #7c3aed)",
    tags: ["LLMs", "Python", "TensorFlow", "RAG"],
  },
  {
    slug: "consultoria-tecnologia",
    emoji: "🎯",
    title: "Consultoria em Tecnologia",
    description:
      "Diagnóstico técnico, escolha de stack, revisão de arquitetura e roadmap de produto. Apoio estratégico para times que querem construir certo desde o início.",
    color: "#16a34a",
    colorBg: "rgba(22,163,74,0.12)",
    colorBorder: "rgba(22,163,74,0.25)",
    gradient: "linear-gradient(135deg, #15803d, #16a34a)",
    tags: ["Diagnóstico", "Roadmap", "Stack", "Revisão"],
  },
  {
    slug: "projetos-empreendedorismo",
    emoji: "💡",
    title: "Projetos, Ideias e Empreendedorismo",
    description:
      "Da ideia ao MVP. Validação, prototipagem rápida e lançamento de produtos digitais. Para fundadores e equipes que querem transformar conceitos em realidade.",
    color: "#db2777",
    colorBg: "rgba(219,39,119,0.12)",
    colorBorder: "rgba(219,39,119,0.25)",
    gradient: "linear-gradient(135deg, #be185d, #db2777)",
    tags: ["MVP", "Startup", "Prototipagem", "Pitch"],
  },
];

export default function ServicesPage() {
  return (
    <div className="space-y-10">

      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-3xl p-8 md:p-12"
        style={{ background: "linear-gradient(135deg, #0d0a1e 0%, #1a0938 40%, #0a1628 100%)" }}
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#7c3aed] opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-16 h-64 w-64 rounded-full bg-[#06b6d4] opacity-15 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-xs">⚡</span>
            <span className="text-[11px] font-black uppercase tracking-widest text-[#c4b5fd]">
              BrasUX Serviços
            </span>
          </div>
          <h1 className="mt-5 text-4xl font-black leading-tight text-white md:text-5xl">
            Soluções tech para{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #c4b5fd 0%, #67e8f9 100%)" }}
            >
              o seu negócio.
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#94a3b8]">
            Da ideia ao impacto — desenvolvimento, dados, IA, arquitetura e consultoria. Time especializado, entrega real.
          </p>
        </div>
      </section>

      {/* Services grid */}
      <section>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((svc) => (
            <div
              key={svc.slug}
              className="group flex flex-col overflow-hidden rounded-3xl bg-white transition-transform hover:-translate-y-1"
              style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)" }}
            >
              {/* Top colored strip */}
              <div
                className="flex h-2 w-full"
                style={{ background: svc.gradient }}
              />

              <div className="flex flex-1 flex-col gap-4 p-6">
                {/* Icon */}
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
                  style={{ background: svc.colorBg, border: `1px solid ${svc.colorBorder}` }}
                >
                  {svc.emoji}
                </div>

                {/* Text */}
                <div className="flex-1">
                  <h2 className="text-base font-black leading-snug text-[#0f172a]">{svc.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#64748b]">{svc.description}</p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {svc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wide"
                      style={{ background: svc.colorBg, color: svc.color }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        className="relative overflow-hidden rounded-3xl p-8 text-center md:p-12"
        style={{ background: "linear-gradient(135deg, #0d0a1e 0%, #1a0938 60%, #0a1628 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-64 w-64 rounded-full bg-[#7c3aed] opacity-15 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-5">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#c4b5fd]">Fale com a gente</p>
          <h2 className="text-3xl font-black text-white md:text-4xl">
            Tem um projeto em mente?
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-[#94a3b8]">
            Conte o que você precisa. Nossa equipe analisa e responde com uma proposta personalizada.
          </p>
          <a
            href="mailto:contato@brasux.com.br"
            className="inline-flex items-center gap-2 rounded-2xl px-8 py-3.5 text-sm font-black text-white transition-all hover:scale-[1.03]"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              boxShadow: "0 8px 24px rgba(124,58,237,0.45)",
            }}
          >
            <Mail size={16} /> Entrar em contato
          </a>
          <Link
            to="/"
            className="flex items-center gap-1 text-sm font-bold text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            Voltar ao início <ArrowRight size={14} />
          </Link>
        </div>
      </section>

    </div>
  );
}
