"use client";

import { useEffect, useRef, useState } from "react";
import type { Material, Texture, TextureLoader as TextureLoaderT } from "three";
import { tileUrl, type TileBounds, type TileKey } from "./globeTiles";

export type ReadyTile = TileBounds & {
  material: Material;
};

const CACHE_LIMIT = 256;

type Entry = {
  texture: Texture | null;
  material: Material | null;
  lastUsed: number;
  loading: boolean;
};

type ThreeBits = {
  loader: TextureLoaderT;
  SRGBColorSpace: unknown;
  LinearMipmapLinearFilter: unknown;
  LinearFilter: unknown;
  MeshLambertMaterial: new (opts: object) => Material;
  MeshBasicMaterial: new (opts: object) => Material;
};

let threePromise: Promise<ThreeBits> | null = null;
const loadThree = (): Promise<ThreeBits> => {
  if (!threePromise) {
    threePromise = import("three").then((THREE) => {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      return {
        loader,
        SRGBColorSpace: THREE.SRGBColorSpace,
        LinearMipmapLinearFilter: THREE.LinearMipmapLinearFilter,
        LinearFilter: THREE.LinearFilter,
        MeshLambertMaterial: THREE.MeshLambertMaterial as unknown as new (
          opts: object,
        ) => Material,
        MeshBasicMaterial: THREE.MeshBasicMaterial as unknown as new (
          opts: object,
        ) => Material,
      };
    });
  }
  return threePromise;
};

export function useTileCache(
  desired: TileBounds[],
  anisotropy: number,
): ReadyTile[] {
  const cacheRef = useRef<Map<TileKey, Entry>>(new Map());
  const [, force] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const cache = cacheRef.current;
    const now = performance.now();
    let scheduled = false;
    const schedule = () => {
      if (scheduled || cancelled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (!cancelled) force((n) => n + 1);
      });
    };

    loadThree().then((three) => {
      if (cancelled) return;
      for (const tile of desired) {
        const existing = cache.get(tile.key);
        if (existing) {
          existing.lastUsed = now;
          continue;
        }
        const entry: Entry = {
          texture: null,
          material: null,
          lastUsed: now,
          loading: true,
        };
        cache.set(tile.key, entry);
        three.loader.load(
          tileUrl(tile),
          (tex) => {
            (tex as unknown as { colorSpace: unknown }).colorSpace =
              three.SRGBColorSpace;
            tex.anisotropy = anisotropy;
            tex.minFilter = three.LinearMipmapLinearFilter as Texture["minFilter"];
            tex.magFilter = three.LinearFilter as Texture["magFilter"];
            tex.needsUpdate = true;
            entry.texture = tex;
            entry.material = new three.MeshLambertMaterial({
              map: tex,
              transparent: true,
              depthWrite: false,
            });
            entry.loading = false;
            schedule();
          },
          undefined,
          () => {
            entry.loading = false;
            entry.material = new three.MeshBasicMaterial({
              color: 0x000000,
              transparent: true,
              opacity: 0,
              depthWrite: false,
            });
            schedule();
          },
        );
      }

      if (cache.size > CACHE_LIMIT) {
        const entries: Array<[TileKey, Entry]> = [];
        cache.forEach((value, key) => entries.push([key, value]));
        entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
        const evict = entries.slice(0, cache.size - CACHE_LIMIT);
        for (const [k, e] of evict) {
          e.texture?.dispose();
          (e.material as { dispose?: () => void } | null)?.dispose?.();
          cache.delete(k);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [desired, anisotropy]);

  const out: ReadyTile[] = [];
  for (const tile of desired) {
    const e = cacheRef.current.get(tile.key);
    if (e?.material) out.push({ ...tile, material: e.material });
  }
  return out;
}
