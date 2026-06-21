import { create } from "zustand";

// supabase carregado de forma lazy — importado apenas quando initAuth() é chamado
const getSupabase = () => import("../lib/supabase").then((m) => m.supabase);

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

async function fetchProfileWithToken(userId: string, email: string, accessToken: string): Promise<AuthUser | null> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const url = `${supabaseUrl}/rest/v1/profiles?select=id,name,role,store_id&id=eq.${userId}`;
    const res = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email,
      role: roleMap[row.role] ?? "Customer",
      storeId: row.store_id ?? null,
    };
  } catch {
    return null;
  }
}

function readStoredSession(): { userId: string; email: string; accessToken: string; refreshToken: string } | null {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const ref = new URL(supabaseUrl).hostname.split(".")[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const token = parsed?.access_token;
    const refresh = parsed?.refresh_token ?? "";
    const user = parsed?.user;
    const expiresAt: number = parsed?.expires_at ?? 0;
    if (!token || !user?.id) return null;
    if (expiresAt > 0 && expiresAt < Math.floor(Date.now() / 1000)) return null;
    return { userId: user.id, email: user.email ?? "", accessToken: token, refreshToken: refresh };
  } catch {
    return null;
  }
}

let _initDone = false;

// Chamado pelo AppLayout no primeiro useEffect — garante que supabase não está no bundle inicial
export async function initAuth(): Promise<void> {
  if (_initDone) return;
  _initDone = true;

  const stored = readStoredSession();

  // Download lazy do supabase — só acontece aqui, após o primeiro render
  const supabase = await getSupabase();

  if (stored) {
    await supabase.auth.setSession({
      access_token: stored.accessToken,
      refresh_token: stored.refreshToken,
    }).catch(() => {});

    const user = await fetchProfileWithToken(stored.userId, stored.email, stored.accessToken);
    useAuthStore.setState({ user, initialized: true });
  } else {
    useAuthStore.setState({ user: null, initialized: true });
  }

  // Registra listener para login/logout/refresh futuros
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "INITIAL_SESSION") return;

    if (session?.user) {
      const user = await fetchProfileWithToken(
        session.user.id,
        session.user.email ?? "",
        session.access_token ?? ""
      );
      useAuthStore.setState({ user, initialized: true });
    } else {
      useAuthStore.setState({ user: null, initialized: true });
    }
  });
}
