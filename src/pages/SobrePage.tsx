import { usePageMeta } from "../hooks/usePageMeta";
import { useJsonLd } from "../hooks/useJsonLd";
import {
  buildFaqSchema,
  buildOrganizationSchema,
  buildWebPageSchema,
  HOME_FAQS,
  canonicalUrl,
} from "../lib/seo";
import Breadcrumbs from "../components/seo/Breadcrumbs";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShoppingBag, Truck, Store, Bot, GraduationCap, Package } from "lucide-react";

const EXTENDED_FAQS = [
  ...HOME_FAQS,
  {
    question: "Quais categorias de produtos estão disponíveis no BrasUX?",
    answer:
      "O BrasUX Shopping oferece mais de 30 categorias: restaurantes, pizzarias, lanches, mercado, hortifruti, carnes, farmácia, bebidas, cafeterias, padaria, pet shop, beleza, moda, fitness, eletrônicos, casa e cozinha, brinquedos, automotivo, serviços digitais, cursos online e muito mais.",
  },
  {
    question: "O BrasUX tem aplicativo para celular?",
    answer:
      "Sim! O BrasUX Shopping é um Progressive Web App (PWA) que pode ser instalado diretamente no seu celular Android ou iPhone sem precisar de app store. Acesse pelo navegador e toque em 'Adicionar à tela inicial'.",
  },
  {
    question: "Como funciona o BrasUX Caixa?",
    answer:
      "O BrasUX Caixa é um sistema de PDV (Ponto de Venda) completo para pequenos e médios negócios. Inclui gestão de vendas, estoque, fluxo de caixa e dashboard. Acesse em brasux-caixa-livre.vercel.app.",
  },
  {
    question: "O que é o SimulENEM?",
    answer:
      "O SimulENEM é uma plataforma de simulados do ENEM com gabarito comentado, ranking nacional e estatísticas de desempenho. Disponível em simulenem.com, faz parte do ecossistema BrasUX Edu.",
  },
  {
    question: "Como me tornar entregador parceiro BrasUX?",
    answer:
      "Para se tornar entregador parceiro, acesse entregas.brasux.com.br e faça seu cadastro. Você receberá pedidos próximos à sua localização e pode escolher seus horários de trabalho.",
  },
  {
    question: "O BrasUX aceita pagamento com Pix?",
    answer:
      "Sim, o BrasUX aceita Pix como forma de pagamento. O QR Code é gerado instantaneamente no checkout e a confirmação é imediata, agilizando a preparação do seu pedido.",
  },
];

const ECOSYSTEM = [
  {
    icon: ShoppingBag,
    name: "Shopping BrasUX",
    desc: "Marketplace multilojas com entregas rápidas. O coração do ecossistema.",
    url: "/",
    badge: "Ativo",
  },
  {
    icon: Store,
    name: "BrasUX Loja",
    desc: "Plataforma white-label para qualquer negócio ter sua loja online.",
    url: "https://lojas.brasux.com.br",
    badge: "Ativo",
  },
  {
    icon: Truck,
    name: "BrasUX Entregas",
    desc: "Rede de entregadores parceiros com rastreamento em tempo real.",
    url: "https://entregas.brasux.com.br",
    badge: "Ativo",
  },
  {
    icon: Bot,
    name: "Fábrica de Bots IA",
    desc: "Bots de atendimento e automação com inteligência artificial.",
    url: "https://produtos.brasux.com.br",
    badge: "Em breve",
  },
  {
    icon: GraduationCap,
    name: "BrasUX Edu",
    desc: "Cursos, simulados e plataformas educacionais — NotaOn, SimulENEM, SimulaiOAB.",
    url: "/categorias/cursos-online",
    badge: "Ativo",
  },
  {
    icon: Package,
    name: "BrasUX Catalog API",
    desc: "API de catálogo de produtos para integrações e white-labels.",
    url: "https://brasux.com.br",
    badge: "API",
  },
];

