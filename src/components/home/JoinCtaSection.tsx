import { ArrowRight, Code2, Store as StoreIcon } from "lucide-react";

const SELLER_URL = "https://brasux.com.br/lojista";
const PARTNER_URL = "https://brasux.com.br/parceiro";

export default function JoinCtaSection() {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div
        className="relative overflow-hidden rounded-3xl p-8"
        style={{ background: "linear-gradient(135deg, #001640 0%, #002776 50%, #003d1a 100%)" }}
      >
        <div className="blob-a pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#16a34a] opacity-25 blur-3xl" />
        <div className="relative z-10 flex items-start gap-5">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #16a34a, #15803d)",
              boxShadow: "0 6px 20px rgba(22,163,74,0.4)",
            }}
          >
            <StoreIcon size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-black text-white">Tem uma empresa de tech?</h3>
            <p className="mt-2 text-sm leading-relaxed text-faint">
              Venda seus produtos e serviços digitais no BrasUX. Cadastre sua loja em minutos e alcance novos clientes.
            </p>
            <a
              href={SELLER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
            >
              Quero ser lojista <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-5 rounded-3xl border border-line bg-surface p-8 shadow-sm">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: "rgba(99,102,241,0.1)" }}
        >
          <Code2 size={24} className="text-[#6366f1]" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-black text-content">É dev ou designer freelancer?</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Publique seus templates, componentes, kits e ferramentas digitais. Venda para centenas de clientes sem esforço.
          </p>
          <a
            href={PARTNER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0f172a] px-5 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.03]"
          >
            Ser parceiro <ArrowRight size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}
