/* City of Elmina township model built from real OpenStreetMap footprints (© OpenStreetMap contributors, ODbL).
   Heights are estimated from OSM `height` / `building:levels` tags where present, otherwise from building type.
   Building categories drive solar eligibility (rooftop / CREAM / car park) and electricity-demand profiles. */
import raw from './osm/elmina.osm.json';
import { type BBox, type LngLat, type XY, bbox, centroid, polygonArea, ringToXY, toLngLat, toXY } from '../lib/geo';

export type Category =
  | 'mall' | 'commercial' | 'education' | 'worship' | 'community' | 'industrial'
  | 'apartment' | 'residential' | 'utility' | 'construction' | 'canopy';

export interface Building {
  id: string; name?: string; osmType: string; category: Category;
  height: number; levels: number; ring: LngLat[]; pts: XY[]; area: number;
  center: XY; centerLL: LngLat; bb: BBox; homes: number;
}
export interface CarPark { id: string; name?: string; ring: LngLat[]; pts: XY[]; area: number; center: XY; centerLL: LngLat; bb: BBox; surface: string }
export interface Obstacle { id: string; pts: XY[]; h: number; bb: BBox }
export interface Substation { id: string; name: string; center: XY; centerLL: LngLat }

type RawFeature = { type: 'Feature'; properties: Record<string, string>; geometry: { type: string; coordinates: any } };
const FEATURES = (raw as unknown as { features: RawFeature[] }).features;

export const CATEGORY_LABEL: Record<Category, string> = {
  mall: 'Shopping mall', commercial: 'Commercial / retail', education: 'School / kindergarten', worship: 'Mosque / surau / temple',
  community: 'Community hall', industrial: 'Industrial', apartment: 'Apartment (strata)', residential: 'Landed home',
  utility: 'Utility building', construction: 'Under construction', canopy: 'Existing canopy roof',
};

function classify(p: Record<string, string>, area: number): Category {
  const b = p.building, name = (p.name || '').toLowerCase(), am = p.amenity;
  if (name.includes('lakeside mall') || name.includes('saujana utama mall') || name === 'central mart') return 'mall';
  if (name.includes('pencawang') || name.includes('rumah pam') || name.includes('water balancing') || name.includes('plaza tol')) return 'utility';
  if (b === 'construction') return 'construction';
  if (b === 'roof') return 'canopy';
  if (['terrace', 'house', 'semidetached_house', 'detached'].includes(b)) return 'residential';
  if (b === 'apartments' || name.startsWith('pangsapuri')) return 'apartment';
  if (b === 'school' || b === 'kindergarten' || am === 'kindergarten' || am === 'school') return 'education';
  if (b === 'mosque' || b === 'musalla' || am === 'place_of_worship' || name.includes('surau') || name.includes('masjid')) return 'worship';
  if (am === 'community_centre' || name.includes('dewan')) return 'community';
  if (b === 'industrial') return 'industrial';
  if (['retail', 'commercial', 'office'].includes(b) || p.shop || ['fast_food', 'cafe', 'restaurant'].includes(am) || p.leisure) return 'commercial';
  if (area < 45) return 'utility';
  if (area <= 420) return 'residential';
  return 'commercial';
}

const DEFAULT_HEIGHT: Record<Category, number> = {
  mall: 20, commercial: 10, education: 13, worship: 10, community: 7, industrial: 10,
  apartment: 16, residential: 8, utility: 4, construction: 6, canopy: 5.5,
};
function heightOf(p: Record<string, string>, cat: Category, area: number): { height: number; levels: number } {
  const h = parseFloat(p.height || '');
  const lv = parseFloat(p.building_levels || '');
  if (Number.isFinite(h) && h > 0) return { height: h, levels: Number.isFinite(lv) ? lv : Math.max(1, Math.round(h / 3.5)) };
  if (Number.isFinite(lv) && lv > 0) return { height: lv * 3.4 + 1.2, levels: lv };
  let height = DEFAULT_HEIGHT[cat];
  if (cat === 'commercial' && area > 2500) height = 13;
  if ((p.name || '').toLowerCase().includes('sales gallery')) height = 11;
  return { height, levels: Math.max(1, Math.round(height / 3.6)) };
}

