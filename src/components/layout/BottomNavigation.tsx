import { Home, ShoppingCart, ReceiptText, User } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useCartStore } from "../../stores/cartStore";

const navItems = [
  { label: "Início", path: "/", icon: Home },
  { label: "Carrinho", path: "/carrinho", icon: ShoppingCart },
  { label: "Pedidos", path: "/pedidos", icon: ReceiptText },
  { label: "Conta", path: "/conta", icon: User },
];

export default function BottomNavigation() {
  const totalItems = useCartStore((s) => s.totalItems());

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
          const isCart = item.path === "/carrinho";

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className="relative"
            >
              {({ isActive }) => (
                <div
                  className="relative flex flex-col items-center gap-0.5 rounded-[22px] px-4 py-2.5 transition-all duration-200"
                  style={isActive ? { background: "#7c3aed" } : {}}
                >
                  <div className="relative">
                    <Icon
                      size={20}
                      strokeWidth={isActive ? 2.5 : 1.8}
                      className={isActive ? "text-white" : "text-white/45"}
                    />
                    {isCart && totalItems > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] font-black text-[#7c3aed]">
                        {totalItems > 9 ? "9+" : totalItems}
                      </span>
                    )}
                  </div>
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
