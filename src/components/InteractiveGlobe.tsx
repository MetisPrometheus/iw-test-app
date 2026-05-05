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

const COUNTRIES_TOPO = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

const altitudeTier = (a: number): number =>
  a > 1.7 ? 0 : a > 1.2 ? 1 : a > 0.8 ? 2 : a > 0.25 ? 3 : 4;

const TIER_RANK_CUTOFF = [-1, 1, 3, 6, 0, 0] as const;
const TIER_MAX_CITIES = [0, 25, 60, 100, 0, 0] as const;

const tileEngineUrl = (x: number, y: number, level: number): string =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${level}/${y}/${x}`;

export default function InteractiveGlobe() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selected, setSelected] = useState<CountryFeature | null>(null);
  const [tier, setTier] = useState(0);
  const tierRef = useRef(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const isMobile = useMemo(
    () => (size.w > 0 ? size.w < 768 : false),
    [size.w],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(COUNTRIES_TOPO);
        const topo = await r.json();
        const { feature } = await import("topojson-client");
        const geo = feature(topo, topo.objects.countries) as unknown as CountriesGeoJSON;
        if (!cancelled) setCountries(geo.features);
      } catch {
        /* ignore */
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
      .then(
        (geo: {
          features: Array<{
            properties: Record<string, unknown>;
            geometry: { coordinates: [number, number] };
          }>;
        }) => {
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
            .filter((c) => c.name)
            .sort((a, b) => b.pop - a.pop);
          setCities(list);
        },
      )
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
    controls.autoRotate = !isMobile;
    controls.autoRotateSpeed = 0.3;
    controls.enableDamping = true;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.8;
    const radius = globeRef.current.getGlobeRadius?.() ?? 100;
    controls.minDistance = radius * 1.0008;
    globeRef.current.pointOfView({ altitude: 2.4 }, 0);

    const renderer = globeRef.current.renderer();
    if (renderer) {
      const cap = isMobile ? 1.5 : 1.75;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    }
  }, [countries.length, isMobile]);

  const visibleCities = useMemo(() => {
    if (!cities.length || tier === 0 || tier >= 4) return [];
    const rankCutoff = TIER_RANK_CUTOFF[tier];
    const maxN = TIER_MAX_CITIES[tier];
    const mobileScale = isMobile ? 0.5 : 1;
    return cities
      .filter((c) => c.rank <= rankCutoff)
      .slice(0, Math.floor(maxN * mobileScale));
  }, [cities, tier, isMobile]);

  const renderCityElement = useCallback((d: object): HTMLElement => {
    const city = d as City;
    const el = document.createElement("div");
    el.className =
      "pointer-events-none flex select-none items-center gap-1 whitespace-nowrap text-[11px] font-medium tracking-wide text-slate-100/95";
    el.style.transform = "translate(-50%, -100%)";
    el.style.textShadow = "0 1px 2px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.6)";
    const dot = document.createElement("span");
    dot.style.width = "5px";
    dot.style.height = "5px";
    dot.style.borderRadius = "9999px";
    dot.style.background = "rgba(248, 250, 252, 0.95)";
    dot.style.boxShadow = "0 0 0 1px rgba(15, 23, 42, 0.7), 0 0 4px rgba(96, 165, 250, 0.5)";
    dot.style.marginRight = "4px";
    const label = document.createElement("span");
    label.textContent = city.name;
    el.appendChild(dot);
    el.appendChild(label);
    return el;
  }, []);

  const polygonCapColor = useMemo(
    () => (d: object) =>
      d === selected ? "rgba(96, 165, 250, 0.55)" : "rgba(30, 64, 175, 0.0)",
    [selected],
  );

  const polygonAltitude = useMemo(() => () => 0.002, []);

  const handleZoom = useCallback((pov: { altitude: number }) => {
    const t = altitudeTier(pov.altitude);
    if (t !== tierRef.current) {
      tierRef.current = t;
      setTier(t);
    }
  }, []);

  return (
    <div className="relative h-full w-full">
      {size.w > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="https://cdn.jsdelivr.net/gh/turban/webgl-earth@master/images/2_no_clouds_4k.jpg"
          bumpImageUrl="https://cdn.jsdelivr.net/gh/turban/webgl-earth@master/images/elev_bump_4k.jpg"
          globeTileEngineUrl={tileEngineUrl}
          {...({ globeTileEngineMaxLevel: 19 } as object)}
          showAtmosphere
          atmosphereColor="#60a5fa"
          atmosphereAltitude={0.18}
          polygonsData={countries}
          polygonAltitude={polygonAltitude}
          polygonCapColor={polygonCapColor}
          polygonSideColor={() => "rgba(30, 64, 175, 0.15)"}
          polygonStrokeColor={() => "rgba(191, 219, 254, 0.45)"}
          polygonsTransitionDuration={0}
          onPolygonClick={(p) => {
            const f = p as CountryFeature;
            setSelected((curr) => (curr === f ? null : f));
            if (globeRef.current) {
              const controls = globeRef.current.controls();
              controls.autoRotate = false;
            }
          }}
          htmlElementsData={visibleCities}
          htmlLat={(d: object) => (d as City).lat}
          htmlLng={(d: object) => (d as City).lng}
          htmlAltitude={0.01}
          htmlElement={renderCityElement}
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
            <span className="text-blue-200/70">No country selected</span>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-2 right-3 select-none text-[10px] tracking-wide text-blue-200/50">
        Imagery © Esri, Maxar, Earthstar Geographics
      </div>
    </div>
  );
}