/** Landed homes represented by one footprint: OSM maps whole terrace rows as single polygons (~130 m² per unit). */
function homesOf(p: Record<string, string>, cat: Category, area: number): number {
  if (cat !== 'residential') return 0;
  if (p.building === 'terrace') return Math.max(2, Math.round(area / 130));
  if (p.building === 'semidetached_house') return 2;
  return 1;
}

export interface Township {
  buildings: Building[]; byId: Map<string, Building>; carParks: CarPark[]; obstacles: Obstacle[]; substations: Substation[];
  water: RawFeature[]; green: RawFeature[]; trees: RawFeature[];
  /** Spatial grid of obstacles for fast neighbour queries (100 m cells). */
  near(center: XY, radius: number): Obstacle[];
}

let cache: Township | null = null;
export function getTownship(): Township {
  if (cache) return cache;
  const buildings: Building[] = [], carParks: CarPark[] = [], obstacles: Obstacle[] = [], substations: Substation[] = [];
  const water: RawFeature[] = [], green: RawFeature[] = [], trees: RawFeature[] = [];
  for (const f of FEATURES) {
    const p = f.properties, kind = p.kind;
    if (kind === 'water') { water.push(f); continue; }
    if (kind === 'green') { green.push(f); continue; }
    if (kind === 'trees') {
      trees.push(f);
      // Tree canopies are shading obstacles (assumed 10 m). Tree rows become 4 m-wide strips.
      if (f.geometry.type === 'Polygon') {
        const pts = ringToXY(f.geometry.coordinates[0]);
        obstacles.push({ id: p.osmId, pts, h: 10, bb: bbox(pts) });
      } else if (f.geometry.type === 'LineString') {
        const line: XY[] = f.geometry.coordinates.map((c: LngLat) => toXY(c));
        for (let i = 1; i < line.length; i++) {
          const [a, b] = [line[i - 1], line[i]], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const nx = (-(b[1] - a[1]) / len) * 2, ny = ((b[0] - a[0]) / len) * 2;
          const pts: XY[] = [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
          obstacles.push({ id: p.osmId + ':' + i, pts, h: 9, bb: bbox(pts) });
        }
      }
      continue;
    }
    if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue;
    const ring: LngLat[] = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
    const pts = ringToXY(ring);
    if (pts.length < 3) continue;
    const area = polygonArea(pts), center = centroid(pts), bb = bbox(pts);
    if (kind === 'parking') {
      carParks.push({ id: p.osmId, name: p.name, ring, pts, area, center, centerLL: toLngLat(center), bb, surface: p.parking || 'surface' });
      continue;
    }
    if (kind !== 'building') continue;
    const category = classify(p, area);
    const { height, levels } = heightOf(p, category, area);
    const b: Building = { id: p.osmId, name: p.name, osmType: p.building, category, height, levels, ring, pts, area, center, centerLL: toLngLat(center), bb, homes: homesOf(p, category, area) };
    buildings.push(b);
    obstacles.push({ id: b.id, pts, h: height, bb });
    if ((p.name || '').toLowerCase().includes('pencawang')) substations.push({ id: b.id, name: p.name, center, centerLL: b.centerLL });
  }
  const grid = new Map<string, Obstacle[]>();
  const key = (i: number, j: number) => i + ':' + j;
  for (const o of obstacles)
    for (let i = Math.floor(o.bb.minX / 100); i <= Math.floor(o.bb.maxX / 100); i++)
      for (let j = Math.floor(o.bb.minY / 100); j <= Math.floor(o.bb.maxY / 100); j++) {
        const k = key(i, j);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k)!.push(o);
      }
  const near = (c: XY, r: number) => {
    const out = new Set<Obstacle>();
    for (let i = Math.floor((c[0] - r) / 100); i <= Math.floor((c[0] + r) / 100); i++)
      for (let j = Math.floor((c[1] - r) / 100); j <= Math.floor((c[1] + r) / 100); j++) for (const o of grid.get(key(i, j)) || []) out.add(o);
    return [...out];
  };
  cache = { buildings, byId: new Map(buildings.map((b) => [b.id, b])), carParks, obstacles, substations, water, green, trees, near };
  return cache;
}
