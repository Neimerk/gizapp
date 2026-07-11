import { Suspense } from "react";
import { Outlet, Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Mic,
  MicOff,
  Search,
} from "lucide-react";
import { useCallback, useEffect } from "react";
import BottomNavigation from "./BottomNavigation";
import Footer from "./Footer";
import BrasUXLogo from "../ui/BrasUXLogo";
import ErrorBoundary from "./ErrorBoundary";
import CompareBar from "../ui/CompareBar";
import Onboarding from "../ui/Onboarding";
import Toast from "../ui/Toast";
import { useVoiceSearch } from "../../hooks/useVoiceSearch";
import { useErrorMonitor } from "../../hooks/useErrorMonitor";
import { getPrimaryNav } from "../../data/navigation";
import CookieBanner from "../ui/CookieBanner";

export default function AppLayout() {
  useErrorMonitor();

  const navLinks = getPrimaryNav(undefined);

  const navigate = useNavigate();

  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

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
    <div className="min-h-screen overflow-x-clip bg-canvas">
      <Onboarding />

      {/* ── TOP HEADER ── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,39,118,0.10)",
          boxShadow: "0 1px 8px rgba(0,39,118,0.06)",
        }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-8">
          {/* Logo */}
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <BrasUXLogo size={36} style={{ filter: "drop-shadow(0 4px 10px rgba(22,163,74,0.45))" }} />
            <span className="hidden text-lg font-black text-content sm:block">
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
            className="flex flex-1 items-center gap-2 rounded-2xl border bg-subtle px-4 py-2.5 transition-all focus-within:bg-surface"
            style={{ borderColor: "rgba(22,163,74,0.15)" }}
          >
            <Search size={16} className="shrink-0 text-faint" />
            <input
              name="q"
              placeholder="Buscar soluções, produtos, lojas…"
              className="flex-1 bg-transparent text-sm font-medium text-content outline-none placeholder:text-faint"
            />

            {/* Voice search button */}
            {voiceSupported && (
              <button
                type="button"
                onClick={isListening ? stopVoice : startVoice}
                className={`shrink-0 rounded-lg p-1 transition-colors ${
                  isListening
                    ? "text-red-500 animate-pulse"
                    : "text-faint hover:text-[#16a34a]"
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
                end={item.end ?? false}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                    isActive
                      ? "bg-[#16a34a]/10 text-[#16a34a]"
                      : "text-muted hover:bg-canvas hover:text-content"
                  }`
                }
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </nav>

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

      <CompareBar />
      <CookieBanner />
      <BottomNavigation />
    </div>
  );
}
