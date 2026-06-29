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

import { Home, LayoutGrid, Store, ReceiptText, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** marca a rota como "exata" para o NavLink (usado em "/") */
  end?: boolean;
}

// Nav principal do shopping — desktop e mobile.
export const customerNav: NavItem[] = [
  { label: "Início",     path: "/",           icon: Home,       end: true },
  { label: "Categorias", path: "/categorias", icon: LayoutGrid },
  { label: "Lojas",      path: "/lojas",      icon: Store },
  { label: "Pedidos",    path: "/pedidos",    icon: ReceiptText },
  { label: "Conta",      path: "/conta",      icon: User },
];

/** Nav primário — app de compras, todos os papéis usam o mesmo nav. */
export function getPrimaryNav(_role?: string): NavItem[] {
  return customerNav;
}
