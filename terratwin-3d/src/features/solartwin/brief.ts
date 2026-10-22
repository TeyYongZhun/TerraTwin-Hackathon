/* AI site brief: request payload for Claude, and a deterministic offline brief built from the same numbers. */
import type { Site } from '../../data/sites';
import type { Assumptions } from '../../data/assumptions';
import { type Evaluation, fmt } from '../../lib/solar/evaluate';
import { TECH_LABEL, moduleOf } from '../../lib/solar/modules';

export function briefPayload(s: Site, ev: Evaluation, A: Assumptions) {
  return {
    site: {
      name: s.name, kind: s.kind, type: s.subtitle, osmId: s.id, footprintM2: Math.round(s.area), heightM: s.height, homes: s.homes,
      kwp: s.kwp, panels: s.panels, pvModule: moduleOf(s.module).product, usableAreaM2: s.usableArea, annualShadingLossPct: +(s.shadingLoss * 100).toFixed(1),
      attributes: s.attrs, nearestSubstation: s.substation, servesBuilding: s.nearName ?? null,
    },
    metrics: {
      score: +ev.score.toFixed(1), components: ev.components.map((c) => ({ name: c.label, value: Math.round(c.value), weight: c.weight })),
      annualMWh: +(ev.annualKwh / 1000).toFixed(1), selfConsumptionPct: Math.round(ev.dm.selfConsumption * 100), loadCoveragePct: Math.round(ev.dm.coverage * 100),
      capexRM: Math.round(ev.finance.capex), annualSavingsRM: Math.round(ev.finance.annualSavings), paybackYears: Number.isFinite(ev.finance.paybackYears) ? +ev.finance.paybackYears.toFixed(1) : null,
      tco2PerYear: Math.round(ev.finance.tco2), creamMonthlyLeasePerHomeRM: ev.finance.monthlyLease ? Math.round(ev.finance.monthlyLease) : null,
    },
    redFlags: ev.flags.map((f) => ({ severity: f.severity, area: f.area, title: f.title, resolve: f.resolve })),
    passedChecks: ev.passed,
    assumptions: A,
  };
}

export function offlineBrief(s: Site, ev: Evaluation): string {
  const high = ev.flags.filter((f) => f.severity === 'high'), med = ev.flags.filter((f) => f.severity === 'medium');
  const verdict = high.length ? 'Proceed to feasibility once the blockers below are cleared' : ev.score >= 70 ? 'Strong candidate: move to detailed design' : ev.score >= 50 ? 'Viable: shortlist for the next tranche' : 'Low priority under the current weights';
  const lines: string[] = [];
  lines.push(`## ${verdict}`);
  if (s.kind === 'home') {
    lines.push(`${s.name} can host about **${fmt(s.kwp, 1)} kWp** (${fmt(ev.finance.perHomeKwp ?? 0, 1)} kWp per home), generating **${fmt(ev.annualKwh / 1000, 1)} MWh/yr** with ${(s.shadingLoss * 100).toFixed(1)}% modelled shading. Under CREAM, each homeowner leases the roof for an illustrative **RM ${fmt(ev.finance.monthlyLease ?? 0)} per month** with no upfront cost, and the pool avoids **${fmt(ev.finance.tco2)} tCO₂e/yr**.`);
  } else {
    lines.push(`${s.name} supports **${fmt(s.kwp)} kWp** (${fmt(s.panels)} ${TECH_LABEL[moduleOf(s.module).tech]} panels on ${fmt(s.usableArea)} m² usable), producing **${fmt(ev.annualKwh / 1000)} MWh/yr** at ${(s.shadingLoss * 100).toFixed(1)}% shading loss. ${Math.round(ev.dm.selfConsumption * 100)}% of it is consumed on site, giving an illustrative payback of **${Number.isFinite(ev.finance.paybackYears) ? ev.finance.paybackYears.toFixed(1) + ' years' : 'n/a'}** on ${fmt(ev.finance.capex / 1e6, 2)} M RM CAPEX and **${fmt(ev.finance.tco2)} tCO₂e/yr** avoided. It saves about **RM ${fmt(ev.finance.annualSavings)}/yr** on the electricity bill after O&M.`);
  }
  if (high.length || med.length) {
    lines.push('## Blockers to clear');
    for (const f of [...high, ...med].slice(0, 4)) lines.push(`- **${f.title}**: ${f.resolve}`);
  }
  lines.push('## Next steps');
  if (s.kind === 'carpark') lines.push('- Design the solar canopy and pass footing concrete and paver quantities to the **Canopy Materials** tab so the structure is built with verified low-carbon materials, then choose the PV panels in the **Solar Panels** tab.');
  lines.push(`- Collect the missing documents (${ev.missingData} item${ev.missingData === 1 ? '' : 's'}), then commission a site survey to confirm the OSM-derived geometry.`);
  lines.push('- Add to the Net-Zero portfolio to track its SSR2030 contribution and IFRS S2 Scope 2 reduction.');
  lines.push('_Offline brief generated from the screening model. Connect an Anthropic API key for a Claude-written brief._');
  return lines.join('\n\n');
}
