/* Gate-then-rank. 1) Every mandatory performance requirement must pass (a missing value is not a pass).
   2) Carbon and cost are normalised to the functional unit and scaled to the project quantity.
   3) The recommendation is the top-scoring candidate among those that pass the gate, have verified carbon evidence
      and stay within the cost-premium cap. The total score (0–100) is a weighted average of three parts, each set
      so the standard product scores 50: Eco = 50 + % carbon saved, Cost = 50 − % cost premium, Performance = 50 +
      the % by which the headline spec (PV efficiency, paver / concrete strength) beats its limit. PV modules are
      costed on what the whole system costs per kWh it generates, not on the module price alone, because a dearer
      module that fits more power on the roof and runs cooler can be cheaper per kWh. Ties go to the lower carbon. Abatement cost = extra RM per tonne CO₂e avoided vs the baseline. */
import { type Extraction, SPEC_KEYS } from './schema';
import type { Requirement, UseCase } from '../../data/ecospec/usecases';
import { type Assumptions, DEFAULT_ASSUMPTIONS } from '../../data/assumptions';
import type { SiteKind } from '../../data/sites';
import { costPerKwhRatio, pvSpecFrom } from '../solar/modules';
import { type EvidenceResult, assessEvidence } from './evidence';
import { type Normalized, normalize } from './normalize';

export interface Candidate { id: string; fileName: string; ex: Extraction; source: string }
/** Weights of the total score's three parts, on any scale (they are normalised). */
export interface ScoreWeights { eco: number; cost: number; performance: number }
export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = { eco: 40, cost: 40, performance: 20 };
/** The three part-scores, 0–100, where the standard product scores 50 on each. */
export interface Scores { eco: number; cost: number; performance: number | null }
export interface GateCheck { req: Requirement; value: number | null; status: 'pass' | 'fail' | 'missing'; quote: string | null; page: number | null }
export interface Ranked {
  c: Candidate; gate: GateCheck[]; gatePass: boolean; evidence: EvidenceResult; norm: Normalized;
  totalCost: number | null; tco2: number | null; savedT: number | null; savedPct: number | null; premiumPct: number | null;
  abatement: number | null;
  scores: Scores;
  /** PV: system cost per kWh generated relative to the standard module (1 = same), which the Cost part scores; null for materials. */
  costRatio: number | null;
  /** Weighted total of the part-scores, 0–100; null when the candidate is not eligible. */
  score: number | null;
  /** The standard product itself (see standardOption), not a supplier's. */
  standard?: boolean;
  eligible: boolean; recommended: boolean; reasons: string[]; order: number;
}

export function gateChecks(ex: Extraction, uc: UseCase): GateCheck[] {
  return uc.requirements.map((req) => {
    const f = ex.specs[req.key], v = f.value;
    const status = v === null ? 'missing' : (req.op === '>=' ? v >= req.value : v <= req.value) ? 'pass' : 'fail';
    return { req, value: v, status, quote: f.quote, page: f.page };
  });
}

const clamp100 = (v: number) => Math.max(0, Math.min(100, v));

/** The % by which the headline performance spec beats its limit (negative = short of it), or null if not stated. */
function specMargin(ex: Extraction, uc: UseCase): number | null {
  const req = uc.requirements.find((r) => r.key === uc.performance.key)!, v = ex.specs[req.key].value;
  return v === null ? null : ((req.op === '>=' ? v - req.value : req.value - v) / Math.abs(req.value)) * 100;
}

export function totalScore(s: Scores, w: ScoreWeights): number {
  return (s.eco * w.eco + s.cost * w.cost + (s.performance ?? 50) * w.performance) / (w.eco + w.cost + w.performance || 1);
}

