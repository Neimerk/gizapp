import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Store as StoreIcon, Package, ShoppingBag,
  Shield, ToggleLeft, ToggleRight, Search, ChevronDown,
  LogOut, ArrowLeft, RefreshCw, Clock3, Image as ImageIcon,
  Plus, Pencil, Trash2, Loader2, ExternalLink,
  Tag, Wallet, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { logout } from "../services/auth";
import { useAuthStore, type AuthUser } from "../stores/authStore";
import {
  adminGetUsers, adminToggleUserActive, adminGetAllOrders, adminUpdateOrderStatus, getStores,
  adminGetBanners, adminCreateBanner, adminUpdateBanner, adminDeleteBanner,
  adminGetCoupons, adminCreateCoupon, adminUpdateCoupon, adminDeleteCoupon,
  adminGetWithdrawals, adminUpdateWithdrawal,
  queryKeys,
  type AdminBanner, type BannerPayload,
  type CouponAdmin, type CouponAdminPayload,
} from "../services/gizApi";
import { useToastStore } from "../stores/toastStore";
import { formatBRL } from "../utils/format";

const ROLE_LABEL: Record<string, string> = {
  Admin: "Admin",
  Customer: "Cliente",
  Seller: "Vendedor",
  Courier: "Entregador",
};

const ROLE_COLOR: Record<string, string> = {
  Admin: "bg-[#002776]/15 text-[#002776] border-[#002776]/20",
  Customer: "bg-[#f0fdf4] text-[#15803d] border-[#16a34a]/20",
  Seller: "bg-[#fef9c3] text-[#a16207] border-[#ca8a04]/20",
  Courier: "bg-[#f0f9ff] text-[#0369a1] border-[#0284c7]/20",
};

export default function AdminPage() {
  const navigate = useNavigate();
  const { user: auth, initialized } = useAuthStore();

  useEffect(() => {
    if (initialized && (!auth || auth.role !== "Admin")) {
      navigate("/login", { state: { from: "/admin" }, replace: true });
    }
  }, [initialized, auth, navigate]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#16a34a] border-t-transparent" />
      </div>
    );
  }

  if (!auth || auth.role !== "Admin") return null;

  return <AdminDashboard auth={auth} />;
}

