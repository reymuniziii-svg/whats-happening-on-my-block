import proj4 from "proj4";

const EPSG_2263 =
  "+proj=lcc +lat_1=41.03333333333333 +lat_2=40.66666666666666 +lat_0=40.16666666666666 +lon_0=-74 +x_0=300000 +y_0=0 +datum=NAD83 +units=us-ft +no_defs";

proj4.defs("EPSG:2263", EPSG_2263);

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
}

export function bboxForRadius(lat: number, lon: number, radiusMeters: number) {
  const latDelta = radiusMeters / 111320;
  const lonDelta = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  };
}

export function toBlockKey(lat: number, lon: number, bbl?: string): string {
  if (bbl) {
    return `bbl:${bbl}`;
  }
  return `grid:${lat.toFixed(4)}:${lon.toFixed(4)}`;
}

export function parseWktLineStringToLatLon(wkt: string): Array<[number, number]> {
  const trimmed = wkt.trim();
  const match = trimmed.match(/^LINESTRING\s*\((.*)\)$/i);
  if (!match) {
    return [];
  }

  const rawCoords = match[1]
    .split(",")
    .map((pair) => pair.trim().split(/\s+/).map(Number))
    .filter((pair) => pair.length >= 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1])) as number[][];

  const converted = rawCoords
    .map(([x, y]) => proj4("EPSG:2263", "WGS84", [x, y]) as [number, number])
    .filter(([lon, lat]) => Number.isFinite(lat) && Number.isFinite(lon))
    .map(([lon, lat]) => [lat, lon] as [number, number]);

  return converted;
}

function toLocalMeters(lat: number, lon: number, lat0: number): { x: number; y: number } {
  const x = ((lon * Math.PI) / 180) * 6378137 * Math.cos((lat0 * Math.PI) / 180);
  const y = ((lat * Math.PI) / 180) * 6378137;
  return { x, y };
}

function pointToSegmentDistanceMeters(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const projX = a.x + clamped * dx;
  const projY = a.y + clamped * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

export function distancePointToLineMeters(
  lat: number,
  lon: number,
  lineCoords: Array<[number, number]>,
): number {
  if (lineCoords.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (lineCoords.length === 1) {
    return haversineMeters(lat, lon, lineCoords[0][0], lineCoords[0][1]);
  }

  const p = toLocalMeters(lat, lon, lat);
  let min = Number.POSITIVE_INFINITY;

  for (let i = 0; i < lineCoords.length - 1; i += 1) {
    const a = toLocalMeters(lineCoords[i][0], lineCoords[i][1], lat);
    const b = toLocalMeters(lineCoords[i + 1][0], lineCoords[i + 1][1], lat);
    const dist = pointToSegmentDistanceMeters(p, a, b);
    if (dist < min) {
      min = dist;
    }
  }

  return min;
}

export function toPointWkt(lon: number, lat: number): string {
  return `POINT (${lon} ${lat})`;
}
