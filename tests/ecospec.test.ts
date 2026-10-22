import { describe, expect, it } from 'vitest';
import cache from '../src/data/ecospec/sample-extractions.json';
import { ExtractionSchema, type Extraction } from '../src/lib/ecospec/schema';
import { useCaseById } from '../src/data/ecospec/usecases';
import { normalize, unitBasis } from '../src/lib/ecospec/normalize';
import { assessEvidence } from '../src/lib/ecospec/evidence';
import { type Candidate, rankCandidates, standardOption } from '../src/lib/ecospec/rank';
import { SAMPLE_DOCS } from '../scripts/sample-pack';

const TODAY = new Date('2026-10-21T12:00:00');
const entries = Object.entries(cache as Record<string, { fileName: string; useCaseId: string; source: string; extraction: Extraction }>);
const cand = (file: string): Candidate => { const [id, v] = entries.find(([, x]) => x.fileName === file)!; return { id, fileName: v.fileName, ex: v.extraction, source: v.source }; };
const pack = (uc: string) => entries.filter(([, v]) => v.useCaseId === uc).map(([id, v]) => ({ id, fileName: v.fileName, ex: v.extraction, source: v.source }));

describe('sample pack cache', () => {
  it('has one valid extraction per sample PDF', () => {
    expect(entries).toHaveLength(SAMPLE_DOCS.length);
    for (const [, v] of entries) expect(() => ExtractionSchema.parse(v.extraction)).not.toThrow();
  });
  it('quotes are verbatim lines of the rendered documents', () => {
    for (const doc of SAMPLE_DOCS) {
      const text = doc.pages.map((p) => [...(p.rows ?? []).map((r) => `${r.label}: ${r.value}`), ...(p.paras ?? [])]);
      const ex = cand(doc.file).ex;
      for (const f of [...Object.values(ex.specs), ex.price, ex.gwp, ...ex.claims]) if (f.quote) expect(text[f.page! - 1]).toContain(f.quote);
    }
  });
});

describe('normalisation', () => {
  it('parses declared units', () => {
    expect(unitBasis('kgCO2e/m3')).toBe('m3');
    expect(unitBasis('kgCO2e per m²')).toBe('m2');
    expect(unitBasis('kgCO2e/t')).toBe('t');
    expect(unitBasis('kgCO2e per tonne')).toBe('t');
    expect(unitBasis('kgCO2e/kg')).toBe('kg');
  });
  it('converts a per-tonne paver GWP with the stated mass per m²', () => {
    const n = normalize(cand('paver-durablock-classic.pdf').ex, useCaseById('paver-80'));
    expect(n.gwp).toBeCloseTo(112 * 0.182, 2);
    expect(n.gwpAssumed).toBe(false);
  });
  it('keeps per-m³ concrete GWP as declared', () => {
    expect(normalize(cand('concrete-verdemix-ggbs50.pdf').ex, useCaseById('concrete-c30')).gwp).toBe(182);
  });
  it('parses PV units, checking kWp before Wp and m²', () => {
    expect(unitBasis('kgCO2e/kWp')).toBe('kWp');
    expect(unitBasis('RM/Wp')).toBe('Wp');
    expect(unitBasis('RM per module')).toBe('module');
    expect(unitBasis('kgCO2e/m2')).toBe('m2');
  });
  it('converts PV carbon and price to per kWp with the document\'s own efficiency and power', () => {
    const pv = useCaseById('pv-module');
    const hjt = normalize(cand('pv-heliomax-hjt600.pdf').ex, pv);
    expect(hjt.gwp).toBeCloseTo(88 / 0.232, 1);
    expect(hjt.gwpNote).toMatch(/23.2% efficiency/);
    expect(normalize(cand('pv-solarispeak-topcon580.pdf').ex, pv).price).toBe(510);
    expect(normalize(cand('pv-everbright-perc550.pdf').ex, pv).price).toBeCloseTo(255 / 0.55, 1);
  });
});

describe('evidence & greenwashing', () => {
  it('flags marketing claims with no third-party evidence', () => {
    const e = assessEvidence(cand('concrete-ecocrete-40r.pdf').ex, TODAY);
    expect(e.greenwash).toHaveLength(2);
    expect(e.greenwash[0].reason).toMatch(/SIRIM|EPD/);
    expect(e.grade).toBe('unverified');
  });
  it('treats an expired SIRIM certificate as no evidence', () => {
    const e = assessEvidence(cand('concrete-lowcarb-c28.pdf').ex, TODAY);
    expect(e.expiredLabels).toHaveLength(1);
    expect(e.greenwash[0].reason).toMatch(/expired/);
  });
  it('accepts a valid ISO 14025 / EN 15804 EPD as verified carbon', () => {
    const e = assessEvidence(cand('paver-terrablock-ggbs.pdf').ex, TODAY);
    expect(e.gwpStatus).toBe('verified');
    expect(e.greenwash).toHaveLength(0);
    expect(e.grade).toBe('verified');
  });
  it('a valid eco-label backs general claims but not a self-declared carbon number', () => {
    const e = assessEvidence(cand('paver-repave-r30.pdf').ex, TODAY);
    expect(e.greenwash).toHaveLength(0);
    expect(e.gwpStatus).toBe('self_declared');
    expect(e.grade).toBe('partial');
  });
  it('an EPD becomes expired after its validity date', () => {
    expect(assessEvidence(cand('paver-terrablock-ggbs.pdf').ex, new Date('2031-01-01')).gwpStatus).toBe('expired');
  });
});

