import { useMemo } from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { useJsonLd } from "../hooks/useJsonLd";
import {
  buildOrganizationSchema,
  buildWebSiteSchema,
  buildFaqSchema,
  HOME_FAQS,
  canonicalUrl,
} from "../lib/seo";

import { departments } from "../data/taxonomy";
import DepartmentCard from "../components/ui/DepartmentCard";
import SectionHeader from "../components/home/SectionHeader";
import BrasuxSolutionsSection from "../components/home/BrasuxSolutionsSection";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Shield,
  Star,
  Zap,
} from "lucide-react";

// ── Dados estáticos de vitrine ────────────────────────────────────────────────

const TECH_STACK = [
  { label: "React",      icon: "⚛️" },
  { label: "Next.js",    icon: "▲"  },
  { label: "TypeScript", icon: "🔷" },
  { label: "Node.js",    icon: "🟩" },
  { label: "Python",     icon: "🐍" },
  { label: "Supabase",   icon: "⚡" },
  { label: "PostgreSQL", icon: "🐘" },
  { label: "AWS",        icon: "☁️" },
  { label: "Docker",     icon: "🐳" },
  { label: "Tailwind",   icon: "🎨" },
  { label: "Flutter",    icon: "💙" },
  { label: "OpenAI",     icon: "🤖" },
];

const CASES = [
  {
    emoji: "🚀",
    client: "Fábrica de Landing Pages",
    result: "Mais de 200 páginas entregues",
    detail: "Alta conversão · 5 dias úteis · WhatsApp incluso",
    accent: "#16a34a",
  },
  {
    emoji: "📱",
    client: "App de Delivery",
    result: "Lançado em 45 dias",
    detail: "React Native · Pagamentos integrados · Rastreio em tempo real",
    accent: "#2563eb",
  },
  {
    emoji: "🤖",
    client: "Chatbot para Clínica",
    result: "40% menos chamados de suporte",
    detail: "Agendamentos automáticos · WhatsApp Business · IA conversacional",
    accent: "#0d9488",
  },
  {
    emoji: "🏛️",
    client: "Data Warehouse",
    result: "Pipeline de dados em 30 dias",
    detail: "ETL · BigQuery · Dashboards em Power BI",
    accent: "#9333ea",
  },
];

const TESTIMONIALS = [
  {
    name: "Mariana Costa",
    role: "CEO · Clínica VitaPlus",
    avatar: "M",
    color: "#16a34a",
    text: "A landing page ficou incrível e aumentou nossas conversões em 3x. Entrega rápida, comunicação excelente.",
  },
  {
    name: "Rafael Menezes",
    role: "Fundador · DelivEx",
    avatar: "R",
    color: "#2563eb",
    text: "O app de delivery ficou melhor do que eu esperava. A equipe entende de produto e de negócio.",
  },
  {
    name: "Patrícia Alves",
    role: "Diretora de TI · GrupoAlpha",
    avatar: "P",
    color: "#9333ea",
    text: "Transformação digital real. Os dashboards de BI mudaram como a diretoria toma decisões.",
  },
];

