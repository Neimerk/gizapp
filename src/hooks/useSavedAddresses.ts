import { useState, useEffect, useCallback } from "react";
import {
  getMySavedAddresses,
  insertSavedAddress,
  updateSavedAddress,
  deleteSavedAddress,
} from "../services/gizApi";
import { useAuthStore } from "../stores/authStore";

export type SavedAddress = {
  id: string;
  label: string;
  phone: string;
  cep: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
};

const LOCAL_KEY = "brasux-addresses";

function loadLocal(): SavedAddress[] {
  try {
    const d = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]");
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}

function persistLocal(addresses: SavedAddress[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(addresses));
}

export function useSavedAddresses() {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialized) return;

    if (!user) {
      setAddresses(loadLocal());
      return;
    }

    setLoading(true);
    getMySavedAddresses()
      .then((rows) => {
        setAddresses(
          rows.map((r) => ({
            id: r.id,
            label: r.label,
            phone: r.phone ?? "",
            cep: r.cep ?? "",
            address: r.address,
            number: r.number,
            complement: r.complement ?? "",
            neighborhood: r.neighborhood,
            city: r.city ?? "",
          }))
        );
      })
      .catch(() => setAddresses(loadLocal()))
      .finally(() => setLoading(false));
  }, [user, initialized]);

  const save = useCallback(
    async (addr: Omit<SavedAddress, "id">): Promise<SavedAddress> => {
      if (user) {
        const saved = await insertSavedAddress(addr);
        const normalized: SavedAddress = {
          id: saved.id,
          label: saved.label,
          phone: saved.phone ?? "",
          cep: saved.cep ?? "",
          address: saved.address,
          number: saved.number,
          complement: saved.complement ?? "",
          neighborhood: saved.neighborhood,
          city: saved.city ?? "",
        };
        setAddresses((prev) => [...prev, normalized]);
        return normalized;
      }
      const next: SavedAddress = { ...addr, id: crypto.randomUUID() };
      setAddresses((prev) => {
        const updated = [...prev, next];
        persistLocal(updated);
        return updated;
      });
      return next;
    },
    [user]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<SavedAddress, "id">>) => {
      if (user) await updateSavedAddress(id, patch);
      setAddresses((prev) => {
        const updated = prev.map((a) => (a.id === id ? { ...a, ...patch } : a));
        if (!user) persistLocal(updated);
        return updated;
      });
    },
    [user]
  );

  const remove = useCallback(
    async (id: string) => {
      if (user) await deleteSavedAddress(id);
      setAddresses((prev) => {
        const updated = prev.filter((a) => a.id !== id);
        if (!user) persistLocal(updated);
        return updated;
      });
    },
    [user]
  );

  return { addresses, loading, save, update, remove };
}
