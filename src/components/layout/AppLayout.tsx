import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  Search,
  ShoppingCart,
  ReceiptText,
  User,
} from "lucide-react";
import BottomNavigation from "./BottomNavigation";
import BrasUXLogo from "../ui/BrasUXLogo";
import { useCartStore } from "../../stores/cartStore";
import Toast from "../ui/Toast";

const navLinks = [
  { label: "Início", path: "/", icon: Home },
  { label: "Lojas", path: "/lojas", icon: ShoppingCart },
  { label: "Pedidos", path: "/pedidos", icon: ReceiptText },
  { label: "Conta", path: "/conta", icon: User },
];

export default function AppLayout() {
  const totalItems = useCartStore((s) => s.totalItems());
  const totalPrice = useCartStore((s) => s.totalPrice());
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f0f5ff]">
      {/* ── TOP HEADER ── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(22,163,74,0.10)",
          boxShadow: "0 1px 0 rgba(22,163,74,0.06)",
        }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-8">
          {/* Logo */}
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <BrasUXLogo size={36} style={{ filter: "drop-shadow(0 4px 10px rgba(22,163,74,0.45))" }} />
            <span className="hidden text-lg font-black text-[#0f172a] sm:block">
              Bras<span className="text-[#16a34a]">UX</span>
            </span>
          </Link>

          {/* Search bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim();
              navigate(q ? `/buscar?q=${encodeURIComponent(q)}` : "/buscar");
            }}
            className="flex flex-1 items-center gap-2 rounded-2xl border bg-[#f8fafc] px-4 py-2.5 transition-all focus-within:bg-white"
            style={{
              borderColor: "rgba(22,163,74,0.15)",
            }}
          >
            <Search size={16} className="shrink-0 text-[#94a3b8]" />
            <input
              name="q"
              placeholder="Buscar soluções, produtos, lojas…"
              className="flex-1 bg-transparent text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
            />
            <button
              type="submit"
              className="hidden rounded-xl bg-[#16a34a] px-3 py-1 text-xs font-black text-white sm:block"
              style={{ boxShadow: "0 2px 8px rgba(22,163,74,0.35)" }}
            >
              Buscar
            </button>
          </form>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                    isActive
                      ? "bg-[#16a34a]/10 text-[#16a34a]"
                      : "text-[#64748b] hover:bg-[#f0f5ff] hover:text-[#0f172a]"
                  }`
                }
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Cart button */}
          <Link
            to="/carrinho"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] transition-all hover:border-[#16a34a]/40 hover:text-[#16a34a]"
          >
            <ShoppingCart size={18} />
            {totalItems > 0 && (
              <span
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white"
                style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
              >
                {totalItems > 9 ? "9+" : totalItems}
              </span>
            )}
          </Link>
        </div>
      </header>

      <Toast />

      {/* ── MAIN CONTENT ── */}
      <main
        className={`mx-auto max-w-7xl px-4 py-6 md:px-8 md:pb-8 ${
          totalItems > 0 ? "pb-44" : "pb-32"
        }`}
      >
        <Outlet />
      </main>

      {/* ── FLOATING CART BAR (mobile) ── */}
      {totalItems > 0 && (
        <Link
          to="/carrinho"
          className="fixed left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-between rounded-2xl px-5 py-3.5 md:hidden"
          style={{
            bottom: "96px",
            background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
            boxShadow: "0 8px 32px rgba(22,163,74,0.5), 0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
              <ShoppingCart size={16} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-white/80">
                {totalItems} {totalItems === 1 ? "item" : "itens"} no carrinho
              </p>
              <p className="text-sm font-black text-white">
                R$ {totalPrice.toFixed(2).replace(".", ",")}
              </p>
            </div>
          </div>
          <span className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-[#16a34a]">
            Ver
          </span>
        </Link>
      )}

      <BottomNavigation />

      {/* ── DESKTOP CART BAR ── */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 right-6 z-40 hidden md:block">
          <Link
            to="/carrinho"
            className="flex items-center gap-3 rounded-2xl px-5 py-3.5"
            style={{
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              boxShadow: "0 8px 32px rgba(22,163,74,0.5)",
            }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
              <ShoppingCart size={16} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-white/80">
                {totalItems} {totalItems === 1 ? "item" : "itens"}
              </p>
              <p className="text-sm font-black text-white">
                R$ {totalPrice.toFixed(2).replace(".", ",")}
              </p>
            </div>
            <span className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-[#16a34a]">
              Ver carrinho
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
