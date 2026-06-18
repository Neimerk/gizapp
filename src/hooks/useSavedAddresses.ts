import { useState, useCallback } from "react";

export type SavedAddress = {
  id: string;
  label: string;
  phone: string;
  cep: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
};

const KEY = "brasux-addresses";

function load(): SavedAddress[] {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

function persist(addresses: SavedAddress[]) {
  localStorage.setItem(KEY, JSON.stringify(addresses));
}

export function useSavedAddresses() {
  const [addresses, setAddresses] = useState<SavedAddress[]>(load);

  const save = useCallback((addr: Omit<SavedAddress, "id">) => {
    const next: SavedAddress = { ...addr, id: crypto.randomUUID() };
    setAddresses((prev) => {
      const updated = [...prev, next];
      persist(updated);
      return updated;
    });
    return next;
  }, []);

  const update = useCallback((id: string, patch: Partial<Omit<SavedAddress, "id">>) => {
    setAddresses((prev) => {
      const updated = prev.map((a) => (a.id === id ? { ...a, ...patch } : a));
      persist(updated);
      return updated;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setAddresses((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      persist(updated);
      return updated;
    });
  }, []);

  return { addresses, save, update, remove };
}
