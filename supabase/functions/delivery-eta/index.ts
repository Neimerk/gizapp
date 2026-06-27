import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, optionsResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAPBOX_TOKEN = Deno.env.get("MAPBOX_TOKEN") ?? "";
const AVG_SPEED_KMH = 22; // fallback Haversine (trânsito urbano)

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/search/geocoding/v6/forward?q=${encodeURIComponent(q)}&country=br&limit=1&access_token=${MAPBOX_TOKEN}`;
    const r = await fetch(url);
    const d = await r.json();
    const c = d.features?.[0]?.geometry?.coordinates;
    if (Array.isArray(c)) return { lng: c[0], lat: c[1] };
  } catch { /* ignore */ }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401, req);

    const { orderId } = await req.json() as { orderId?: string };
    if (!orderId) return json({ error: "orderId_required" }, 400, req);

    // Cliente autenticado (valida posse via RLS)
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "unauthorized" }, 401, req);

    // Service role para ler posição do entregador (fura RLS com segurança)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: order } = await admin
      .from("orders")
      .select("id, customer_id, dest_lat, dest_lng, delivery_address, delivery_number, delivery_neighborhood")
      .eq("id", orderId).single();
    if (!order || order.customer_id !== userData.user.id) return json({ error: "not_found" }, 404, req);

    // Geocode destino 1x e cacheia
    let destLat = order.dest_lat as number | null;
    let destLng = order.dest_lng as number | null;
    if (destLat == null || destLng == null) {
      const q = `${order.delivery_address} ${order.delivery_number}, ${order.delivery_neighborhood}, Brasil`;
      const g = await geocode(q);
      if (g) {
        destLat = g.lat; destLng = g.lng;
        await admin.from("orders").update({ dest_lat: destLat, dest_lng: destLng }).eq("id", orderId);
      }
    }
    if (destLat == null || destLng == null) return json({ error: "no_destination" }, 422, req);

    // Entregador atribuído → posição
    const { data: delivery } = await admin
      .from("deliveries")
      .select("courier_id, status")
      .eq("order_id", orderId).neq("status", "CANCELLED")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!delivery?.courier_id) return json({ error: "no_courier" }, 422, req);

    const { data: loc } = await admin
      .from("courier_locations")
      .select("lat, lng, updated_at")
      .eq("courier_id", delivery.courier_id).maybeSingle();
    if (!loc) return json({ error: "no_location" }, 422, req);

    // Mapbox Directions (driving-traffic); fallback Haversine
    if (MAPBOX_TOKEN) {
      try {
        const coords = `${loc.lng},${loc.lat};${destLng},${destLat}`;
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?overview=false&access_token=${MAPBOX_TOKEN}`;
        const r = await fetch(url);
        const d = await r.json();
        const route = d.routes?.[0];
        if (route) {
          return json({
            etaMinutes: Math.max(1, Math.round(route.duration / 60)),
            distanceKm: Math.round((route.distance / 1000) * 10) / 10,
            source: "mapbox",
            courierSeen: loc.updated_at,
          }, 200, req);
        }
      } catch { /* cai no fallback */ }
    }
    const km = haversineKm(loc.lat, loc.lng, destLat, destLng);
    return json({
      etaMinutes: Math.max(1, Math.round((km / AVG_SPEED_KMH) * 60)),
      distanceKm: Math.round(km * 10) / 10,
      source: "haversine",
      courierSeen: loc.updated_at,
    }, 200, req);
  } catch {
    return json({ error: "internal" }, 500, req);
  }
});
