/* GeoJSON builders for the 3D township layers. Geometry is built once; only properties change with the analytics. */
import { getTownship } from '../data/township';
import { getSites, type Site } from '../data/sites';
import { type XY, toLngLat, xyToRing } from '../lib/geo';
import type { Analytics } from '../hooks/useAnalytics';
import { shadowPolygon } from '../lib/solar/shadows';
import type { SunPos } from '../lib/solar/sun';
import { CANOPY } from '../lib/solar/panels';
import { type PvSpec, TECH_COLOR, moduleOf } from '../lib/solar/modules';
import { siteGeometry } from '../lib/solar/siteGeometry';
import type { CanopySpec } from '../store/app';

type FC = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.Point>;
export const EMPTY: FC = { type: 'FeatureCollection', features: [] };
const poly = (ring: [number, number][], props: Record<string, unknown>, id?: number): GeoJSON.Feature<GeoJSON.Polygon> =>
  ({ type: 'Feature', id, properties: props, geometry: { type: 'Polygon', coordinates: [ring] } });

/** Numeric feature ids (for feature-state) ↔ site ids. Buildings first, then car parks. */
export const fidOf = new Map<string, number>();
export const sidOf: string[] = [];

let buildingBase: GeoJSON.Feature<GeoJSON.Polygon>[] | null = null, carparkBase: GeoJSON.Feature<GeoJSON.Polygon>[] | null = null;
function bases() {
  if (buildingBase && carparkBase) return;
  const t = getTownship();
  const reg = (id: string) => { const f = sidOf.length; sidOf.push(id); fidOf.set(id, f); return f; };
  buildingBase = t.buildings.map((b) => poly(b.ring, { sid: b.id, h: Math.round(b.height * 10) / 10, name: b.name || '' }, reg(b.id)));
  carparkBase = t.carParks.map((c) => poly(c.ring, { sid: c.id, name: c.name || '' }, reg(c.id)));
}

/** Buildings and car parks, tagged with solar percentile (-1 = not a candidate) and CREAM membership. */
export function townshipFC(a: Analytics, cream: Set<string>): { buildings: FC; carparks: FC } {
  bases();
  const tag = (f: GeoJSON.Feature<GeoJSON.Polygon>) => {
    const sid = f.properties!.sid as string, r = a.byId.get(sid);
    return { ...f, properties: { ...f.properties, pct: r ? Math.round(r.pct * 1000) / 1000 : -1, kind: r?.site.kind ?? 'none', cream: cream.has(sid) ? 1 : 0 } };
  };
  return { buildings: { type: 'FeatureCollection', features: buildingBase!.map(tag) }, carparks: { type: 'FeatureCollection', features: carparkBase!.map(tag) } };
}

/** Ground shadows of every building and tree canopy for one sun position. */
export function shadowsFC(sun: SunPos): FC {
  if (sun.altitude <= 0.02) return EMPTY;
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  for (const o of getTownship().obstacles) {
    const p = shadowPolygon(o.pts, o.h, sun);
    if (p) features.push(poly(xyToRing(p), {}));
  }
  return { type: 'FeatureCollection', features };
}

/** Panels (+ rooftop plant) for a set of sites, coloured by their PV module; `reveal` (0–1) grows the array from one
    corner for the build-out animation. */
export function panelsFC(sites: Site[], revealFor?: { id: string; t: number }, modules: Record<string, PvSpec> = {}): FC {
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  for (const s of sites) {
    if (s.kind === 'carpark') continue;
    const g = siteGeometry(s), c = TECH_COLOR[moduleOf(modules[s.id]).tech];
    let panels = g.panels;
    if (revealFor && revealFor.id === s.id && revealFor.t < 1) {
      const key = (q: XY[]) => q[0][0] * 0.6 + q[0][1];
      const sorted = [...panels].sort((x, y) => key(x) - key(y));
      panels = sorted.slice(0, Math.ceil(sorted.length * revealFor.t));
    }
    const base = g.panelBase + 0.12;
    for (const p of panels) features.push(poly(xyToRing(p), { base, top: base + 0.22, c }));
    for (const p of g.plant) features.push(poly(xyToRing(p), { base: g.panelBase, top: g.panelBase + 2.2, c: '#94a3b8' }));
  }
  return { type: 'FeatureCollection', features };
}

/** A build-out in progress: the canopy structure rising (panels follow onto the deck), or only the panels being laid. */
export interface CanopyReveal { id: string; t: number; part: 'structure' | 'panels' }

/** Solar carport canopies: paving and footing pads once the Canopy Materials tab has specified them, steel columns and the canopy
    deck, and PV modules on top only once the Solar Panels tab has chosen them. */
export function canopyFC(sites: Site[], revealFor?: CanopyReveal, modules: Record<string, PvSpec> = {}, specs: Record<string, CanopySpec> = {}): FC {
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  for (const s of sites) {
    const d = siteGeometry(s).canopy;
    if (!d) continue;
    const r = revealFor && revealFor.id === s.id ? revealFor : null;
    // Structure progress, and panel progress (panels follow the deck, or are laid on their own).
    const t = r && r.part === 'structure' ? r.t : 1;
    const tp = !r ? 1 : r.part === 'panels' ? r.t : Math.max(0, Math.min(1, (r.t - 0.7) / 0.3));
    if (specs[s.id]?.paver && t > 0.05) features.push(poly(s.ring, { base: 0, top: 0.08, c: '#a8a29e' }));
    // 1.8 m pad footings, centred on the 0.45 m columns.
    if (specs[s.id]?.concrete && t > 0.12) for (const c of d.columns) {
      const [cx, cy] = [c.reduce((a, p) => a + p[0], 0) / c.length, c.reduce((a, p) => a + p[1], 0) / c.length];
      features.push(poly(xyToRing(c.map(([x, y]): XY => [cx + (x - cx) * 4, cy + (y - cy) * 4])), { base: 0, top: 0.2, c: '#e7e5e4' }));
    }
    const colTop = CANOPY.clearance * Math.min(1, t * 1.6);
    for (const c of d.columns) features.push(poly(xyToRing(c), { base: 0, top: colTop, c: '#cbd5e1' }));
    if (t > 0.55) for (const st of d.strips) features.push(poly(xyToRing(st), { base: CANOPY.clearance, top: CANOPY.clearance + 0.22, c: '#f1f5f9' }));
    if (modules[s.id] && tp > 0) {
      const n = Math.ceil(d.panels.length * tp), c = TECH_COLOR[moduleOf(modules[s.id]).tech];
      for (const p of d.panels.slice(0, n)) features.push(poly(xyToRing(p), { base: CANOPY.clearance + 0.24, top: CANOPY.roofTop, c }));
    }
  }
  return { type: 'FeatureCollection', features };
}

export function outlineFC(s: Site | null): FC {
  return s ? { type: 'FeatureCollection', features: [poly(s.ring, {})] } : EMPTY;
}

/** Floating labels for featured sites and the current selection. */
export function labelsFC(selected: Site | null): FC {
  const list = getSites().sites.filter((s) => s.featured || s.id === selected?.id);
  return {
    type: 'FeatureCollection',
    features: list.map((s) => ({ type: 'Feature', properties: { name: s.name.replace(/^Car park · /, ''), sel: s.id === selected?.id ? 1 : 0 }, geometry: { type: 'Point', coordinates: toLngLat(s.center) } })),
  };
}
