/* Detailed geometry for one site (panel layout, rooftop plant or canopy design, shading targets), computed on demand
   and cached. Shared by the 3D map layers and the site drawer so both always show the same design. */
import type { Site } from '../../data/sites';
import { type Obstacle, getTownship } from '../../data/township';
import { type XY, dist } from '../geo';
import { CANOPY, type CanopyDesign, designCanopy, layoutRoof, rooftopObstacles } from './panels';
import { type ShadeTarget, homeSamplePoints } from './shadingLoss';
import { MAX_SHADOW_M } from './shadows';

export interface SiteGeometry {
  panels: XY[][]; plant: XY[][]; canopy?: CanopyDesign;
  /** Height of the panel plane above ground (m). */
  panelBase: number;
  target: ShadeTarget; neighbours: Obstacle[];
}

const cache = new Map<string, SiteGeometry>();

export function siteGeometry(s: Site): SiteGeometry {
  const hit = cache.get(s.id);
  if (hit) return hit;
  const radius = Math.max(...s.pts.map((p) => dist(p, s.center)));
  const neighbours = getTownship().near(s.center, MAX_SHADOW_M + radius);
  let g: SiteGeometry;
  if (s.kind === 'carpark') {
    const d = designCanopy(s.pts);
    g = { panels: d.panels, plant: [], canopy: d, panelBase: CANOPY.roofTop, target: { id: s.id, samplePoints: d.samplePoints, receiverHeight: CANOPY.roofTop }, neighbours };
  } else if (s.kind === 'roof') {
    const plant = rooftopObstacles(s.id, s.pts, s.area), lay = layoutRoof(s.pts, { obstacles: plant });
    g = { panels: lay.panels, plant, panelBase: s.height, target: { id: s.id, samplePoints: lay.samplePoints, receiverHeight: s.height }, neighbours };
  } else {
    // Landed homes: drawn as a flat array capped at the CREAM-sized system (pitched planes are not modelled).
    const lay = layoutRoof(s.pts, { setback: 0.6, rowGap: 0.1, walkwayEvery: 99 });
    g = { panels: lay.panels.slice(0, s.panels), plant: [], panelBase: s.height, target: { id: s.id, samplePoints: homeSamplePoints(s.pts), receiverHeight: s.height - 1.5 }, neighbours };
  }
  cache.set(s.id, g);
  return g;
}
