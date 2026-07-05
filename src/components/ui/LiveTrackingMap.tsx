import { useEffect, useRef, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import { MapPin, Navigation, Store } from "lucide-react";
import type { LineString } from "geojson";
import { supabase } from "../../lib/supabase";
import { RouteLayer } from "./RouteLayer";
import { APPROACH_LIFECYCLE_STATES } from "../../hooks/useOrderTracking";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

const LIFECYCLE_LABEL: Record<string, string> = {
  waiting_courier:  "Aguardando entregador",
  courier_assigned: "Entregador a caminho",
  courier_arriving: "Entregador chegando na loja",
  picked_up:        "Pedido coletado",
  in_transit:       "Em rota de entrega",
  arrived:          "Entregador chegou",
  delivered:        "Entregue",
  cancelled:        "Cancelado",
  failed:           "Falhou",
};

const LIFECYCLE_COLOR: Record<string, string> = {
  waiting_courier:  "#f59e0b",
  courier_assigned: "#3b82f6",
  courier_arriving: "#8b5cf6",
  picked_up:        "#06b6d4",
  in_transit:       "#10b981",
  arrived:          "#16a34a",
  delivered:        "#15803d",
  cancelled:        "#ef4444",
  failed:           "#f87171",
};

interface DeliveryInfo {
  id:               string;
  lifecycle:        string;
  driverId:         string | null;
  pickupLat:        number | null;
  pickupLng:        number | null;
  dropoffLat:       number | null;
  dropoffLng:       number | null;
  routeGeometry:    LineString | null;
  estimatedMinutes: number | null;
}

interface DriverPos {
  lat:     number;
  lng:     number;
  heading: number | null;
}

async function geocodeAddress(query: string, token: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=BR&limit=1`;
    const data = await fetch(url).then(r => r.json());
    const [lng, lat] = data.features?.[0]?.center ?? [];
    return typeof lat === "number" ? { lat, lng } : null;
  } catch {
    return null;
  }
}

async function fetchRoute(
  from: { lat: number; lng: number },
  to:   { lat: number; lng: number },
  token: string,
): Promise<LineString | null> {
  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?geometries=geojson&overview=full&access_token=${token}`;
    const data = await fetch(url).then(r => r.json());
    return (data?.routes?.[0]?.geometry as LineString) ?? null;
  } catch {
    return null;
  }
}

interface Props {
  orderId:               string;
  deliveryAddress?:      string;
  deliveryNumber?:       string;
  deliveryNeighborhood?: string;
}

