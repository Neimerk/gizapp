// ─────────────────────────────────────────────────────────────────────────────
// navigation.ts — Navegação primária do BrasUX Soluções Tecnológicas.
// ─────────────────────────────────────────────────────────────────────────────

import { Home, LayoutGrid, Globe, ReceiptText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
}

export const customerNav: NavItem[] = [
  { label: "Início",      path: "/",             icon: Home,        end: true },
  { label: "Soluções",    path: "/categorias",   icon: LayoutGrid },
  { label: "Ecossistema", path: "/ecossistema",  icon: Globe },
  { label: "Projetos",    path: "/projetos",      icon: ReceiptText },
];

export function getPrimaryNav(_role?: string): NavItem[] {
  return customerNav;
}