/** `pv` is the kind of site the modules go on (its CAPEX per kWp) and the finance assumptions; a rooftop by default. */
export function rankCandidates(uc: UseCase, qty: number, cands: Candidate[], opts: { premiumCapPct: number; weights?: ScoreWeights; pv?: { kind: SiteKind; assumptions: Assumptions }; today?: Date }) {
  const w = opts.weights ?? DEFAULT_SCORE_WEIGHTS;
  const baseT = (uc.baseline.gwp * qty) / 1000, baseCost = uc.baseline.price * qty;
  const rows: Ranked[] = cands.map((c) => {
    const gate = gateChecks(c.ex, uc), evidence = assessEvidence(c.ex, opts.today), norm = normalize(c.ex, uc);
    const gatePass = gate.every((g) => g.status === 'pass');
    const tco2 = norm.gwp !== null ? (norm.gwp * qty) / 1000 : null;
    const totalCost = norm.price !== null ? norm.price * qty : null;
    const savedT = tco2 !== null ? baseT - tco2 : null;
    const premiumPct = totalCost !== null ? ((totalCost - baseCost) / baseCost) * 100 : null;
    const abatement = savedT !== null && savedT > 0 && totalCost !== null ? (totalCost - baseCost) / savedT : null;
    const savedPct = savedT !== null ? (savedT / baseT) * 100 : null;
    const margin = specMargin(c.ex, uc), spec = uc.id === 'pv-module' ? pvSpecFrom(c.ex, norm) : null;
    const costRatio = spec ? costPerKwhRatio(opts.pv?.kind ?? 'roof', spec, opts.pv?.assumptions ?? DEFAULT_ASSUMPTIONS) : null;
    const cost = costRatio !== null ? 50 - (costRatio - 1) * 100 : 50 - (premiumPct ?? 0);
    const scores: Scores = { eco: clamp100(50 + (savedPct ?? 0)), cost: clamp100(cost), performance: margin === null ? null : clamp100(50 + margin) };
    const reasons: string[] = [];
    for (const g of gate) if (g.status !== 'pass') reasons.push(g.status === 'missing' ? `No ${g.req.label.toLowerCase()} evidence` : `${g.req.label} ${g.value}${g.req.unit ? ' ' + g.req.unit : ''} fails ${g.req.op} ${g.req.value}`);
    if (evidence.greenwash.length) reasons.push('Greenwashing risk');
    else if (evidence.grade !== 'verified') reasons.push(evidence.gwpStatus === 'self_declared' ? 'Carbon not verified by an EPD' : `Carbon evidence ${evidence.gwpStatus}`);
    if (tco2 === null) reasons.push('Carbon not comparable');
    if (premiumPct !== null && premiumPct > opts.premiumCapPct) reasons.push(`Premium ${premiumPct.toFixed(0)}% exceeds ${opts.premiumCapPct}% cap`);
    const eligible = gatePass && evidence.grade === 'verified' && tco2 !== null && totalCost !== null && (premiumPct ?? 0) <= opts.premiumCapPct;
    return { c, gate, gatePass, evidence, norm, totalCost, tco2, savedT, savedPct, premiumPct, abatement, scores, costRatio, score: eligible ? totalScore(scores, w) : null, eligible, recommended: false, reasons, order: 0 };
  });
  const tier = (r: Ranked) => (r.eligible ? 0 : r.gatePass && !r.evidence.greenwash.length ? 1 : r.gatePass ? 2 : 3);
  rows.sort((a, b) => tier(a) - tier(b) || (b.score ?? -Infinity) - (a.score ?? -Infinity) || (a.tco2 ?? Infinity) - (b.tco2 ?? Infinity));
  rows.forEach((r, i) => (r.order = i + 1));
  const rec = rows.find((r) => r.eligible) ?? null;
  if (rec) rec.recommended = true;
  return { rows, recommended: rec, baseline: { tco2: baseT, cost: baseCost } };
}

const MATERIAL: Record<UseCase['id'], Extraction['material_type']> = { 'concrete-c30': 'ready_mix_concrete', 'paver-80': 'interlocking_paver', 'pv-module': 'pv_module' };

/** The standard product every saving is measured against, as an option people can pick: it meets the spec by
    definition, saves nothing, costs the baseline price and is never the recommendation. */
export function standardOption(uc: UseCase, qty: number): Ranked {
  const { label, gwp, price } = uc.baseline, field = (value: number | null, unit: string | null) => ({ value, unit, quote: null, page: null });
  const ex: Extraction = {
    product_name: label, supplier: 'Standard product', material_type: MATERIAL[uc.id], document_kinds: [],
    specs: Object.fromEntries(SPEC_KEYS.map((k) => [k, field(null, null)])) as Extraction['specs'],
    price: field(price, `RM/${uc.fu}`), warranty_years: field(null, null),
    gwp: { value: gwp, declared_unit: `kgCO2e/${uc.fu}`, lifecycle_stages: null, basis: 'none', quote: null, page: null },
    epd: { present: false, registration_number: null, programme_operator: null, standards: [], third_party_verified: null, valid_until: null, quote: null, page: null },
    certifications: [], claims: [], notes: [],
  };
  return {
    c: { id: `standard:${uc.id}`, fileName: '', ex, source: 'standard' }, standard: true, gate: [], gatePass: true,
    evidence: { gwpStatus: 'missing', epdStatus: 'none', validLabels: [], expiredLabels: [], greenwash: [], grade: 'partial', flags: [] },
    norm: { gwp, gwpNote: '', gwpAssumed: false, price, priceNote: '' },
    totalCost: price * qty, tco2: (gwp * qty) / 1000, savedT: 0, savedPct: 0, premiumPct: 0, abatement: null,
    scores: { eco: 50, cost: 50, performance: 50 }, costRatio: uc.id === 'pv-module' ? 1 : null, score: 50,
    eligible: true, recommended: false, reasons: [], order: 0,
  };
}
