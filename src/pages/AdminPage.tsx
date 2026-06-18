import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Store as StoreIcon, Package, ShoppingBag,
  Shield, ToggleLeft, ToggleRight, Search, ChevronDown,
  LogOut, ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getAuth, logout } from "../services/auth";
import {
  adminGetUsers, adminToggleUserActive, getStores,
} from "../services/gizApi";
import { useToastStore } from "../stores/toastStore";

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
  const auth = getAuth();

  useEffect(() => {
    if (!auth || auth.role !== "Admin") {
      logout();
      navigate("/login", { state: { from: "/admin" }, replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!auth || auth.role !== "Admin") return null;

  return <AdminDashboard auth={auth} />;
}

function AdminDashboard({ auth }: { auth: NonNullable<ReturnType<typeof getAuth>> }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overview" | "users" | "stores">("overview");

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
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
          {(["overview", "users", "stores"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wide transition-colors ${
                tab === t
                  ? "border-[#002776] text-[#002776]"
                  : "border-transparent text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              {t === "overview" ? "Visão Geral" : t === "users" ? "Usuários" : "Lojas"}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {tab === "overview" && <OverviewTab />}
        {tab === "users"    && <UsersTab />}
        {tab === "stores"   && <StoresTab />}
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
