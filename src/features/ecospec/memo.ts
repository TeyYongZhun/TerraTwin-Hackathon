/* Procurement memo: compact payload of the deterministic ranking for Claude, and an offline memo from the same data. */
import type { UseCase } from '../../data/ecospec/usecases';
import type { Ranked } from '../../lib/ecospec/rank';

const n = (v: number | null, d = 1) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

export function memoPayload(uc: UseCase, qty: number, rows: Ranked[], baseline: { tco2: number; cost: number }, premiumCap: number, siteName?: string) {
  return {
    useCase: uc.title, quantity: qty, unit: uc.fu, forSite: siteName ?? null, premiumCapPct: premiumCap,
    baseline: { label: uc.baseline.label, gwpPerUnit: uc.baseline.gwp, pricePerUnit: uc.baseline.price, totalTco2: n(baseline.tco2), totalCostRM: Math.round(baseline.cost) },
    requirements: uc.requirements.map((r) => `${r.label} ${r.op} ${r.value}${r.unit ? ' ' + r.unit : ''}`),
    candidates: rows.map((r) => ({
      rank: r.order, recommended: r.recommended, eligible: r.eligible, product: r.c.ex.product_name, supplier: r.c.ex.supplier,
      gate: r.gate.map((g) => ({ requirement: g.req.label, value: g.value, status: g.status })),
      evidenceGrade: r.evidence.grade, carbonEvidence: r.evidence.gwpStatus, epd: r.evidence.epdStatus, validEcoLabels: r.evidence.validLabels, expiredEcoLabels: r.evidence.expiredLabels,
      greenwashing: r.evidence.greenwash.map((g) => `${g.claim}: ${g.reason}`),
      gwpPerUnit: r.norm.gwp, gwpNote: r.norm.gwpNote, pricePerUnit: r.norm.price,
      totalTco2: n(r.tco2), savedTco2: n(r.savedT), savedPct: n(r.savedPct, 0), premiumPct: n(r.premiumPct, 0), abatementRMperTco2: n(r.abatement, 0),
      deciding: r.reasons,
    })),
  };
}

export function offlineMemo(uc: UseCase, qty: number, rows: Ranked[], siteName?: string): string {
  const rec = rows.find((r) => r.recommended);
  const out: string[] = [];
  out.push('## Recommendation');
  if (rec) {
    out.push(`Specify **${rec.c.ex.product_name}** from ${rec.c.ex.supplier} for ${qty.toLocaleString()} ${uc.fuLabel}${siteName ? ` at ${siteName}` : ''}. It saves **${n(rec.savedT)} tCO₂e (${n(rec.savedPct, 0)}%)** against ${uc.baseline.label.toLowerCase()} for a ${n(rec.premiumPct, 0)}% cost premium, an abatement cost of **RM ${Math.round(rec.abatement ?? 0).toLocaleString()} per tCO₂e**.`);
    out.push('## Why');
    out.push([
      `- Passes every mandatory requirement: ${rec.gate.map((g) => `${g.req.label.toLowerCase()} ${g.value}${g.req.unit ? ' ' + g.req.unit : ''}`).join(', ')}.`,
      `- Carbon is backed by ${rec.evidence.flags.filter((f) => f.tone === 'green').map((f) => f.text).join('; ') || 'verified evidence'}.`,
      `- Lowest verified embodied carbon among eligible options (${rec.norm.gwp} kgCO₂e/${uc.fuLabel}).`,
    ].join('\n'));
  } else out.push('No candidate is eligible: none passes the performance gate with verified carbon evidence within the premium cap.');
  const others = rows.filter((r) => !r.recommended);
  if (others.length) {
    out.push('## Rejected or conditional');
    out.push(others.map((r) => `- **${r.c.ex.product_name}**: ${r.reasons.length ? r.reasons.join('; ') : r.eligible ? 'eligible, but higher carbon than the recommendation' : 'not eligible'}.`).join('\n'));
  }
  out.push('## Next steps');
  out.push([
    rec ? `- Verify ${rec.c.ex.epd.registration_number ?? 'the EPD'} with the programme operator and attach it to the purchase order.` : '- Request third-party EPDs (ISO 14025 / EN 15804) or valid SIRIM Eco-Label / MyHIJAU certificates.',
    ...rows.filter((r) => r.evidence.greenwash.length).slice(0, 1).map((r) => `- Ask ${r.c.ex.supplier} to substantiate its claims or withdraw them from the bid.`),
    '- Record the saving in the SSR2030 embodied-carbon ledger for IFRS S2 disclosure.',
  ].join('\n'));
  out.push('_Offline memo from the deterministic ranking. Supplier documents are fictitious sample data._');
  return out.join('\n\n');
}
