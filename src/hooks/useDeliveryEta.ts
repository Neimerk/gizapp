import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type EtaResult = { etaMinutes: number | null; distanceKm: number | null; loading: boolean };

const POLL_MS = 75_000; // ~75s entre recálculos (controla custo Directions)

/**
 * Busca o ETA do pedido enquanto `enabled` (tipicamente status === 3).
 * Retorna null enquanto não há rota/posição disponível.
 */
export function useDeliveryEta(orderId: string, enabled: boolean): EtaResult {
  const [state, setState] = useState<EtaResult>({ etaMinutes: null, distanceKm: null, loading: false });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !orderId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ etaMinutes: null, distanceKm: null, loading: false });
      return;
    }
    let active = true;

    async function fetchEta() {
      setState((s) => ({ ...s, loading: true }));
      try {
        const { data, error } = await supabase.functions.invoke("delivery-eta", { body: { orderId } });
        if (!active) return;
        if (error || !data || (data as { error?: string }).error) {
          setState({ etaMinutes: null, distanceKm: null, loading: false });
          return;
        }
        const d = data as { etaMinutes: number; distanceKm: number };
        setState({ etaMinutes: d.etaMinutes, distanceKm: d.distanceKm, loading: false });
      } catch {
        if (active) setState({ etaMinutes: null, distanceKm: null, loading: false });
      }
    }

    fetchEta();
    timer.current = setInterval(fetchEta, POLL_MS);
    return () => {
      active = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [orderId, enabled]);

  return state;
}
