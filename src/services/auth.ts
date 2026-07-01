import { useAuthStore, initAuth, type AuthUser } from "../stores/authStore";

export { initAuth, type AuthUser };

export const BRASUX_API =
  (import.meta.env.VITE_BRASUX_API_URL as string) ||
  "https://brasux-api.brasux-account.workers.dev";

export function getAuth(): AuthUser | null {
  return useAuthStore.getState().user;
}

export function getAuthToken(): string {
  return useAuthStore.getState().user?.token ?? "";
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

export async function logout(): Promise<void> {
  useAuthStore.getState().clearAuth();
}
