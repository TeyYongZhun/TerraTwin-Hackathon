/* Annual shading loss: fraction of irradiance-weighted sun-hours during which roof sample points sit inside the
   shadow of a taller neighbouring building or tree canopy. Self-shading and diffuse light are ignored (screening). */
import { type XY, bbox, bboxHit, centroid, pointInPolygon } from '../geo';
import type { Obstacle } from '../../data/township';
import { type SunPos, type SunSample, annualSunSamples } from './sun';
import { shadowPolygon } from './shadows';

export interface ShadeTarget { id: string; samplePoints: XY[]; receiverHeight: number }

/** Pitched home roof: the centroid plus points halfway to each vertex (max 8). */
export function homeSamplePoints(pts: XY[]): XY[] {
  const c = centroid(pts);
  return [c, ...pts.slice(0, 8).map((p) => [(p[0] + c[0]) / 2, (p[1] + c[1]) / 2] as XY)];
}

/** Shaded share (0–1) of the sample points at one sun position. */
export function shadedFraction(target: ShadeTarget, obstacles: Obstacle[], sun: SunPos): number {
  if (!target.samplePoints.length || sun.altitude <= 0.01) return 0;
  const tb = bbox(target.samplePoints);
  const shadows: { poly: XY[]; bb: ReturnType<typeof bbox> }[] = [];
  for (const o of obstacles) {
    if (o.id === target.id || o.h <= target.receiverHeight + 0.4) continue;
    const poly = shadowPolygon(o.pts, o.h, sun, target.receiverHeight);
    if (!poly) continue;
    const bb = bbox(poly);
    if (bboxHit(bb, tb)) shadows.push({ poly, bb });
  }
  if (!shadows.length) return 0;
  let shaded = 0;
  for (const p of target.samplePoints)
    if (shadows.some((s) => p[0] >= s.bb.minX && p[0] <= s.bb.maxX && p[1] >= s.bb.minY && p[1] <= s.bb.maxY && pointInPolygon(p, s.poly))) shaded++;
  return shaded / target.samplePoints.length;
}

/** Irradiance-weighted annual shading loss (0–1). */
export function annualShadingLoss(target: ShadeTarget, obstacles: Obstacle[], samples: SunSample[] = annualSunSamples()): number {
  const relevant = obstacles.filter((o) => o.id !== target.id && o.h > target.receiverHeight + 0.4);
  if (!relevant.length) return 0;
  let w = 0, lost = 0;
  for (const s of samples) { w += s.weight; lost += s.weight * shadedFraction(target, relevant, s); }
  return w ? lost / w : 0;
}

/** Monthly profile (12 values) — feeds the sun-path / shading chart. */
export function monthlyShading(target: ShadeTarget, obstacles: Obstacle[]): number[] {
  const samples = annualSunSamples(), out: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const ms = samples.filter((s) => s.month === m);
    let w = 0, lost = 0;
    for (const s of ms) { w += s.weight; lost += s.weight * shadedFraction(target, obstacles, s); }
    out.push(w ? lost / w : 0);
  }
  return out;
}
