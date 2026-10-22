/* Site evaluation: yield, demand match, transparent weighted score, engineering red flags and finance. */
import type { Site } from '../../data/sites';
import type { Assumptions } from '../../data/assumptions';
import { type DemandMatch, demandMatch } from './energy';
import { capexPerKwp, heatFactor, moduleOf } from './modules';

export interface Weights { capacity: number; shading: number; demand: number; readiness: number }
export const DEFAULT_WEIGHTS: Weights = { capacity: 35, shading: 25, demand: 25, readiness: 15 };

export type Severity = 'high' | 'medium' | 'low' | 'info';
export interface RedFlag { id: string; severity: Severity; area: 'Structural' | 'Grid' | 'Shading' | 'Legal' | 'Data' | 'Safety' | 'Scheme'; title: string; resolve: string }

export interface Finance { capex: number; annualSavings: number; paybackYears: number; tco2: number; monthlyLease?: number; perHomeKwp?: number }
export interface Evaluation {
  annualKwh: number; dm: DemandMatch; score: number;
  components: { key: keyof Weights; label: string; value: number; weight: number; detail: string }[];
  flags: RedFlag[]; passed: string[]; finance: Finance; missingData: number;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function redFlags(s: Site): { flags: RedFlag[]; passed: string[] } {
  const f: RedFlag[] = [], passed: string[] = [], a = s.attrs;
  const add = (x: RedFlag) => f.push(x);
  if (s.kind !== 'carpark') {
    if (a.structuralCert === 'missing') add({ id: 'struct', severity: 'high', area: 'Structural', title: 'Missing structural roof load certificate', resolve: 'PV adds ~15–20 kg/m² dead load (>15 kg/m² check). Commission a C&S engineer load assessment before design.' });
    else if (a.structuralCert === 'expired') add({ id: 'struct', severity: 'medium', area: 'Structural', title: 'Structural assessment out of date', resolve: 'Re-validate roof load capacity (last check >5 years ago).' });
    else passed.push('Structural load certificate on file');
    if (a.roofAge !== null && a.roofAge > 15) add({ id: 'roofage', severity: 'medium', area: 'Structural', title: `Roof ${a.roofAge} years old`, resolve: 'Re-roof / waterproofing survey first — PV stays for 25 years.' });
    else if (a.roofAge !== null) passed.push(`Roof age ${a.roofAge} yrs (<15)`);
  } else {
    add({ id: 'bomba', severity: 'medium', area: 'Safety', title: 'BOMBA fire-appliance access & canopy clearance check', resolve: 'Confirm fire-engine routes and ≥3.6 m clearance; keep hydrants and access lanes clear of columns.' });
    if (!a.geotech) add({ id: 'geotech', severity: 'medium', area: 'Data', title: 'Soil investigation (SI) report missing', resolve: 'Commission SI boreholes to size column footings (feeds the Canopy Materials concrete quantities).' });
    else passed.push('Soil investigation report available');
  }
  const kwac = s.kwp / 1.25;
  if (s.kwp >= 1000) add({ id: 'pss', severity: 'high', area: 'Grid', title: 'Power System Study (PSS) likely required', resolve: `≈${Math.round(kwac)} kWac export capacity — engage TNB/grid owner for PSS and connection offer (illustrative ≥1 MWp threshold).` });
  else if (s.kwp >= 180) add({ id: 'tnb', severity: 'medium', area: 'Grid', title: 'TNB local transformer capacity check pending', resolve: 'Request a TNB connection assessment: transformer headroom, protection settings, metering.' });
  else passed.push('Small system — standard connection route');
  if (s.substation && s.substation.distance > 450) add({ id: 'feeder', severity: 'low', area: 'Grid', title: `Nearest mapped substation ${s.substation.distance} m away`, resolve: `${s.substation.name} (OSM). Confirm feeder route and spare capacity with TNB.` });
  if (s.shadingLoss >= 0.25) add({ id: 'shade', severity: 'high', area: 'Shading', title: `High annual shading loss (${Math.round(s.shadingLoss * 100)}%)`, resolve: 'Run a detailed shading survey; consider optimisers or excluding shaded zones.' });
  else if (s.shadingLoss >= 0.1) add({ id: 'shade', severity: 'medium', area: 'Shading', title: `Moderate shading loss (${Math.round(s.shadingLoss * 100)}%)`, resolve: 'Verify neighbouring building / tree heights on site (OSM heights are estimates).' });
  else passed.push(`Low modelled shading (${(s.shadingLoss * 100).toFixed(1)}%)`);
  if (a.ownership === 'Strata (JMB/MC)') add({ id: 'own', severity: 'medium', area: 'Legal', title: 'Strata roof — JMB/MC resolution required', resolve: 'Table a resolution at the AGM; agree roof-lease terms with the management body.' });
  else if (a.ownership === 'Third party') add({ id: 'own', severity: 'medium', area: 'Legal', title: 'Third-party owned roof', resolve: 'Negotiate a roof lease or solar PPA with the owner.' });
  else if (a.ownership === 'SDP-managed (tenanted)') add({ id: 'own', severity: 'low', area: 'Legal', title: 'Tenanted building', resolve: 'Align with tenant lease (roof access, PPA pass-through).' });
  else passed.push(`${a.ownership} — clear roof rights`);
  if (!a.bills12m) add({ id: 'bills', severity: 'medium', area: 'Data', title: '12-month electricity bills / load profile missing', resolve: 'Demand match uses a typical profile — upload 12 months of bills or smart-meter data.' });
  else passed.push('12-month electricity data available');
  if (!a.asBuilt) add({ id: 'asbuilt', severity: 'low', area: 'Data', title: 'As-built roof drawings missing', resolve: 'Request as-built architectural and M&E roof drawings.' });
  if (!a.sld) add({ id: 'sld', severity: 'low', area: 'Data', title: 'Electrical single-line diagram (SLD) missing', resolve: 'Obtain the SLD to locate the point of connection.' });
  if (s.kind === 'home') add({ id: 'scheme', severity: 'info', area: 'Scheme', title: 'CREAM-eligible landed residential', resolve: 'Homeowner opt-in + roof-lease agreement; aggregated by SDP into a CREAM pool.' });
  else if (s.category === 'apartment') add({ id: 'scheme', severity: 'info', area: 'Scheme', title: 'Multi-dwelling — not a CREAM rooftop', resolve: 'Use landlord-supply self-consumption for common areas instead.' });
  else add({ id: 'scheme', severity: 'info', area: 'Scheme', title: 'Commercial self-consumption (NEM-type), not CREAM', resolve: 'Behind-the-meter supply; export surplus under the applicable net-offset scheme.' });
  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 };
  return { flags: f.sort((x, y) => order[x.severity] - order[y.severity]), passed };
}

