"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Map, {
  Source,
  Layer,
  type MapRef,
  type MapMouseEvent,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const STYLE = "mapbox://styles/mapbox/satellite-streets-v12";

const STRIP_LAYER_PATTERNS = [
  /^road/i,
  /^bridge/i,
  /^tunnel/i,
  /^transit/i,
  /^ferry/i,
  /^aeroway/i,
  /^golf/i,
  /^pedestrian/i,
  /^path/i,
];

type Selected = {
  iso: string;
  name: string;
};

export default function InteractiveGlobe() {
  const mapRef = useRef<MapRef | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    map.setFog({
      color: "rgb(186, 210, 235)",
      "high-color": "rgb(36, 92, 223)",
      "horizon-blend": 0.04,
      "space-color": "rgb(11, 11, 25)",
      "star-intensity": 0.45,
    } as Parameters<typeof map.setFog>[0]);

    for (const layer of map.getStyle().layers ?? []) {
      if (STRIP_LAYER_PATTERNS.some((re) => re.test(layer.id))) {
        try {
          map.removeLayer(layer.id);
        } catch {
          /* ignore */
        }
      }
    }
  }, []);

  const handleClick = useCallback((e: MapMouseEvent) => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const features = map.queryRenderedFeatures(e.point, {
      layers: ["country-fill"],
    });
    const feature = features[0];
    if (!feature) {
      setSelected(null);
      return;
    }
    const props = feature.properties ?? {};
    const iso = (props.iso_3166_1_alpha_3 as string) || (props.iso_3166_1 as string) || "";
    const name = (props.name_en as string) || (props.name as string) || iso || "Unknown";
    setSelected((curr) => (curr?.iso === iso ? null : { iso, name }));
  }, []);

  const fillFilter = useMemo<["==", string, string]>(
    () => ["==", "iso_3166_1_alpha_3", selected?.iso ?? "__none__"],
    [selected],
  );

  if (!TOKEN) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 text-center">
        <div className="max-w-md rounded-lg border border-blue-300/20 bg-slate-950/60 px-5 py-4 text-sm text-blue-100/90 backdrop-blur-md">
          <div className="mb-2 font-semibold text-blue-200">
            Mapbox token missing
          </div>
          Set <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code>{" "}
          in <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">.env.local</code> and your Vercel
          project, then redeploy. Free token at{" "}
          <span className="underline">account.mapbox.com</span>.
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={TOKEN}
        mapStyle={STYLE}
        projection={{ name: "globe" }}
        initialViewState={{
          longitude: 10,
          latitude: 25,
          zoom: 1.6,
        }}
        minZoom={0.6}
        maxZoom={20}
        renderWorldCopies={false}
        attributionControl={false}
        onLoad={handleLoad}
        onClick={handleClick}
        interactiveLayerIds={["country-fill"]}
        cursor={selected ? "pointer" : "grab"}
      >
        <Source
          id="country-boundaries"
          type="vector"
          url="mapbox://mapbox.country-boundaries-v1"
        >
          <Layer
            id="country-fill"
            type="fill"
            source-layer="country_boundaries"
            paint={{
              "fill-color": "rgba(96, 165, 250, 0.0)",
            }}
          />
          <Layer
            id="country-fill-selected"
            type="fill"
            source-layer="country_boundaries"
            filter={fillFilter}
            paint={{
              "fill-color": "rgba(96, 165, 250, 0.45)",
              "fill-outline-color": "rgba(191, 219, 254, 0.9)",
            }}
          />
        </Source>
      </Map>

      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 select-none">
        <div className="rounded-full border border-blue-300/20 bg-slate-950/60 px-4 py-2 text-center text-sm text-blue-100 backdrop-blur-md sm:text-base">
          {selected ? (
            <span>
              <span className="text-blue-300/70">Selected:</span>{" "}
              <span className="font-semibold">{selected.name}</span>
            </span>
          ) : (
            <span className="text-blue-200/70">No country selected</span>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-2 right-3 select-none text-[10px] tracking-wide text-blue-200/50">
        © Mapbox · © Maxar · © OpenStreetMap
      </div>
    </div>
  );
}
