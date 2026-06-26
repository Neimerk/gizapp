import { NavLink } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { getPrimaryNav } from "../../data/navigation";

// Bottom nav (mobile) — mesma fonte de navegação do desktop (data/navigation.ts).
// Busca e Carrinho ficam no header; Favoritos no header. Aqui só os destinos
// primários: Início · Categorias · Lojas · Pedidos · Conta.
export default function BottomNavigation() {
  const userRole = useAuthStore((s) => s.user?.role);
  const navItems = getPrimaryNav(userRole);

  return (
    <nav className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 md:hidden">
      <div
        className="flex items-center rounded-[28px] p-1.5"
        style={{
          background: "rgba(15, 23, 42, 0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 8px 40px rgba(15,23,42,0.45), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.path} to={item.path} end={item.end ?? false} className="relative">
              {({ isActive }) => (
                <div
                  className="relative flex flex-col items-center gap-0.5 rounded-[22px] px-3 py-2.5 transition-all duration-200"
                  style={isActive ? { background: "#16a34a" } : {}}
                >
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    className={isActive ? "text-white" : "text-white/45"}
                  />
                  <span
                    className="text-[9px] font-black leading-none tracking-wide"
                    style={{ color: isActive ? "white" : "rgba(255,255,255,0.38)" }}
                  >
                    {item.label}
                  </span>
                </div>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
