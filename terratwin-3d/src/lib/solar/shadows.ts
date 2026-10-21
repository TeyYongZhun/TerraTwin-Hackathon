/* Shadow geometry. A prism of height H standing above a receiving plane at height h casts a shadow equal to the
   convex hull of its footprint and the footprint translated by L = (H − h) / tan(altitude), away from the sun. */
import { type XY, convexHull } from '../geo';
import type { SunPos } from './sun';

export const MAX_SHADOW_M = 250;

export function shadowOffset(height: number, sun: SunPos, receiverHeight = 0): XY | null {
  const rel = height - receiverHeight;
  if (sun.altitude <= 0.01 || rel <= 0) return null;
  const len = Math.min(MAX_SHADOW_M, rel / Math.tan(sun.altitude));
  const away = ((sun.bearing + 180) * Math.PI) / 180; // shadow points away from the sun
  return [len * Math.sin(away), len * Math.cos(away)];
}

export function shadowPolygon(footprint: XY[], height: number, sun: SunPos, receiverHeight = 0): XY[] | null {
  const off = shadowOffset(height, sun, receiverHeight);
  if (!off) return null;
  return convexHull([...footprint, ...footprint.map(([x, y]) => [x + off[0], y + off[1]] as XY)]);
}
