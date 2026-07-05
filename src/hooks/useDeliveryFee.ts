import { useState, useEffect } from "react";
import { haversineKm, geocodeAddress, calculateDeliveryFee } from "../utils/geo";
import type { Store } from "../services/gizApi";

export type DeliveryFeeResult = {
  fee: number;
  distanceKm: number | null;
  loading: boolean;
  source: "distance" | "store_default" | "pending";
  outOfRange: boolean;
};

export function useDeliveryFee(
  store: Store | undefined | null,
  address: {
    neighborhood?: string;
    city?: string;
    state?: string;
    cep?: string;
  },
): DeliveryFeeResult {
  const [result, setResult] = useState<DeliveryFeeResult>({
    fee:        store ? Number(store.deliveryFee) : 0,
    distanceKm: null,
    loading:    false,
    source:     "store_default",
    outOfRange: false,
  });

  useEffect(() => {
    if (!store) return;

    const defaultFee = Number(store.deliveryFee);

    // Sem coordenadas na loja → usa taxa padrão, sem restrição de raio
    if (store.lat == null || store.lng == null) {
      setResult({ fee: defaultFee, distanceKm: null, loading: false, source: "store_default", outOfRange: false });
      return;
    }

    // Sem dados de endereço suficientes
    const hasAddress = address.neighborhood || address.city || address.cep;
    if (!hasAddress) {
      setResult({ fee: defaultFee, distanceKm: null, loading: false, source: "store_default", outOfRange: false });
      return;
    }

    setResult((prev) => ({ ...prev, loading: true, source: "pending", outOfRange: false }));

    const timer = setTimeout(async () => {
      const pos = await geocodeAddress({
        neighborhood: address.neighborhood,
        city:         address.city,
        state:        address.state,
      });

      if (pos) {
        const km        = haversineKm(store.lat!, store.lng!, pos.lat, pos.lng);
        const maxRadius = store.maxDeliveryRadiusKm;
        const outOfRange = maxRadius != null && km > maxRadius;
        const fee       = outOfRange ? 0 : calculateDeliveryFee(km);
        setResult({ fee, distanceKm: km, loading: false, source: "distance", outOfRange });
      } else {
        setResult({ fee: defaultFee, distanceKm: null, loading: false, source: "store_default", outOfRange: false });
      }
    }, 800); // debounce para não geocodificar a cada tecla

    return () => clearTimeout(timer);
  }, [store?.id, store?.lat, store?.lng, store?.maxDeliveryRadiusKm, address.neighborhood, address.city, address.state, address.cep]);

  return result;
}
