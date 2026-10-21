import { describe, expect, it } from 'vitest';
import { type XY, polygonArea } from '../src/lib/geo';
import { annualSunSamples, mytDate, sunPosition } from '../src/lib/solar/sun';
import { shadowOffset, shadowPolygon } from '../src/lib/solar/shadows';
import { annualShadingLoss, shadedFraction } from '../src/lib/solar/shadingLoss';
import { PANEL, designCanopy, layoutRoof } from '../src/lib/solar/panels';
import { demandMatch, pvShape } from '../src/lib/solar/energy';

const deg = (r: number) => (r * 180) / Math.PI;
const rectPts = (x0: number, y0: number, w: number, h: number): XY[] => [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]];

describe('sun position at City of Elmina (3.18°N)', () => {
  it('rises in the east, sets in the west', () => {
    expect(sunPosition(mytDate(2026, 3, 21, 9)).bearing).toBeGreaterThan(80);
    expect(sunPosition(mytDate(2026, 3, 21, 9)).bearing).toBeLessThan(100);
    expect(sunPosition(mytDate(2026, 3, 21, 17)).bearing).toBeGreaterThan(260);
  });
  it('is nearly overhead at the March equinox solar noon (~13:15 MYT)', () => {
    expect(deg(sunPosition(mytDate(2026, 3, 21, 13.25)).altitude)).toBeGreaterThan(84);
  });
  it('stands north in June and south in December at noon', () => {
    const jun = sunPosition(mytDate(2026, 6, 21, 13.2)).bearing, dec = sunPosition(mytDate(2026, 12, 21, 13.2)).bearing;
    expect(Math.min(jun, 360 - jun)).toBeLessThan(15);
    expect(Math.abs(dec - 180)).toBeLessThan(15);
  });
  it('builds a daytime annual sample set', () => {
    const s = annualSunSamples();
    expect(s.length).toBeGreaterThan(250);
    expect(s.every((x) => x.altitude > 0 && x.weight > 0)).toBe(true);
  });
});

describe('shadows', () => {
  const sun = { altitude: Math.PI / 4, bearing: 90 }; // 45°, sun in the east
  it('has analytic length (H − h) / tan(alt), pointing away from the sun', () => {
    const [dx, dy] = shadowOffset(20, sun)!;
    expect(Math.hypot(dx, dy)).toBeCloseTo(20, 6);
    expect(dx).toBeCloseTo(-20, 6); // cast to the west
    expect(Math.abs(dy)).toBeLessThan(1e-9);
    expect(Math.hypot(...shadowOffset(20, sun, 8)!)).toBeCloseTo(12, 6);
  });
  it('casts nothing onto a taller receiver or at night', () => {
    expect(shadowOffset(10, sun, 12)).toBeNull();
    expect(shadowOffset(10, { altitude: -0.1, bearing: 90 })).toBeNull();
  });
  it('shadow polygon area = footprint + swept area', () => {
    const poly = shadowPolygon(rectPts(0, 0, 10, 10), 10, sun)!;
    expect(polygonArea(poly)).toBeCloseTo(100 + 10 * 10, 3);
  });
  it('a tall neighbour west of a low roof shades it in the afternoon only', () => {
    const roof = { id: 'r', samplePoints: [[5, 5], [8, 5], [5, 8], [8, 8]] as XY[], receiverHeight: 4 };
    const tower = [{ id: 't', pts: rectPts(-14, 0, 12, 12), h: 40, bb: { minX: -14, minY: 0, maxX: -2, maxY: 12 } }];
    expect(shadedFraction(roof, tower, { altitude: Math.PI / 6, bearing: 270 })).toBe(1);
    expect(shadedFraction(roof, tower, { altitude: Math.PI / 6, bearing: 90 })).toBe(0);
    const loss = annualShadingLoss(roof, tower);
    expect(loss).toBeGreaterThan(0.05);
    expect(loss).toBeLessThan(0.6);
  });
});

describe('roof layout & canopy', () => {
  const roof = rectPts(0, 0, 60, 30);
  it('respects the edge setback and panel geometry', () => {
    const lay = layoutRoof(roof);
    expect(lay.usableArea).toBeGreaterThan(58 * 28 * 0.95);
    expect(lay.usableArea).toBeLessThan(58 * 28 * 1.05);
    expect(lay.kwp).toBeCloseTo(lay.count * PANEL.kw, 6);
    const panelArea = lay.count * PANEL.width * PANEL.length;
    expect(panelArea).toBeLessThan(lay.usableArea);
    expect(panelArea / lay.usableArea).toBeGreaterThan(0.6);
  });
  it('excludes rooftop plant', () => {
    const plant = [rectPts(20, 10, 10, 8)];
    expect(layoutRoof(roof, { obstacles: plant }).count).toBeLessThan(layoutRoof(roof).count);
  });
  it('designs double-row carport strips with columns and quantities', () => {
    const lot = rectPts(0, 0, 100, 60), d = designCanopy(lot);
    expect(d.strips.length).toBeGreaterThanOrEqual(3);
    expect(d.columns.length).toBeGreaterThan(10);
    expect(d.quantities.footingConcreteM3).toBeCloseTo(d.columns.length * 1.8 * 1.8 * 1.2, 0);
    expect(d.quantities.paverAreaM2).toBe(6000);
    expect(d.kwp).toBeGreaterThan(400);
  });
});

describe('demand match', () => {
  it('PV shape sums to 1 and peaks around solar noon', () => {
    const s = pvShape();
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(s.indexOf(Math.max(...s))).toBeGreaterThanOrEqual(12);
    expect(s.indexOf(Math.max(...s))).toBeLessThanOrEqual(14);
    expect(s[2]).toBe(0);
  });
  it('stays within [0, 1] and favours daytime loads', () => {
    for (const ratio of [0.1, 1, 10]) {
      const m = demandMatch(1e6, 1e6 * ratio, 'mall');
      expect(m.selfConsumption).toBeGreaterThanOrEqual(0);
      expect(m.selfConsumption).toBeLessThanOrEqual(1);
      expect(m.coverage).toBeLessThanOrEqual(1);
    }
    expect(demandMatch(1e6, 1e6, 'mall').selfConsumption).toBeGreaterThan(demandMatch(1e6, 1e6, 'apartment').selfConsumption);
    expect(demandMatch(1e5, 1e7, 'commercial').selfConsumption).toBeCloseTo(1, 3);
  });
});
