import { useEffect, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export type CourierPosition = { lat: number; lng: number };

type Props = {
  deliveryAddress: string;
  deliveryNumber: string;
  deliveryNeighborhood: string;
  courierPosition?: CourierPosition | null;
};

type Coords = { lat: number; lng: number };

async function geocode(query: string, token: string): Promise<Coords | null> {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&country=BR&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    const [lng, lat] = data.features?.[0]?.center ?? [];
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
    return null;
  } catch {
    return null;
  }
}

export default function MapTrack({ deliveryAddress, deliveryNumber, deliveryNeighborhood, courierPosition }: Props) {
  const [destination, setDestination] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!MAPBOX_TOKEN) { setLoading(false); return; }
    const query = `${deliveryAddress} ${deliveryNumber}, ${deliveryNeighborhood}, Brasil`;
    geocode(query, MAPBOX_TOKEN).then((coords) => {
      setDestination(coords);
      setLoading(false);
    });
  }, [deliveryAddress, deliveryNumber, deliveryNeighborhood]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-line bg-subtle p-6 text-center">
        <div>
          <MapPin size={24} className="mx-auto mb-2 text-faint" />
          <p className="text-xs font-bold text-faint">Mapa indisponível</p>
          <p className="mt-0.5 text-[10px] text-[#cbd5e1]">Configure VITE_MAPBOX_TOKEN no Vercel</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-48 animate-pulse rounded-2xl bg-subtle-2" />
    );
  }

  if (!destination) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-line bg-subtle p-6 text-center">
        <div>
          <MapPin size={24} className="mx-auto mb-2 text-faint" />
          <p className="text-xs font-bold text-faint">Não foi possível localizar o endereço</p>
          <p className="mt-0.5 text-[10px] text-[#cbd5e1]">
            {deliveryAddress}, {deliveryNumber} — {deliveryNeighborhood}
          </p>
        </div>
      </div>
    );
  }

  const center = courierPosition
    ? { longitude: courierPosition.lng, latitude: courierPosition.lat }
    : { longitude: destination.lng, latitude: destination.lat };

  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ ...center, zoom: 15 }}
        style={{ width: "100%", height: 220 }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* Destination marker */}
        <Marker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#16a34a] shadow-lg ring-2 ring-white">
              <MapPin size={16} className="text-white" />
            </div>
            <div className="mt-0.5 whitespace-nowrap rounded-full bg-[#0f172a] px-2 py-0.5 text-[9px] font-black text-white shadow">
              Entrega
            </div>
          </div>
        </Marker>

        {/* Courier marker */}
        {courierPosition && (
          <Marker longitude={courierPosition.lng} latitude={courierPosition.lat} anchor="center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563eb] shadow-lg ring-2 ring-white">
              <Navigation size={16} className="text-white" />
            </div>
          </Marker>
        )}
      </Map>

      {/* Address label */}
      <div className="border-t border-line bg-surface px-4 py-2.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-faint">Destino</p>
        <p className="text-xs font-bold text-content">
          {deliveryAddress}, {deliveryNumber} — {deliveryNeighborhood}
        </p>
        {!courierPosition && (
          <p className="mt-0.5 text-[10px] text-faint">Aguardando localização do entregador…</p>
        )}
      </div>
    </div>
  );
}
