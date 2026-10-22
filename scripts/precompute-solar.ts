/* Precompute SolarTwin screening metrics for every OSM footprint so the map can rank ~2,000 sites instantly.
   Output: src/data/solar-precomputed.json → { [osmId]: { k: kWp, u: usable m², n: panels, s: annual shading loss } }.
   Run: npm run precompute:solar (re-run after npm run fetch:osm). */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getTownship } from '../src/data/township';
import type { XY } from '../src/lib/geo';
import { designCanopy, layoutRoof, rooftopObstacles } from '../src/lib/solar/panels';
import { annualShadingLoss, homeSamplePoints } from '../src/lib/solar/shadingLoss';
import { MAX_SHADOW_M } from '../src/lib/solar/shadows';

const ROOF_CATS = new Set(['mall', 'commercial', 'education', 'worship', 'community', 'industrial', 'apartment', 'canopy']);
const out: Record<string, { k: number; u: number; n: number; s: number }> = {};
const t = getTownship();
const radius = (pts: XY[], c: XY) => Math.max(...pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1])));
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const t0 = Date.now();
let done = 0;

for (const b of t.buildings) {
  const neighbours = () => t.near(b.center, MAX_SHADOW_M + radius(b.pts, b.center));
  if (ROOF_CATS.has(b.category) && b.area >= 150) {
    const lay = layoutRoof(b.pts, { obstacles: rooftopObstacles(b.id, b.pts, b.area) });
    const s = lay.count ? annualShadingLoss({ id: b.id, samplePoints: lay.samplePoints, receiverHeight: b.height }, neighbours()) : 0;
    out[b.id] = { k: Math.round(lay.kwp * 10) / 10, u: Math.round(lay.usableArea), n: lay.count, s: r3(s) };
  } else if (b.category === 'residential') {
    // Pitched home roof, sampled at eave height.
    out[b.id] = { k: 0, u: 0, n: 0, s: r3(annualShadingLoss({ id: b.id, samplePoints: homeSamplePoints(b.pts), receiverHeight: b.height - 1.5 }, neighbours())) };
  }
  if (++done % 250 === 0) console.log(`  buildings ${done}/${t.buildings.length} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

for (const c of t.carParks) {
  if (c.area < 800) continue;
  const d = designCanopy(c.pts);
  const near = t.near(c.center, MAX_SHADOW_M + radius(c.pts, c.center));
  const s = d.count ? annualShadingLoss({ id: c.id, samplePoints: d.samplePoints, receiverHeight: 3.95 }, near) : 0;
  out[c.id] = { k: Math.round(d.kwp * 10) / 10, u: Math.round(d.canopyArea), n: d.count, s: r3(s) };
}

const file = fileURLToPath(new URL('../src/data/solar-precomputed.json', import.meta.url));
writeFileSync(file, JSON.stringify(out));
const vals = Object.values(out), mw = vals.reduce((a, v) => a + v.k, 0) / 1000;
console.log(`✔ ${vals.length} sites · ${mw.toFixed(1)} MWp non-residential · ${((Date.now() - t0) / 1000).toFixed(1)}s → ${file}`);
