import { describe, expect, it } from 'vitest';
import cache from '../src/data/ecospec/sample-extractions.json';
import type { Site, SiteAttributes } from '../src/data/sites';
import { DEFAULT_ASSUMPTIONS as A } from '../src/data/assumptions';
import { useCaseById } from '../src/data/ecospec/usecases';
import type { Extraction } from '../src/lib/ecospec/schema';
import { normalize } from '../src/lib/ecospec/normalize';
import { DEFAULT_WEIGHTS as W, evaluateSite } from '../src/lib/solar/evaluate';
import { BASE_MODULE, type PvSpec, capexPerKwp, heatFactor, pvSpecFrom, pvTech, withModule } from '../src/lib/solar/modules';

const attrs: SiteAttributes = { roofType: 'Metal deck', roofAge: 5, structuralCert: 'provided', ownership: 'SDP-owned', bills12m: true, asBuilt: true, sld: true, geotech: true };
const site = (o: Partial<Site> = {}): Site => ({
  id: 'x', kind: 'roof', name: 'Test', subtitle: '', category: 'mall', ring: [], pts: [], centerLL: [0, 0], center: [0, 0], area: 5000,
  height: 15, floorArea: 10000, homes: 0, kwp: 120, usableArea: 4000, panels: 218, shadingLoss: 0.02, demandClass: 'mall',
  annualLoad: 2_600_000, attrs, substation: { name: 'Pencawang', distance: 120 }, ...o,
});
const hjtDoc = Object.values(cache as Record<string, { fileName: string; extraction: Extraction }>).find((v) => v.fileName === 'pv-heliomax-hjt600.pdf')!.extraction;
const hjt = pvSpecFrom(hjtDoc, normalize(hjtDoc, useCaseById('pv-module')))!;

describe('building a site with a PV module', () => {
  it('the mono PERC baseline leaves the screening unchanged', () => {
    const s = site(), b = withModule(s, BASE_MODULE);
    expect(b.kwp).toBe(s.kwp);
    expect(heatFactor(BASE_MODULE)).toBe(1);
    expect(evaluateSite(b, W, A).annualKwh).toBe(evaluateSite(s, W, A).annualKwh);
    expect(evaluateSite(b, W, A).finance.capex).toBe(120 * A.capexRoof);
    expect(BASE_MODULE.gwpPerKwp).toBe(useCaseById('pv-module').baseline.gwp);
  });
  it('reads the Solar Panels pick from its datasheet: efficiency, heat tolerance, watts, verified carbon and price', () => {
    expect(hjt).toMatchObject({ product: 'HelioMax HJT 600 W', tech: 'hjt', watt: 600, tempCoeff: -0.24, pricePerKwp: 585 });
    expect(hjt.efficiency).toBeCloseTo(0.232, 6);
    expect(hjt.gwpPerKwp).toBeCloseTo(88 / 0.232, 1);
  });
  it('a more efficient module fits more kWp on the same roof, and yields more per kWp in the heat', () => {
    const b = withModule(site(), hjt);
    expect(b.kwp).toBeCloseTo((120 * 0.232) / BASE_MODULE.efficiency, 6);
    expect(b.panels).toBe(Math.round((b.kwp * 1000) / 600));
    expect(heatFactor(hjt)).toBeGreaterThan(1);
    expect(evaluateSite(b, W, A).annualKwh / b.kwp).toBeGreaterThan(evaluateSite(site(), W, A).annualKwh / 120);
  });
  it('CAPEX adds the module premium and spreads area-bound costs, more so on canopies', () => {
    const noPremium: PvSpec = { ...hjt, pricePerKwp: BASE_MODULE.pricePerKwp };
    expect(capexPerKwp('roof', hjt, A) - capexPerKwp('roof', noPremium, A)).toBeCloseTo(585 - 480, 6);
    expect(capexPerKwp('roof', noPremium, A)).toBeLessThan(A.capexRoof);
    expect(capexPerKwp('carpark', noPremium, A) / A.capexCanopy).toBeLessThan(capexPerKwp('roof', noPremium, A) / A.capexRoof);
  });
  it('names the cell technology from the product, else from its physics', () => {
    expect(pvTech('SolarisPeak TOPCon 580 W', 0.225, -0.3)).toBe('topcon');
    expect(pvTech('ThinCell T7 CdTe 545 W', 0.197, -0.28)).toBe('thin_film');
    expect(pvTech('Acme 600', 0.232, -0.24)).toBe('hjt');
    expect(pvTech('Acme 550', 0.213, -0.35)).toBe('perc');
  });
});
