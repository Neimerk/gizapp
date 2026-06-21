import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getMyFavoriteIds, toggleFavoriteDB } from "../services/gizApi";

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
  synced: boolean;
  toggleProduct: (product: FavoriteProduct) => void;
  toggleStore: (store: FavoriteStoreItem) => void;
  isProductFavorite: (id: string) => boolean;
  isStoreFavorite: (id: string) => boolean;
  syncFromDB: (productObjects: FavoriteProduct[], storeObjects: FavoriteStoreItem[]) => void;
  loadFromDB: () => Promise<void>;
};

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      products: [],
      stores: [],
      synced: false,

      toggleProduct: (product) => {
        const isFav = get().products.some((p) => p.id === product.id);
        set({
          products: isFav
            ? get().products.filter((p) => p.id !== product.id)
            : [...get().products, product],
        });
        // Sync to DB in background (non-blocking)
        toggleFavoriteDB("product", product.id).catch(() => null);
      },

      toggleStore: (store) => {
        const isFav = get().stores.some((s) => s.id === store.id);
        set({
          stores: isFav
            ? get().stores.filter((s) => s.id !== store.id)
            : [...get().stores, store],
        });
        toggleFavoriteDB("store", store.id).catch(() => null);
      },

      isProductFavorite: (id) => get().products.some((p) => p.id === id),
      isStoreFavorite: (id) => get().stores.some((s) => s.id === id),

      syncFromDB: (productObjects, storeObjects) => {
        set({ products: productObjects, stores: storeObjects, synced: true });
      },

      loadFromDB: async () => {
        try {
          const { productIds, storeIds } = await getMyFavoriteIds();
          // Keep full objects from current local state that match DB IDs,
          // and keep any extras already in local state that aren't in DB yet
          // (optimistic adds before sync completes)
          const currentProducts = get().products;
          const currentStores = get().stores;

          const syncedProducts = currentProducts.filter((p) => productIds.includes(p.id));
          const syncedStores = currentStores.filter((s) => storeIds.includes(s.id));

          set({ products: syncedProducts, stores: syncedStores, synced: true });
        } catch {
          // Keep local state as fallback
          set({ synced: true });
        }
      },
    }),
    { name: "brasux-favorites" }
  )
);
