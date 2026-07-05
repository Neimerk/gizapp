import { Layer, Source } from "react-map-gl/mapbox";
import type { LineString } from "geojson";

interface RouteLayerProps {
  id:       string;
  geometry: LineString;
  color?:   string;
  width?:   number;
  opacity?: number;
  dashed?:  boolean;
}

export function RouteLayer({
  id, geometry,
  color   = "#16a34a",
  width   = 4,
  opacity = 0.9,
  dashed  = false,
}: RouteLayerProps) {
  const data: GeoJSON.Feature<LineString> = { type: "Feature", geometry, properties: {} };

  return (
    <Source id={id} type="geojson" data={data}>
      <Layer
        id={`${id}-shadow`}
        type="line"
        paint={{
          "line-color":   "#000000",
          "line-width":   width + 4,
          "line-opacity": 0.08,
          "line-cap":     "round",
          "line-join":    "round",
        } as never}
      />
      <Layer
        id={`${id}-line`}
        type="line"
        paint={{
          "line-color":      color,
          "line-width":      width,
          "line-opacity":    opacity,
          "line-cap":        "round",
          "line-join":       "round",
          ...(dashed ? { "line-dasharray": [2, 2] } : {}),
        } as never}
      />
    </Source>
  );
}