export function evaluateSite(s: Site, w: Weights, A: Assumptions): Evaluation {
  const annualKwh = s.kwp * A.specificYield * heatFactor(moduleOf(s.module)) * (1 - s.shadingLoss);
  const load = s.kind === 'home' ? s.homes * A.homeLoadKwh : s.annualLoad;
  const dm = demandMatch(annualKwh, load, s.demandClass);
  const { flags, passed } = redFlags(s);
  const missingData = flags.filter((x) => x.area === 'Data' || x.id === 'struct').length;
  const capacity = clamp((100 * Math.log10(1 + s.kwp)) / Math.log10(1 + 1500));
  const shading = clamp(100 * (1 - s.shadingLoss / 0.35));
  // CREAM homes export to the aggregator pool, so "demand" means pool fit rather than on-site self-consumption.
  const demand = s.kind === 'home' ? 85 : clamp(100 * dm.selfConsumption);
  const readiness = clamp(100 - 22 * missingData - (flags.some((x) => x.severity === 'high') ? 15 : 0));
  const components: Evaluation['components'] = [
    { key: 'capacity', label: 'Usable capacity', value: capacity, weight: w.capacity, detail: `${fmt(s.kwp)} kWp on ${fmt(s.usableArea)} m² usable` },
    { key: 'shading', label: 'Low shading', value: shading, weight: w.shading, detail: `${(s.shadingLoss * 100).toFixed(1)}% annual shading loss` },
    { key: 'demand', label: s.kind === 'home' ? 'CREAM pool fit' : 'Daytime demand match', value: demand, weight: w.demand, detail: s.kind === 'home' ? 'Exported to the CREAM aggregation pool' : `${Math.round(dm.selfConsumption * 100)}% of PV used on site` },
    { key: 'readiness', label: 'Data readiness', value: readiness, weight: w.readiness, detail: `${missingData} missing engineering item(s)` },
  ];
  const tw = components.reduce((a, c) => a + c.weight, 0) || 1;
  const score = components.reduce((a, c) => a + c.value * c.weight, 0) / tw;
  const finance = financeOf(s, annualKwh, dm.selfConsumption, A);
  return { annualKwh, dm, score, components, flags, passed, finance, missingData };
}

export function financeOf(s: Site, annualKwh: number, selfConsumption: number, A: Assumptions): Finance {
  const tco2 = (annualKwh / 1000) * A.gridEF, capex = s.kwp * capexPerKwp(s.kind, moduleOf(s.module), A);
  if (s.kind === 'home') {
    const perHomeKwp = s.kwp / Math.max(1, s.homes);
    return { capex, annualSavings: annualKwh * A.exportRate, paybackYears: NaN, tco2, monthlyLease: perHomeKwp * A.creamLeaseRate, perHomeKwp };
  }
  const annualSavings = annualKwh * selfConsumption * A.tariffCommercial + annualKwh * (1 - selfConsumption) * A.exportRate - (capex * A.omPct) / 100;
  return { capex, annualSavings, paybackYears: annualSavings > 0 ? capex / annualSavings : Infinity, tco2 };
}

export const fmt = (n: number, d = 0) => (Number.isFinite(n) ? n.toLocaleString('en-MY', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—');
