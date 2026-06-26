// ─────────────────────────────────────────────────────────────────────────────
// navigation.ts — FONTE ÚNICA da navegação primária do BrasUX Shopping.
//
// Antes: o nav desktop (AppLayout) e o bottom nav (mobile) tinham itens
// DIFERENTES — "Lojas"/"Favoritos" só no desktop, "Buscar"/"Carrinho" só no
// mobile, e "Categorias" em nenhum. Agora os dois consomem ESTA lista.
//
// Busca e Carrinho ficam sempre no header (não ocupam slot do nav).
// Favoritos virou ícone no header (acessível em todas as larguras).
// ─────────────────────────────────────────────────────────────────────────────

import { Home, LayoutGrid, Store, ReceiptText, User, Bike } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** marca a rota como "exata" para o NavLink (usado em "/") */
  end?: boolean;
}

// Cliente/comprador — mesmos destinos no desktop e no mobile.
export const customerNav: NavItem[] = [
  { label: "Início",     path: "/",           icon: Home,       end: true },
  { label: "Categorias", path: "/categorias", icon: LayoutGrid },
  { label: "Lojas",      path: "/lojas",      icon: Store },
  { label: "Pedidos",    path: "/pedidos",    icon: ReceiptText },
  { label: "Conta",      path: "/conta",      icon: User },
];

// Entregador — fluxo dedicado.
export const courierNav: NavItem[] = [
  { label: "Início",   path: "/",           icon: Home, end: true },
  { label: "Entregas", path: "/entregador", icon: Bike },
  { label: "Pedidos",  path: "/pedidos",    icon: ReceiptText },
  { label: "Conta",    path: "/conta",      icon: User },
];

/** Nav primário conforme o papel do usuário. */
export function getPrimaryNav(role?: string): NavItem[] {
  return role === "Courier" ? courierNav : customerNav;
}
