/* Usable roof area, PV panel layout and solar-canopy design for car parks.
   Works in the local metric frame, aligned to each roof's long axis. */
import { type XY, centroid, distToEdges, pointInPolygon, polygonArea, principalAngle, rotate, seeded, bbox } from '../geo';

export const PANEL = { width: 1.134, length: 2.278, kw: 0.55 } as const; // 550 W mono PERC / TOPCon module
export const PANEL_AREA = PANEL.width * PANEL.length;

export interface RoofLayout {
  angle: number;
  /** Panel rectangles (4 points each) in the local frame. */
  panels: XY[][];
  /** Rooftop plant / skylight zones excluded from the layout (illustrative detection). */
  obstacles: XY[][];
  count: number;
  kwp: number;
  /** Area inside the edge setback and outside obstacles (m²). */
  usableArea: number;
  /** Representative points inside the usable area, used for shading sampling. */
  samplePoints: XY[];
}

const rect = (cx: number, cy: number, w: number, l: number): XY[] => [[cx - w / 2, cy - l / 2], [cx + w / 2, cy - l / 2], [cx + w / 2, cy + l / 2], [cx - w / 2, cy + l / 2]];

/** Illustrative rooftop plant (AHUs, chillers, skylights) on large flat roofs, standing in for a CV detector. */
export function rooftopObstacles(id: string, pts: XY[], area: number): XY[][] {
  if (area < 1200) return [];
  const n = Math.min(10, Math.max(2, Math.floor(area / 2600)));
  const rnd = seeded(id), ang = principalAngle(pts), c = centroid(pts);
  const local = pts.map((p) => rotate(p, -ang, c)), bb = bbox(local), out: XY[][] = [];
  for (let tries = 0; out.length < n && tries < 400; tries++) {
    const x = bb.minX + rnd() * (bb.maxX - bb.minX), y = bb.minY + rnd() * (bb.maxY - bb.minY);
    const big = rnd() > 0.6, w = big ? 9 : 5, l = big ? 6 : 3.5;
    const box = rect(x, y, w, l);
    if (box.every((p) => pointInPolygon(p, local) && distToEdges(p, local) > 3)) out.push(box.map((p) => rotate(p, ang, c)));
  }
  return out;
}

export interface LayoutOptions { setback?: number; rowGap?: number; obstacles?: XY[][]; walkwayEvery?: number; usableCell?: number }

/** Fit portrait panels in rows along the roof's long axis inside an edge setback, skipping obstacle zones. */
export function layoutRoof(pts: XY[], opts: LayoutOptions = {}): RoofLayout {
  const setback = opts.setback ?? 1.0, rowGap = opts.rowGap ?? 0.35, walkway = opts.walkwayEvery ?? 12;
  const ang = principalAngle(pts), c = centroid(pts);
  const local = pts.map((p) => rotate(p, -ang, c));
  const obs = (opts.obstacles || []).map((o) => o.map((p) => rotate(p, -ang, c)));
  const bb = bbox(local);
  const free = (p: XY) => pointInPolygon(p, local) && distToEdges(p, local) >= setback && !obs.some((o) => pointInPolygon(p, o) || distToEdges(p, o) < 0.6);

  // Usable area by grid sampling.
  const area = polygonArea(local);
  const cell = opts.usableCell ?? (area > 6000 ? 1.5 : area > 1500 ? 1 : 0.5);
  let usableCells = 0;
  const samples: XY[] = [];
  for (let y = bb.minY + cell / 2; y < bb.maxY; y += cell)
    for (let x = bb.minX + cell / 2; x < bb.maxX; x += cell)
      if (free([x, y])) { usableCells++; samples.push([x, y]); }
  const stride = Math.max(1, Math.floor(samples.length / 28));
  const samplePoints = samples.filter((_, i) => i % stride === 0).map((p) => rotate(p, ang, c));

  const panels: XY[][] = [];
  let row = 0;
  for (let y = bb.minY + setback + PANEL.length / 2; y + PANEL.length / 2 <= bb.maxY - setback + 1e-6; y += PANEL.length + rowGap, row++) {
    if (row > 0 && row % 6 === 0) y += 0.9; // maintenance corridor every 6 rows
    let col = 0;
    for (let x = bb.minX + setback + PANEL.width / 2; x + PANEL.width / 2 <= bb.maxX - setback + 1e-6; x += PANEL.width + 0.02, col++) {
      if (col > 0 && col % walkway === 0) x += 0.8; // walkway between blocks
      const r = rect(x, y, PANEL.width, PANEL.length);
      if (r.every(free) && free([x, y])) panels.push(r.map((p) => rotate(p, ang, c)));
    }
  }
  return { angle: ang, panels, obstacles: opts.obstacles || [], count: panels.length, kwp: panels.length * PANEL.kw, usableArea: usableCells * cell * cell, samplePoints };
}

