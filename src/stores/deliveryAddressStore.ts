import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DeliveryAddress = {
  label: string;
  lat: number;
  lng: number;
};

type State = {
  address: DeliveryAddress | null;
  setAddress: (addr: DeliveryAddress) => void;
  clearAddress: () => void;
};

export const useDeliveryAddressStore = create<State>()(
  persist(
    (set) => ({
      address: null,
      setAddress: (addr) => set({ address: addr }),
      clearAddress: () => set({ address: null }),
    }),
    { name: "brasux-delivery-address" },
  ),
);
