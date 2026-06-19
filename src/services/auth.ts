import { supabase } from "../lib/supabase";
import { useAuthStore, type AuthUser } from "../stores/authStore";

export type { AuthUser };

export function getAuth(): AuthUser | null {
  return useAuthStore.getState().user;
}

export function getAuthToken(): string {
  return "";
}

export function saveAuth(_user: AuthUser) {}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}
