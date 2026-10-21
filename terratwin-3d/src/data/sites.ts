/* SolarTwin site catalogue: commercial / institutional rooftops, car parks (solar canopy) and landed homes (CREAM),
   all derived from real OSM footprints. Engineering attributes are ILLUSTRATIVE stand-ins for SDP asset records. */
import precomputed from './solar-precomputed.json';
import { CATEGORY_LABEL, type Category, getTownship } from './township';
import { type LngLat, type XY, dist, seeded } from '../lib/geo';
import { type DemandClass, annualLoadKwh, demandClassOf } from '../lib/solar/energy';
import { homeKwp } from '../lib/solar/panels';
import { DEFAULT_ASSUMPTIONS } from './assumptions';

export type SiteKind = 'roof' | 'carpark' | 'home';
export interface SiteAttributes {
  roofType: string; roofAge: number | null; structuralCert: 'provided' | 'missing' | 'expired';
  ownership: 'SDP-owned' | 'SDP-managed (tenanted)' | 'Strata (JMB/MC)' | 'Third party' | 'Homeowner';
  bills12m: boolean; asBuilt: boolean; sld: boolean; geotech: boolean;
}
export interface Site {
  id: string; kind: SiteKind; name: string; subtitle: string; category: Category | 'parking';
  ring: LngLat[]; pts: XY[]; centerLL: LngLat; center: XY; area: number; height: number; floorArea: number;
  homes: number; kwp: number; usableArea: number; panels: number; shadingLoss: number;
  demandClass: DemandClass; annualLoad: number; attrs: SiteAttributes;
  substation: { name: string; distance: number } | null; nearName?: string; featured?: boolean;
}

type Pre = Record<string, { k: number; u: number; n: number; s: number }>;
const PRE = precomputed as unknown as Pre;

const ROOF_CATS: Category[] = ['mall', 'commercial', 'education', 'worship', 'community', 'industrial', 'apartment', 'canopy'];
const FEATURED: Record<string, Partial<SiteAttributes> & { featured?: boolean }> = {
  'way/1308938137': { ownership: 'SDP-owned', roofType: 'Metal deck (standing seam)', roofAge: 2, structuralCert: 'missing', bills12m: true, asBuilt: true, sld: true, featured: true },
  'way/1308938138': { ownership: 'SDP-owned', roofType: 'Concrete flat slab', roofAge: 9, structuralCert: 'provided', bills12m: true, asBuilt: true, sld: true, featured: true },
  'way/1508434458': { ownership: 'Third party', roofType: 'Concrete flat slab', roofAge: 1, structuralCert: 'provided', bills12m: false, featured: true },
  'way/1318133036': { ownership: 'SDP-owned', geotech: false, bills12m: true, asBuilt: true, sld: false, featured: true },
  'way/1493709517': { ownership: 'SDP-owned', geotech: false, bills12m: false, asBuilt: true, sld: false, featured: true },
  'way/1344498805': { ownership: 'SDP-owned', geotech: true, bills12m: true, asBuilt: true, sld: true, featured: true },
};

function attributesFor(id: string, kind: SiteKind, cat: Category | 'parking'): SiteAttributes {
  const r = seeded(id);
  const base: SiteAttributes = {
    roofType: kind === 'carpark' ? 'Open surface car park' : kind === 'home' ? 'Concrete roof tile (pitched)' : r() > 0.5 ? 'Metal deck' : 'Concrete flat slab',
    roofAge: kind === 'carpark' ? null : Math.round(2 + r() * 22),
    structuralCert: r() > 0.62 ? 'provided' : r() > 0.4 ? 'expired' : 'missing',
    ownership: kind === 'home' ? 'Homeowner' : cat === 'apartment' ? 'Strata (JMB/MC)' : cat === 'worship' || cat === 'education' ? 'Third party' : r() > 0.55 ? 'SDP-managed (tenanted)' : r() > 0.3 ? 'Third party' : 'SDP-owned',
    bills12m: kind === 'home' ? true : r() > 0.45, asBuilt: r() > 0.35, sld: r() > 0.5, geotech: r() > 0.6,
  };
  return { ...base, ...(FEATURED[id] || {}) };
}

