export type TileKey = string;

export type TileCoord = {
  x: number;
  y: number;
  z: number;
};

export type TileBounds = TileCoord & {
  key: TileKey;
  lat: number;
  lng: number;
  width: number;
  height: number;
};

const MAX_LAT = 85.05112878;

export const tileKey = (x: number, y: number, z: number): TileKey =>
  `${z}/${x}/${y}`;

export const tileToLng = (x: number, z: number): number =>
  (x / 2 ** z) * 360 - 180;

export const tileToLat = (y: number, z: number): number => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

export const lngToTileX = (lng: number, z: number): number =>
  Math.floor(((lng + 180) / 360) * 2 ** z);

export const latToTileY = (lat: number, z: number): number => {
  const clamped = Math.max(Math.min(lat, MAX_LAT), -MAX_LAT);
  const r = (clamped * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z,
  );
};

export const tileBounds = (x: number, y: number, z: number): TileBounds => {
  const west = tileToLng(x, z);
  const east = tileToLng(x + 1, z);
  const north = tileToLat(y, z);
  const south = tileToLat(y + 1, z);
  return {
    x,
    y,
    z,
    key: tileKey(x, y, z),
    lat: (north + south) / 2,
    lng: (west + east) / 2,
    width: east - west,
    height: north - south,
  };
};

export const altitudeToZoom = (alt: number, mobile: boolean): number => {
  const table: Array<[number, number]> = [
    [1.0, 0],
    [0.5, 3],
    [0.28, 4],
    [0.16, 5],
    [0.085, 6],
    [0.045, 7],
    [0.024, 8],
    [0.0, 9],
  ];
  for (const [threshold, zoom] of table) {
    if (alt > threshold) return mobile ? Math.max(0, zoom - 1) : zoom;
  }
  return mobile ? 8 : 9;
};

export const visibleTiles = (
  centerLat: number,
  centerLng: number,
  alt: number,
  z: number,
  maxTiles: number,
): TileBounds[] => {
  if (z <= 0) return [];

  const halfDeg = Math.min(80, Math.max(4, alt * 65));
  const minLat = Math.max(-MAX_LAT, centerLat - halfDeg);
  const maxLatBound = Math.min(MAX_LAT, centerLat + halfDeg);

  const lonHalf = Math.min(180, halfDeg / Math.max(0.2, Math.cos((centerLat * Math.PI) / 180)));
  const minLng = centerLng - lonHalf;
  const maxLng = centerLng + lonHalf;

  const yTop = latToTileY(maxLatBound, z);
  const yBottom = latToTileY(minLat, z);

  const span = 2 ** z;
  const xStart = Math.floor(((minLng + 180) / 360) * span);
  const xEnd = Math.floor(((maxLng + 180) / 360) * span);

  const tiles: TileBounds[] = [];
  for (let y = yTop; y <= yBottom; y++) {
    if (y < 0 || y >= span) continue;
    for (let xi = xStart; xi <= xEnd; xi++) {
      const x = ((xi % span) + span) % span;
      tiles.push(tileBounds(x, y, z));
      if (tiles.length >= maxTiles) return tiles;
    }
  }
  return tiles;
};

export const tileUrl = ({ x, y, z }: TileCoord): string =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
