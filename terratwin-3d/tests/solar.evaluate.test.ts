import { describe, expect, it } from 'vitest';
import type { Site, SiteAttributes } from '../src/data/sites';
import { DEFAULT_ASSUMPTIONS } from '../src/data/assumptions';
import { DEFAULT_WEIGHTS, evaluateSite, redFlags } from '../src/lib/solar/evaluate';

const attrs = (o: Partial<SiteAttributes> = {}): SiteAttributes => ({
  roofType: 'Metal deck', roofAge: 5, structuralCert: 'provided', ownership: 'SDP-owned', bills12m: true, asBuilt: true, sld: true, geotech: true, ...o,
});
const site = (o: Partial<Site> = {}): Site => ({
  id: 'x', kind: 'roof', name: 'Test', subtitle: '', category: 'mall', ring: [], pts: [], centerLL: [0, 0], center: [0, 0], area: 5000,
  height: 15, floorArea: 10000, homes: 0, kwp: 120, usableArea: 4000, panels: 218, shadingLoss: 0.02, demandClass: 'mall',
  annualLoad: 2_600_000, attrs: attrs(), substation: { name: 'Pencawang', distance: 120 }, ...o,
});
const ids = (s: Site) => redFlags(s).flags.map((f) => f.id);

describe('red flags', () => {
  it('a clean, small SDP-owned roof raises only the scheme note', () => {
    expect(redFlags(site()).flags.map((f) => f.severity)).toEqual(['info']);
  });
  it('missing structural certificate is high severity', () => {
    const f = redFlags(site({ attrs: attrs({ structuralCert: 'missing' }) })).flags[0];
    expect(f.id).toBe('struct');
    expect(f.severity).toBe('high');
    expect(f.resolve).toMatch(/15/);
  });
  it('grid checks scale with system size', () => {
    expect(ids(site({ kwp: 179 }))).not.toContain('tnb');
    expect(ids(site({ kwp: 250 }))).toContain('tnb');
    expect(ids(site({ kwp: 1200 }))).toContain('pss');
    expect(ids(site({ substation: { name: 'P', distance: 900 } }))).toContain('feeder');
  });
  it('flags old roofs, shading, strata and missing data', () => {
    expect(ids(site({ attrs: attrs({ roofAge: 18 }) }))).toContain('roofage');
    expect(redFlags(site({ shadingLoss: 0.3 })).flags.find((f) => f.id === 'shade')!.severity).toBe('high');
    expect(redFlags(site({ shadingLoss: 0.12 })).flags.find((f) => f.id === 'shade')!.severity).toBe('medium');
    expect(ids(site({ attrs: attrs({ ownership: 'Strata (JMB/MC)' }) }))).toContain('own');
    expect(ids(site({ attrs: attrs({ bills12m: false, asBuilt: false, sld: false }) }))).toEqual(expect.arrayContaining(['bills', 'asbuilt', 'sld']));
  });
  it('car parks get BOMBA + soil checks instead of roof checks', () => {
    const c = ids(site({ kind: 'carpark', category: 'parking', attrs: attrs({ geotech: false, structuralCert: 'missing' }) }));
    expect(c).toEqual(expect.arrayContaining(['bomba', 'geotech']));
    expect(c).not.toContain('struct');
  });
  it('sorts high → info', () => {
    const sev = redFlags(site({ kwp: 1500, shadingLoss: 0.3, attrs: attrs({ structuralCert: 'missing', asBuilt: false }) })).flags.map((f) => f.severity);
    const order = { high: 0, medium: 1, low: 2, info: 3 };
    expect(sev.map((s) => order[s])).toEqual([...sev.map((s) => order[s])].sort((a, b) => a - b));
  });
});

describe('scoring & finance', () => {
  it('weights are transparent: one non-zero weight → score equals that component', () => {
    const s = site();
    const e = evaluateSite(s, { capacity: 0, shading: 100, demand: 0, readiness: 0 }, DEFAULT_ASSUMPTIONS);
    expect(e.score).toBeCloseTo(e.components.find((c) => c.key === 'shading')!.value, 6);
  });
  it('more shading → lower score and yield', () => {
    const a = evaluateSite(site(), DEFAULT_WEIGHTS, DEFAULT_ASSUMPTIONS), b = evaluateSite(site({ shadingLoss: 0.3 }), DEFAULT_WEIGHTS, DEFAULT_ASSUMPTIONS);
    expect(b.score).toBeLessThan(a.score);
    expect(b.annualKwh).toBeCloseTo(a.annualKwh * (0.7 / 0.98), 3);
  });
  it('computes CAPEX, CO₂ and payback from assumptions', () => {
    const e = evaluateSite(site(), DEFAULT_WEIGHTS, DEFAULT_ASSUMPTIONS);
    expect(e.finance.capex).toBe(120 * DEFAULT_ASSUMPTIONS.capexRoof);
    expect(e.finance.tco2).toBeCloseTo((e.annualKwh / 1000) * DEFAULT_ASSUMPTIONS.gridEF, 6);
    expect(e.finance.paybackYears).toBeGreaterThan(2);
    expect(e.finance.paybackYears).toBeLessThan(12);
  });
  it('CREAM homes get a monthly roof-lease figure', () => {
    const e = evaluateSite(site({ kind: 'home', category: 'residential', demandClass: 'home', homes: 4, kwp: 20, attrs: attrs({ ownership: 'Homeowner' }) }), DEFAULT_WEIGHTS, DEFAULT_ASSUMPTIONS);
    expect(e.finance.perHomeKwp).toBe(5);
    expect(e.finance.monthlyLease).toBe(5 * DEFAULT_ASSUMPTIONS.creamLeaseRate);
  });
});
