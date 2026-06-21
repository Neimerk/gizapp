import { useState, useEffect, useCallback } from "react";

export type UserPosition = { lat: number; lng: number };

const CACHE_KEY = "brasux-user-position";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function loadCached(): UserPosition | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat: number; lng: number; ts: number };
    if (Date.now() - parsed.ts > CACHE_TTL) return null;
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

/**
 * Hook que obtém e persiste a posição GPS do usuário.
 *
 * - Carrega do cache imediatamente se válido (< 5 min).
 * - Solicita permissão automaticamente na primeira montagem.
 * - Expõe `request()` para re-solicitar manualmente.
 */
export function useGeolocation() {
  const [position, setPosition] = useState<UserPosition | null>(loadCached);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const request = useCallback(async () => {
    if (!navigator.geolocation) {
      setError("Geolocalização não disponível.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(p);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ...p, ts: Date.now() }));
        setLoading(false);
      },
      () => {
        setError("Localização não autorizada.");
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 300_000 },
    );
  }, []);

  // Solicita automaticamente na primeira montagem (silencioso se negado)
  useEffect(() => {
    if (!position) request();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { position, loading, error, request };
}