export interface CanopyDesign {
  angle: number;
  /** Canopy roof strips (structure), panels on top and steel columns. */
  strips: XY[][]; panels: XY[][]; columns: XY[][];
  count: number; kwp: number; canopyArea: number; coveredBays: number;
  samplePoints: XY[];
  /** Material quantities handed to the Canopy Materials tab. */
  quantities: { columns: number; footingConcreteM3: number; paverAreaM2: number; steelTonnes: number };
}

export const CANOPY = { stripDepth: 10.6, aisle: 6.6, setback: 2.5, clearance: 3.6, roofTop: 3.95, columnSpacing: 8.1 } as const;

/** Double-row solar carport canopies over bays, separated by drive aisles. */
export function designCanopy(pts: XY[]): CanopyDesign {
  const ang = principalAngle(pts), c = centroid(pts);
  const local = pts.map((p) => rotate(p, -ang, c)), bb = bbox(local);
  const inside = (p: XY) => pointInPolygon(p, local) && distToEdges(p, local) >= CANOPY.setback;
  const strips: XY[][] = [], panels: XY[][] = [], columns: XY[][] = [], samples: XY[] = [];
  let canopyArea = 0;
  for (let y0 = bb.minY + CANOPY.setback; y0 + CANOPY.stripDepth <= bb.maxY - CANOPY.setback; y0 += CANOPY.stripDepth + CANOPY.aisle) {
    // Find contiguous x-runs where the full strip depth fits inside the lot.
    let runStart: number | null = null;
    const step = 1;
    const fits = (x: number) => inside([x, y0]) && inside([x, y0 + CANOPY.stripDepth]) && inside([x, y0 + CANOPY.stripDepth / 2]);
    for (let x = bb.minX; x <= bb.maxX + step; x += step) {
      const ok = x <= bb.maxX && fits(x);
      if (ok && runStart === null) runStart = x;
      if ((!ok || x > bb.maxX) && runStart !== null) {
        const x1 = x - step;
        if (x1 - runStart >= 10) {
          const s: XY[] = [[runStart, y0], [x1, y0], [x1, y0 + CANOPY.stripDepth], [runStart, y0 + CANOPY.stripDepth]];
          strips.push(s.map((p) => rotate(p, ang, c)));
          canopyArea += (x1 - runStart) * CANOPY.stripDepth;
          // Panels: 4 deep (portrait) across the strip depth.
          for (let px = runStart + 0.3 + PANEL.width / 2; px + PANEL.width / 2 <= x1 - 0.3; px += PANEL.width + 0.02)
            for (let k = 0; k < 4; k++) {
              const py = y0 + 0.6 + PANEL.length / 2 + k * (PANEL.length + 0.05);
              panels.push(rect(px, py, PANEL.width, PANEL.length).map((p) => rotate(p, ang, c)));
            }
          // Columns along the centreline.
          for (let cx = runStart + 1; cx <= x1 - 1 + 1e-6; cx += CANOPY.columnSpacing) columns.push(rect(cx, y0 + CANOPY.stripDepth / 2, 0.45, 0.45).map((p) => rotate(p, ang, c)));
          for (let sx = runStart + 4; sx < x1; sx += 12) samples.push(rotate([sx, y0 + CANOPY.stripDepth / 2], ang, c));
        }
        runStart = null;
      }
    }
  }
  const count = panels.length;
  const footing = 1.8 * 1.8 * 1.2; // pad footing per column, m³ (illustrative design)
  return {
    angle: ang, strips, panels, columns, count, kwp: count * PANEL.kw, canopyArea,
    coveredBays: Math.floor(canopyArea / 13.2), samplePoints: samples.slice(0, 40),
    quantities: { columns: columns.length, footingConcreteM3: Math.round(columns.length * footing * 10) / 10, paverAreaM2: Math.round(polygonArea(pts)), steelTonnes: Math.round(canopyArea * 0.032 * 10) / 10 },
  };
}

/** Landed home: a pitched roof — panels typically fit on the better-oriented plane(s); capped at a CREAM-typical size. */
export function homeKwp(footprintPerHome: number): number {
  return Math.max(3, Math.min(8, Math.round(footprintPerHome * 0.19 * (PANEL.kw / PANEL_AREA) * 10) / 10));
}
