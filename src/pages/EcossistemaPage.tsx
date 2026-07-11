import { ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Product {
  name: string;
  desc: string;
  icon: string;
  badge: string;
  href?: string;
  to?: string;
  domain?: string;
  comingSoon?: boolean;
}

interface Cluster {
  id: string;
  emoji: string;
  label: string;
  title: string;
  subtitle: string;
  color: string;
  colorDim: string;
  colorBorder: string;
  gradient: string;
  description: string;
  products: Product[];
}

// ─── Dados ───────────────────────────────────────────────────────────────────

const CLUSTERS: Cluster[] = [
  {
    id: "plataforma",
    emoji: "🛍️",
    label: "Plataforma",
    title: "ComprAÍ Shopping",
    subtitle: "O marketplace brasileiro",
    color: "#16a34a",
    colorDim: "rgba(22,163,74,0.12)",
    colorBorder: "rgba(22,163,74,0.25)",
    gradient: "linear-gradient(135deg, #002776 0%, #16a34a 100%)",
    description:
      "Marketplace multi-lojista com entregas rápidas em todo o Brasil. Compradores, lojistas e entregadores — todos em uma só plataforma.",
    products: [
      {
        name: "ComprAÍ Shopping",
        desc: "Marketplace para compradores — lojas, categorias e produtos com entrega rápida.",
        icon: "🛍️",
        badge: "Compradores",
        href: "https://comprai.store",
        domain: "comprai.store",
      },
      {
        name: "ComprAÍ Loja",
        desc: "Plataforma para lojistas abrirem e gerenciarem suas lojas online em minutos.",
        icon: "🏪",
        badge: "Lojistas",
        href: "https://loja.comprai.store",
        domain: "loja.comprai.store",
      },
      {
        name: "ComprAÍ Entregas",
        desc: "App para entregadores parceiros — aceite pedidos e ganhe na sua região.",
        icon: "🏍️",
        badge: "Entregadores",
        href: "https://entrega.comprai.store",
        domain: "entrega.comprai.store",
      },
    ],
  },
  {
    id: "educacao",
    emoji: "🎓",
    label: "Educação",
    title: "BrasUX Edu",
    subtitle: "Plataformas educacionais",
    color: "#818cf8",
    colorDim: "rgba(129,140,248,0.12)",
    colorBorder: "rgba(129,140,248,0.25)",
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #4f46e5 60%, #7c3aed 100%)",
    description:
      "Simulados, cursos e preparação para os principais exames do Brasil — ENEM, OAB e residência médica.",
    products: [
      {
        name: "Curso NotaOn",
        desc: "Preparação completa para o ENEM com videoaulas, material didático e correção de redação.",
        icon: "🎯",
        badge: "ENEM",
        href: "https://cursonotaon.com.br",
        domain: "cursonotaon.com.br",
      },
      {
        name: "SimulENEM",
        desc: "Simulados com gabarito comentado, ranking nacional e estatísticas de desempenho.",
        icon: "📝",
        badge: "ENEM",
        href: "https://simulenem.com",
        domain: "simulenem.com",
      },
      {
        name: "SimulaiOAB",
        desc: "Simulados para a prova da OAB com questões comentadas por ordem e fase.",
        icon: "⚖️",
        badge: "OAB",
        href: "https://simulaioab.com",
        domain: "simulaioab.com",
      },
      {
        name: "SimulaMedi",
        desc: "Simulados para residência médica com banco de questões atualizado e comentado.",
        icon: "🩺",
        badge: "Medicina",
        comingSoon: true,
      },
    ],
  },
  {
    id: "tech",
    emoji: "⚡",
    label: "Produtos Tech",
    title: "BrasUX Tech",
    subtitle: "Ferramentas e infraestrutura",
    color: "#f59e0b",
    colorDim: "rgba(245,158,11,0.12)",
    colorBorder: "rgba(245,158,11,0.25)",
    gradient: "linear-gradient(135deg, #1c1400 0%, #2d1f00 50%, #1a2400 100%)",
    description:
      "APIs, PDV e sites de alta conversão para negócios digitais que precisam de infraestrutura real.",
    products: [
      {
        name: "BrasUX ImageAPI",
        desc: "API de imagens e tempo real para e-commerce — upload, processamento e streaming via SignalR.",
        icon: "🔌",
        badge: "API",
      },
      {
        name: "BrasUX Caixa",
        desc: "PDV e gestão comercial completos — vendas, estoque, fluxo de caixa e dashboard.",
        icon: "🧾",
        badge: "PDV",
        href: "https://caixa.brasux.store",
        domain: "caixa.brasux.store",
      },
      {
        name: "Fábrica de Landing Pages",
        desc: "Landing Page profissional + botão WhatsApp entregue em até 5 dias úteis. A partir de R$ 499.",
        icon: "🚀",
        badge: "Web",
        href: "https://produtos.brasux.com.br",
        domain: "produtos.brasux.com.br",
      },
    ],
  },
];

const SERVICES = [
  { id: "desenvolvimento", icon: "💻", name: "Análise e Desenvolvimento de Sistemas",  desc: "Sistemas web, mobile e desktop sob medida — arquitetura sólida, entrega real." },
  { id: "dados",           icon: "📊", name: "Análise de Dados",                        desc: "Dados brutos em inteligência de negócio — dashboards, KPIs e análise preditiva." },
  { id: "arquitetura",     icon: "🏗️", name: "Engenharia e Arquitetura de Software",    desc: "Revisão e design de arquiteturas para sistemas que precisam crescer com segurança." },
  { id: "ia-ml",           icon: "🤖", name: "Soluções em IA e Machine Learning",       desc: "Integração de LLMs, RAG, agentes autônomos e automação inteligente ao seu produto." },
  { id: "consultoria",     icon: "🎯", name: "Consultoria em Tecnologia",               desc: "Direção técnica estratégica — stack, arquitetura, equipe e roadmap sem viés de fornecedor." },
  { id: "empreendedorismo",icon: "💡", name: "Projetos, Ideias e Empreendedorismo",    desc: "Da validação ao MVP e primeiros usuários — execução real, sem burocracia." },
];

const CLUSTER_NAV = [
  { id: "plataforma", label: "Plataforma", color: "#16a34a" },
  { id: "educacao",   label: "Educação",   color: "#818cf8" },
  { id: "tech",       label: "Tech",       color: "#f59e0b" },
  { id: "servicos",   label: "Serviços",   color: "#a855f7" },
];

// ─── Componente ──────────────────────────────────────────────────────────────

export default function EcossistemaPage() {
  usePageMeta({
    title: "Ecossistema BrasUX — Shopping, Educação, Tech e Serviços",
    description:
      "Conheça o ecossistema completo BrasUX: marketplace, plataformas educacionais, ferramentas tech e serviços digitais para negócios brasileiros.",
  });

  return (
    <div className="space-y-8">

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden rounded-3xl px-8 py-16 md:px-14 md:py-24"
        style={{ background: "linear-gradient(135deg, #020617 0%, #001640 38%, #001226 100%)" }}
      >
        {/* blobs */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#16a34a] opacity-[0.15] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-0 h-72 w-72 rounded-full bg-[#002776] opacity-[0.4] blur-3xl" />
        <div className="pointer-events-none absolute right-1/3 top-1/2 h-56 w-56 rounded-full bg-[#7c3aed] opacity-[0.10] blur-3xl" />
        {/* grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.7) 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* scan line */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" style={{ boxShadow: "0 0 8px #16a34a" }} />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">
              Ecossistema BrasUX
            </span>
          </div>

          <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Tudo que o seu negócio precisa{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #4ade80 0%, #60a5fa 50%, #c084fc 100%)" }}
            >
              para crescer.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/55">
            Marketplace, educação, infraestrutura tech e serviços digitais — um ecossistema completo feito no Brasil para o Brasil.
          </p>

          {/* Cluster nav pills */}
          <div className="mt-8 flex flex-wrap gap-2">
            {CLUSTER_NAV.map((c) => (
              <a
                key={c.id}
                href={`#${c.id}`}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-black transition-all hover:scale-[1.04]"
                style={{
                  background: `${c.color}18`,
                  border: `1px solid ${c.color}40`,
                  color: c.color,
                }}
              >
                {c.label}
              </a>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="relative z-10 mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { value: "3",    label: "Plataformas"       },
            { value: "4",    label: "Soluções Edu"      },
            { value: "3",    label: "Produtos Tech"      },
            { value: "6",    label: "Serviços Digitais" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl px-5 py-4 text-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-white/40">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CLUSTERS ── */}
      {CLUSTERS.map((cluster) => (
        <ClusterSection key={cluster.id} cluster={cluster} />
      ))}

      {/* ── SERVIÇOS ── */}
      <section id="servicos" className="scroll-mt-4">
        <div
          className="relative overflow-hidden rounded-3xl px-8 py-12 md:px-12 md:py-14"
          style={{ background: "linear-gradient(135deg, #0d0a1e 0%, #1a0938 50%, #0a1628 100%)" }}
        >
          {/* blobs */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#7c3aed] opacity-[0.15] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-10 h-64 w-64 rounded-full bg-[#06b6d4] opacity-[0.10] blur-3xl" />

          <div className="relative z-10 mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#a855f7]/30 bg-[#a855f7]/10 px-3 py-1.5">
                <span className="text-sm">⚙️</span>
                <span className="text-[11px] font-black uppercase tracking-widest text-[#c4b5fd]">Serviços BrasUX</span>
              </div>
              <h2 className="mt-4 text-3xl font-black text-white md:text-4xl">
                Soluções tech para{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(135deg, #c4b5fd, #67e8f9)" }}
                >
                  o seu negócio.
                </span>
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/50">
                Time especializado em desenvolvimento, dados, IA, arquitetura e consultoria — da ideia ao impacto real.
              </p>
            </div>
            <Link
              to="/servicos"
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white transition-all hover:scale-[1.03]"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                boxShadow: "0 8px 24px rgba(124,58,237,0.4)",
              }}
            >
              Ver todos os serviços <ArrowRight size={15} />
            </Link>
          </div>

          <div className="relative z-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((svc) => (
              <Link
                key={svc.id}
                to={`/servicos#${svc.id}`}
                className="group flex flex-col gap-3 rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:bg-white/5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.25)" }}
                  >
                    {svc.icon}
                  </span>
                  <p className="text-sm font-black leading-snug text-white">{svc.name}</p>
                </div>
                <p className="text-xs leading-relaxed text-white/45">{svc.desc}</p>
                <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-black text-[#c4b5fd] opacity-0 transition-opacity group-hover:opacity-100">
                  Saiba mais <ArrowRight size={11} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section>
        <div
          className="relative overflow-hidden rounded-3xl px-8 py-14 text-center md:px-14 md:py-16"
          style={{ background: "linear-gradient(135deg, #020617 0%, #001640 50%, #020617 100%)" }}
        >
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-80 w-80 rounded-full bg-[#16a34a] opacity-[0.12] blur-3xl" />
          </div>
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />
          <div className="relative z-10 flex flex-col items-center gap-6">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
              style={{
                background: "rgba(22,163,74,0.12)",
                border: "1px solid rgba(22,163,74,0.3)",
                boxShadow: "0 0 32px rgba(22,163,74,0.2)",
              }}
            >
              🇧🇷
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-[#4ade80]">Feito no Brasil</p>
              <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
                Faça parte do ecossistema.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/50">
                Compre, venda, estude ou construa com a BrasUX. Um ecossistema completo para quem quer crescer no digital brasileiro.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <a
                href="https://comprai.store"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl px-8 py-3.5 text-sm font-black text-white transition-all hover:scale-[1.03]"
                style={{
                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                  boxShadow: "0 8px 28px rgba(22,163,74,0.45)",
                }}
              >
                Explorar o ComprAÍ <ArrowRight size={15} />
              </a>
              <a
                href="mailto:contato@brasux.com.br"
                className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-black text-white/70 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white"
              >
                Fale com a gente
              </a>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

// ─── ClusterSection ───────────────────────────────────────────────────────────

function ClusterSection({ cluster }: { cluster: Cluster }) {
  return (
    <section id={cluster.id} className="scroll-mt-4">
      <div
        className="relative overflow-hidden rounded-3xl px-8 py-12 md:px-12 md:py-14"
        style={{ background: cluster.gradient }}
      >
        {/* blob */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full blur-3xl"
          style={{ background: cluster.color, opacity: 0.18 }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-8 h-56 w-56 rounded-full blur-3xl"
          style={{ background: cluster.color, opacity: 0.08 }}
        />
        {/* grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.7) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Header */}
        <div className="relative z-10 mb-8">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{ background: `${cluster.color}20`, border: `1px solid ${cluster.color}40` }}
          >
            <span className="text-sm">{cluster.emoji}</span>
            <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: cluster.color }}>
              {cluster.label}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-white md:text-3xl">{cluster.title}</h2>
              <p className="mt-1 text-sm font-bold" style={{ color: cluster.color }}>{cluster.subtitle}</p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">{cluster.description}</p>
            </div>
          </div>
        </div>

        {/* Product cards */}
        <div className="relative z-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cluster.products.map((p) => (
            <ProductCard key={p.name} product={p} color={cluster.color} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

function ProductCard({ product, color }: { product: Product; color: string }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl"
            style={{ background: `${color}18`, border: `1px solid ${color}35` }}
          >
            {product.icon}
          </span>
          <div>
            <p className="text-sm font-black leading-snug text-white">{product.name}</p>
            <span
              className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide"
              style={{ background: `${color}20`, color }}
            >
              {product.badge}
            </span>
          </div>
        </div>
        {product.comingSoon ? (
          <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white/40">
            Em breve
          </span>
        ) : product.to ? (
          <ArrowRight size={14} className="shrink-0 text-white/20 transition-colors group-hover:text-white/60" />
        ) : product.href ? (
          <ExternalLink size={14} className="shrink-0 text-white/20 transition-colors group-hover:text-white/60" />
        ) : (
          <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white/40">
            API
          </span>
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-white/45">{product.desc}</p>

      {product.domain && (
        <p className="mt-3 text-[10px] text-white/25">{product.domain}</p>
      )}
    </>
  );

  const cls =
    "group flex flex-col rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg " +
    (product.comingSoon ? "opacity-60 cursor-default" : "cursor-pointer");

  const cardStyle = {
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.10)",
    backdropFilter: "blur(8px)",
  };

  if (product.comingSoon) {
    return <div className={cls} style={cardStyle}>{inner}</div>;
  }

  if (product.to) {
    return (
      <Link to={product.to} className={cls} style={cardStyle}>
        {inner}
      </Link>
    );
  }

  return (
    <a href={product.href} target="_blank" rel="noopener noreferrer" className={cls} style={cardStyle}>
      {inner}
    </a>
  );
}