let cache: { sites: Site[]; byId: Map<string, Site> } | null = null;
export function getSites(): { sites: Site[]; byId: Map<string, Site> } {
  if (cache) return cache;
  const t = getTownship(), sites: Site[] = [];
  const nearestSub = (c: XY) => {
    let best: Site['substation'] = null;
    for (const s of t.substations) { const d = dist(c, s.center); if (!best || d < best.distance) best = { name: s.name, distance: Math.round(d) }; }
    return best;
  };
  // Landmark a car park serves: the named building with the best size-vs-distance prominence within 350 m.
  const named = t.buildings.filter((b) => b.name && b.area > 250);
  const landmark = (c: XY) => {
    let best: { b: (typeof named)[number]; w: number } | null = null;
    for (const b of named) { const d = dist(c, b.center); const w = b.area / (d + 30) ** 2; if (d < 350 && (!best || w > best.w)) best = { b, w }; }
    return best?.b;
  };
  let idx = 0;
  for (const b of t.buildings) {
    const pre = PRE[b.id];
    if (ROOF_CATS.includes(b.category) && b.area >= 150) {
      const kwp = pre?.k ?? 0;
      if (kwp < 5) continue;
      const cls = demandClassOf(b.category);
      sites.push({
        id: b.id, kind: 'roof', name: b.name || `${CATEGORY_LABEL[b.category]} · R-${String(++idx).padStart(3, '0')}`,
        subtitle: CATEGORY_LABEL[b.category], category: b.category, ring: b.ring, pts: b.pts, centerLL: b.centerLL, center: b.center,
        area: b.area, height: b.height, floorArea: b.area * b.levels, homes: 0, kwp, usableArea: pre?.u ?? 0, panels: pre?.n ?? 0,
        shadingLoss: pre?.s ?? 0, demandClass: cls, annualLoad: annualLoadKwh(cls, b.area * b.levels, 0, DEFAULT_ASSUMPTIONS.homeLoadKwh),
        attrs: attributesFor(b.id, 'roof', b.category), substation: nearestSub(b.center), featured: !!FEATURED[b.id]?.featured,
      });
    } else if (b.category === 'residential') {
      const homes = b.homes, perHome = homeKwp(b.area / Math.max(1, homes));
      const label = b.osmType === 'terrace' ? `Terrace row · ${homes} homes` : b.osmType === 'semidetached_house' ? 'Semi-detached pair' : 'Landed home';
      sites.push({
        id: b.id, kind: 'home', name: label, subtitle: 'Landed residential · CREAM candidate', category: 'residential', ring: b.ring, pts: b.pts,
        centerLL: b.centerLL, center: b.center, area: b.area, height: b.height, floorArea: b.area * 2, homes, kwp: Math.round(perHome * homes * 10) / 10,
        usableArea: Math.round(b.area * 0.19), panels: Math.round((perHome * homes) / 0.55), shadingLoss: pre?.s ?? 0, demandClass: 'home',
        annualLoad: homes * DEFAULT_ASSUMPTIONS.homeLoadKwh, attrs: attributesFor(b.id, 'home', 'residential'), substation: nearestSub(b.center),
      });
    }
  }
  for (const c of t.carParks) {
    const pre = PRE[c.id];
    if (c.area < 800 || !pre || pre.k < 10) continue;
    const nearB = landmark(c.center), near = nearB?.name;
    const servesMall = !!nearB && (nearB.category === 'mall' || /gallery/i.test(near!));
    const cls: DemandClass = servesMall ? 'mall' : 'canopy';
    const side = nearB ? ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((Math.atan2(c.center[0] - nearB.center[0], c.center[1] - nearB.center[1]) * 180) / Math.PI + 360) % 360 / 45) % 8] : '';
    sites.push({
      id: c.id, kind: 'carpark', name: c.name ? `Car park · ${c.name}` : near ? `${near} · ${side} car park` : `Surface car park · P-${c.id.slice(-4)}`,
      subtitle: 'Solar canopy (carport) candidate', category: 'parking', ring: c.ring, pts: c.pts, centerLL: c.centerLL, center: c.center,
      area: c.area, height: 3.95, floorArea: 0, homes: 0, kwp: pre.k, usableArea: pre.u, panels: pre.n, shadingLoss: pre.s, demandClass: cls,
      // Behind-the-meter supply to the adjacent mall / gallery (35% of its load on that feeder), or EV charging + lighting otherwise.
      annualLoad: servesMall ? annualLoadKwh('mall', nearB!.area * nearB!.levels, 0, 0) * 0.35 : pre.k * 900,
      attrs: attributesFor(c.id, 'carpark', 'parking'), substation: nearestSub(c.center), nearName: near, featured: !!FEATURED[c.id]?.featured,
    });
  }
  cache = { sites, byId: new Map(sites.map((s) => [s.id, s])) };
  return cache;
}
