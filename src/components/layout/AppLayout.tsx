import { Suspense } from "react";
import { Outlet, Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Bike,
  Briefcase,
  Home,
  Mic,
  MicOff,
  Moon,
  ReceiptText,
  Search,
  ShoppingCart,
  Store as StoreIcon,
  Sun,
  User,
} from "lucide-react";
import { useCallback, useEffect } from "react";
import BottomNavigation from "./BottomNavigation";
import Footer from "./Footer";
import BrasUXLogo from "../ui/BrasUXLogo";
import ErrorBoundary from "./ErrorBoundary";
import CompareBar from "../ui/CompareBar";
import Onboarding from "../ui/Onboarding";
import Toast from "../ui/Toast";
import { useCartStore } from "../../stores/cartStore";
import { useThemeStore } from "../../stores/themeStore";
import { useFavoritesStore } from "../../stores/favoritesStore";
import { usePointsStore } from "../../stores/pointsStore";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { useVoiceSearch } from "../../hooks/useVoiceSearch";
import { useAuthStore, initAuth } from "../../stores/authStore";
import { formatBRL } from "../../utils/format";
import { prefetchCart, prefetchCheckout, prefetchOrders } from "../../utils/prefetch";
import { useErrorMonitor } from "../../hooks/useErrorMonitor";
import CookieBanner from "../ui/CookieBanner";

const baseNavLinks = [
  { label: "Início", path: "/", icon: Home },
  { label: "Lojas", path: "/lojas", icon: ShoppingCart },
  { label: "Serviços", path: "/servicos", icon: Briefcase },
  { label: "Pedidos", path: "/pedidos", icon: ReceiptText },
  { label: "Conta", path: "/conta", icon: User },
];

export default function AppLayout() {
  useErrorMonitor();

  // brasux.store é o portal de lojistas — redireciona para /parceiro
  useEffect(() => {
    if (window.location.hostname === "brasux.store" && window.location.pathname === "/") {
      window.location.replace("/parceiro");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const authUser = useAuthStore((s) => s.user);
  const isSellerOrAdmin = authUser?.role === "Seller" || authUser?.role === "Admin";
  const isCourier       = authUser?.role === "Courier";
  const navLinks = isCourier
    ? [baseNavLinks[0], { label: "Entregas", path: "/entregador", icon: Bike }, baseNavLinks[3], baseNavLinks[4]]
    : isSellerOrAdmin
    ? [...baseNavLinks.slice(0, 4), { label: "Minha Loja", path: "/minha-loja", icon: StoreIcon }, baseNavLinks[4]]
    : baseNavLinks;

  const totalItems = useCartStore((s) => s.totalItems());
  const totalPrice = useCartStore((s) => s.totalPrice());
  const navigate = useNavigate();

  // Inicializa auth lazy — carrega Supabase apenas após primeiro render
  useEffect(() => { initAuth(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync favorites, pontos e push subscription quando usuário loga/desloga
  const loadFavorites = useFavoritesStore((s) => s.loadFromDB);
  const loadPoints    = usePointsStore((s) => s.loadFromDB);
  const { syncExisting: syncPush } = usePushNotifications();
  useEffect(() => {
    if (authUser) {
      loadFavorites();
      loadPoints();
      syncPush(); // persiste subscription existente no banco após login
    }
  }, [authUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const { theme, toggle: toggleTheme } = useThemeStore();
  const isDark = theme === "dark";

  const handleVoiceResult = useCallback(
    (text: string) => {
      navigate(`/buscar?q=${encodeURIComponent(text)}`);
    },
    [navigate]
  );
  const { status: voiceStatus, supported: voiceSupported, start: startVoice, stop: stopVoice } =
    useVoiceSearch(handleVoiceResult);
  const isListening = voiceStatus === "listening";

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <Onboarding />

      {/* ── TOP HEADER ── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: isDark ? "rgba(15,23,42,0.96)" : "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: isDark
            ? "1px solid rgba(255,255,255,0.06)"
            : "1px solid rgba(0,39,118,0.10)",
          boxShadow: "0 1px 8px rgba(0,39,118,0.06)",
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
            style={{ borderColor: "rgba(22,163,74,0.15)" }}
          >
            <Search size={16} className="shrink-0 text-[#94a3b8]" />
            <input
              name="q"
              placeholder="Buscar soluções, produtos, lojas…"
              className="flex-1 bg-transparent text-sm font-medium text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
            />

            {/* Voice search button */}
            {voiceSupported && (
              <button
                type="button"
                onClick={isListening ? stopVoice : startVoice}
                className={`shrink-0 rounded-lg p-1 transition-colors ${
                  isListening
                    ? "text-red-500 animate-pulse"
                    : "text-[#94a3b8] hover:text-[#16a34a]"
                }`}
                aria-label={isListening ? "Parar gravação" : "Buscar por voz"}
              >
                {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
            )}

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
                onMouseEnter={() => {
                  if (item.path === "/carrinho") prefetchCart();
                  if (item.path === "/pedidos")  prefetchOrders();
                  if (item.path === "/checkout") prefetchCheckout();
                }}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                    isActive
                      ? "bg-[#16a34a]/10 text-[#16a34a]"
                      : "text-[#64748b] hover:bg-[#f7f9fc] hover:text-[#0f172a]"
                  }`
                }
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:border-[#16a34a]/40 hover:text-[#16a34a]"
            aria-label={isDark ? "Modo claro" : "Modo escuro"}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Cart button */}
          <Link
            to="/carrinho"
            onMouseEnter={prefetchCart}
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
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:pb-8">
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="flex min-h-[60vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#16a34a] border-t-transparent" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />

      {/* ── FLOATING CART BAR (mobile) ── */}
      {totalItems > 0 && (
        <Link
          to="/carrinho"
          onMouseEnter={prefetchCheckout}
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
                {formatBRL(totalPrice)}
              </p>
            </div>
          </div>
          <span className="rounded-xl bg-white px-3 py-1.5 text-xs font-black text-[#16a34a]">
            Ver
          </span>
        </Link>
      )}

      <CompareBar />
      <CookieBanner />
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
                {formatBRL(totalPrice)}
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
