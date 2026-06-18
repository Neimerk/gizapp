import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useToastStore } from "./toastStore";

export type CartItem = {
  id: string;

  /*
    ID do produto da loja (StoreProduct)
    usado no checkout real
  */
  storeProductId: string;

  /*
    ID do produto base
  */
  productId?: string;

  storeId: string;

  name: string;

  description?: string;

  price: number;

  promotionalPrice?: number | null;

  image: string;

  quantity: number;

  stock?: number;
};

type CartStore = {
  items: CartItem[];

  addItem: (
    item: Omit<CartItem, "quantity">
  ) => void;

  removeItem: (id: string) => void;

  increaseItem: (id: string) => void;

  decreaseItem: (id: string) => void;

  clearCart: () => void;

  totalItems: () => number;

  totalPrice: () => number;

  getStoreId: () => string | null;
};

export const useCartStore =
  create<CartStore>()(
    persist(
      (set, get) => ({
        items: [],

        addItem: (item) => {
          const currentItems =
            get().items;

          /*
            Impede múltiplas lojas
          */

          if (
            currentItems.length > 0 &&
            currentItems[0].storeId !==
              item.storeId
          ) {
            useToastStore.getState().show(
              "Finalize o pedido atual antes de comprar em outra loja.",
              "warning"
            );
            return;
          }

          const existingItem =
            currentItems.find(
              (cartItem) =>
                cartItem.id === item.id
            );

          /*
            Produto já existe
          */

          if (existingItem) {
            /*
              respeita estoque
            */

            if (
              existingItem.stock &&
              existingItem.quantity >=
                existingItem.stock
            ) {
              return;
            }

            set({
              items: currentItems.map(
                (cartItem) =>
                  cartItem.id === item.id
                    ? {
                        ...cartItem,
                        quantity:
                          cartItem.quantity + 1,
                      }
                    : cartItem
              ),
            });

            return;
          }

          /*
            novo item
          */

          set({
            items: [
              ...currentItems,
              {
                ...item,
                quantity: 1,
              },
            ],
          });
        },

        removeItem: (id) => {
          set({
            items: get().items.filter(
              (item) => item.id !== id
            ),
          });
        },

        increaseItem: (id) => {
          set({
            items: get().items.map(
              (item) => {
                /*
                  respeita estoque
                */

                if (
                  item.id === id &&
                  item.stock &&
                  item.quantity >= item.stock
                ) {
                  return item;
                }

                return item.id === id
                  ? {
                      ...item,
                      quantity:
                        item.quantity + 1,
                    }
                  : item;
              }
            ),
          });
        },

        decreaseItem: (id) => {
          set({
            items: get()
              .items.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      quantity:
                        item.quantity - 1,
                    }
                  : item
              )
              .filter(
                (item) => item.quantity > 0
              ),
          });
        },

        clearCart: () => {
          set({
            items: [],
          });
        },

        totalItems: () => {
          return get().items.reduce(
            (total, item) =>
              total + item.quantity,
            0
          );
        },

        totalPrice: () => {
          return get().items.reduce(
            (total, item) => {
              const finalPrice =
                item.promotionalPrice ??
                item.price;

              return (
                total +
                finalPrice *
                  item.quantity
              );
            },
            0
          );
        },

        getStoreId: () => {
          const firstItem =
            get().items[0];

          return firstItem
            ? firstItem.storeId
            : null;
        },
      }),
      {
        name: "brasux-cart",
      }
    )
  );