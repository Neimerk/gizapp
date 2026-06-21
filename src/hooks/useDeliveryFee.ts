import { useState, useEffect } from "react";
import { haversineKm, geocodeAddress, calculateDeliveryFee } from "../utils/geo";
import type { Store } from "../services/gizApi";

export type DeliveryFeeResult = {
  fee: number;
  distanceKm: number | null;
  loading: boolean;
  source: "distance" | "store_default" | "pending";
};

/**
 * Calcula a taxa de entrega dinamicamente com base na distância
 * entre a loja e o endereço de entrega do cliente.
 *
 * - Se a loja tiver lat/lng e o endereço tiver dados suficientes:
 *   geocodifica o endereço via Nominatim e aplica a fórmula.
 * - Caso contrário, usa a taxa padrão da loja.
 */
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
  });

  useEffect(() => {
    if (!store) return;

    const defaultFee = Number(store.deliveryFee);

    // Sem coordenadas na loja → usa taxa padrão
    if (store.lat == null || store.lng == null) {
      setResult({ fee: defaultFee, distanceKm: null, loading: false, source: "store_default" });
      return;
    }

    // Sem dados de endereço suficientes
    const hasAddress = address.neighborhood || address.city || address.cep;
    if (!hasAddress) {
      setResult({ fee: defaultFee, distanceKm: null, loading: false, source: "store_default" });
      return;
    }

    setResult((prev) => ({ ...prev, loading: true, source: "pending" }));

    const timer = setTimeout(async () => {
      const pos = await geocodeAddress({
        neighborhood: address.neighborhood,
        city:         address.city,
        state:        address.state,
      });

      if (pos) {
        const km  = haversineKm(store.lat!, store.lng!, pos.lat, pos.lng);
        const fee = calculateDeliveryFee(km);
        setResult({ fee, distanceKm: km, loading: false, source: "distance" });
      } else {
        setResult({ fee: defaultFee, distanceKm: null, loading: false, source: "store_default" });
      }
    }, 800); // debounce para não geocodificar a cada tecla

    return () => clearTimeout(timer);
  }, [store?.id, store?.lat, store?.lng, address.neighborhood, address.city, address.state, address.cep]);

  return result;
}
