/** Distância em km entre dois pontos usando a fórmula de Haversine. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Formata distância de forma legível: "350m" ou "1.2km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

/**
 * Calcula a taxa de entrega com base na distância.
 * Fórmula: R$ 5 base + R$ 2/km (mínimo R$ 7, máximo R$ 100).
 */
export function calculateDeliveryFee(distanceKm: number): number {
  const raw = 5 + 2 * distanceKm;
  return Math.max(7, Math.min(100, Math.ceil(raw)));
}

/** Ganho do entregador: 90% da taxa de entrega. */
export function courierEarnings(deliveryFee: number): number {
  return Math.round(deliveryFee * 0.9 * 100) / 100;
}

// Cache em memória de geocoding — evita chamadas repetidas ao Nominatim na sessão.
// Chave: string de consulta normalizada. Escopo: lifetime do módulo (tab/sessão).
const _geocodeMemCache = new Map<string, { lat: number; lng: number }>();

/**
 * Geocoding gratuito via OpenStreetMap Nominatim, com cache em memória.
 * Retorna lat/lng a partir de partes de endereço.
 * Rate limit Nominatim: 1 req/s — o cache garante que endereços repetidos
 * dentro da sessão não disparam novas requisições.
 */
export async function geocodeAddress(parts: {
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}): Promise<{ lat: number; lng: number } | null> {
  const query = [parts.address, parts.neighborhood, parts.city, parts.state, "Brasil"]
    .filter(Boolean)
    .join(", ");

  if (!query.replace(/,\s*Brasil$/, "").trim()) return null;

  const cached = _geocodeMemCache.get(query);
  if (cached) return cached;

  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=br`,
      { headers: { "Accept-Language": "pt-BR", "User-Agent": "BrasUX-Shopping/1.0" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data[0]) return null;
    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    _geocodeMemCache.set(query, result);
    return result;
  } catch {
    return null;
  }
}

/** Solicita posição GPS do navegador. Rejeita se negado ou indisponível. */
export function getBrowserPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não suportada neste navegador."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
