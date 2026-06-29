import { Link } from "react-router-dom";
import { MessageCircle, ShoppingBag, Truck, CreditCard, User, Package, ChevronDown } from "lucide-react";
import { useState } from "react";
import Breadcrumbs from "../components/seo/Breadcrumbs";
import { usePageMeta } from "../hooks/usePageMeta";
import { canonicalUrl } from "../lib/seo";

const WA_LINK = "https://wa.me/5548984470474?text=Olá!%20Preciso%20de%20ajuda%20com%20o%20BrasUX%20Shopping.";

const TOPICS = [
  {
    icon: ShoppingBag,
    color: "#16a34a",
    title: "Pedidos",
    faqs: [
      {
        q: "Como faço um pedido?",
        a: "Acesse a loja desejada, adicione os produtos ao carrinho e finalize o checkout. O pagamento é feito via Pix e você receberá a confirmação imediatamente.",
      },
      {
        q: "Como cancelo um pedido?",
        a: "Pedidos podem ser cancelados em até 5 minutos após a confirmação, antes do lojista iniciar o preparo. Acesse 'Meus Pedidos' e toque em 'Cancelar'.",
      },
      {
        q: "Meu pedido sumiu — o que aconteceu?",
        a: "Verifique em 'Meus Pedidos' se está logado na conta correta. Se o problema persistir, fale conosco pelo WhatsApp com o número do pedido em mãos.",
      },
    ],
  },
  {
    icon: Truck,
    color: "#0ea5e9",
    title: "Entrega",
    faqs: [
      {
        q: "Quanto tempo leva a entrega?",
        a: "O prazo é estimado pelo lojista no momento do pedido. Em média 15–40 minutos para delivery local. Você acompanha o status em tempo real na tela do pedido.",
      },
      {
        q: "Posso rastrear meu pedido?",
        a: "Sim! Após a coleta pelo entregador, um mapa em tempo real aparece na tela do pedido para você acompanhar a localização.",
      },
      {
        q: "O entregador não chegou — o que faço?",
        a: "Entre em contato com o suporte via WhatsApp informando o número do pedido. Nossa equipe acionará o entregador imediatamente.",
      },
    ],
  },
  {
    icon: CreditCard,
    color: "#7c3aed",
    title: "Pagamentos",
    faqs: [
      {
        q: "Quais formas de pagamento são aceitas?",
        a: "Atualmente aceitamos Pix. O QR Code é gerado no checkout e a confirmação é instantânea.",
      },
      {
        q: "Paguei mas o pedido não foi confirmado.",
        a: "O Pix pode levar até 2 minutos para processar. Se após esse tempo o pedido ainda não aparecer como confirmado, entre em contato pelo WhatsApp com o comprovante.",
      },
      {
        q: "Como funciona o reembolso?",
        a: "Reembolsos de pedidos cancelados são processados via Pix em até 3 dias úteis para a chave Pix usada no pagamento.",
      },
    ],
  },
  {
    icon: Package,
    color: "#f59e0b",
    title: "Produtos e Lojas",
    faqs: [
      {
        q: "Como encontro um produto específico?",
        a: "Use a busca no topo da página ou navegue pelas categorias. Você também pode buscar por voz pressionando o ícone de microfone.",
      },
      {
        q: "Um produto estava indisponível — quando volta?",
        a: "A disponibilidade é controlada pelo lojista. Adicione o produto aos Favoritos e verifique novamente mais tarde.",
      },
      {
        q: "Como entro em contato com um lojista?",
        a: "Em cada página de loja há um botão de chat direto com o lojista. Você pode tirar dúvidas sobre produtos, horários e personalizações.",
      },
    ],
  },
  {
    icon: User,
    color: "#ec4899",
    title: "Conta e Acesso",
    faqs: [
      {
        q: "Esqueci minha senha — como recupero?",
        a: "Na tela de Login, clique em 'Esqueci minha senha'. Você receberá um link de redefinição no e-mail cadastrado.",
      },
      {
        q: "Como excluo minha conta?",
        a: "Acesse Minha Conta → Configurações → Excluir conta. Os dados são anonimizados conforme nossa Política de Privacidade (LGPD).",
      },
      {
        q: "Posso ter mais de um endereço de entrega?",
        a: "Sim! Em Minha Conta você pode cadastrar vários endereços e escolher o desejado no checkout.",
      },
    ],
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-subtle-2 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-black text-content">{q}</span>
        <ChevronDown
          size={16}
          className="shrink-0 text-faint transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      {open && (
        <p className="pb-4 text-sm leading-relaxed text-muted">{a}</p>
      )}
    </div>
  );
}

export default function AjudaPage() {
  usePageMeta({
    title: "Central de Ajuda — BrasUX Shopping",
    description: "Tire suas dúvidas sobre pedidos, entregas, pagamentos e conta no BrasUX Shopping. Atendimento via WhatsApp.",
    canonical: canonicalUrl("/ajuda"),
  });

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ name: "Central de Ajuda", path: "/ajuda" }]} />

      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-3xl p-8 text-white"
        style={{ background: "linear-gradient(135deg, #001640 0%, #002776 40%, #003d1a 100%)" }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#16a34a] opacity-20 blur-3xl" />
        <div className="relative z-10">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#4ade80]">Suporte</p>
          <h1 className="mt-2 text-3xl font-black leading-tight md:text-4xl">
            Central de Ajuda
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/70">
            Encontre respostas rápidas abaixo ou fale diretamente com nossa equipe pelo WhatsApp.
          </p>
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 6px 20px rgba(22,163,74,0.4)" }}
          >
            <MessageCircle size={16} />
            Falar no WhatsApp
          </a>
        </div>
      </section>

      {/* FAQ por categoria */}
      {TOPICS.map((topic) => {
        const Icon = topic.icon;
        return (
          <section key={topic.title}>
            <div className="mb-3 flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: `${topic.color}18` }}
              >
                <Icon size={16} style={{ color: topic.color }} />
              </div>
              <h2 className="text-lg font-black text-content">{topic.title}</h2>
            </div>
            <div className="rounded-3xl border border-line-subtle bg-surface px-5 shadow-sm">
              {topic.faqs.map((faq) => (
                <FaqItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </section>
        );
      })}

      {/* CTA final */}
      <section className="rounded-3xl border border-[#dcfce7] bg-[#f0fdf4] p-6">
        <p className="text-sm font-black text-content">Não encontrou o que precisava?</p>
        <p className="mt-1 text-sm text-muted">
          Nossa equipe responde em minutos pelo WhatsApp, de segunda a sábado das 8h às 20h.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#16a34a] px-5 py-2.5 text-sm font-black text-white transition-opacity hover:opacity-90"
          >
            <MessageCircle size={15} /> WhatsApp (48) 98447-0474
          </a>
          <Link
            to="/contato"
            className="inline-flex items-center gap-2 rounded-2xl border border-[#16a34a]/30 px-5 py-2.5 text-sm font-black text-[#16a34a] transition-colors hover:bg-[#16a34a]/5"
          >
            Ver todos os contatos
          </Link>
        </div>
      </section>
    </div>
  );
}
