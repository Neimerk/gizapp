import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FolderOpen,
  LogIn,
  MessageCircle,
  Plus,
  ReceiptText,
  RefreshCw,
  Rocket,
} from "lucide-react";
import { getMyOrders, queryKeys, type Order } from "../services/gizApi";
import { formatBRL } from "../utils/format";
import { useAuthStore } from "../stores/authStore";
import { supabase } from "../lib/supabase";
import { usePageMeta } from "../hooks/usePageMeta";

// ─── Status mapping ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<number, string> = {
  0: "Aguardando",
  1: "Iniciando",
  2: "Em desenvolvimento",
  3: "Em revisão",
  4: "Entregue",
  5: "Cancelado",
};

const STATUS_COLOR: Record<number, { bg: string; text: string; border: string }> = {
  0: { bg: "#fefce8", text: "#a16207", border: "#fde68a" },
  1: { bg: "#f5f3ff", text: "#7c3aed", border: "#ddd6fe" },
  2: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  3: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  4: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  5: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
};

const STATUS_ACCENT: Record<number, string> = {
  0: "#eab308",
  1: "#7c3aed",
  2: "#2563eb",
  3: "#ea580c",
  4: "#16a34a",
  5: "#ef4444",
};

const STATUS_PROGRESS: Record<number, number> = {
  0: 5, 1: 20, 2: 60, 3: 85, 4: 100, 5: 0,
};

const STEPS = [
  { status: 0, label: "Briefing" },
  { status: 1, label: "Iniciando" },
  { status: 2, label: "Dev" },
  { status: 3, label: "Revisão" },
  { status: 4, label: "Entregue" },
];

// ─── Portfolio showcase (empty state) ────────────────────────────────────────

const SHOWCASE = [
  {
    id: "s1",
    type: "Landing Page",
    icon: "🚀",
    color: "#16a34a",
    name: "LP Alta Conversão — Clínica VitaPlus",
    status: 4,
    value: 1200,
    tech: ["React", "Tailwind", "Vite"],
    date: "Jun 2026",
    result: "Conversão +180% em 30 dias",
  },
  {
    id: "s2",
    type: "App Mobile",
    icon: "📱",
    color: "#2563eb",
    name: "App Delivery — DelivEx",
    status: 4,
    value: 18000,
    tech: ["React Native", "Supabase", "Stripe"],
    date: "Mai 2026",
    result: "Lançado em 45 dias úteis",
  },
  {
    id: "s3",
    type: "Dashboard BI",
    icon: "📊",
    color: "#9333ea",
    name: "Data Studio — GrupoAlpha",
    status: 4,
    value: 8500,
    tech: ["Python", "BigQuery", "Power BI"],
    date: "Abr 2026",
    result: "Pipeline ETL + 12 dashboards",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterKey = "todos" | "andamento" | "revisao" | "entregues" | "cancelados";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "todos",      label: "Todos" },
  { key: "andamento",  label: "Em andamento" },
  { key: "revisao",    label: "Em revisão" },
  { key: "entregues",  label: "Entregues" },
  { key: "cancelados", label: "Cancelados" },
];

function filterOrders(orders: Order[], key: FilterKey): Order[] {
  if (key === "todos")      return orders;
  if (key === "andamento")  return orders.filter((o) => o.status >= 1 && o.status <= 2);
  if (key === "revisao")    return orders.filter((o) => o.status === 3);
  if (key === "entregues")  return orders.filter((o) => o.status === 4);
  if (key === "cancelados") return orders.filter((o) => o.status === 5);
  return orders;
}

