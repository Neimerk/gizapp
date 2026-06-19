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

async function fetchProfile(userId: string, email: string): Promise<AuthUser | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, role, store_id")
      .eq("id", userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      email,
      role: roleMap[data.role] ?? "Customer",
      storeId: data.store_id ?? null,
    };
  } catch {
    return null;
  }
}

// Lê a sessão diretamente do localStorage sem depender de inicialização async
function readSessionFromStorage(): { userId: string; email: string; accessToken: string; expiresAt: number } | null {
  try {
    const key = `sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const token = parsed?.access_token ?? parsed?.session?.access_token;
    const user = parsed?.user ?? parsed?.session?.user;
    const expiresAt = parsed?.expires_at ?? parsed?.session?.expires_at ?? 0;
    if (!token || !user?.id) return null;
    if (expiresAt && expiresAt < Math.floor(Date.now() / 1000)) return null; // expirado
    return { userId: user.id, email: user.email ?? "", accessToken: token, expiresAt };
  } catch {
    return null;
  }
}

// Inicializa lendo localStorage diretamente (síncrono e imediato)
async function init() {
  const stored = readSessionFromStorage();
  if (stored) {
    // Injeta o token no Supabase client para que chamadas subsequentes funcionem
    await supabase.auth.setSession({
      access_token: stored.accessToken,
      refresh_token: "",
    }).catch(() => {});

    const user = await fetchProfile(stored.userId, stored.email);
    useAuthStore.setState({ user, initialized: true });
  } else {
    useAuthStore.setState({ user: null, initialized: true });
  }
}

init();

// Mantém sincronizado com eventos posteriores (login, logout, refresh de token)
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "INITIAL_SESSION") return; // já tratado pelo init() acima

  if (session?.user) {
    const user = await fetchProfile(session.user.id, session.user.email ?? "");
    useAuthStore.setState({ user, initialized: true });
  } else {
    useAuthStore.setState({ user: null, initialized: true });
  }
});
