import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { LineString } from "geojson";

export type TrackingState = {
  deliveryId:    string | null;
  lifecycle:     string | null;
  driverId:      string | null;
  driverPos:     { lat: number; lng: number; heading: number | null } | null;
  eta:           number | null;
  routeGeometry: LineString | null;
  pickupCoords:  { lat: number; lng: number } | null;
  dropoffCoords: { lat: number; lng: number } | null;
};

const EMPTY: TrackingState = {
  deliveryId: null, lifecycle: null, driverId: null,
  driverPos: null, eta: null, routeGeometry: null,
  pickupCoords: null, dropoffCoords: null,
};

export const LIVE_LIFECYCLE_STATES = new Set([
  "waiting_courier", "courier_assigned", "courier_arriving",
  "picked_up", "in_transit", "arrived",
]);

export const APPROACH_LIFECYCLE_STATES = new Set([
  "courier_assigned", "courier_arriving",
]);

type TrackingRow = {
  id: string; lifecycle: string; driver_id: string | null;
  pickup_lat: number | null; pickup_lng: number | null;
  dropoff_lat: number | null; dropoff_lng: number | null;
  route_geometry: LineString | null; estimated_minutes: number | null;
};
type DriverPosRow = { current_lat: number | null; current_lng: number | null; heading: number | null };

// Polls delivery status via SECURITY DEFINER RPCs (works for anon/guest users)
async function fetchTrackingViaRpc(orderId: string): Promise<TrackingState> {
  const { data } = await supabase
    .rpc("get_delivery_tracking_public", { p_order_id: orderId })
    .single();

  const d = data as TrackingRow | null;
  if (!d) return EMPTY;

  const next: TrackingState = {
    deliveryId:    d.id,
    lifecycle:     d.lifecycle,
    driverId:      d.driver_id ?? null,
    driverPos:     null,
    eta:           d.estimated_minutes ?? null,
    routeGeometry: d.route_geometry,
    pickupCoords:  d.pickup_lat && d.pickup_lng
      ? { lat: d.pickup_lat, lng: d.pickup_lng } : null,
    dropoffCoords: d.dropoff_lat && d.dropoff_lng
      ? { lat: d.dropoff_lat, lng: d.dropoff_lng } : null,
  };

  if (d.driver_id) {
    const { data: posData } = await supabase
      .rpc("get_driver_position_public", { p_driver_id: d.driver_id })
      .single();
    const dd = posData as DriverPosRow | null;
    if (dd?.current_lat && dd?.current_lng) {
      next.driverPos = { lat: dd.current_lat, lng: dd.current_lng, heading: dd.heading ?? null };
    }
  }

  return next;
}

export function useOrderTracking(orderId: string | null | undefined): TrackingState {
  const [state, setState] = useState<TrackingState>(EMPTY);
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAuthRef   = useRef<boolean | null>(null);
  // Ref para evitar closure stale do orderId no polling de guests
  const orderIdRef  = useRef(orderId);
  useEffect(() => { orderIdRef.current = orderId; }, [orderId]);

  // Initial fetch + determine auth status
  useEffect(() => {
    if (!orderId) { setState(EMPTY); return; }
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      isAuthRef.current = !!session;

      if (session) {
        // Authenticated: query directly (RLS grants access)
        const { data: d } = await supabase
          .from("delivery_orders")
          .select("id, lifecycle, driver_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, route_geometry, estimated_minutes")
          .eq("order_id", orderId)
          .maybeSingle();

        if (cancelled || !d) return;

        const next: TrackingState = {
          deliveryId:    d.id,
          lifecycle:     d.lifecycle,
          driverId:      d.driver_id ?? null,
          driverPos:     null,
          eta:           d.estimated_minutes ?? null,
          routeGeometry: d.route_geometry as LineString | null,
          pickupCoords:  d.pickup_lat && d.pickup_lng
            ? { lat: d.pickup_lat, lng: d.pickup_lng } : null,
          dropoffCoords: d.dropoff_lat && d.dropoff_lng
            ? { lat: d.dropoff_lat, lng: d.dropoff_lng } : null,
        };

        if (d.driver_id) {
          const { data: dd } = await supabase
            .from("delivery_drivers")
            .select("current_lat, current_lng, heading")
            .eq("id", d.driver_id)
            .maybeSingle();
          if (dd?.current_lat && dd?.current_lng) {
            next.driverPos = { lat: dd.current_lat, lng: dd.current_lng, heading: dd.heading ?? null };
          }
        }

        if (!cancelled) setState(next);
      } else {
        // Guest / anon: use SECURITY DEFINER RPCs
        const next = await fetchTrackingViaRpc(orderId);
        if (!cancelled) setState(next);
      }
    })();

    return () => { cancelled = true; };
  }, [orderId]);

  // Realtime (authenticated) or polling (guest)
  useEffect(() => {
    const { deliveryId, driverId } = state;
    if (!deliveryId) return;

    // Clean up previous subscriptions/polling
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    if (pollRef.current)    { clearInterval(pollRef.current); pollRef.current = null; }

    if (isAuthRef.current) {
      // Authenticated: Supabase Realtime (RLS allows)
      const ch = supabase
        .channel(`order-tracking:${orderId}:${deliveryId}`)
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "delivery_orders",
          filter: `id=eq.${deliveryId}`,
        }, (p) => {
          const row = p.new as {
            lifecycle: string; driver_id: string | null;
            route_geometry: LineString | null; estimated_minutes: number | null;
            pickup_lat: number | null; pickup_lng: number | null;
            dropoff_lat: number | null; dropoff_lng: number | null;
          };
          setState(prev => ({
            ...prev,
            lifecycle:     row.lifecycle,
            driverId:      row.driver_id ?? prev.driverId,
            routeGeometry: row.route_geometry ?? prev.routeGeometry,
            eta:           row.estimated_minutes ?? prev.eta,
            pickupCoords:  row.pickup_lat && row.pickup_lng
              ? { lat: row.pickup_lat, lng: row.pickup_lng } : prev.pickupCoords,
            dropoffCoords: row.dropoff_lat && row.dropoff_lng
              ? { lat: row.dropoff_lat, lng: row.dropoff_lng } : prev.dropoffCoords,
          }));
        });

      if (driverId) {
        ch.on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "delivery_drivers",
          filter: `id=eq.${driverId}`,
        }, (p) => {
          const dd = p.new as { current_lat: number; current_lng: number; heading: number | null };
          if (dd.current_lat && dd.current_lng) {
            setState(prev => ({
              ...prev,
              driverPos: { lat: dd.current_lat, lng: dd.current_lng, heading: dd.heading ?? null },
            }));
          }
        });
      }

      ch.subscribe();
      channelRef.current = ch;
    } else {
      // Guest: poll every 5s via RPC (Realtime needs auth)
      const poll = async () => {
        const id = orderIdRef.current;
        if (!id) return;
        const next = await fetchTrackingViaRpc(id);
        if (next.deliveryId) setState(next);
      };
      pollRef.current = setInterval(poll, 5000);
    }

    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      if (pollRef.current)    { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [state.deliveryId, state.driverId]);

  return state;
}