export default function OrdersPage() {
  usePageMeta({ title: "Meus Projetos — BrasUX" });

  const auth       = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("todos");

  const { data: orders = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: queryKeys.myOrders(),
    queryFn: getMyOrders,
    enabled: !!auth,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!auth) return;
    const channel = supabase
      .channel(`orders:customer:${auth.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `customer_id=eq.${auth.id}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.myOrders() }); }
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `customer_id=eq.${auth.id}` },
        () => { queryClient.invalidateQueries({ queryKey: queryKeys.myOrders() }); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [auth, queryClient]);

  // ── Unauthenticated ───────────────────────────────────────────────────────

  if (!auth) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col items-center justify-center pt-10 pb-4 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-3xl"
            style={{ background: "linear-gradient(135deg, #16a34a22, #16a34a44)" }}
          >
            <FolderOpen size={36} className="text-[#16a34a]" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-content">Meus Projetos</h1>
          <p className="mt-2 text-sm text-muted max-w-sm">
            Faça login para acompanhar o andamento dos seus projetos tech em tempo real.
          </p>
          <Link
            to="/login"
            state={{ from: "/projetos" }}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#16a34a] px-6 py-3 text-sm font-black text-white"
            style={{ boxShadow: "0 4px 16px rgba(22,163,74,0.35)" }}
          >
            <LogIn size={16} /> Entrar na conta
          </Link>
        </div>

        {/* Showcase blurred */}
        <div>
          <p className="mb-4 text-center text-[11px] font-black uppercase tracking-widest text-faint">
            Exemplos do portfólio BrasUX
          </p>
          <div className="grid gap-4 sm:grid-cols-3 opacity-60 pointer-events-none select-none">
            {SHOWCASE.map((p) => <ShowcaseCard key={p.id} project={p} />)}
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated ─────────────────────────────────────────────────────────

  const filtered   = filterOrders(orders, filter);
  const inProgress = orders.filter((o) => o.status >= 1 && o.status <= 3).length;
  const delivered  = orders.filter((o) => o.status === 4).length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#16a34a]">BrasUX</p>
          <h1 className="text-2xl font-black text-content">Meus Projetos</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface"
            aria-label="Atualizar"
          >
            <RefreshCw size={15} className={`text-muted ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <Link
            to="/contato"
            className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-black text-white"
            style={{ boxShadow: "0 4px 14px rgba(22,163,74,0.35)" }}
          >
            <Plus size={15} /> Novo projeto
          </Link>
        </div>
      </div>

      {/* Stats */}
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total",        value: orders.length,  color: "#16a34a" },
            { label: "Em andamento", value: inProgress,     color: "#2563eb" },
            { label: "Entregues",    value: delivered,      color: "#9333ea" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border border-line bg-surface px-4 py-3 text-center shadow-sm">
              <p className="text-2xl font-black" style={{ color }}>{value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      {orders.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black transition-colors ${
                filter === key
                  ? "bg-[#16a34a] text-white"
                  : "bg-surface border border-line text-muted hover:text-content"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-3xl border border-line bg-surface p-5 shadow-sm animate-pulse">
              <div className="h-5 w-1/3 rounded-xl bg-subtle-2" />
              <div className="mt-3 h-8 w-1/2 rounded-xl bg-subtle-2" />
              <div className="mt-4 h-2 w-full rounded-full bg-subtle-2" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-5xl">🔍</span>
          <p className="mt-4 text-sm font-black text-content">Nenhum projeto nessa categoria</p>
          <button onClick={() => setFilter("todos")} className="mt-3 text-sm font-bold text-[#16a34a] hover:underline">
            Ver todos
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => <ProjectCard key={order.id} order={order} />)}
        </div>
      )}
    </div>
  );
}

// ─── ProjectCard ──────────────────────────────────────────────────────────────

function ProjectCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const s       = STATUS_COLOR[order.status] ?? STATUS_COLOR[0];
  const accent  = STATUS_ACCENT[order.status] ?? "#16a34a";
  const progress = STATUS_PROGRESS[order.status] ?? 0;
  const isCancelled = order.status === 5;

  const projectName = order.storeName
    ? `Projeto — ${order.storeName}`
    : order.items[0]?.productName ?? "Projeto BrasUX";

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">

      {/* Header gradient */}
      <div
        className="px-5 py-4"
        style={{ background: `linear-gradient(135deg, ${accent}18, ${accent}08)`, borderBottom: `1px solid ${accent}20` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg"
              style={{ background: `${accent}20` }}
            >
              <Rocket size={18} style={{ color: accent }} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                BrasUX · {new Date(order.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
              </p>
              <h3 className="font-black text-content line-clamp-1">{projectName}</h3>
            </div>
          </div>
          <span
            className="shrink-0 rounded-full border px-3 py-1 text-[10px] font-black"
            style={{ background: s.bg, color: s.text, borderColor: s.border }}
          >
            {STATUS_LABEL[order.status]}
          </span>
        </div>

        {/* Progress bar */}
        {!isCancelled && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted">Progresso</span>
              <span className="text-[10px] font-black" style={{ color: accent }}>{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle-2">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, background: accent }}
              />
            </div>
          </div>
        )}

        {/* Timeline steps */}
        {!isCancelled && (
          <div className="mt-4 flex items-start">
            {STEPS.map((step, idx) => {
              const done    = order.status >= step.status;
              const current = order.status === step.status;
              const isLast  = idx === STEPS.length - 1;
              return (
                <div key={step.status} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    <div
                      className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 transition-all ${
                        done ? (current ? "scale-125" : "") : ""
                      }`}
                      style={{
                        borderColor: done ? accent : "#e2e8f0",
                        background:  done ? accent : "var(--color-surface)",
                      }}
                    />
                    {!isLast && (
                      <div
                        className="h-0.5 flex-1"
                        style={{ background: order.status > step.status ? accent : "#e2e8f0" }}
                      />
                    )}
                  </div>
                  <p
                    className="mt-1.5 text-[9px] font-black uppercase tracking-wide"
                    style={{ color: done ? accent : "#cbd5e1" }}
                  >
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Clock size={12} />
            {new Date(order.createdAt).toLocaleDateString("pt-BR")}
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/5500000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold text-[#16a34a] hover:underline"
            >
              <MessageCircle size={12} /> Falar com equipe
            </a>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1 text-xs font-black text-content"
            >
              {open ? <><ChevronUp size={14} /> Ocultar</> : <><ChevronDown size={14} /> Detalhes</>}
            </button>
          </div>
        </div>

        {open && (
          <div className="mt-4 space-y-4 border-t border-subtle-2 pt-4">

            {/* Deliverables */}
            {order.items.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-faint">
                  Entregas do projeto
                </p>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-line bg-subtle p-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base"
                        style={{ background: `${accent}15` }}
                      >
                        <CheckCircle2 size={16} style={{ color: accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-content line-clamp-1">{item.productName}</p>
                        <p className="text-xs text-muted">{item.quantity}× entrega</p>
                      </div>
                      <span className="text-sm font-black shrink-0" style={{ color: accent }}>
                        {formatBRL(item.totalPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Value summary */}
            <div className="rounded-2xl border border-line bg-subtle px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">Valor do projeto</p>
                <p className="text-lg font-black" style={{ color: accent }}>{formatBRL(order.total)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-3xl"
          style={{ background: "linear-gradient(135deg, #16a34a18, #16a34a30)" }}
        >
          <ReceiptText size={40} className="text-[#16a34a]" />
        </div>
        <h2 className="mt-6 text-xl font-black text-content">Nenhum projeto ainda</h2>
        <p className="mt-2 max-w-xs text-sm text-muted">
          Seus projetos contratados aparecerão aqui com atualizações em tempo real.
        </p>
        <Link
          to="/contato"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#16a34a] px-6 py-3 text-sm font-black text-white"
          style={{ boxShadow: "0 4px 16px rgba(22,163,74,0.35)" }}
        >
          Iniciar um projeto <ArrowRight size={15} />
        </Link>
      </div>

      <div>
        <p className="mb-4 text-center text-[11px] font-black uppercase tracking-widest text-faint">
          Cases do portfólio BrasUX
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {SHOWCASE.map((p) => <ShowcaseCard key={p.id} project={p} />)}
        </div>
      </div>
    </div>
  );
}

// ─── ShowcaseCard ─────────────────────────────────────────────────────────────

interface ShowcaseProject {
  id: string; type: string; icon: string; color: string;
  name: string; status: number; value: number;
  tech: string[]; date: string; result: string;
}

function ShowcaseCard({ project: p }: { project: ShowcaseProject }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
      <div
        className="px-4 py-4"
        style={{ background: `linear-gradient(135deg, ${p.color}18, ${p.color}06)`, borderBottom: `1px solid ${p.color}20` }}
      >
        <div className="flex items-center gap-2.5 mb-3">
          <span className="text-2xl">{p.icon}</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: p.color }}>{p.type}</p>
            <p className="text-xs font-black text-content line-clamp-1">{p.name}</p>
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle-2">
          <div className="h-full w-full rounded-full" style={{ background: p.color }} />
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {p.tech.map((t) => (
            <span key={t} className="rounded-lg border border-line bg-subtle px-2 py-0.5 text-[10px] font-bold text-muted">
              {t}
            </span>
          ))}
        </div>
        <p className="text-xs font-black" style={{ color: p.color }}>{p.result}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-faint">{p.date}</span>
          <span className="text-sm font-black text-content">{formatBRL(p.value)}</span>
        </div>
      </div>
    </div>
  );
}
