import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock, FolderOpen, LogIn, Sparkles } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { usePageMeta } from "../hooks/usePageMeta";

// ─── Projetos reais BrasUX ───────────────────────────────────────────────────

type ProjectStatus = "entregue" | "andamento" | "revisao";

interface Project {
  id: string;
  name: string;
  tagline: string;
  type: string;
  icon: string;
  color: string;
  status: ProjectStatus;
  tech: string[];
  href?: string;
  domain?: string;
  category: "plataforma" | "ecommerce" | "educacao" | "api" | "analytics" | "app";
}

const PROJECTS: Project[] = [
  // ── Plataforma ComprAÍ ───────────────────────────────────────────────────
  {
    id: "comprai-shopping",
    name: "ComprAÍ Shopping",
    tagline: "Marketplace multi-lojista com delivery em tempo real",
    type: "Marketplace",
    icon: "🛍️",
    color: "#16a34a",
    status: "entregue",
    tech: ["React", "TypeScript", "Supabase", "SignalR"],
    href: "https://comprai.store",
    domain: "comprai.store",
    category: "plataforma",
  },
  {
    id: "comprai-loja",
    name: "ComprAÍ Loja",
    tagline: "Painel do lojista — gestão de produtos, pedidos e financeiro",
    type: "Plataforma Lojistas",
    icon: "🏪",
    color: "#059669",
    status: "entregue",
    tech: ["React", "TypeScript", "Supabase", "Vite"],
    href: "https://loja.comprai.store",
    domain: "loja.comprai.store",
    category: "plataforma",
  },
  {
    id: "comprai-entregas",
    name: "ComprAÍ Entregas",
    tagline: "App de entregadores parceiros com rastreio ao vivo",
    type: "App Entregadores",
    icon: "🏍️",
    color: "#0284c7",
    status: "entregue",
    tech: ["React Native", "Mapbox", "Supabase", "SignalR"],
    href: "https://entrega.comprai.store",
    domain: "entrega.comprai.store",
    category: "plataforma",
  },
  // ── APIs & Backend ───────────────────────────────────────────────────────
  {
    id: "brasux-ecommerce-api",
    name: "BrasUX E-commerce API",
    tagline: "API REST completa para operações de marketplace e checkout",
    type: "API / Backend",
    icon: "⚡",
    color: "#7c3aed",
    status: "entregue",
    tech: [".NET", "PostgreSQL", "Supabase", "Asaas"],
    category: "api",
  },
  {
    id: "api-sku",
    name: "API SKU",
    tagline: "Serviço de catálogo e gestão de SKUs com sync em tempo real",
    type: "API / Catálogo",
    icon: "📦",
    color: "#0891b2",
    status: "entregue",
    tech: [".NET", "PostgreSQL", "REST", "SignalR"],
    category: "api",
  },
  // ── PDV ─────────────────────────────────────────────────────────────────
  {
    id: "brasux-caixa",
    name: "BrasUX Caixa",
    tagline: "PDV web completo — vendas, estoque, fiscal e relatórios",
    type: "PDV / Sistema",
    icon: "🖥️",
    color: "#002776",
    status: "entregue",
    tech: ["React", "TypeScript", "Supabase", "Vite"],
    href: "https://caixa.brasux.store",
    domain: "caixa.brasux.store",
    category: "plataforma",
  },
  // ── E-commerce ───────────────────────────────────────────────────────────
  {
    id: "cerveja-barata",
    name: "Cerveja Barata",
    tagline: "E-commerce especializado em cervejas artesanais e importadas",
    type: "E-commerce",
    icon: "🍺",
    color: "#d97706",
    status: "entregue",
    tech: ["React", "Next.js", "Supabase", "Stripe"],
    category: "ecommerce",
  },
  // ── Educação ─────────────────────────────────────────────────────────────
  {
    id: "simulaioab",
    name: "SimulaiOAB",
    tagline: "Simulado online com IA para a prova da OAB — 1ª e 2ª fase",
    type: "Plataforma Educacional",
    icon: "⚖️",
    color: "#1d4ed8",
    status: "entregue",
    tech: ["React", "Next.js", "PostgreSQL", "OpenAI"],
    href: "https://simulaioab.com",
    domain: "simulaioab.com",
    category: "educacao",
  },
  {
    id: "simulenem",
    name: "SimulENEM",
    tagline: "Plataforma de simulados para o ENEM com correção por IA",
    type: "Plataforma Educacional",
    icon: "📚",
    color: "#dc2626",
    status: "entregue",
    tech: ["React", "Next.js", "PostgreSQL", "OpenAI"],
    href: "https://simulenem.com",
    domain: "simulenem.com",
    category: "educacao",
  },
  {
    id: "simulamedi",
    name: "SimulaMedi",
    tagline: "Simulados para residência médica e REVALIDA com gabarito IA",
    type: "Plataforma Educacional",
    icon: "🩺",
    color: "#059669",
    status: "entregue",
    tech: ["React", "Next.js", "PostgreSQL", "OpenAI"],
    category: "educacao",
  },
  {
    id: "curso-notaon",
    name: "Curso NotaOn",
    tagline: "Plataforma EAD de cursos e certificações para profissionais",
    type: "EAD / Cursos",
    icon: "🎓",
    color: "#7c3aed",
    status: "entregue",
    tech: ["React", "Vite", "Supabase", "Stripe"],
    href: "https://cursonotaon.com.br",
    domain: "cursonotaon.com.br",
    category: "educacao",
  },
  // ── Em andamento ─────────────────────────────────────────────────────────
  {
    id: "brasux-analytics",
    name: "BrasUX Analytics",
    tagline: "Plataforma própria de BI e analytics com dashboards em tempo real",
    type: "Analytics / BI",
    icon: "📊",
    color: "#9333ea",
    status: "andamento",
    tech: ["Python", "BigQuery", "React", "Power BI"],
    category: "analytics",
  },
  {
    id: "giza-vida-plena",
    name: "Giza Vida Plena",
    tagline: "App de bem-estar: Pilates, academia, psicologia e terapia — corpo e mente",
    type: "App Mobile / Saúde",
    icon: "🧘",
    color: "#16a34a",
    status: "andamento",
    tech: ["React Native", "Supabase", "OpenAI", "Stripe"],
    category: "app",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<ProjectStatus, { label: string; bg: string; text: string; border: string; dot: string }> = {
  entregue: { label: "Entregue",        bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", dot: "#16a34a" },
  andamento: { label: "Em andamento",   bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#2563eb" },
  revisao:  { label: "Em revisão",      bg: "#fff7ed", text: "#c2410c", border: "#fed7aa", dot: "#ea580c" },
};

type FilterKey = "todos" | "entregues" | "andamento" | "plataforma" | "educacao" | "api" | "app";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "todos",      label: "Todos" },
  { key: "andamento",  label: "Em andamento" },
  { key: "entregues",  label: "Entregues" },
  { key: "plataforma", label: "Plataformas" },
  { key: "educacao",   label: "Educação" },
  { key: "api",        label: "APIs" },
  { key: "app",        label: "Apps" },
];

function filterProjects(projects: Project[], key: FilterKey): Project[] {
  if (key === "todos")      return projects;
  if (key === "entregues")  return projects.filter((p) => p.status === "entregue");
  if (key === "andamento")  return projects.filter((p) => p.status === "andamento" || p.status === "revisao");
  return projects.filter((p) => p.category === key);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  usePageMeta({
    title: "Projetos — BrasUX Soluções Tecnológicas",
    description: "Portfólio de projetos entregues e em andamento pelo BrasUX: plataformas, APIs, apps e sistemas educacionais.",
  });

  const auth = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<FilterKey>("todos");

  const visible  = filterProjects(PROJECTS, filter);
  const entregues = PROJECTS.filter((p) => p.status === "entregue").length;
  const emAndamento = PROJECTS.filter((p) => p.status !== "entregue").length;

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">BrasUX</p>
          <h1 className="text-2xl font-black text-content">Projetos</h1>
          <p className="mt-1 text-sm text-muted">Plataformas, APIs e sistemas que construímos</p>
        </div>
        <Link
          to="/contato"
          className="inline-flex w-fit items-center gap-2 rounded-2xl bg-[#16a34a] px-5 py-2.5 text-sm font-black text-white"
          style={{ boxShadow: "0 4px 14px rgba(22,163,74,0.35)" }}
        >
          Iniciar projeto <ArrowRight size={15} />
        </Link>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-center shadow-sm">
          <p className="text-2xl font-black text-[#16a34a]">{PROJECTS.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Projetos</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-center shadow-sm">
          <p className="text-2xl font-black text-[#16a34a]">{entregues}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Entregues</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-center shadow-sm">
          <p className="text-2xl font-black text-[#2563eb]">{emAndamento}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Em andamento</p>
        </div>
      </div>

      {/* ── Em andamento — destaque ─────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={14} className="text-[#2563eb]" />
          <p className="text-[11px] font-black uppercase tracking-widest text-[#2563eb]">Em andamento agora</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {PROJECTS.filter((p) => p.status !== "entregue").map((p) => (
            <ProjectCard key={p.id} project={p} featured />
          ))}
        </div>
      </section>

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black transition-colors ${
              filter === key
                ? "bg-[#16a34a] text-white"
                : "border border-line bg-surface text-muted hover:text-content"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Grid de projetos ────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>

      {/* ── Cliente logado ──────────────────────────────────────────────── */}
      {auth ? (
        <section
          className="rounded-3xl border border-line bg-surface p-6 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#16a34a]/10">
              <FolderOpen size={18} className="text-[#16a34a]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">Área do cliente</p>
              <p className="font-black text-content">
                Olá, {auth.name?.split(" ")[0] || "cliente"}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted">
            Seus projetos contratados serão exibidos aqui com atualizações em tempo real. Entre em contato para acompanhar o andamento.
          </p>
          <Link
            to="/contato"
            className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#16a34a] hover:underline"
          >
            Falar com a equipe <ArrowRight size={14} />
          </Link>
        </section>
      ) : (
        <section
          className="rounded-3xl border border-line bg-surface p-6 text-center shadow-sm"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#16a34a]/10">
            <LogIn size={22} className="text-[#16a34a]" />
          </div>
          <h3 className="font-black text-content">Área do cliente</h3>
          <p className="mt-1 text-sm text-muted">Faça login para acompanhar seus projetos contratados.</p>
          <Link
            to="/login"
            state={{ from: "/projetos" }}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#16a34a] px-5 py-2.5 text-sm font-black text-white"
          >
            Entrar <ArrowRight size={14} />
          </Link>
        </section>
      )}

      {/* ── CTA final ───────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-3xl p-8 text-center"
        style={{ background: "linear-gradient(135deg, #001640 0%, #002776 60%, #003d1a 100%)" }}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#16a34a] opacity-20 blur-3xl" />
        <div className="relative z-10 space-y-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#4ade80]">Próximo projeto</p>
          <h2 className="text-2xl font-black text-white md:text-3xl">Seu sistema pode ser o próximo</h2>
          <p className="text-sm text-white/60">Landing pages, apps, plataformas, APIs, BI — do briefing à entrega.</p>
          <Link
            to="/contato"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#16a34a] px-6 py-3 text-sm font-black text-white"
            style={{ boxShadow: "0 4px 20px rgba(22,163,74,0.45)" }}
          >
            Iniciar conversa <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}

// ─── ProjectCard ──────────────────────────────────────────────────────────────

function ProjectCard({ project: p, featured = false }: { project: Project; featured?: boolean }) {
  const s = STATUS_META[p.status];
  const isLive = p.status === "entregue" && !!p.href;

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
        featured ? "border-2" : ""
      }`}
      style={featured ? { borderColor: `${p.color}40` } : {}}
    >
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${p.color}, ${p.color}66)` }} />

      {/* Card content */}
      <div className="flex flex-1 flex-col gap-4 p-5">

        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
              style={{ background: `${p.color}18` }}
            >
              {p.icon}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: p.color }}>
                {p.type}
              </p>
              <h3 className="font-black text-content leading-tight">{p.name}</h3>
            </div>
          </div>

          <span
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black"
            style={{ background: s.bg, color: s.text, borderColor: s.border }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
            {s.label}
          </span>
        </div>

        {/* Tagline */}
        <p className="text-sm leading-relaxed text-muted">{p.tagline}</p>

        {/* Progress bar for in-progress */}
        {p.status === "andamento" && (
          <div>
            <div className="mb-1 flex justify-between text-[10px] font-bold text-muted">
              <span>Em desenvolvimento</span>
              <span style={{ color: p.color }}>60%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-subtle-2">
              <div className="h-full w-[60%] rounded-full animate-pulse" style={{ background: p.color }} />
            </div>
          </div>
        )}
        {p.status === "revisao" && (
          <div>
            <div className="mb-1 flex justify-between text-[10px] font-bold text-muted">
              <span>Em revisão final</span>
              <span style={{ color: p.color }}>85%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-subtle-2">
              <div className="h-full w-[85%] rounded-full" style={{ background: p.color }} />
            </div>
          </div>
        )}
        {p.status === "entregue" && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#16a34a]">
            <CheckCircle2 size={13} />
            100% concluído
          </div>
        )}

        {/* Tech stack */}
        <div className="flex flex-wrap gap-1.5">
          {p.tech.map((t) => (
            <span
              key={t}
              className="rounded-lg border border-line bg-subtle px-2 py-0.5 text-[10px] font-bold text-muted"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderTop: `1px solid ${p.color}18`, background: `${p.color}06` }}
      >
        {p.domain ? (
          <span className="text-[11px] text-faint">{p.domain}</span>
        ) : (
          <span className="text-[11px] text-faint flex items-center gap-1">
            <Clock size={11} /> {p.status === "entregue" ? "Entregue" : "Em construção"}
          </span>
        )}

        {isLive && (
          <a
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-black text-white transition-opacity hover:opacity-90"
            style={{ background: p.color }}
            onClick={(e) => e.stopPropagation()}
          >
            Ver ao vivo <ArrowUpRight size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
