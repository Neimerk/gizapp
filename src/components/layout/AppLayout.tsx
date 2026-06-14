import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Home,
  Search,
  ShoppingCart,
  ReceiptText,
  User,
  Zap,
  Menu,
  X,
} from "lucide-react";
import { useCartStore } from "../../stores/cartStore";

const navLinks = [
  { label: "Início", path: "/", icon: Home },
  { label: "Buscar", path: "/buscar", icon: Search },
  { label: "Lojas", path: "/lojas", icon: ShoppingCart },
  { label: "Pedidos", path: "/pedidos", icon: ReceiptText },
  { label: "Conta", path: "/conta", icon: User },
];

export default function AppLayout() {
  const totalItems = useCartStore((s) => s.totalItems());
  const totalPrice = useCartStore((s) => s.totalPrice());
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f0f2f7]">
      {/* ── TOP HEADER (desktop + mobile) ── */}
      <header className="sticky top-0 z-50 border-b border-[#e8eaf0] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-8">
          {/* Logo */}
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#2563eb]">
              <Zap size={18} className="fill-[#ffd400] text-[#ffd400]" />
            </div>
            <span className="hidden text-lg font-black text-[#0f172a] sm:block">
              Giz<span className="text-[#7c3aed]">App</span>
            </span>
          </Link>

          {/* Search bar (center, desktop) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim();
              navigate(q ? `/buscar?q=${encodeURIComponent(q)}` : "/buscar");
            }}
            className="flex flex-1 items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 transition-colors focus-within:border-[#7c3aed]/40 focus-within:bg-white"
          >
            <Search size={16} className="shrink-0 text-[#94a3b8]" />
            <input
              name="q"
              placeholder="Buscar produtos, lojas, restaurantes…"
              className="flex-1 bg-transparent text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
            />
            <button
              type="submit"
              className="hidden rounded-xl bg-[#7c3aed] px-3 py-1 text-xs font-black text-white sm:block"
            >
              Buscar
            </button>
          </form>

          {/* Desktop nav links */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                    isActive
                      ? "bg-[#7c3aed]/10 text-[#7c3aed]"
                      : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a]"
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
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:border-[#7c3aed]/30 hover:text-[#7c3aed]"
          >
            <ShoppingCart size={18} />
            {totalItems > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#7c3aed] text-[10px] font-black text-white">
                {totalItems > 9 ? "9+" : totalItems}
              </span>
            )}
          </Link>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e2e8f0] text-[#64748b] lg:hidden"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="border-t border-[#e8eaf0] bg-white px-4 pb-4 pt-2 lg:hidden">
            <nav className="grid grid-cols-5 gap-1">
              {navLinks.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 rounded-xl p-2.5 text-[10px] font-bold transition-colors ${
                      isActive
                        ? "bg-[#7c3aed]/10 text-[#7c3aed]"
                        : "text-[#94a3b8] hover:bg-[#f8fafc]"
                    }`
                  }
                >
                  <item.icon size={20} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="mx-auto max-w-7xl px-4 py-6 pb-8 md:px-8">
        <Outlet />
      </main>

      {/* ── FLOATING CART BAR (mobile only, when items in cart) ── */}
      {totalItems > 0 && (
        <Link
          to="/carrinho"
          className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-between rounded-2xl bg-[#7c3aed] px-5 py-3.5 shadow-xl shadow-[#7c3aed]/40 md:hidden"
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
          <span className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-[#7c3aed]">
            Ver
          </span>
        </Link>
      )}

      {/* ── DESKTOP CART BAR (when items in cart) ── */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 right-6 z-40 hidden md:block">
          <Link
            to="/carrinho"
            className="flex items-center gap-3 rounded-2xl bg-[#7c3aed] px-5 py-3.5 shadow-xl shadow-[#7c3aed]/40"
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
            <span className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-[#7c3aed]">
              Ver carrinho
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