describe('gate-then-rank', () => {
  it('concrete: recommends the verified GGBS mix and fails the 28 MPa mix at the gate', () => {
    const { rows, recommended } = rankCandidates(useCaseById('concrete-c30'), 180, pack('concrete-c30'), { premiumCapPct: 20, today: TODAY });
    expect(recommended?.c.fileName).toBe('concrete-verdemix-ggbs50.pdf');
    const c28 = rows.find((r) => r.c.fileName === 'concrete-lowcarb-c28.pdf')!;
    expect(c28.gatePass).toBe(false);
    expect(c28.reasons.join(' ')).toMatch(/28/);
    expect(rows.find((r) => r.c.fileName === 'concrete-ecocrete-40r.pdf')!.eligible).toBe(false);
    expect(recommended!.abatement!).toBeCloseTo((318 - 278) / ((318 - 182) / 1000), 0);
  });
  it('pavers: missing slip test fails the gate; top score wins; weights and the premium cap switch the pick', () => {
    const uc = useCaseById('paver-80');
    const r25 = rankCandidates(uc, 1000, pack('paver-80'), { premiumCapPct: 25, today: TODAY });
    expect(r25.recommended?.c.fileName).toBe('paver-terrablock-ggbs.pdf');
    // 37% less carbon for 22% more cost at 52 MPa narrowly outscores DuraBlock's 15% less for 6% more at 55 MPa.
    expect(r25.recommended!.score!).toBeCloseTo(57.0, 0);
    expect(r25.rows.find((r) => r.c.fileName === 'paver-durablock-classic.pdf')!.score!).toBeCloseTo(56.3, 0);
    // A close call: equal weights hand the pick to DuraBlock.
    const equal = rankCandidates(uc, 1000, pack('paver-80'), { premiumCapPct: 25, weights: { eco: 1, cost: 1, performance: 1 }, today: TODAY });
    expect(equal.recommended?.c.fileName).toBe('paver-durablock-classic.pdf');
    expect(r25.rows.find((r) => r.c.fileName === 'paver-greenstep-eco.pdf')!.gate.find((g) => g.req.key === 'slip_resistance_ptv')!.status).toBe('missing');
    const r15 = rankCandidates(uc, 1000, pack('paver-80'), { premiumCapPct: 15, today: TODAY });
    expect(r15.recommended?.c.fileName).toBe('paver-durablock-classic.pdf');
  });
  it('PV modules: top score within the cap wins; the lowest-carbon module fails the gate and is not scored', () => {
    const uc = useCaseById('pv-module');
    const r25 = rankCandidates(uc, 737, pack('pv-module'), { premiumCapPct: 25, today: TODAY });
    expect(r25.recommended?.c.fileName).toBe('pv-heliomax-hjt600.pdf');
    // HJT costs 21.9% more per kWp than mono PERC, but fits more power on the roof and loses less to heat, so the
    // system costs about the same per kWh as TOPCon's; its bigger carbon cut and efficiency then win.
    const topcon = r25.rows.find((r) => r.c.fileName === 'pv-solarispeak-topcon580.pdf')!;
    expect(topcon.eligible).toBe(true);
    expect(r25.recommended!.costRatio!).toBeLessThan(1);
    expect(Math.abs(r25.recommended!.costRatio! - topcon.costRatio!)).toBeLessThan(0.01);
    expect(topcon.score!).toBeLessThan(r25.recommended!.score!);
    const cdte = r25.rows.find((r) => r.c.fileName === 'pv-thincell-cdte545.pdf')!;
    expect(cdte.norm.gwp).toBeLessThan(r25.recommended!.norm.gwp!);
    expect(cdte.gate.map((g) => g.status)).toEqual(['fail', 'pass', 'missing']);
    expect(cdte.score).toBeNull();
    const perc = r25.rows.find((r) => r.c.fileName === 'pv-everbright-perc550.pdf')!;
    expect(perc.gatePass).toBe(true);
    expect(perc.evidence.greenwash.map((g) => g.reason).join(' ')).toMatch(/expired/);
    expect(perc.eligible).toBe(false);
    // The premium cap still applies to the module price: a 20% cap rules HJT out and hands the pick to TOPCon.
    expect(rankCandidates(uc, 737, pack('pv-module'), { premiumCapPct: 20, today: TODAY }).recommended?.c.fileName).toBe('pv-solarispeak-topcon580.pdf');
  });
  it('the standard product is a valid option that saves nothing, costs the baseline and is never recommended', () => {
    for (const id of ['concrete-c30', 'paver-80', 'pv-module'] as const) {
      const uc = useCaseById(id), std = standardOption(uc, 740);
      expect(ExtractionSchema.safeParse(std.c.ex).success).toBe(true);
      expect([std.savedPct, std.premiumPct, std.score, std.recommended]).toEqual([0, 0, 50, false]);
      expect(std.tco2).toBeCloseTo((uc.baseline.gwp * 740) / 1000);
      expect(std.totalCost).toBeCloseTo(uc.baseline.price * 740);
    }
  });
  it('eligible candidates are ordered before ineligible ones', () => {
    const { rows } = rankCandidates(useCaseById('paver-80'), 500, pack('paver-80'), { premiumCapPct: 25, today: TODAY });
    const firstIneligible = rows.findIndex((r) => !r.eligible);
    expect(rows.slice(firstIneligible).every((r) => !r.eligible)).toBe(true);
  });
});
