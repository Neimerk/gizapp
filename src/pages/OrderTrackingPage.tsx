import {
  CheckCircle2, Clock, Loader2, Package, PackageCheck,
  Radio, Search, ShoppingBag, Truck, XCircle,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchOrderTracking, type TrackingResult } from "../services/guestSession";
import { formatBRL } from "../utils/format";

const LiveTrackingMap = lazy(() => import("../components/ui/LiveTrackingMap"));

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix:    "Pix",
  card:   "Cartão de crédito",
  boleto: "Boleto bancário",
};

const STEP_ICONS = [
  <Clock key={0} size={18} />,
  <CheckCircle2 key={1} size={18} />,
  <Package key={2} size={18} />,
  <Truck key={3} size={18} />,
  <PackageCheck key={4} size={18} />,
];

function StatusTimeline({ timeline }: { timeline: TrackingResult["timeline"] }) {
  const active = timeline.filter((s) => s.step < 5);
  return (
    <div className="space-y-1">
      {active.map((step, idx) => (
        <div key={step.step} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              step.completed
                ? "bg-[#16a34a] text-white"
                : step.current
                ? "bg-[#0f172a] text-white"
                : "bg-subtle-2 text-faint"
            }`}>
              {STEP_ICONS[step.step] ?? <span className="text-xs font-black">{step.step}</span>}
            </div>
            {idx < active.length - 1 && (
              <div className={`my-0.5 h-5 w-0.5 rounded-full ${step.completed ? "bg-[#16a34a]" : "bg-line"}`} />
            )}
          </div>
          <div className="pt-1">
            <p className={`text-sm font-black ${
              step.current ? "text-content" : step.completed ? "text-[#16a34a]" : "text-faint"
            }`}>
              {step.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Status em que faz sentido mostrar o mapa ao vivo
const LIVE_STATUSES = new Set([1, 2, 3]); // pago, em preparo, em rota

function TrackingResult({ data }: { data: TrackingResult }) {
  const isCancelled    = data.status === 5;
  const isDelivered    = data.status === 4;
  const paymentPending = data.paymentStatus === "PENDING";
  const showLiveMap    = LIVE_STATUSES.has(data.status) && !!data.orderId;

  return (
    <div className="space-y-4">
      {/* Status principal */}
      <div className={`rounded-3xl border p-5 text-center ${
        isDelivered    ? "border-[#bbf7d0] bg-[#f0fdf4]"
        : isCancelled  ? "border-red-200 bg-red-50"
        : paymentPending ? "border-[#fde68a] bg-[#fffbeb]"
        : "border-line-subtle bg-surface"
      }`}>
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface/80">
          {isDelivered   ? <PackageCheck size={32} className="text-[#16a34a]" />
          : isCancelled  ? <XCircle size={32} className="text-red-500" />
          : paymentPending ? <Clock size={32} className="text-[#f59e0b]" />
          : <ShoppingBag size={32} className="text-[#0f172a]" />}
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-faint">
          Pedido #{data.trackingCode}
        </p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <h2 className="text-xl font-black text-content">{data.statusLabel}</h2>
          {showLiveMap && (
            <span className="flex items-center gap-1 rounded-full bg-[#16a34a] px-2 py-0.5 text-[9px] font-black text-white">
              <Radio size={8} className="animate-pulse" />
              AO VIVO
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">{data.storeName}</p>
        <p className="mt-2 text-2xl font-black text-[#16a34a]">
          {formatBRL(data.total)}
        </p>
        <p className="mt-1 text-xs text-faint">
          {PAYMENT_METHOD_LABELS[data.paymentMethod] ?? data.paymentMethod} · {data.paymentLabel}
        </p>
      </div>

      {/* Mapa ao vivo — mostra quando pedido está ativo */}
      {showLiveMap && (
        <Suspense fallback={<div className="h-52 animate-pulse rounded-2xl bg-subtle-2" />}>
          <LiveTrackingMap orderId={data.orderId} />
        </Suspense>
      )}

      {/* Timeline */}
      {!isCancelled && (
        <div className="rounded-3xl border border-line-subtle bg-surface p-5 shadow-sm">
          <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-faint">
            Acompanhamento
          </h3>
          <StatusTimeline timeline={data.timeline} />
        </div>
      )}

      {/* Aviso pagamento pendente */}
      {paymentPending && (
        <div className="rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-4 text-sm text-[#92400e]">
          <p className="font-black">Aguardando pagamento</p>
          <p className="mt-0.5 text-xs">
            Seu pedido só será processado após a confirmação do pagamento.
          </p>
        </div>
      )}

      {/* CTA de login */}
      <div className="rounded-3xl border border-line-subtle bg-surface p-5 text-center shadow-sm">
        <p className="text-sm font-black text-content">Quer acompanhar mais facilmente?</p>
        <p className="mt-1 text-xs text-muted">
          Crie uma conta gratuita e todos os seus pedidos ficam salvos em um só lugar.
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            to="/login"
            state={{ from: "/conta" }}
            className="flex-1 rounded-2xl bg-[#6366f1] py-3 text-sm font-black text-white"
          >
            Criar conta
          </Link>
          <Link
            to="/"
            className="flex-1 rounded-2xl border border-line bg-subtle py-3 text-sm font-black text-muted"
          >
            Explorar lojas
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  const { code }   = useParams<{ code: string }>();
  const [input,    setInput]    = useState(code?.toUpperCase() ?? "");
  const [loading,  setLoading]  = useState(!!code);
  const [result,   setResult]   = useState<TrackingResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (code) search(code);
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  async function search(trackCode = input) {
    const cleaned = trackCode.trim().toUpperCase().replace(/[^A-F0-9]/g, "");
    if (cleaned.length !== 8) {
      setError("O código de rastreamento deve ter exatamente 8 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchOrderTracking(cleaned);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pedido não encontrado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-6">
      {/* Header */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#16a34a]">BrasUX</p>
        <h1 className="text-2xl font-black text-content">Rastrear pedido</h1>
        <p className="mt-1 text-sm text-muted">
          Digite o código de 8 caracteres que você recebeu ao finalizar a compra.
        </p>
      </div>

      {/* Buscador */}
      <div className="rounded-3xl border border-line-subtle bg-surface p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, "").slice(0, 8))}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Ex: A1B2C3D4"
            maxLength={8}
            className="flex-1 rounded-xl border border-line bg-subtle px-4 py-3 font-mono text-sm font-black uppercase text-content tracking-widest outline-none focus:ring-2 focus:ring-[#16a34a]/30 placeholder:text-faint placeholder:normal-case placeholder:tracking-normal placeholder:font-semibold"
          />
          <button
            onClick={() => search()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[#0f172a] px-4 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs font-bold text-red-500">{error}</p>
        )}
      </div>

      {/* Resultado */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 size={32} className="animate-spin text-[#16a34a]" />
          <p className="text-sm text-muted">Buscando pedido…</p>
        </div>
      )}

      {result && !loading && <TrackingResult data={result} />}

      {/* Dica */}
      {!result && !loading && (
        <div className="rounded-2xl border border-line bg-subtle p-4 text-xs text-muted">
          <p className="font-black text-content">Onde encontro o código?</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>Na tela de confirmação do pedido</li>
            <li>No e-mail de confirmação que enviamos</li>
            <li>Na caixa "Guarde o número do seu pedido"</li>
          </ul>
        </div>
      )}
    </div>
  );
}
