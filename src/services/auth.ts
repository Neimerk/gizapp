import { supabase } from "../lib/supabase";
import { useAuthStore, type AuthUser } from "../stores/authStore";

export type { AuthUser };

export function getAuth(): AuthUser | null {
  return useAuthStore.getState().user;
}

/** Token JWT real da sessão Supabase (para chamadas a serviços externos). */
export async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}
