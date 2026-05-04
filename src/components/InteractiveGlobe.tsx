"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const countryName = (f: CountryFeature): string =>
  (f.properties?.ADMIN as string) ||
  (f.properties?.NAME as string) ||
  (f.properties?.name as string) ||
  "Unknown";

export default function InteractiveGlobe() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [selected, setSelected] = useState<CountryFeature | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    fetch("https://unpkg.com/world-atlas@2.0.2/countries-110m.json")
      .then((r) => r.json())
      .then(async (topo) => {
        const { feature } = await import("topojson-client");
        const geo = feature(topo, topo.objects.countries) as unknown as CountriesGeoJSON;
        setCountries(geo.features);
      })
      .catch(() => {
        fetch(
          "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
        )
          .then((r) => r.json())
          .then((geo: CountriesGeoJSON) => setCountries(geo.features));
      });
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

  const polygonCapColor = useMemo(
    () => (d: object) =>
      d === selected ? "rgba(96, 165, 250, 0.85)" : "rgba(30, 64, 175, 0.18)",
    [selected],
  );

  const polygonAltitude = useMemo(
    () => (d: object) => (d === selected ? 0.04 : 0.008),
    [selected],
  );

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
          polygonSideColor={() => "rgba(30, 64, 175, 0.25)"}
          polygonStrokeColor={() => "rgba(191, 219, 254, 0.55)"}
          polygonsTransitionDuration={250}
          onPolygonClick={(p) => {
            const f = p as CountryFeature;
            setSelected((curr) => (curr === f ? null : f));
            if (globeRef.current) {
              const controls = globeRef.current.controls();
              controls.autoRotate = false;
            }
          }}
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
