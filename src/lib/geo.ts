/* Lightweight planar geometry in a local metric frame (x = east, y = north, metres) centred on City of Elmina.
   Accurate to well under 0.1% over the few-km township extent, and much faster than spherical ops for the
   thousands of shadow / panel tests the solar engine runs. */
export type LngLat = [number, number];
export type XY = [number, number];

/** Elmina Lakeside Mall (OSM way/1308938137) — reference origin of the local frame. */
export const ORIGIN: LngLat = [101.51006, 3.18169];
const M_PER_DEG_LAT = 110_574;
const LON_M = 111_320 * Math.cos((ORIGIN[1] * Math.PI) / 180);

export const toXY = ([lon, lat]: LngLat): XY => [(lon - ORIGIN[0]) * LON_M, (lat - ORIGIN[1]) * M_PER_DEG_LAT];
export const toLngLat = ([x, y]: XY): LngLat => [ORIGIN[0] + x / LON_M, ORIGIN[1] + y / M_PER_DEG_LAT];

/** Ring → open list of XY points (drops the closing duplicate). */
export function ringToXY(ring: LngLat[]): XY[] {
  const pts = ring.map(toXY);
  const a = pts[0], z = pts[pts.length - 1];
  if (pts.length > 1 && a[0] === z[0] && a[1] === z[1]) pts.pop();
  return pts;
}
/** Open XY list → closed lon/lat ring for GeoJSON. */
export function xyToRing(pts: XY[]): LngLat[] {
  const ring = pts.map(toLngLat);
  ring.push(ring[0]);
  return ring;
}

export function polygonArea(pts: XY[]): number {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  return Math.abs(s) / 2;
}
export function centroid(pts: XY[]): XY {
  let x = 0, y = 0, a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    x += (pts[j][0] + pts[i][0]) * f;
    y += (pts[j][1] + pts[i][1]) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-9) return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  return [x / (3 * a), y / (3 * a)];
}
export function pointInPolygon([px, py]: XY, pts: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export interface BBox { minX: number; minY: number; maxX: number; maxY: number }
export function bbox(pts: XY[]): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  return { minX, minY, maxX, maxY };
}
export const bboxHit = (a: BBox, b: BBox) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
export const dist = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Distance from point p to segment ab. */
export function distToSegment(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
export function distToEdges(p: XY, pts: XY[]): number {
  let d = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) d = Math.min(d, distToSegment(p, pts[j], pts[i]));
  return d;
}

/** Monotone-chain convex hull (counter-clockwise, open ring). */
export function convexHull(points: XY[]): XY[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: XY, a: XY, b: XY) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: XY[] = [], upper: XY[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

/** Orientation (radians) of the longest edge of the polygon's convex hull — the roof's long axis. */
export function principalAngle(pts: XY[]): number {
  const h = convexHull(pts);
  let best = 0, ang = 0;
  for (let i = 0, j = h.length - 1; i < h.length; j = i++) {
    const l = dist(h[i], h[j]);
    if (l > best) { best = l; ang = Math.atan2(h[i][1] - h[j][1], h[i][0] - h[j][0]); }
  }
  return ang;
}
export const rotate = ([x, y]: XY, a: number, c: XY = [0, 0]): XY => {
  const s = Math.sin(a), k = Math.cos(a), dx = x - c[0], dy = y - c[1];
  return [c[0] + dx * k - dy * s, c[1] + dx * s + dy * k];
};

/** Small deterministic PRNG so illustrative attributes are stable between reloads. */
export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
