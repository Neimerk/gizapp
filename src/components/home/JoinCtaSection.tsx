import { ArrowRight, Bike, Store as StoreIcon } from "lucide-react";

const SELLER_URL = "https://brasux.store";
const DELIVERY_URL = "https://entregas.brasux.com.br";

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
                  <h3 className="text-xl font-black text-white">Tem uma loja?</h3>
                  <p className="mt-2 text-sm leading-relaxed text-faint">
                    Venda pelo BrasUX sem comissão por pedido. Catálogo pronto, só informe o preço.
                  </p>
                  <a
                    href={SELLER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.03]"
                    style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
                  >
                    Quero vender <ArrowRight size={15} />
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-5 rounded-3xl border border-line bg-surface p-8 shadow-sm">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: "rgba(22,163,74,0.1)" }}
              >
                <Bike size={24} className="text-[#16a34a]" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-content">Quer fazer entregas?</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Qualquer veículo — a pé, bike, moto, carro. Receba por PIX a cada corrida.
                </p>
                <a
                  href={DELIVERY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0f172a] px-5 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.03]"
                >
                  Ser entregador <ArrowRight size={15} />
                </a>
              </div>
            </div>
          </section>
  );
}
