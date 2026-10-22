/* Yield, demand profiles and demand-match (on-site self-consumption) for a site. */
import type { Category } from '../../data/township';
import { mytDate, sunPosition } from './sun';

export type DemandClass = 'mall' | 'commercial' | 'education' | 'worship' | 'community' | 'industrial' | 'apartment' | 'home' | 'canopy' | 'utility';

const shape = (fn: (h: number) => number) => { const v = Array.from({ length: 24 }, (_, h) => fn(h)); const s = v.reduce((a, b) => a + b, 0); return v.map((x) => x / s); };

/** Normalised 24 h load shapes (sum = 1) by demand class — illustrative typical-day profiles. */
export const LOAD_SHAPES: Record<DemandClass, number[]> = {
  mall: shape((h) => (h >= 10 && h <= 21 ? (h >= 13 && h <= 16 ? 1.15 : 1) : h === 9 || h === 22 ? 0.55 : 0.22)),
  commercial: shape((h) => (h >= 9 && h <= 18 ? 1 : h >= 19 && h <= 21 ? 0.55 : 0.2)),
  education: shape((h) => (h >= 7 && h <= 13 ? 1 : h >= 14 && h <= 17 ? 0.45 : 0.08)),
  worship: shape((h) => ([5, 6].includes(h) ? 0.6 : h === 13 || h === 14 ? 1 : h === 16 ? 0.65 : h === 19 || h === 20 ? 0.9 : 0.15)),
  community: shape((h) => (h >= 18 && h <= 22 ? 1 : h >= 9 && h <= 17 ? 0.35 : 0.1)),
  industrial: shape((h) => (h >= 8 && h <= 17 ? 1 : h >= 18 && h <= 22 ? 0.45 : 0.3)),
  apartment: shape((h) => (h >= 19 || h <= 6 ? 1 : 0.5)),
  home: shape((h) => (h <= 5 ? 0.62 : h <= 8 ? 0.5 : h <= 16 ? 0.3 : h >= 20 && h <= 22 ? 1.2 : 1)),
  canopy: shape((h) => (h >= 7 && h <= 22 ? 1.15 : 0.6)),
  utility: shape(() => 1),
};

/** Energy use intensity (kWh per m² of floor area per year) used to size annual load — illustrative. */
const EUI: Record<DemandClass, number> = { mall: 260, commercial: 210, education: 55, worship: 45, community: 40, industrial: 160, apartment: 30, home: 0, canopy: 300, utility: 120 };

export function demandClassOf(cat: Category): DemandClass {
  switch (cat) {
    case 'mall': return 'mall';
    case 'education': return 'education';
    case 'worship': return 'worship';
    case 'community': return 'community';
    case 'industrial': return 'industrial';
    case 'apartment': return 'apartment';
    case 'residential': return 'home';
    case 'canopy': return 'canopy';
    case 'utility': return 'utility';
    default: return 'commercial';
  }
}

export function annualLoadKwh(cls: DemandClass, floorArea: number, homes: number, homeLoad: number): number {
  if (cls === 'home') return Math.max(1, homes) * homeLoad;
  return floorArea * EUI[cls];
}

let pvShapeCache: number[] | null = null;
/** Average-day PV generation shape (sum = 1), averaged over the 21st of each month at Elmina. */
export function pvShape(): number[] {
  if (pvShapeCache) return pvShapeCache;
  const v = new Array(24).fill(0);
  for (let m = 1; m <= 12; m++) for (let h = 0; h < 24; h++) {
    const s = sunPosition(mytDate(2026, m, 21, h + 0.5));
    if (s.altitude > 0) v[h] += Math.pow(Math.sin(s.altitude), 1.15);
  }
  const sum = v.reduce((a, b) => a + b, 0);
  return (pvShapeCache = v.map((x) => x / sum));
}

export interface DemandMatch { selfConsumption: number; coverage: number; pvDay: number[]; loadDay: number[] }
/** Average-day hourly balance. selfConsumption = Σmin(PV, load)/ΣPV; coverage = Σmin/Σload. */
export function demandMatch(annualPv: number, annualLoad: number, cls: DemandClass): DemandMatch {
  const pv = pvShape().map((x) => (x * annualPv) / 365), ld = LOAD_SHAPES[cls].map((x) => (x * annualLoad) / 365);
  let used = 0;
  for (let h = 0; h < 24; h++) used += Math.min(pv[h], ld[h]);
  const sPv = pv.reduce((a, b) => a + b, 0), sLd = ld.reduce((a, b) => a + b, 0);
  return { selfConsumption: sPv ? used / sPv : 0, coverage: sLd ? used / sLd : 0, pvDay: pv, loadDay: ld };
}
