import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f172a]">
          <ArrowLeft size={18} className="text-white" />
        </Link>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">BrasUX</p>
          <h1 className="text-xl font-black text-content">Política de Privacidade</h1>
        </div>
      </div>

      <p className="text-xs text-faint">Última atualização: junho de 2026</p>

      {[
        {
          title: "1. Dados que coletamos",
          body: "Coletamos nome, e-mail, CPF (opcional), telefone e endereço de entrega para processar pedidos. Coletamos também dados de navegação (erros técnicos, página visitada) para melhoria do serviço.",
        },
        {
          title: "2. Como usamos seus dados",
          body: "Seus dados são usados exclusivamente para: (a) processar e entregar pedidos; (b) autenticação e segurança da conta; (c) comunicação sobre pedidos via e-mail ou notificação push (apenas com seu consentimento); (d) cumprimento de obrigações legais.",
        },
        {
          title: "3. Compartilhamento",
          body: "Compartilhamos seus dados somente com: Asaas (processador de pagamento), Resend (envio de e-mails transacionais) e entregadores parceiros (apenas nome, telefone e endereço de entrega do pedido específico). Não vendemos dados a terceiros.",
        },
        {
          title: "4. Cookies e armazenamento local",
          body: "Utilizamos cookies essenciais para autenticação (via Supabase Auth) e preferências locais (tema, carrinho). Não utilizamos cookies de rastreamento ou publicidade de terceiros.",
        },
        {
          title: "5. Seus direitos (LGPD)",
          body: "Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a: acessar seus dados, corrigir dados incorretos, solicitar portabilidade, revogar consentimento e solicitar exclusão. Acesse sua conta para exercer esses direitos ou entre em contato pelo e-mail abaixo.",
        },
        {
          title: "6. Retenção de dados",
          body: "Dados de pedidos são mantidos por 5 anos para fins fiscais e legais. Dados de perfil são anonimizados imediatamente após a exclusão de conta. Logs de erros são mantidos por 90 dias.",
        },
        {
          title: "7. Segurança",
          body: "Utilizamos criptografia TLS em trânsito, autenticação JWT via Supabase Auth e Row Level Security (RLS) no banco de dados. Senhas nunca são armazenadas em texto claro.",
        },
        {
          title: "8. Contato e DPO",
          body: "Para exercer seus direitos ou dúvidas sobre privacidade, entre em contato: privacidade@brasux.com.br",
        },
      ].map((s) => (
        <div key={s.title} className="rounded-2xl border border-line-subtle bg-surface p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-black text-content">{s.title}</h2>
          <p className="text-sm leading-relaxed text-muted">{s.body}</p>
        </div>
      ))}

      <p className="text-center text-xs text-faint">
        BrasUX Shopping · CNPJ 00.000.000/0001-00 ·{" "}
        <a href="mailto:privacidade@brasux.com.br" className="text-[#16a34a]">
          privacidade@brasux.com.br
        </a>
      </p>
    </div>
  );
}