const WHY_BRASUX = [
  { icon: Zap,           title: "Entrega Rápida",      text: "Landing pages em 5 dias, apps em 30–90 dias. Sem enrolação." },
  { icon: Shield,        title: "Qualidade Garantida", text: "Código limpo, testes, documentação. Sem gambiarra." },
  { icon: CheckCircle2,  title: "Preço Transparente",  text: "Saiba o valor antes de contratar. Sem surpresas." },
  { icon: Clock,         title: "Suporte Contínuo",    text: "Acompanhamento do projeto até a entrega final." },
  { icon: Star,          title: "Profissionais Reais", text: "Só parceiros verificados com portfólio e avaliações." },
  { icon: ArrowRight,    title: "Escalável",           text: "Do MVP ao sistema enterprise — crescemos com você." },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function HomePage() {
  usePageMeta({
    title: "Shopping Brasileiro de Soluções Tecnológicas",
    description:
      "BrasUX — Landing pages, aplicativos, white label, inteligência artificial, engenharia de software, dados e consultorias. O shopping tech do Brasil.",
    canonical: canonicalUrl("/"),
  });

  const homeSchemas = useMemo(
    () => [buildOrganizationSchema(), buildWebSiteSchema(), buildFaqSchema([...HOME_FAQS])],
    []
  );
  useJsonLd(homeSchemas);

  return (
    <div className="space-y-12">

      {/* ── PROMO CARDS — carrossel fullscreen, sangra o container ── */}
      <div className="relative left-1/2 w-screen -translate-x-1/2 -mt-6">
        <BrasuxSolutionsSection />
      </div>

      {/* ── POR QUE A BRASUX ── */}
      <section>
        <SectionHeader
          label="por que a BrasUX"
          title="A plataforma certa para soluções tech"
          color="#16a34a"
        />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {WHY_BRASUX.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 shadow-sm"
            >
              <Icon size={20} className="text-[#16a34a]" />
              <p className="text-sm font-black text-content">{title}</p>
              <p className="text-xs leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── ÁREAS DE SOLUÇÃO (10 departamentos) ── */}
      <section>
        <SectionHeader
          label="explorar"
          title="Explore por área"
          linkTo="/categorias"
          linkLabel="Ver todas"
        />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {departments.map((dep) => (
            <DepartmentCard key={dep.key} department={dep} />
          ))}
        </div>
      </section>

      {/* ── CASES DE SUCESSO ── */}
      <section>
        <SectionHeader
          label="resultados reais"
          title="Cases de sucesso"
          color="#2563eb"
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CASES.map((c) => (
            <div
              key={c.client}
              className="rounded-2xl border border-line bg-surface p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                  style={{ background: `${c.accent}15` }}
                >
                  {c.emoji}
                </div>
                <p className="text-[11px] font-black uppercase tracking-wide text-muted">{c.client}</p>
              </div>
              <p className="text-base font-black" style={{ color: c.accent }}>{c.result}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{c.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── STACK DE TECNOLOGIAS ── */}
      <section>
        <SectionHeader
          label="stack"
          title="Tecnologias que dominamos"
          color="#ea580c"
        />
        <div className="mt-5 flex flex-wrap gap-3">
          {TECH_STACK.map((t) => (
            <div
              key={t.label}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold text-content shadow-sm"
            >
              <span>{t.icon}</span>
              {t.label}
            </div>
          ))}
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section>
        <SectionHeader
          label="depoimentos"
          title="O que nossos clientes dizem"
          color="#9333ea"
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black text-white"
                  style={{ background: t.color }}
                >
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-black text-content">{t.name}</p>
                  <p className="text-[11px] text-muted">{t.role}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted">"{t.text}"</p>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={12} className="fill-[#f59e0b] text-[#f59e0b]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section>
        <SectionHeader
          label="dúvidas frequentes"
          title="FAQ"
          color="#0369a1"
        />
        <div className="mt-5 space-y-3">
          {HOME_FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl border border-line bg-surface px-5 py-4 shadow-sm open:pb-5"
            >
              <summary className="cursor-pointer list-none text-sm font-black text-content">
                {faq.question}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section
        className="relative overflow-hidden rounded-3xl p-8 md:p-12"
        style={{ background: "linear-gradient(135deg, #001640 0%, #002776 60%, #003d1a 100%)" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[#16a34a] opacity-20 blur-3xl" />
        <div className="relative z-10 flex flex-col items-center gap-5 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-[#4ade80]">Comece agora</p>
          <h2 className="text-3xl font-black text-white md:text-4xl">
            Sua próxima solução tech está aqui
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-white/70">
            Explore 10 áreas especializadas, compare soluções e contrate com segurança. Do briefing à entrega.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/categorias"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#16a34a] px-6 py-3 text-sm font-black text-white transition-opacity hover:opacity-90"
            >
              Explorar soluções <ArrowRight size={15} />
            </Link>
            <Link
              to="/contato"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-6 py-3 text-sm font-black text-white/80 transition-colors hover:border-white/40 hover:text-white"
            >
              Falar conosco
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
