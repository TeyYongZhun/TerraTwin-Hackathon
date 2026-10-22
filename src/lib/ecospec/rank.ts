/* Gate-then-rank. 1) Every mandatory performance requirement must pass (a missing value is not a pass).
   2) Carbon and cost are normalised to the functional unit and scaled to the project quantity.
   3) The recommendation is the lowest-carbon candidate that passes the gate, has verified carbon evidence,
      and stays within the cost-premium cap. Abatement cost = extra RM per tonne CO₂e avoided vs the baseline. */
import type { Extraction } from './schema';
import type { Requirement, UseCase } from '../../data/ecospec/usecases';
import { type EvidenceResult, assessEvidence } from './evidence';
import { type Normalized, normalize } from './normalize';

export interface Candidate { id: string; fileName: string; ex: Extraction; source: string }
export interface GateCheck { req: Requirement; value: number | null; status: 'pass' | 'fail' | 'missing'; quote: string | null; page: number | null }
export interface Ranked {
  c: Candidate; gate: GateCheck[]; gatePass: boolean; evidence: EvidenceResult; norm: Normalized;
  totalCost: number | null; tco2: number | null; savedT: number | null; savedPct: number | null; premiumPct: number | null;
  abatement: number | null; eligible: boolean; recommended: boolean; reasons: string[]; order: number;
}

export function gateChecks(ex: Extraction, uc: UseCase): GateCheck[] {
  return uc.requirements.map((req) => {
    const f = ex.specs[req.key], v = f.value;
    const status = v === null ? 'missing' : (req.op === '>=' ? v >= req.value : v <= req.value) ? 'pass' : 'fail';
    return { req, value: v, status, quote: f.quote, page: f.page };
  });
}

export function rankCandidates(uc: UseCase, qty: number, cands: Candidate[], opts: { premiumCapPct: number; today?: Date }) {
  const baseT = (uc.baseline.gwp * qty) / 1000, baseCost = uc.baseline.price * qty;
  const rows: Ranked[] = cands.map((c) => {
    const gate = gateChecks(c.ex, uc), evidence = assessEvidence(c.ex, opts.today), norm = normalize(c.ex, uc);
    const gatePass = gate.every((g) => g.status === 'pass');
    const tco2 = norm.gwp !== null ? (norm.gwp * qty) / 1000 : null;
    const totalCost = norm.price !== null ? norm.price * qty : null;
    const savedT = tco2 !== null ? baseT - tco2 : null;
    const premiumPct = totalCost !== null ? ((totalCost - baseCost) / baseCost) * 100 : null;
    const abatement = savedT !== null && savedT > 0 && totalCost !== null ? (totalCost - baseCost) / savedT : null;
    const reasons: string[] = [];
    for (const g of gate) if (g.status !== 'pass') reasons.push(g.status === 'missing' ? `No ${g.req.label.toLowerCase()} evidence` : `${g.req.label} ${g.value}${g.req.unit ? ' ' + g.req.unit : ''} fails ${g.req.op} ${g.req.value}`);
    if (evidence.greenwash.length) reasons.push('Greenwashing risk');
    else if (evidence.grade !== 'verified') reasons.push(evidence.gwpStatus === 'self_declared' ? 'Carbon not verified by an EPD' : `Carbon evidence ${evidence.gwpStatus}`);
    if (tco2 === null) reasons.push('Carbon not comparable');
    if (premiumPct !== null && premiumPct > opts.premiumCapPct) reasons.push(`Premium ${premiumPct.toFixed(0)}% exceeds ${opts.premiumCapPct}% cap`);
    const eligible = gatePass && evidence.grade === 'verified' && tco2 !== null && totalCost !== null && (premiumPct ?? 0) <= opts.premiumCapPct;
    return { c, gate, gatePass, evidence, norm, totalCost, tco2, savedT, savedPct: savedT !== null ? (savedT / baseT) * 100 : null, premiumPct, abatement, eligible, recommended: false, reasons, order: 0 };
  });
  const tier = (r: Ranked) => (r.eligible ? 0 : r.gatePass && !r.evidence.greenwash.length ? 1 : r.gatePass ? 2 : 3);
  rows.sort((a, b) => tier(a) - tier(b) || (a.tco2 ?? Infinity) - (b.tco2 ?? Infinity));
  rows.forEach((r, i) => (r.order = i + 1));
  const rec = rows.find((r) => r.eligible) ?? null;
  if (rec) rec.recommended = true;
  return { rows, recommended: rec, baseline: { tco2: baseT, cost: baseCost } };
}
