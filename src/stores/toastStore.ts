import { create } from "zustand";

type ToastType = "error" | "warning" | "success";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastStore = {
  toasts: Toast[];
  show: (message: string, type?: ToastType) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  show: (message, type = "error") => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, type }] }));
    setTimeout(() => get().dismiss(id), 4000);
  },

  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