function AdminDashboard({ auth }: { auth: AuthUser }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overview" | "orders" | "users" | "stores" | "banners" | "coupons" | "withdrawals" | "errors" | "audit">("overview");

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f7f9fc]">
      {/* Header */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,39,118,0.10)",
          boxShadow: "0 1px 8px rgba(0,39,118,0.06)",
        }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] hover:text-[#0f172a]"
            >
              <ArrowLeft size={17} />
            </button>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg, #001640, #002776)" }}
            >
              <Shield size={17} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#002776]">BrasUX</p>
              <h1 className="text-base font-black leading-tight text-[#0f172a]">Painel Admin</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-black text-[#0f172a]">{auth.name}</p>
              <p className="text-[10px] text-[#64748b]">{auth.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-xs font-bold text-[#64748b] hover:text-red-500"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-0 md:px-8">
          {([
            { key: "overview",     label: "Visão Geral" },
            { key: "orders",       label: "Pedidos"     },
            { key: "users",        label: "Usuários"    },
            { key: "stores",       label: "Lojas"       },
            { key: "banners",      label: "Banners"     },
            { key: "coupons",      label: "Cupons"      },
            { key: "withdrawals",  label: "Saques"      },
            { key: "errors",       label: "Erros"       },
            { key: "audit",        label: "Auditoria"   },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wide transition-colors ${
                tab === t.key
                  ? "border-[#002776] text-[#002776]"
                  : "border-transparent text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {tab === "overview"    && <OverviewTab />}
        {tab === "orders"      && <OrdersTab />}
        {tab === "users"       && <UsersTab />}
        {tab === "stores"      && <StoresTab />}
        {tab === "banners"     && <BannersTab />}
        {tab === "coupons"     && <CouponsTab />}
        {tab === "withdrawals" && <WithdrawalsTab />}
        {tab === "errors"      && <ErrorsTab />}
        {tab === "audit"       && <AuditTab />}
      </main>
    </div>
  );
}

/* ── OVERVIEW ── */
function OverviewTab() {
  const { data: users = [] } = useQuery({ queryKey: ["admin", "users"], queryFn: adminGetUsers });
  const { data: stores = [] } = useQuery({ queryKey: ["stores"], queryFn: getStores });

  const stats = [
    {
      label: "Usuários",
      value: users.length,
      sub: `${users.filter((u) => u.active).length} ativos`,
      icon: <Users size={20} className="text-[#002776]" />,
      color: "bg-[#002776]/10",
    },
    {
      label: "Lojas",
      value: stores.length,
      sub: `${stores.filter((s) => s.active).length} ativas`,
      icon: <StoreIcon size={20} className="text-[#16a34a]" />,
      color: "bg-[#16a34a]/10",
    },
    {
      label: "Clientes",
      value: users.filter((u) => u.role === "Customer").length,
      sub: "cadastrados",
      icon: <ShoppingBag size={20} className="text-[#0369a1]" />,
      color: "bg-[#0369a1]/10",
    },
    {
      label: "Vendedores",
      value: users.filter((u) => u.role === "Seller").length,
      sub: "vinculados a lojas",
      icon: <Package size={20} className="text-[#a16207]" />,
      color: "bg-[#a16207]/10",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-3xl border border-[#e8eaf0] bg-white p-6 shadow-sm">
            <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl ${s.color}`}>
              {s.icon}
            </div>
            <p className="text-3xl font-black text-[#0f172a]">{s.value}</p>
            <p className="mt-0.5 text-sm font-bold text-[#0f172a]">{s.label}</p>
            <p className="text-xs text-[#94a3b8]">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Role breakdown */}
      <div className="rounded-3xl border border-[#e8eaf0] bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-black uppercase tracking-wide text-[#64748b]">Distribuição por perfil</h2>
        <div className="space-y-3">
          {(["Admin", "Seller", "Customer", "Courier"] as const).map((role) => {
            const count = users.filter((u) => u.role === role).length;
            const pct = users.length ? Math.round((count / users.length) * 100) : 0;
            return (
              <div key={role} className="flex items-center gap-3">
                <span className={`w-20 shrink-0 rounded-full border px-2 py-0.5 text-center text-[10px] font-black ${ROLE_COLOR[role]}`}>
                  {ROLE_LABEL[role]}
                </span>
                <div className="flex-1 overflow-hidden rounded-full bg-[#f1f5f9]">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: role === "Admin" ? "#002776" : role === "Seller" ? "#ca8a04" : role === "Customer" ? "#16a34a" : "#0284c7",
                    }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-black text-[#0f172a]">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Last registered users */}
      <div className="rounded-3xl border border-[#e8eaf0] bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-black uppercase tracking-wide text-[#64748b]">Últimos cadastros</h2>
        <div className="divide-y divide-[#f1f5f9]">
          {[...users].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8).map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                style={{ background: "linear-gradient(135deg, #001640, #002776)" }}
              >
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-[#0f172a]">{u.name}</p>
                <p className="truncate text-xs text-[#64748b]">{u.email}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${ROLE_COLOR[u.role]}`}>
                {ROLE_LABEL[u.role]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── ORDERS ── */
const ORDER_STATUS_LABEL: Record<number, string> = {
  0: "Recebido", 1: "Aceito", 2: "Preparando", 3: "Saiu p/ entrega", 4: "Entregue", 5: "Cancelado",
};
const ORDER_STATUS_COLOR: Record<number, string> = {
  0: "bg-yellow-50 text-yellow-700 border-yellow-200",
  1: "bg-purple-50 text-purple-700 border-purple-200",
  2: "bg-blue-50 text-blue-700 border-blue-200",
  3: "bg-orange-50 text-orange-700 border-orange-200",
  4: "bg-green-50 text-green-700 border-green-200",
  5: "bg-red-50 text-red-600 border-red-200",
};
const NEXT_STATUS: Record<number, number> = { 0: 1, 1: 2, 2: 3, 3: 4 };
const NEXT_LABEL: Record<number, string> = {
  0: "Aceitar", 1: "Preparando", 2: "Saiu p/ entrega", 3: "Confirmar entrega",
};

function OrdersTab() {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: orders = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: queryKeys.adminOrders(),
    queryFn: adminGetAllOrders,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: number }) => adminUpdateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminOrders() });
      show("Status atualizado.", "success");
    },
    onError: () => show("Erro ao atualizar status.", "error"),
  });

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === "all" || o.status === Number(statusFilter);
    const q = search.toLowerCase();
    const matchSearch = !q || o.id.toLowerCase().includes(q) ||
      (o.storeName ?? "").toLowerCase().includes(q) ||
      o.deliveryAddress.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const gmv = orders.filter((o) => o.status === 4).reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total de pedidos", value: orders.length, color: "#002776" },
          { label: "Em andamento", value: orders.filter((o) => o.status < 4 && o.status !== 5).length, color: "#f59e0b" },
          { label: "Entregues", value: orders.filter((o) => o.status === 4).length, color: "#16a34a" },
          { label: "GMV", value: formatBRL(gmv), color: "#7c3aed" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
            <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-[#64748b]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 shadow-sm min-w-48 focus-within:border-[#002776]/30">
          <Search size={15} className="shrink-0 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID, loja, endereço…"
            className="flex-1 bg-transparent text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 pr-8 text-sm font-bold text-[#0f172a] shadow-sm outline-none"
          >
            <option value="all">Todos os status</option>
            {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-bold text-[#64748b] shadow-sm hover:bg-[#f8fafc] disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /> Atualizar
        </button>
        <span className="flex items-center rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-bold text-[#64748b] shadow-sm">
          {filtered.length} pedido{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-[#e8eaf0] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-[#94a3b8]">Carregando pedidos…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#94a3b8]">
            {orders.length === 0 ? "Nenhum pedido ainda." : "Nenhum pedido encontrado."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f1f5f9]">
                  {["Pedido", "Loja", "Valor", "Pagamento", "Endereço", "Data", "Status", "Ação"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f8fafc]">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-black text-[#0f172a]">#{o.id.slice(0, 8)}</p>
                      <p className="text-[10px] text-[#94a3b8]">{o.items.length} item{o.items.length !== 1 ? "s" : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-[#0f172a]">{o.storeName ?? "—"}</td>
                    <td className="px-4 py-3 text-sm font-black text-[#16a34a]">{formatBRL(Number(o.total))}</td>
                    <td className="px-4 py-3 text-xs text-[#64748b] uppercase">{o.paymentMethod}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-[#0f172a]">{o.deliveryAddress}, {o.deliveryNumber}</p>
                      <p className="text-[10px] text-[#94a3b8]">{o.deliveryNeighborhood}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-[10px] text-[#94a3b8]">
                        <Clock3 size={10} />
                        {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black ${ORDER_STATUS_COLOR[o.status]}`}>
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {NEXT_STATUS[o.status] !== undefined && (
                        <button
                          onClick={() => updateMutation.mutate({ id: o.id, status: NEXT_STATUS[o.status] })}
                          disabled={updateMutation.isPending}
                          className="rounded-xl border border-[#002776]/20 bg-[#002776]/5 px-3 py-1.5 text-[11px] font-black text-[#002776] hover:bg-[#002776]/10 disabled:opacity-50"
                        >
                          {NEXT_LABEL[o.status]}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── USERS ── */
function UsersTab() {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: adminGetUsers,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminToggleUserActive(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      show("Usuário atualizado.", "success");
    },
    onError: () => show("Erro ao atualizar usuário.", "error"),
  });

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 shadow-sm min-w-48 focus-within:border-[#002776]/30">
          <Search size={15} className="shrink-0 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome ou email…"
            className="flex-1 bg-transparent text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
          />
        </div>
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="appearance-none rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 pr-8 text-sm font-bold text-[#0f172a] shadow-sm outline-none"
          >
            <option value="all">Todos os perfis</option>
            <option value="Admin">Admin</option>
            <option value="Customer">Cliente</option>
            <option value="Seller">Vendedor</option>
            <option value="Courier">Entregador</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
        </div>
        <span className="flex items-center rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-bold text-[#64748b] shadow-sm">
          {filtered.length} usuário{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-[#e8eaf0] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-[#94a3b8]">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#94a3b8]">Nenhum usuário encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f1f5f9]">
                  {["Usuário", "Perfil", "Loja", "Status", "Ação"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f8fafc]">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white"
                          style={{ background: "linear-gradient(135deg, #001640, #002776)" }}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-[#0f172a]">{u.name}</p>
                          <p className="text-[11px] text-[#94a3b8]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black ${ROLE_COLOR[u.role]}`}>
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-[#64748b]">{u.store?.name ?? "—"}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${u.active ? "bg-[#f0fdf4] text-[#16a34a]" : "bg-[#fef2f2] text-red-500"}`}>
                        {u.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.role !== "Admin" && (
                        <button
                          onClick={() => toggleMutation.mutate({ id: u.id, active: !u.active })}
                          disabled={toggleMutation.isPending}
                          className="flex items-center gap-1.5 rounded-xl border border-[#e2e8f0] px-3 py-1.5 text-[11px] font-black text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50"
                        >
                          {u.active
                            ? <><ToggleRight size={14} className="text-[#16a34a]" /> Desativar</>
                            : <><ToggleLeft size={14} className="text-red-400" /> Ativar</>}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── BANNERS ── */

const EMPTY_BANNER: BannerPayload = {
  title: "", description: "", imageUrl: "", link: "", linkLabel: "",
  badge: "", active: true, sortOrder: 0, startsAt: null, endsAt: null,
};

function BannerModal({
  banner,
  onClose,
  onSave,
}: {
  banner?: AdminBanner | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState<BannerPayload>(
    banner
      ? {
          title:       banner.title,
          description: banner.description ?? "",
          imageUrl:    banner.imageUrl,
          link:        banner.link ?? "",
          linkLabel:   banner.linkLabel ?? "",
          badge:       banner.badge ?? "",
          active:      banner.active,
          sortOrder:   banner.sortOrder,
          startsAt:    banner.startsAt?.slice(0, 16) ?? null,
          endsAt:      banner.endsAt?.slice(0, 16) ?? null,
        }
      : EMPTY_BANNER,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  function set(k: keyof BannerPayload, v: unknown) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const ALLOWED_LINK_DOMAINS = ["brasux.com.br", "shopping.brasux.com.br"];

  function validateLink(link: string | undefined): boolean {
    if (!link) return true;
    // Relativo (começa com /) → sempre permitido
    if (link.startsWith("/")) return true;
    // Absoluto → verificar domínio
    try {
      const host = new URL(link).hostname;
      return ALLOWED_LINK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
    } catch {
      return false;
    }
  }

  async function handleSave() {
    if (!form.title.trim()) { setError("Título é obrigatório."); return; }
    if (!form.imageUrl.trim()) { setError("URL da imagem é obrigatória."); return; }
    if (form.link && !validateLink(form.link)) {
      setError("Link inválido. Use um caminho relativo (/lojas) ou domínio brasux.com.br.");
      return;
    }
    setSaving(true); setError(null);
    const payload: BannerPayload = {
      ...form,
      description: form.description || undefined,
      link:        form.link        || undefined,
      linkLabel:   form.linkLabel   || undefined,
      badge:       form.badge       || undefined,
    };
    try {
      if (banner) await adminUpdateBanner(banner.id, payload);
      else        await adminCreateBanner(payload);
      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f1f5f9] px-5 py-4">
          <h2 className="font-black text-[#0f172a]">{banner ? "Editar banner" : "Novo banner"}</h2>
          <button onClick={onClose} className="rounded-xl bg-[#f1f5f9] p-2 text-[#64748b]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-5">
          {/* Preview da imagem */}
          {form.imageUrl && (
            <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: "21/9" }}>
              <img src={form.imageUrl} alt="Preview" className="h-full w-full object-cover"
                onError={(e) => { e.currentTarget.style.display = "none"; }} />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />
              {form.badge && (
                <span className="absolute left-3 top-3 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur-sm">
                  {form.badge}
                </span>
              )}
              {form.title && (
                <p className="absolute bottom-3 left-3 text-base font-black text-white drop-shadow-sm">{form.title}</p>
              )}
            </div>
          )}

          <div>
            <label className={lbl}>Título *</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex: Ofertas da semana" className={inp} />
          </div>
          <div>
            <label className={lbl}>Descrição</label>
            <input value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Texto complementar (opcional)" className={inp} />
          </div>
          <div>
            <label className={lbl}>URL da imagem *</label>
            <input value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://..." className={inp} />
            <p className="mt-1 text-[10px] text-[#94a3b8]">Recomendado: 1200×514px (proporção 21:9)</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Link (opcional)</label>
              <input value={form.link ?? ""} onChange={(e) => set("link", e.target.value)} placeholder="/lojas ou https://..." className={inp} />
            </div>
            <div>
              <label className={lbl}>Texto do botão</label>
              <input value={form.linkLabel ?? ""} onChange={(e) => set("linkLabel", e.target.value)} placeholder="Ex: Ver ofertas" className={inp} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Badge</label>
              <input value={form.badge ?? ""} onChange={(e) => set("badge", e.target.value)} placeholder="🔥 Oferta do dia" className={inp} />
            </div>
            <div>
              <label className={lbl}>Ordem</label>
              <input type="number" min="0" value={form.sortOrder ?? 0} onChange={(e) => set("sortOrder", Number(e.target.value))} className={inp} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Início (opcional)</label>
              <input type="datetime-local" value={form.startsAt ?? ""} onChange={(e) => set("startsAt", e.target.value || null)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Fim (opcional)</label>
              <input type="datetime-local" value={form.endsAt ?? ""} onChange={(e) => set("endsAt", e.target.value || null)} className={inp} />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
            <input
              type="checkbox"
              id="banner-active"
              checked={form.active ?? true}
              onChange={(e) => set("active", e.target.checked)}
              className="h-4 w-4 accent-[#16a34a]"
            />
            <label htmlFor="banner-active" className="cursor-pointer text-sm font-black text-[#0f172a]">
              Banner ativo (aparece na home)
            </label>
          </div>

          {error && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}
        </div>

        <div className="border-t border-[#f1f5f9] p-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #002776, #001640)" }}
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando…</> : "Salvar banner"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BannersTab() {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  const [modal, setModal] = useState<{ open: boolean; banner?: AdminBanner | null }>({ open: false });

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["admin", "banners"],
    queryFn:  adminGetBanners,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteBanner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.banners() });
      show("Banner excluído.", "success");
    },
    onError: () => show("Erro ao excluir banner.", "error"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminUpdateBanner(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.banners() });
    },
  });

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.banners() });
    show("Banner salvo!", "success");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-black text-[#0f172a]">{banners.length} banner{banners.length !== 1 ? "s" : ""}</p>
          <p className="text-xs text-[#94a3b8]">Banners aparecem no topo da Home para todos os usuários.</p>
        </div>
        <button
          onClick={() => setModal({ open: true, banner: null })}
          className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black text-white"
          style={{ background: "linear-gradient(135deg, #002776, #001640)" }}
        >
          <Plus size={16} /> Novo banner
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[#002776]" />
        </div>
      ) : banners.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-[#e2e8f0] bg-white p-16 text-center">
          <ImageIcon size={36} className="text-[#cbd5e1]" />
          <div>
            <p className="font-black text-[#0f172a]">Nenhum banner configurado</p>
            <p className="mt-1 text-sm text-[#64748b]">Crie o primeiro banner para exibir na Home.</p>
          </div>
          <button
            onClick={() => setModal({ open: true, banner: null })}
            className="rounded-2xl px-6 py-3 text-sm font-black text-white"
            style={{ background: "linear-gradient(135deg, #002776, #001640)" }}
          >
            <Plus size={14} className="inline mr-1.5" /> Criar banner
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <div key={b.id} className="flex items-center gap-4 rounded-3xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
              {/* Thumbnail */}
              <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-2xl bg-[#f1f5f9]">
                <img src={b.imageUrl} alt={b.title} className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
                {!b.active && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="text-[10px] font-black text-white">INATIVO</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-black text-[#0f172a]">{b.title}</p>
                  {b.badge && (
                    <span className="shrink-0 rounded-full bg-[#f0f9ff] px-2 py-0.5 text-[10px] font-black text-[#0369a1]">
                      {b.badge}
                    </span>
                  )}
                </div>
                {b.description && <p className="mt-0.5 truncate text-xs text-[#64748b]">{b.description}</p>}
                <div className="mt-1 flex items-center gap-3 text-[10px] text-[#94a3b8]">
                  <span>Ordem: {b.sortOrder}</span>
                  {b.link && (
                    <span className="flex items-center gap-1 truncate">
                      <ExternalLink size={10} /> {b.link}
                    </span>
                  )}
                  {b.startsAt && <span>De {new Date(b.startsAt).toLocaleDateString("pt-BR")}</span>}
                  {b.endsAt   && <span>até {new Date(b.endsAt).toLocaleDateString("pt-BR")}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => toggleMutation.mutate({ id: b.id, active: !b.active })}
                  disabled={toggleMutation.isPending}
                  className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 text-[11px] font-black transition-colors ${
                    b.active
                      ? "border-[#16a34a]/30 bg-[#f0fdf4] text-[#16a34a]"
                      : "border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8]"
                  }`}
                >
                  {b.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {b.active ? "Ativo" : "Inativo"}
                </button>
                <button
                  onClick={() => setModal({ open: true, banner: b })}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc]"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => { if (confirm(`Excluir "${b.title}"?`)) deleteMutation.mutate(b.id); }}
                  disabled={deleteMutation.isPending}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <BannerModal
          banner={modal.banner}
          onClose={() => setModal({ open: false })}
          onSave={handleSaved}
        />
      )}
    </div>
  );
}

const inp = "w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#0f172a] outline-none focus:ring-2 focus:ring-[#002776]/20 placeholder:text-[#cbd5e1]";
const lbl = "mb-1.5 block text-[10px] font-black uppercase tracking-wide text-[#94a3b8]";

/* ── COUPONS ── */

const COUPON_TYPE_LABEL: Record<string, string> = {
  percent:       "% Desconto",
  fixed:         "R$ Fixo",
  free_delivery: "Frete Grátis",
};

const EMPTY_COUPON: CouponAdminPayload = {
  code: "", type: "percent", value: 10, label: "", minOrder: 0,
  maxUses: null, expiresAt: null, active: true,
};

function CouponModal({
  coupon, onClose, onSave,
}: { coupon?: CouponAdmin | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState<CouponAdminPayload>(
    coupon
      ? {
          code:      coupon.code,
          type:      coupon.type,
          value:     coupon.value,
          label:     coupon.label,
          minOrder:  coupon.minOrder,
          maxUses:   coupon.maxUses ?? null,
          expiresAt: coupon.expiresAt?.slice(0, 16) ?? null,
          active:    coupon.active,
        }
      : EMPTY_COUPON,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  function set(k: keyof CouponAdminPayload, v: unknown) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!form.code.trim()) { setError("Código é obrigatório."); return; }
    if (!form.label.trim()) { setError("Descrição é obrigatória."); return; }
    if (form.value <= 0)    { setError("Valor deve ser maior que zero."); return; }
    setSaving(true); setError(null);
    try {
      if (coupon) await adminUpdateCoupon(coupon.id, form);
      else        await adminCreateCoupon(form);
      onSave(); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f1f5f9] px-5 py-4">
          <h2 className="font-black text-[#0f172a]">{coupon ? "Editar cupom" : "Novo cupom"}</h2>
          <button onClick={onClose} className="rounded-xl bg-[#f1f5f9] p-2 text-[#64748b]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Código *</label>
              <input
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="EX: BRASUX20"
                className={`${inp} font-mono`}
              />
            </div>
            <div>
              <label className={lbl}>Tipo *</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className={inp}>
                <option value="percent">% Desconto</option>
                <option value="fixed">R$ Fixo</option>
                <option value="free_delivery">Frete Grátis</option>
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Descrição *</label>
            <input value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="Ex: 20% de desconto" className={inp} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>
                {form.type === "percent" ? "Valor (%)" : form.type === "fixed" ? "Valor (R$)" : "Cobertura (%)"}
              </label>
              <input
                type="number" min="0" step="0.01"
                value={form.value}
                onChange={(e) => set("value", Number(e.target.value))}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Pedido mínimo (R$)</label>
              <input
                type="number" min="0" step="0.01"
                value={form.minOrder ?? 0}
                onChange={(e) => set("minOrder", Number(e.target.value))}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Máx de usos</label>
              <input
                type="number" min="1" placeholder="∞ Ilimitado"
                value={form.maxUses ?? ""}
                onChange={(e) => set("maxUses", e.target.value ? Number(e.target.value) : null)}
                className={inp}
              />
            </div>
          </div>

          <div>
            <label className={lbl}>Validade (opcional)</label>
            <input
              type="datetime-local"
              value={form.expiresAt ?? ""}
              onChange={(e) => set("expiresAt", e.target.value || null)}
              className={inp}
            />
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
            <input
              type="checkbox" id="coupon-active"
              checked={form.active ?? true}
              onChange={(e) => set("active", e.target.checked)}
              className="h-4 w-4 accent-[#16a34a]"
            />
            <label htmlFor="coupon-active" className="cursor-pointer text-sm font-black text-[#0f172a]">
              Cupom ativo (aceito no checkout)
            </label>
          </div>

          {error && (
            <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>
          )}
        </div>

        <div className="border-t border-[#f1f5f9] p-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #002776, #001640)" }}
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando…</> : "Salvar cupom"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CouponsTab() {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  const [modal, setModal] = useState<{ open: boolean; coupon?: CouponAdmin | null }>({ open: false });

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: queryKeys.adminCoupons(),
    queryFn:  adminGetCoupons,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminUpdateCoupon(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.adminCoupons() }),
    onError: () => show("Erro ao atualizar cupom.", "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminCoupons() });
      show("Cupom excluído.", "success");
    },
    onError: () => show("Erro ao excluir cupom.", "error"),
  });

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: queryKeys.adminCoupons() });
    show("Cupom salvo!", "success");
  }

  const totalUses = coupons.reduce((s, c) => s + c.usesCount, 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total de cupons", value: coupons.length, color: "#002776" },
          { label: "Cupons ativos",   value: coupons.filter((c) => c.active).length, color: "#16a34a" },
          { label: "Total de usos",   value: totalUses, color: "#7c3aed" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-[#64748b]">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#64748b]">{coupons.length} cupom{coupons.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setModal({ open: true, coupon: null })}
          className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black text-white"
          style={{ background: "linear-gradient(135deg, #002776, #001640)" }}
        >
          <Plus size={16} /> Novo cupom
        </button>
      </div>

      <div className="rounded-3xl border border-[#e8eaf0] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-[#94a3b8]">Carregando…</div>
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center gap-4 p-16 text-center">
            <Tag size={36} className="text-[#cbd5e1]" />
            <p className="font-black text-[#0f172a]">Nenhum cupom cadastrado</p>
            <button
              onClick={() => setModal({ open: true, coupon: null })}
              className="rounded-2xl px-6 py-3 text-sm font-black text-white"
              style={{ background: "linear-gradient(135deg, #002776, #001640)" }}
            >
              Criar primeiro cupom
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f1f5f9]">
                  {["Código", "Tipo", "Valor", "Mín. Pedido", "Usos", "Validade", "Status", "Ações"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f8fafc]">
                {coupons.map((c) => {
                  const expired = c.expiresAt ? new Date(c.expiresAt) < new Date() : false;
                  const exhausted = c.maxUses != null && c.usesCount >= c.maxUses;
                  return (
                    <tr key={c.id} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-black text-[#0f172a]">{c.code}</span>
                        <p className="text-[10px] text-[#94a3b8]">{c.label}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-[#f0f9ff] px-2.5 py-1 text-[10px] font-black text-[#0369a1]">
                          {COUPON_TYPE_LABEL[c.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-black text-[#0f172a]">
                        {c.type === "percent" ? `${c.value}%` : c.type === "fixed" ? formatBRL(c.value) : "100%"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#64748b]">
                        {c.minOrder > 0 ? formatBRL(c.minOrder) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-black ${exhausted ? "text-red-500" : "text-[#0f172a]"}`}>
                          {c.usesCount}
                          {c.maxUses != null && <span className="text-[#94a3b8]">/{c.maxUses}</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.expiresAt ? (
                          <span className={`text-xs font-bold ${expired ? "text-red-500" : "text-[#64748b]"}`}>
                            {new Date(c.expiresAt).toLocaleDateString("pt-BR")}
                            {expired && " ⚠️"}
                          </span>
                        ) : (
                          <span className="text-xs text-[#94a3b8]">Sem prazo</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleMutation.mutate({ id: c.id, active: !c.active })}
                          disabled={toggleMutation.isPending}
                          className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] font-black ${
                            c.active && !expired && !exhausted
                              ? "border-[#16a34a]/30 bg-[#f0fdf4] text-[#16a34a]"
                              : "border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8]"
                          }`}
                        >
                          {c.active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                          {c.active ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setModal({ open: true, coupon: c })}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc]"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => { if (confirm(`Excluir cupom "${c.code}"?`)) deleteMutation.mutate(c.id); }}
                            disabled={deleteMutation.isPending}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-500 hover:bg-red-100"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && (
        <CouponModal
          coupon={modal.coupon}
          onClose={() => setModal({ open: false })}
          onSave={handleSaved}
        />
      )}
    </div>
  );
}

/* ── WITHDRAWALS ── */

function WithdrawalsTab() {
  const queryClient = useQueryClient();
  const show = useToastStore((s) => s.show);
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data: withdrawals = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.adminWithdrawals(),
    queryFn:  adminGetWithdrawals,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: "PAID" | "REJECTED"; note?: string }) =>
      adminUpdateWithdrawal(id, status, note),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminWithdrawals() });
      show(vars.status === "PAID" ? "Saque aprovado! ✅" : "Saque rejeitado.", "success");
      setRejectId(null);
      setRejectNote("");
    },
    onError: () => show("Erro ao atualizar saque.", "error"),
  });

  const filtered = filter === "PENDING" ? withdrawals.filter((w) => w.status === "PENDING") : withdrawals;
  const pendingTotal = withdrawals.filter((w) => w.status === "PENDING").reduce((s, w) => s + w.amount, 0);

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pendentes",   value: withdrawals.filter((w) => w.status === "PENDING").length,  color: "#f59e0b" },
          { label: "Valor pendente", value: formatBRL(pendingTotal), color: "#002776" },
          { label: "Total pago",  value: formatBRL(withdrawals.filter((w) => w.status === "PAID").reduce((s, w) => s + w.amount, 0)), color: "#16a34a" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
            <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-[#64748b]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        {(["PENDING", "ALL"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-xl px-4 py-2 text-xs font-black transition-colors ${
              filter === f ? "bg-[#0f172a] text-white" : "border border-[#e2e8f0] bg-white text-[#64748b]"
            }`}
          >
            {f === "PENDING" ? `Pendentes (${withdrawals.filter((w) => w.status === "PENDING").length})` : "Todos"}
          </button>
        ))}
        <button onClick={() => refetch()} className="ml-auto text-[#64748b] hover:text-[#0f172a]">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-3xl border border-[#e8eaf0] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-[#94a3b8]">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Wallet size={36} className="text-[#cbd5e1]" />
            <p className="font-black text-[#0f172a]">
              {filter === "PENDING" ? "Nenhum saque pendente 🎉" : "Nenhum saque registrado"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f1f5f9]">
                  {["Entregador", "Valor", "Chave Pix", "Status", "Data", "Ações"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f8fafc]">
                {filtered.map((w) => (
                  <>
                    <tr key={w.id} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f0f9ff] text-xs font-black text-[#0369a1]">
                            {w.courierName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-black text-[#0f172a]">{w.courierName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-base font-black text-[#16a34a]">
                        {formatBRL(w.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-[#64748b]">{w.pixKey}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                          w.status === "PAID"     ? "bg-green-50 text-green-700" :
                          w.status === "REJECTED" ? "bg-red-50 text-red-600"    :
                          "bg-yellow-50 text-yellow-700"
                        }`}>
                          {w.status === "PAID" ? "✓ Pago" : w.status === "REJECTED" ? "Rejeitado" : "Pendente"}
                        </span>
                        {w.note && <p className="mt-0.5 text-[10px] text-[#94a3b8] italic">{w.note}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#64748b]">
                        {new Date(w.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        {w.status === "PENDING" && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => updateMutation.mutate({ id: w.id, status: "PAID" })}
                              disabled={updateMutation.isPending}
                              className="flex items-center gap-1 rounded-xl border border-green-200 bg-green-50 px-3 py-1.5 text-[11px] font-black text-green-700 hover:bg-green-100 disabled:opacity-50"
                            >
                              <CheckCircle2 size={12} /> Aprovar
                            </button>
                            <button
                              onClick={() => setRejectId(w.id)}
                              className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-black text-red-600 hover:bg-red-100"
                            >
                              <XCircle size={12} /> Rejeitar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Inline reject form */}
                    {rejectId === w.id && (
                      <tr key={`${w.id}-reject`}>
                        <td colSpan={6} className="bg-red-50 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <input
                              value={rejectNote}
                              onChange={(e) => setRejectNote(e.target.value)}
                              placeholder="Motivo da rejeição (obrigatório)…"
                              className="flex-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-[#0f172a] outline-none"
                            />
                            <button
                              onClick={() => {
                                if (!rejectNote.trim()) return;
                                updateMutation.mutate({ id: w.id, status: "REJECTED", note: rejectNote });
                              }}
                              disabled={!rejectNote.trim() || updateMutation.isPending}
                              className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                            >
                              Confirmar rejeição
                            </button>
                            <button
                              onClick={() => { setRejectId(null); setRejectNote(""); }}
                              className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-xs font-bold text-[#64748b]"
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── STORES ── */
function StoresTab() {
  const [search, setSearch] = useState("");

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: getStores,
  });

  const filtered = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 shadow-sm focus-within:border-[#002776]/30">
          <Search size={15} className="shrink-0 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar loja ou categoria…"
            className="flex-1 bg-transparent text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
          />
        </div>
        <span className="flex items-center rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-bold text-[#64748b] shadow-sm">
          {filtered.length} loja{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="rounded-3xl border border-[#e8eaf0] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-[#94a3b8]">Carregando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f1f5f9]">
                  {["Loja", "Categoria", "Entrega", "Taxa", "Avaliação", "Status"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f8fafc]">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-black text-[#0f172a]">{s.name}</p>
                        {s.description && (
                          <p className="max-w-xs truncate text-[11px] text-[#94a3b8]">{s.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#64748b]">{s.category.split(",")[0]}</td>
                    <td className="px-5 py-3.5 text-xs font-bold text-[#0f172a]">{s.deliveryTimeMin}–{s.deliveryTimeMax}min</td>
                    <td className="px-5 py-3.5 text-xs font-bold text-[#0f172a]">
                      {Number(s.deliveryFee) === 0 ? "Grátis" : `R$ ${Number(s.deliveryFee).toFixed(2).replace(".", ",")}`}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-bold text-[#0f172a]">⭐ {Number(s.rating).toFixed(1)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span className={`w-fit rounded-full px-2.5 py-0.5 text-[10px] font-black ${s.isOpen ? "bg-[#f0fdf4] text-[#16a34a]" : "bg-[#f1f5f9] text-[#94a3b8]"}`}>
                          {s.isOpen ? "Aberto" : "Fechado"}
                        </span>
                        <span className={`w-fit rounded-full px-2.5 py-0.5 text-[10px] font-black ${s.active ? "bg-[#f0fdf4] text-[#16a34a]" : "bg-[#fef2f2] text-red-400"}`}>
                          {s.active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── ERRORS ── */

type ErrorLog = {
  id: string;
  created_at: string;
  error_type: "uncaught" | "unhandledrejection" | "react";
  message: string;
  stack?: string;
  url?: string;
  user_id?: string;
  user_agent?: string;
  extra?: Record<string, unknown>;
};

const ERROR_TYPE_COLOR: Record<string, string> = {
  uncaught:            "bg-red-50 text-red-700 border-red-200",
  unhandledrejection:  "bg-orange-50 text-orange-700 border-orange-200",
  react:               "bg-purple-50 text-purple-700 border-purple-200",
};

function ErrorsTab() {
  const [errors, setErrors]     = useState<ErrorLog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | ErrorLog["error_type"]>("all");

  async function load() {
    setLoading(true);
    const { supabase } = await import("../lib/supabase");
    const { data } = await supabase
      .from("error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setErrors((data ?? []) as ErrorLog[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = typeFilter === "all" ? errors : errors.filter((e) => e.error_type === typeFilter);

  const counts = {
    uncaught:            errors.filter((e) => e.error_type === "uncaught").length,
    unhandledrejection:  errors.filter((e) => e.error_type === "unhandledrejection").length,
    react:               errors.filter((e) => e.error_type === "react").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total (últimos 100)", value: errors.length,             color: "#0f172a" },
          { label: "JS (uncaught)",        value: counts.uncaught,           color: "#dc2626" },
          { label: "Promises rejeitadas",  value: counts.unhandledrejection,  color: "#ea580c" },
          { label: "React (boundaries)",   value: counts.react,              color: "#9333ea" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-[#64748b]">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {([
          { key: "all",                label: "Todos"   },
          { key: "uncaught",           label: "JS"      },
          { key: "unhandledrejection", label: "Promise" },
          { key: "react",              label: "React"   },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            className={`rounded-xl px-3 py-1.5 text-xs font-black transition-colors ${
              typeFilter === f.key ? "bg-[#0f172a] text-white" : "border border-[#e2e8f0] bg-white text-[#64748b]"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button onClick={load} className="ml-auto rounded-xl border border-[#e2e8f0] bg-white p-2 text-[#64748b] hover:text-[#0f172a]">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="rounded-3xl border border-[#e8eaf0] bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 size={24} className="animate-spin text-[#002776]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#f0fdf4]">
              <AlertTriangle size={28} className="text-[#16a34a]" />
            </div>
            <p className="font-black text-[#0f172a]">Nenhum erro registrado</p>
            <p className="text-sm text-[#64748b]">Erros de JavaScript e React aparecem aqui em tempo real.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {filtered.map((e) => (
              <div key={e.id} className="p-4">
                <div
                  className="flex cursor-pointer items-start gap-3"
                  onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                >
                  <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${ERROR_TYPE_COLOR[e.error_type]}`}>
                    {e.error_type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#0f172a]">{e.message}</p>
                    <div className="mt-0.5 flex items-center gap-3 text-[10px] text-[#94a3b8]">
                      <span className="flex items-center gap-1">
                        <Clock3 size={10} />
                        {new Date(e.created_at).toLocaleString("pt-BR")}
                      </span>
                      {e.url && (
                        <span className="max-w-[200px] truncate">
                          {e.url.replace(/^https?:\/\/[^/]+/, "")}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`mt-1 shrink-0 text-[#94a3b8] transition-transform ${expanded === e.id ? "rotate-180" : ""}`}
                  />
                </div>

                {expanded === e.id && (
                  <div className="mt-3 space-y-2 pl-20">
                    {e.stack && (
                      <pre className="overflow-x-auto rounded-xl bg-[#0f172a] p-3 text-[10px] leading-relaxed text-[#94a3b8] whitespace-pre-wrap">
                        {e.stack}
                      </pre>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {e.user_id && (
                        <div className="rounded-xl bg-[#f8fafc] p-2">
                          <p className="font-black text-[#64748b]">Usuário</p>
                          <p className="font-mono text-[#0f172a]">{e.user_id.slice(0, 16)}…</p>
                        </div>
                      )}
                      {e.user_agent && (
                        <div className="rounded-xl bg-[#f8fafc] p-2">
                          <p className="font-black text-[#64748b]">Browser</p>
                          <p className="truncate text-[#0f172a]">{e.user_agent.split(" ").slice(-1)[0]}</p>
                        </div>
                      )}
                    </div>
                    {e.extra && (
                      <pre className="overflow-x-auto rounded-xl bg-[#f8fafc] p-3 text-[10px] text-[#64748b]">
                        {JSON.stringify(e.extra, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── AUDIT ── */

type AuditLog = {
  id: string;
  created_at: string;
  user_id?: string;
  action: string;
  table_name?: string;
  record_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
};

const AUDIT_ACTION_COLOR: Record<string, string> = {
  ADMIN_LOGIN:  "bg-blue-50 text-blue-700 border-blue-200",
  DELETE:       "bg-red-50 text-red-700 border-red-200",
  UPDATE:       "bg-yellow-50 text-yellow-700 border-yellow-200",
  INSERT:       "bg-green-50 text-green-700 border-green-200",
};

function AuditTab() {
  const [logs, setLogs]         = useState<AuditLog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("all");

  async function load() {
    setLoading(true);
    const { supabase } = await import("../lib/supabase");
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setLogs((data ?? []) as AuditLog[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const actions = [...new Set(logs.map((l) => l.action))];
  const filtered = actionFilter === "all" ? logs : logs.filter((l) => l.action === actionFilter);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total de eventos", value: logs.length,                                              color: "#0f172a" },
          { label: "Logins admin",     value: logs.filter((l) => l.action === "ADMIN_LOGIN").length,    color: "#2563eb" },
          { label: "Deleções",         value: logs.filter((l) => l.action === "DELETE").length,         color: "#dc2626" },
          { label: "Atualizações",     value: logs.filter((l) => l.action === "UPDATE").length,         color: "#d97706" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-sm">
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-[#64748b]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActionFilter("all")}
          className={`rounded-xl px-3 py-1.5 text-xs font-black transition-colors ${
            actionFilter === "all" ? "bg-[#0f172a] text-white" : "border border-[#e2e8f0] bg-white text-[#64748b]"
          }`}
        >
          Todos
        </button>
        {actions.map((a) => (
          <button
            key={a}
            onClick={() => setActionFilter(a)}
            className={`rounded-xl px-3 py-1.5 text-xs font-black transition-colors ${
              actionFilter === a ? "bg-[#0f172a] text-white" : "border border-[#e2e8f0] bg-white text-[#64748b]"
            }`}
          >
            {a}
          </button>
        ))}
        <button onClick={load} className="ml-auto rounded-xl border border-[#e2e8f0] bg-white p-2 text-[#64748b] hover:text-[#0f172a]">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Lista */}
      <div className="rounded-3xl border border-[#e8eaf0] bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 size={24} className="animate-spin text-[#002776]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-sm text-[#94a3b8]">Nenhum evento de auditoria registrado.</div>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {filtered.map((l) => (
              <div key={l.id} className="p-4">
                <div
                  className="flex cursor-pointer items-center gap-3"
                  onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                >
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${AUDIT_ACTION_COLOR[l.action] ?? "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]"}`}>
                    {l.action}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-[#0f172a]">
                      {l.table_name ?? "—"}
                      {l.record_id && <span className="ml-2 font-mono text-xs text-[#94a3b8]">#{l.record_id.slice(0, 8)}</span>}
                    </p>
                    <p className="text-[10px] text-[#94a3b8] flex items-center gap-2">
                      <Clock3 size={10} />
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                      {l.user_id && <span className="font-mono">· {l.user_id.slice(0, 8)}…</span>}
                    </p>
                  </div>
                  <ChevronDown size={14} className={`shrink-0 text-[#94a3b8] transition-transform ${expanded === l.id ? "rotate-180" : ""}`} />
                </div>

                {expanded === l.id && (l.old_data || l.new_data) && (
                  <div className="mt-3 grid grid-cols-2 gap-2 pl-[calc(theme(space.3)+theme(space.16))]">
                    {l.old_data && (
                      <div>
                        <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-red-500">Antes</p>
                        <pre className="overflow-x-auto rounded-xl bg-[#fef2f2] p-3 text-[10px] text-[#64748b]">
                          {JSON.stringify(l.old_data, null, 2)}
                        </pre>
                      </div>
                    )}
                    {l.new_data && (
                      <div>
                        <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-green-600">Depois</p>
                        <pre className="overflow-x-auto rounded-xl bg-[#f0fdf4] p-3 text-[10px] text-[#64748b]">
                          {JSON.stringify(l.new_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
