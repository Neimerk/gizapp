import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

export type UserRole = "Admin" | "Customer" | "Seller" | "Courier";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeId?: string | null;
};

type AuthStore = {
  user: AuthUser | null;
  initialized: boolean;
};

export const useAuthStore = create<AuthStore>(() => ({
  user: null,
  initialized: false,
}));

const roleMap: Record<string, UserRole> = {
  admin: "Admin",
  customer: "Customer",
  seller: "Seller",
  courier: "Courier",
};

async function fetchProfile(supabaseUser: User): Promise<AuthUser | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, role, store_id")
      .eq("id", supabaseUser.id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      email: supabaseUser.email ?? "",
      role: roleMap[data.role] ?? "Customer",
      storeId: data.store_id ?? null,
    };
  } catch {
    return null;
  }
}

// Inicializa lendo a sessão atual imediatamente (não depende só do listener)
supabase.auth.getSession().then(async ({ data: { session } }) => {
  if (session?.user) {
    const user = await fetchProfile(session.user);
    useAuthStore.setState({ user, initialized: true });
  } else {
    useAuthStore.setState({ user: null, initialized: true });
  }
});

// Mantém sincronizado com mudanças posteriores (login, logout, refresh)
supabase.auth.onAuthStateChange(async (event, session) => {
  // INITIAL_SESSION já foi tratado pelo getSession acima — evita dupla chamada
  if (event === "INITIAL_SESSION") return;

  if (session?.user) {
    const user = await fetchProfile(session.user);
    useAuthStore.setState({ user, initialized: true });
  } else {
    useAuthStore.setState({ user: null, initialized: true });
  }
});
