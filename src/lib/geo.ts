export type LngLat = [number, number];

const R = 6371008.8; // mean earth radius, meters
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Point at `dist` meters from origin along `bearing` (degrees, 0 = north, clockwise). */
export function destination(origin: LngLat, bearing: number, dist: number): LngLat {
  const d = dist / R;
  const b = toRad(bearing);
  const lat1 = toRad(origin[1]);
  const lng1 = toRad(origin[0]);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 =
    lng1 +
    Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [((toDeg(lng2) + 540) % 360) - 180, toDeg(lat2)];
}

/** Great-circle distance in meters. */
export function distance(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearing(a: LngLat, b: LngLat): number {
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLng = toRad(b[0] - a[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Spherical polygon area in square meters (ring must be closed or will be closed). */
export function ringArea(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  const pts = ring.slice();
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) pts.push(first);
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [lng1, lat1] = pts[i]!;
    const [lng2, lat2] = pts[i + 1]!;
    total += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * R * R) / 2);
}

export function pathLength(path: LngLat[]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += distance(path[i - 1]!, path[i]!);
  return d;
}

export const SECTOR_COUNT = 12;
export const SECTOR_SPAN = 360 / SECTOR_COUNT;

/** Angular start of sector index (0-based) so that sector 1 is centered on top. */
export function sectorStartAngle(index: number, rotation: number): number {
  return rotation - SECTOR_SPAN / 2 + index * SECTOR_SPAN;
}

export function sectorMidAngle(index: number, rotation: number): number {
  return rotation + index * SECTOR_SPAN;
}

/** Geographic polygon ring for one 30° sector. */
export function sectorRing(
  center: LngLat,
  radius: number,
  index: number,
  rotation: number,
  steps = 12,
): LngLat[] {
  const start = sectorStartAngle(index, rotation);
  const ring: LngLat[] = [center];
  for (let i = 0; i <= steps; i++) {
    ring.push(destination(center, start + (SECTOR_SPAN * i) / steps, radius));
  }
  ring.push(center);
  return ring;
}

export function circleRing(center: LngLat, radius: number, steps = 96): LngLat[] {
  const ring: LngLat[] = [];
  for (let i = 0; i <= steps; i++) ring.push(destination(center, (360 * i) / steps, radius));
  return ring;
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`;
}

export function formatArea(sqm: number): string {
  return sqm >= 1_000_000 ? `${(sqm / 1_000_000).toFixed(3)} km²` : `${sqm.toFixed(0)} m²`;
}

export function formatLatLng(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Parses "42.69, 23.32" style coordinate input. */
export function parseCoordinates(input: string): LngLat | null {
  const m = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1]!);
  const lng = parseFloat(m[2]!);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return [lng, lat];
}
