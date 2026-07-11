import { Link } from "react-router-dom";
import { ExternalLink, ArrowRight } from "lucide-react";
import BrasUXLogo from "../ui/BrasUXLogo";

const SOLUTIONS = [
  { name: "Landing Pages",          slug: "landing-pages" },
  { name: "Aplicativos",            slug: "aplicativos" },
  { name: "White Label",            slug: "white-label" },
  { name: "Inteligência Artificial", slug: "inteligencia-artificial" },
  { name: "Engenharia de Software", slug: "engenharia-software" },
  { name: "UX/UI Design",           slug: "ux-ui-design" },
  { name: "Análise de Dados",       slug: "analise-dados" },
  { name: "Consultoria",            slug: "consultoria" },
];

const ECOSYSTEM = [
  { name: "BrasUX Caixa",     href: "https://caixa.brasux.store",          badge: "PDV" },
  { name: "SimulENEM",         href: "https://simulenem.com",               badge: "Edu" },
  { name: "SimulaiOAB",        href: "https://simulaioab.com",              badge: "Edu" },
  { name: "Curso NotaOn",      href: "https://cursonotaon.com.br",          badge: "Edu" },
  { name: "BrasUX Dev",        href: "https://servicos.brasux.com.br",      badge: "Dev" },
  { name: "Landing Pages",     href: "https://produtos.brasux.com.br",      badge: "Dev" },
  { name: "ComprAÍ Shopping",  href: "https://comprai.store",               badge: "Shop" },
];

const COMPANY = [
  { name: "Sobre o BrasUX",      to: "/sobre" },
  { name: "Ecossistema BrasUX",   to: "/ecossistema" },
  { name: "Todas as soluções",    to: "/categorias" },
  { name: "Todas as lojas",       to: "/lojas" },
  { name: "Blog",                 to: "/blog" },
  { name: "Portfólio",            to: "/portfolio" },
];

const SUPPORT = [
  { name: "Central de ajuda",        to: "/ajuda" },
  { name: "Fale conosco",            to: "/contato" },
  { name: "Política de privacidade", to: "/privacidade" },
];

const SOCIAL = [
  {
    label: "Instagram",
    href: "https://instagram.com/brasux",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/brasux-solutec/?viewAsMember=true",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
        <rect x="2" y="9" width="4" height="12"/>
        <circle cx="4" cy="4" r="2"/>
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://facebook.com/brasux",
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
      </svg>
    ),
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-16 w-full"
      aria-label="Rodapé BrasUX Soluções Tecnológicas"
      style={{
        background: "linear-gradient(180deg, #071020 0%, #060d1a 100%)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* ── MAIN GRID ── */}
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">

          {/* ── COL 1: BRAND ── */}
          <div className="lg:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <BrasUXLogo
                size={36}
                style={{ filter: "drop-shadow(0 4px 12px rgba(22,163,74,0.5))" }}
              />
              <span className="text-xl font-black text-white">
                Bras<span className="text-[#4ade80]">UX</span>
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              O Shopping Brasileiro de Soluções Tecnológicas. Landing pages, apps,
              white label, IA, engenharia de dados e consultorias — tudo em um só lugar.
            </p>

            <div className="mt-6 flex items-center gap-3">
              {SOCIAL.map(({ label, href, svg }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`BrasUX no ${label}`}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-muted transition-colors hover:border-[#16a34a]/40 hover:text-[#4ade80]"
                >
                  {svg}
                </a>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-2.5">
              <span className="text-lg">📱</span>
              <div>
                <p className="text-[11px] font-black text-white/70">App em breve</p>
                <p className="text-[10px] text-muted">Android e iPhone</p>
              </div>
            </div>
          </div>

          {/* ── COL 2: SOLUÇÕES ── */}
          <div>
            <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest text-[#4ade80]">
              Nossas Soluções
            </h3>
            <ul className="space-y-2.5">
              {SOLUTIONS.map((sol) => (
                <li key={sol.slug}>
                  <Link
                    to={`/categorias/${sol.slug}`}
                    className="text-sm text-muted transition-colors hover:text-white"
                  >
                    {sol.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/categorias"
                  className="inline-flex items-center gap-1 text-sm font-bold text-[#16a34a] transition-opacity hover:opacity-80"
                >
                  Ver todas <ArrowRight size={12} />
                </Link>
              </li>
            </ul>
          </div>

          {/* ── COL 3: ECOSSISTEMA ── */}
          <div>
            <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest text-[#4ade80]">
              Ecossistema BrasUX
            </h3>
            <ul className="space-y-2.5">
              {ECOSYSTEM.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-white"
                  >
                    {item.name}
                    <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-muted transition-colors group-hover:bg-[#16a34a]/20 group-hover:text-[#4ade80]">
                      {item.badge}
                    </span>
                    <ExternalLink size={11} className="opacity-0 transition-opacity group-hover:opacity-50" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ── COL 4: EMPRESA + SUPORTE ── */}
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-1 lg:gap-8">
            <div>
              <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest text-[#4ade80]">
                Empresa
              </h3>
              <ul className="space-y-2.5">
                {COMPANY.map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.to}
                      className="text-sm text-muted transition-colors hover:text-white"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest text-[#4ade80]">
                Suporte
              </h3>
              <ul className="space-y-2.5">
                {SUPPORT.map((item) => (
                  <li key={item.name}>
                    <Link
                      to={item.to}
                      className="text-sm text-muted transition-colors hover:text-white"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div className="border-t border-white/5 px-4 pt-5 pb-20 md:px-8 md:pb-6">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <p className="text-xs text-[#334155]">
            © {year} BrasUX Tecnologia Ltda. — Todos os direitos reservados.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-[#334155]">
              <span
                className="inline-block h-2 w-2 rounded-full bg-[#16a34a]"
                style={{ boxShadow: "0 0 6px rgba(22,163,74,0.6)" }}
              />
              Todos os sistemas operando
            </span>
            <span className="text-xs text-[#334155]">🇧🇷 Feito no Brasil</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