export default function SobrePage() {
  const schemas = useMemo(
    () => [
      buildOrganizationSchema(),
      buildWebPageSchema({
        path: "/sobre",
        name: "Sobre o BrasUX Shopping",
        description:
          "Conheça o BrasUX Shopping, o ecossistema brasileiro de soluções tecnológicas com shopping, loja white-label, entregas, IA e educação.",
        type: "AboutPage",
      }),
      buildFaqSchema(EXTENDED_FAQS.map(f => ({ question: f.question, answer: f.answer }))),
    ],
    []
  );
  useJsonLd(schemas);

  usePageMeta({
    title: "Sobre o BrasUX — Ecossistema de Soluções Tecnológicas",
    description:
      "Conheça o BrasUX Shopping, o ecossistema brasileiro de soluções tecnológicas com shopping, loja white-label, entregas, IA e educação.",
    canonical: canonicalUrl("/sobre"),
  });

  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ name: "Sobre o BrasUX", path: "/sobre" }]} />

      {/* Hero */}
      <section className="rounded-3xl bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-8 text-white">
        <p className="text-xs font-black uppercase tracking-widest text-[#4ade80]">Quem somos</p>
        <h1 className="mt-2 text-4xl font-black leading-tight">
          O Shopping Brasileiro de<br />
          <span className="text-[#4ade80]">Soluções Tecnológicas</span>
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70">
          O BrasUX é um ecossistema completo que conecta consumidores, lojistas e entregadores em
          uma plataforma moderna, rápida e brasileira. Do restaurante ao software, do mercado à IA.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/lojas"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#16a34a] px-5 py-3 text-sm font-black text-white"
          >
            Ver lojas <ArrowRight size={15} />
          </Link>
          <a
            href="https://lojas.brasux.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-5 py-3 text-sm font-black text-white hover:bg-white/10"
          >
            Quero vender
          </a>
        </div>
      </section>

      {/* Ecossistema */}
      <section>
        <h2 className="mb-1 text-2xl font-black text-content">Ecossistema BrasUX</h2>
        <p className="mb-6 text-sm text-muted">
          Mais do que um shopping — um ecossistema completo de tecnologia brasileira.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ECOSYSTEM.map((item) => {
            const Icon = item.icon;
            const isExternal = item.url.startsWith("http");
            const inner = (
              <div className="flex flex-col gap-3 rounded-2xl border border-line-subtle bg-surface p-5 hover:border-[#16a34a]/30 hover:shadow-md transition-all h-full">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0fdf4]">
                    <Icon size={20} className="text-[#16a34a]" />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    item.badge === "Ativo"
                      ? "bg-[#f0fdf4] text-[#16a34a]"
                      : item.badge === "API"
                      ? "bg-[#eff6ff] text-[#2563eb]"
                      : "bg-[#fefce8] text-[#ca8a04]"
                  }`}>
                    {item.badge}
                  </span>
                </div>
                <div>
                  <h3 className="font-black text-content">{item.name}</h3>
                  <p className="mt-1 text-sm text-muted">{item.desc}</p>
                </div>
              </div>
            );
            return isExternal ? (
              <a key={item.name} href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                {inner}
              </a>
            ) : (
              <Link key={item.name} to={item.url} className="block">
                {inner}
              </Link>
            );
          })}
        </div>
      </section>

      {/* FAQ — AEO/GEO content */}
      <section itemScope itemType="https://schema.org/FAQPage">
        <h2 className="mb-6 text-2xl font-black text-content">Perguntas Frequentes</h2>
        <div className="space-y-4">
          {EXTENDED_FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl border border-line-subtle bg-surface"
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <summary
                className="flex cursor-pointer items-center justify-between gap-4 p-5 font-black text-content list-none"
                itemProp="name"
              >
                {faq.question}
                <ArrowRight
                  size={16}
                  className="shrink-0 text-faint transition-transform group-open:rotate-90"
                />
              </summary>
              <div
                className="border-t border-subtle-2 px-5 pb-5 pt-4 text-sm leading-relaxed text-muted"
                itemScope
                itemProp="acceptedAnswer"
                itemType="https://schema.org/Answer"
              >
                <span itemProp="text">{faq.answer}</span>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
