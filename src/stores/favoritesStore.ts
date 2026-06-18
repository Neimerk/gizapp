import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FavoriteProduct = {
  id: string;
  storeId: string;
  name: string;
  imageUrl?: string;
  price: number;
  promotionalPrice?: number | null;
  category: string;
};

export type FavoriteStoreItem = {
  id: string;
  name: string;
  category: string;
  logoUrl?: string;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  deliveryFee: number;
  rating: number;
  isOpen: boolean;
};

type FavoritesState = {
  products: FavoriteProduct[];
  stores: FavoriteStoreItem[];
  toggleProduct: (product: FavoriteProduct) => void;
  toggleStore: (store: FavoriteStoreItem) => void;
  isProductFavorite: (id: string) => boolean;
  isStoreFavorite: (id: string) => boolean;
};

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      products: [],
      stores: [],

      toggleProduct: (product) => {
        const isFav = get().products.some((p) => p.id === product.id);
        set({
          products: isFav
            ? get().products.filter((p) => p.id !== product.id)
            : [...get().products, product],
        });
      },

      toggleStore: (store) => {
        const isFav = get().stores.some((s) => s.id === store.id);
        set({
          stores: isFav
            ? get().stores.filter((s) => s.id !== store.id)
            : [...get().stores, store],
        });
      },

      isProductFavorite: (id) => get().products.some((p) => p.id === id),
      isStoreFavorite: (id) => get().stores.some((s) => s.id === id),
    }),
    { name: "brasux-favorites" }
  )
);
