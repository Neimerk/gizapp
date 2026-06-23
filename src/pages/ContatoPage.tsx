import { Link } from "react-router-dom";
import { MessageCircle, Mail, MapPin, Clock, ArrowRight } from "lucide-react";
import Breadcrumbs from "../components/seo/Breadcrumbs";
import { usePageMeta } from "../hooks/usePageMeta";
import { canonicalUrl } from "../lib/seo";

function IconInstagram({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function IconLinkedin({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
      <rect x="2" y="9" width="4" height="12"/>
      <circle cx="4" cy="4" r="2"/>
    </svg>
  );
}

const WA_NUMBER = "(48) 98447-0474";
const WA_LINK = "https://wa.me/5548984470474?text=Olá!%20Gostaria%20de%20falar%20com%20a%20equipe%20BrasUX.";
const EMAIL = "contato@brasux.com.br";

const CONTACTS = [
  {
    icon: MessageCircle,
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#dcfce7",
    label: "WhatsApp",
    value: WA_NUMBER,
    desc: "Resposta em minutos · Seg–Sáb 8h–20h",
    href: WA_LINK,
    cta: "Abrir WhatsApp",
    external: true,
    highlight: true,
  },
  {
    icon: Mail,
    color: "#6366f1",
    bg: "#f5f3ff",
    border: "#ede9fe",
    label: "E-mail",
    value: EMAIL,
    desc: "Respondemos em até 1 dia útil",
    href: `mailto:${EMAIL}`,
    cta: "Enviar e-mail",
    external: false,
    highlight: false,
  },
  {
    icon: IconInstagram,
    color: "#ec4899",
    bg: "#fdf2f8",
    border: "#fce7f3",
    label: "Instagram",
    value: "@brasux",
    desc: "Novidades, promoções e suporte",
    href: "https://instagram.com/brasux",
    cta: "Ver perfil",
    external: true,
    highlight: false,
  },
  {
    icon: IconLinkedin,
    color: "#0ea5e9",
    bg: "#f0f9ff",
    border: "#e0f2fe",
    label: "LinkedIn",
    value: "BrasUX Solutec",
    desc: "Parcerias e negócios",
    href: "https://www.linkedin.com/company/brasux-solutec/?viewAsMember=true",
    cta: "Ver empresa",
    external: true,
    highlight: false,
  },
];

const FAQS_QUICK = [
  { q: "Como me torno lojista?", link: "https://brasux.store", label: "Cadastrar loja" },
  { q: "Quero ser entregador parceiro", link: "https://entregas.brasux.com.br", label: "Cadastrar como entregador" },
  { q: "Dúvidas sobre pedidos e entregas", link: "/ajuda", label: "Central de ajuda" },
];

export default function ContatoPage() {
  usePageMeta({
    title: "Fale Conosco — BrasUX Shopping",
    description: "Entre em contato com a equipe BrasUX pelo WhatsApp, e-mail ou redes sociais. Atendimento rápido e humanizado.",
    canonical: canonicalUrl("/contato"),
  });

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ name: "Fale Conosco", path: "/contato" }]} />

      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-3xl p-8 text-white"
        style={{ background: "linear-gradient(135deg, #001640 0%, #002776 40%, #003d1a 100%)" }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#16a34a] opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-24 h-40 w-40 rounded-full bg-[#002776] opacity-30 blur-2xl" />
        <div className="relative z-10">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#4ade80]">Atendimento</p>
          <h1 className="mt-2 text-3xl font-black leading-tight md:text-4xl">
            Fale Conosco
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/70">
            Estamos aqui para ajudar. Escolha o canal de preferência — nossa equipe é rápida e atenciosa.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Clock size={14} className="text-[#4ade80]" />
              Seg–Sáb · 8h às 20h
            </div>
            <div className="flex items-center gap-2 text-sm text-white/60">
              <MapPin size={14} className="text-[#4ade80]" />
              Florianópolis, SC — Brasil
            </div>
          </div>
        </div>
      </section>

      {/* Canais de contato */}
      <section>
        <h2 className="mb-4 text-xl font-black text-[#0f172a]">Nossos canais</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CONTACTS.map((c) => {
            const Icon = c.icon;
            const isExternal = c.external;
            const Tag = isExternal ? "a" : Link;
            const extraProps = isExternal
              ? { href: c.href, target: "_blank", rel: "noopener noreferrer" }
              : { to: c.href };

            return (
              <div
                key={c.label}
                className="relative flex flex-col gap-4 rounded-3xl border p-5 transition-shadow hover:shadow-md"
                style={{ background: c.bg, borderColor: c.border }}
              >
                {c.highlight && (
                  <span
                    className="absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white"
                    style={{ background: c.color }}
                  >
                    Recomendado
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-2xl"
                    style={{ background: `${c.color}20` }}
                  >
                    <Icon size={20} style={{ color: c.color }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: c.color }}>
                      {c.label}
                    </p>
                    <p className="text-sm font-black text-[#0f172a]">{c.value}</p>
                  </div>
                </div>
                <p className="text-xs text-[#64748b]">{c.desc}</p>
                {/* @ts-ignore — Tag alterna entre <a> e Link */}
                <Tag
                  {...extraProps}
                  className="inline-flex items-center gap-1.5 text-sm font-black transition-opacity hover:opacity-80"
                  style={{ color: c.color }}
                >
                  {c.cta} <ArrowRight size={14} />
                </Tag>
              </div>
            );
          })}
        </div>
      </section>

      {/* Acesso rápido */}
      <section>
        <h2 className="mb-4 text-xl font-black text-[#0f172a]">Acesso rápido</h2>
        <div className="space-y-3">
          {FAQS_QUICK.map((item) => {
            const isExternal = item.link.startsWith("http");
            if (isExternal) {
              return (
                <a
                  key={item.q}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-2xl border border-[#e8eaf0] bg-white px-5 py-4 shadow-sm transition-all hover:border-[#16a34a]/30 hover:shadow-md"
                >
                  <span className="text-sm font-black text-[#0f172a]">{item.q}</span>
                  <span className="flex items-center gap-1 text-xs font-black text-[#16a34a]">
                    {item.label} <ArrowRight size={13} />
                  </span>
                </a>
              );
            }
            return (
              <Link
                key={item.q}
                to={item.link}
                className="flex items-center justify-between rounded-2xl border border-[#e8eaf0] bg-white px-5 py-4 shadow-sm transition-all hover:border-[#16a34a]/30 hover:shadow-md"
              >
                <span className="text-sm font-black text-[#0f172a]">{item.q}</span>
                <span className="flex items-center gap-1 text-xs font-black text-[#16a34a]">
                  {item.label} <ArrowRight size={13} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA WhatsApp */}
      <section
        className="flex flex-col items-center gap-4 rounded-3xl p-8 text-center"
        style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 6px 20px rgba(22,163,74,0.35)" }}
        >
          <MessageCircle size={26} className="text-white" />
        </div>
        <div>
          <p className="text-lg font-black text-[#0f172a]">Prefere falar agora?</p>
          <p className="mt-1 text-sm text-[#475569]">
            Nosso WhatsApp é o jeito mais rápido de resolver qualquer situação.
          </p>
        </div>
        <a
          href={WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 6px 20px rgba(22,163,74,0.4)" }}
        >
          <MessageCircle size={16} /> Chamar no WhatsApp
        </a>
      </section>
    </div>
  );
}