export default function LiveTrackingMap({ orderId, deliveryAddress, deliveryNumber, deliveryNeighborhood }: Props) {
  const [delivery,      setDelivery]      = useState<DeliveryInfo | null>(null);
  const [driverPos,     setDriverPos]     = useState<DriverPos | null>(null);
  const [fallbackPos,   setFallbackPos]   = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryRoute, setDeliveryRoute] = useState<LineString | null>(null);
  const [approachRoute, setApproachRoute] = useState<LineString | null>(null);
  const [loading,       setLoading]       = useState(true);
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const approachAc  = useRef<AbortController | null>(null);

  // 1 — Initial fetch
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);

      const { data } = await supabase
        .from("delivery_orders")
        .select("id, lifecycle, driver_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, route_geometry, estimated_minutes")
        .eq("order_id", orderId)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        const info: DeliveryInfo = {
          id:               data.id,
          lifecycle:        data.lifecycle,
          driverId:         data.driver_id ?? null,
          pickupLat:        data.pickup_lat ?? null,
          pickupLng:        data.pickup_lng ?? null,
          dropoffLat:       data.dropoff_lat ?? null,
          dropoffLng:       data.dropoff_lng ?? null,
          routeGeometry:    data.route_geometry as LineString | null,
          estimatedMinutes: data.estimated_minutes ?? null,
        };
        setDelivery(info);
        setDeliveryRoute(info.routeGeometry);

        if (info.driverId) {
          const { data: dd } = await supabase
            .from("delivery_drivers")
            .select("current_lat, current_lng, heading")
            .eq("id", info.driverId)
            .maybeSingle();
          if (dd?.current_lat && dd?.current_lng && !cancelled) {
            setDriverPos({ lat: dd.current_lat, lng: dd.current_lng, heading: dd.heading ?? null });
          }
        }
      } else if (deliveryAddress && MAPBOX_TOKEN) {
        const query = [deliveryAddress, deliveryNumber, deliveryNeighborhood, "Brasil"].filter(Boolean).join(", ");
        const coords = await geocodeAddress(query, MAPBOX_TOKEN);
        if (!cancelled && coords) setFallbackPos(coords);
      }

      if (!cancelled) setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, [orderId, deliveryAddress, deliveryNumber, deliveryNeighborhood]);

  // 2 — Fetch delivery route from Mapbox when DB geometry is missing
  useEffect(() => {
    if (!MAPBOX_TOKEN || deliveryRoute || !delivery) return;
    if (!delivery.pickupLat || !delivery.pickupLng || !delivery.dropoffLat || !delivery.dropoffLng) return;

    fetchRoute(
      { lat: delivery.pickupLat,  lng: delivery.pickupLng },
      { lat: delivery.dropoffLat, lng: delivery.dropoffLng },
      MAPBOX_TOKEN,
    ).then(geom => { if (geom) setDeliveryRoute(geom); });
  }, [delivery, deliveryRoute]);

  // 3 — Fetch approach route (driver → store) when driver moves
  useEffect(() => {
    if (!MAPBOX_TOKEN || !driverPos || !delivery) return;
    if (!delivery.pickupLat || !delivery.pickupLng) return;
    if (!APPROACH_LIFECYCLE_STATES.has(delivery.lifecycle)) {
      setApproachRoute(null);
      return;
    }

    approachAc.current?.abort();
    const ac = new AbortController();
    approachAc.current = ac;

    fetchRoute(
      { lat: driverPos.lat, lng: driverPos.lng },
      { lat: delivery.pickupLat, lng: delivery.pickupLng },
      MAPBOX_TOKEN,
    ).then(geom => {
      if (!ac.signal.aborted && geom) setApproachRoute(geom);
    });

    return () => { ac.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverPos?.lat, driverPos?.lng, delivery?.lifecycle, delivery?.pickupLat, delivery?.pickupLng]);

  // 4 — Realtime: delivery_orders + delivery_drivers
  useEffect(() => {
    if (!delivery) return;

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const ch = supabase
      .channel(`live-tracking:${orderId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "delivery_orders",
        filter: `id=eq.${delivery.id}`,
      }, (p) => {
        const row = p.new as typeof p.new & {
          lifecycle: string; driver_id: string | null;
          route_geometry: LineString | null; estimated_minutes: number | null;
        };
        setDelivery(prev => prev ? {
          ...prev,
          lifecycle:        row.lifecycle,
          driverId:         row.driver_id ?? prev.driverId,
          routeGeometry:    row.route_geometry ?? prev.routeGeometry,
          estimatedMinutes: row.estimated_minutes ?? prev.estimatedMinutes,
        } : prev);
        if (row.route_geometry) setDeliveryRoute(row.route_geometry);
        if (!APPROACH_LIFECYCLE_STATES.has(row.lifecycle)) setApproachRoute(null);
      });

    if (delivery.driverId) {
      ch.on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "delivery_drivers",
        filter: `id=eq.${delivery.driverId}`,
      }, (p) => {
        const dd = p.new as { current_lat: number; current_lng: number; heading: number | null };
        if (dd.current_lat && dd.current_lng) {
          setDriverPos({ lat: dd.current_lat, lng: dd.current_lng, heading: dd.heading ?? null });
        }
      });
    }

    ch.subscribe();
    channelRef.current = ch;

    return () => { supabase.removeChannel(ch); channelRef.current = null; };
  }, [delivery?.id, delivery?.driverId, orderId]);

  if (!MAPBOX_TOKEN) return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-line bg-subtle p-6 text-center">
      <div>
        <MapPin size={24} className="mx-auto mb-2 text-faint" />
        <p className="text-xs font-bold text-faint">Mapa indisponível</p>
        <p className="mt-0.5 text-[10px] text-[#cbd5e1]">Configure VITE_MAPBOX_TOKEN</p>
      </div>
    </div>
  );

  if (loading) return <div className="h-52 animate-pulse rounded-2xl bg-subtle-2" />;

  const destLat  = delivery?.dropoffLat  ?? fallbackPos?.lat;
  const destLng  = delivery?.dropoffLng  ?? fallbackPos?.lng;
  const storeLat = delivery?.pickupLat;
  const storeLng = delivery?.pickupLng;

  if (!destLat || !destLng) return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-line bg-subtle p-6 text-center">
      <div>
        <MapPin size={24} className="mx-auto mb-2 text-faint" />
        <p className="text-xs font-bold text-faint">Não foi possível localizar o endereço</p>
      </div>
    </div>
  );

  const centerLat = driverPos?.lat ?? destLat;
  const centerLng = driverPos?.lng ?? destLng;

  const lifecycle      = delivery?.lifecycle;
  const lifecycleLabel = lifecycle ? (LIFECYCLE_LABEL[lifecycle] ?? lifecycle) : null;
  const lifecycleColor = lifecycle ? (LIFECYCLE_COLOR[lifecycle] ?? "#64748b") : "#64748b";
  const eta            = delivery?.estimatedMinutes;
  const showApproach   = !!(approachRoute && lifecycle && APPROACH_LIFECYCLE_STATES.has(lifecycle));

  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ longitude: centerLng, latitude: centerLat, zoom: 14 }}
        style={{ width: "100%", height: 224 }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* Rota de aproximação: entregador → loja (dashed azul) */}
        {showApproach && (
          <RouteLayer id="approach" geometry={approachRoute!} color="#3b82f6" width={3} dashed opacity={0.7} />
        )}

        {/* Rota de entrega: loja → cliente (solid verde) */}
        {deliveryRoute && (
          <RouteLayer id="delivery" geometry={deliveryRoute} color="#16a34a" width={4} />
        )}

        {/* Loja */}
        {storeLat && storeLng && (
          <Marker longitude={storeLng} latitude={storeLat} anchor="center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f59e0b] shadow-lg ring-2 ring-white">
              <Store size={14} className="text-white" />
            </div>
          </Marker>
        )}

        {/* Destino */}
        <Marker longitude={destLng} latitude={destLat} anchor="bottom">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#16a34a] shadow-lg ring-2 ring-white">
              <MapPin size={14} className="text-white" />
            </div>
            <div className="mt-0.5 whitespace-nowrap rounded-full bg-[#0f172a] px-2 py-0.5 text-[9px] font-black text-white shadow">
              Entrega
            </div>
          </div>
        </Marker>

        {/* Entregador */}
        {driverPos && (
          <Marker longitude={driverPos.lng} latitude={driverPos.lat} anchor="center">
            <div
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "#2563eb",
                border: "3px solid white",
                boxShadow: "0 0 0 3px rgba(37,99,235,0.3), 0 4px 12px rgba(0,0,0,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transform: `rotate(${driverPos.heading ?? 0}deg)`,
                transition: "transform 0.5s ease",
              }}
            >
              <Navigation size={16} className="text-white" />
            </div>
          </Marker>
        )}
      </Map>

      {/* Rodapé */}
      <div className="flex items-center justify-between gap-2 border-t border-line bg-surface px-4 py-2.5">
        <div>
          {lifecycleLabel ? (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest text-faint">Status</p>
              <p className="text-xs font-black" style={{ color: lifecycleColor }}>{lifecycleLabel}</p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest text-faint">Destino</p>
              <p className="text-xs font-black text-content">
                {[deliveryAddress, deliveryNumber, deliveryNeighborhood].filter(Boolean).join(", ")}
              </p>
            </>
          )}
        </div>
        {eta && lifecycle && !["delivered", "cancelled", "failed"].includes(lifecycle) && (
          <div className="shrink-0 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-1 text-center">
            <p className="text-[10px] font-black text-[#15803d]">~{eta} min</p>
          </div>
        )}
        {!driverPos && !["waiting_courier", "delivered", "cancelled"].includes(lifecycle ?? "") && (
          <p className="shrink-0 text-[10px] text-faint">Aguardando localização…</p>
        )}
      </div>
    </div>
  );
}
