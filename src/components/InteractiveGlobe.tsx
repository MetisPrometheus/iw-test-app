"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { GlobeMethods } from "react-globe.gl";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

type CountryFeature = {
  type: "Feature";
  properties: { name?: string; NAME?: string; ADMIN?: string; [k: string]: unknown };
  geometry: unknown;
};

type CountriesGeoJSON = {
  type: "FeatureCollection";
  features: CountryFeature[];
};

type City = {
  name: string;
  lat: number;
  lng: number;
  pop: number;
  rank: number;
};

const countryName = (f: CountryFeature): string =>
  (f.properties?.ADMIN as string) ||
  (f.properties?.NAME as string) ||
  (f.properties?.name as string) ||
  "Unknown";

const CITIES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places_simple.geojson";

const COUNTRIES_50M_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

const COUNTRIES_110M_TOPO = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

export default function InteractiveGlobe() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selected, setSelected] = useState<CountryFeature | null>(null);
  const [altitude, setAltitude] = useState(2.4);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(COUNTRIES_50M_URL);
        if (!r.ok) throw new Error("50m fetch failed");
        const geo = (await r.json()) as CountriesGeoJSON;
        if (!cancelled) setCountries(geo.features);
      } catch {
        try {
          const r = await fetch(COUNTRIES_110M_TOPO);
          const topo = await r.json();
          const { feature } = await import("topojson-client");
          const geo = feature(topo, topo.objects.countries) as unknown as CountriesGeoJSON;
          if (!cancelled) setCountries(geo.features);
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(CITIES_URL)
      .then((r) => r.json())
      .then((geo: { features: Array<{ properties: Record<string, unknown>; geometry: { coordinates: [number, number] } }> }) => {
        if (cancelled) return;
        const list: City[] = geo.features
          .map((f) => {
            const p = f.properties;
            const [lng, lat] = f.geometry.coordinates;
            return {
              name: (p.name as string) || (p.NAME as string) || "",
              lat,
              lng,
              pop: Number(p.pop_max ?? p.POP_MAX ?? 0),
              rank: Number(p.scalerank ?? p.SCALERANK ?? 10),
            };
          })
          .filter((c) => c.name);
        setCities(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableDamping = true;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.8;
    globeRef.current.pointOfView({ altitude: 2.4 }, 0);
  }, [countries.length]);

  const visibleCities = useMemo(() => {
    if (!cities.length) return [];
    if (altitude > 1.7) return [];
    const rankCutoff = altitude > 1.2 ? 1 : altitude > 0.8 ? 3 : altitude > 0.45 ? 6 : 10;
    return cities.filter((c) => c.rank <= rankCutoff);
  }, [cities, altitude]);

  const cityDotSize = useMemo(
    () => Math.max(0.05, Math.min(0.25, altitude * 0.12)),
    [altitude],
  );

  const labelSize = useMemo(
    () => Math.max(0.18, Math.min(0.55, altitude * 0.32)),
    [altitude],
  );

  const polygonCapColor = useMemo(
    () => (d: object) =>
      d === selected ? "rgba(96, 165, 250, 0.85)" : "rgba(30, 64, 175, 0.12)",
    [selected],
  );

  const polygonAltitude = useMemo(
    () => (d: object) => (d === selected ? 0.04 : 0.006),
    [selected],
  );

  const handleZoom = useCallback((pov: { altitude: number }) => {
    setAltitude(pov.altitude);
  }, []);

  return (
    <div className="relative h-full w-full">
      {size.w > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          showAtmosphere
          atmosphereColor="#60a5fa"
          atmosphereAltitude={0.18}
          polygonsData={countries}
          polygonAltitude={polygonAltitude}
          polygonCapColor={polygonCapColor}
          polygonSideColor={() => "rgba(30, 64, 175, 0.2)"}
          polygonStrokeColor={() => "rgba(191, 219, 254, 0.45)"}
          polygonsTransitionDuration={250}
          onPolygonClick={(p) => {
            const f = p as CountryFeature;
            setSelected((curr) => (curr === f ? null : f));
            if (globeRef.current) {
              const controls = globeRef.current.controls();
              controls.autoRotate = false;
            }
          }}
          pointsData={visibleCities}
          pointLat={(d: object) => (d as City).lat}
          pointLng={(d: object) => (d as City).lng}
          pointAltitude={0.005}
          pointRadius={cityDotSize}
          pointColor={() => "rgba(253, 224, 71, 0.95)"}
          pointResolution={6}
          pointsMerge
          labelsData={visibleCities}
          labelLat={(d: object) => (d as City).lat}
          labelLng={(d: object) => (d as City).lng}
          labelText={(d: object) => (d as City).name}
          labelSize={labelSize}
          labelDotRadius={0}
          labelColor={() => "rgba(248, 250, 252, 0.92)"}
          labelResolution={2}
          labelAltitude={0.012}
          labelIncludeDot={false}
          onZoom={handleZoom}
        />
      )}
      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 select-none">
        <div className="rounded-full border border-blue-300/20 bg-slate-950/60 px-4 py-2 text-center text-sm text-blue-100 backdrop-blur-md sm:text-base">
          {selected ? (
            <span>
              <span className="text-blue-300/70">Selected:</span>{" "}
              <span className="font-semibold">{countryName(selected)}</span>
            </span>
          ) : (
            <span className="text-blue-200/80">
              Drag to rotate · pinch / scroll to zoom · tap a country
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
