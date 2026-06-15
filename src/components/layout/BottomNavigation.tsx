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
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-[#e8eaf0] bg-white/95 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isCart = item.path === "/carrinho";

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-0.5 py-3 text-[10px] font-bold transition-colors ${
                  isActive ? "text-[#7c3aed]" : "text-[#94a3b8]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                    {isCart && totalItems > 0 && (
                      <span className="absolute -right-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#7c3aed] text-[9px] font-black text-white">
                        {totalItems > 9 ? "9+" : totalItems}
                      </span>
                    )}
                  </div>
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-[#7c3aed]" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
