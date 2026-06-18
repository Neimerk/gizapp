import { create } from "zustand";

export type CompareProduct = {
  id: string;
  storeId: string;
  name: string;
  imageUrl?: string;
  price: number;
  promotionalPrice?: number | null;
  category: string;
  brand?: string;
  description?: string;
  stock: number;
};

const MAX = 3;

type CompareState = {
  products: CompareProduct[];
  add: (product: CompareProduct) => boolean;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
};

export const useCompareStore = create<CompareState>()((set, get) => ({
  products: [],

  add: (product) => {
    if (get().products.length >= MAX || get().has(product.id)) return false;
    set((s) => ({ products: [...s.products, product] }));
    return true;
  },

  remove: (id) =>
    set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

  clear: () => set({ products: [] }),

  has: (id) => get().products.some((p) => p.id === id),
}));
