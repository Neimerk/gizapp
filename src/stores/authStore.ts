import { create } from "zustand";

const AUTH_KEY = "brasux-shopping-auth";

export type UserRole = "Admin" | "Customer" | "Seller" | "Courier";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeId?: string | null;
  token: string;
};

type AuthStore = {
  user: AuthUser | null;
  initialized: boolean;
  setAuth: (user: AuthUser) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  initialized: false,

  setAuth: (user) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    set({ user, initialized: true });
  },

  clearAuth: () => {
    localStorage.removeItem(AUTH_KEY);
    set({ user: null, initialized: true });
  },
}));

export function initAuth(): void {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) {
      useAuthStore.setState({ initialized: true });
      return;
    }
    const user = JSON.parse(raw) as AuthUser;
    useAuthStore.setState({ user, initialized: true });
  } catch {
    useAuthStore.setState({ initialized: true });
  }
}
