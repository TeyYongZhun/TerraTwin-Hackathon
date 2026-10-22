/* Printable decision pack (window.print). Hidden on screen; the interactive app is hidden in print. */
import { useApp } from '../../store/app';
import { ASSUMPTION_META, type Assumptions, SOURCES } from '../../data/assumptions';
import { fmt } from '../../lib/solar/evaluate';
import { rm } from '../../components/ui';
import { SSR2030_TARGET, usePortfolio } from './usePortfolio';

export function PrintReport() {
  const p = usePortfolio();
  const A = useApp((s) => s.assumptions);
  const th = 'border-b border-slate-300 py-1 pr-2 text-left text-[10px] uppercase tracking-wide text-slate-500';
  const td = 'border-b border-slate-200 py-1 pr-2 align-top';
  return (
    <div className="hidden bg-white p-8 text-[11px] text-slate-900 print:block">
      <h1 className="text-2xl font-bold">TerraTwin AI: Net-Zero decision pack</h1>
      <p className="text-slate-600">City of Elmina · generated {new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })} · screening-level estimates for discussion, not an engineering design or a sustainability disclosure.</p>

      <h2 className="mt-5 text-base font-bold">Summary</h2>
      <table className="mt-1 w-full border-collapse">
        <tbody>
          {[
            ['Operational CO₂e avoided', `${fmt(p.operationalT)} tCO₂e/yr (${((p.operationalT / p.baselineT) * 100).toFixed(1)}% of the modelled baseline; SSR2030 target ${SSR2030_TARGET * 100}%)`],
            ['Embodied CO₂e saved (materials)', `${fmt(p.embodiedT, 1)} tCO₂e one-off`],
            ['Solar capacity / generation', `${fmt(p.kwp / 1000, 2)} MWp · ${fmt(p.mwh)} MWh/yr`],
            ['CAPEX (illustrative)', `${rm(p.capex)} solar + ${rm(p.materialCost)} materials`],
            ['CREAM pool', `${p.poolHomes} homes · ${rm(p.poolLease)} per month in roof leases`],
          ].map(([k, v]) => <tr key={k}><td className={`${td} w-56 font-semibold`}>{k}</td><td className={td}>{v}</td></tr>)}
        </tbody>
      </table>

      {p.sites.length > 0 && (<>
        <h2 className="mt-5 text-base font-bold">Solar sites</h2>
        <table className="mt-1 w-full border-collapse">
          <thead><tr>{['Site', 'Type', 'kWp', 'MWh/yr', 'Shading', 'tCO₂e/yr', 'CAPEX', 'Payback', 'Open red flags'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {p.sites.map((r) => (
              <tr key={r.site.id}>
                <td className={td}>{r.site.name}<div className="text-[9px] text-slate-500">OSM {r.site.id}</div></td>
                <td className={td}>{r.site.subtitle}</td><td className={td}>{fmt(r.site.kwp)}</td><td className={td}>{fmt(r.ev.annualKwh / 1000)}</td>
                <td className={td}>{(r.site.shadingLoss * 100).toFixed(1)}%</td><td className={td}>{fmt(r.ev.finance.tco2)}</td><td className={td}>{rm(r.ev.finance.capex)}</td>
                <td className={td}>{Number.isFinite(r.ev.finance.paybackYears) ? `${r.ev.finance.paybackYears.toFixed(1)} y` : '—'}</td>
                <td className={td}>{r.ev.flags.filter((f) => f.severity === 'high' || f.severity === 'medium').map((f) => `${f.severity === 'high' ? '●' : '○'} ${f.title}`).join('; ') || 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>)}

      {p.picks.length > 0 && (<>
        <h2 className="mt-5 text-base font-bold">Low-carbon panels and materials (Solar Panels, Canopy Materials)</h2>
        <table className="mt-1 w-full border-collapse">
          <thead><tr>{['Use case', 'Product', 'Supplier', 'Quantity', 'tCO₂e', 'Saved', 'Cost', 'Premium'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {p.picks.map((m) => (
              <tr key={m.useCaseId}>
                <td className={td}>{m.useCase}</td><td className={td}>{m.product}</td><td className={td}>{m.supplier} (fictitious)</td><td className={td}>{m.quantity.toLocaleString()} {m.unit}</td>
                <td className={td}>{fmt(m.tco2, 1)}</td><td className={td}>{fmt(m.tco2Saved, 1)}</td><td className={td}>{rm(m.cost)}</td><td className={td}>{m.premium.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>)}

      <h2 className="mt-5 text-base font-bold">Assumptions</h2>
      <table className="mt-1 w-full border-collapse">
        <tbody>{(Object.keys(ASSUMPTION_META) as (keyof Assumptions)[]).map((k) => <tr key={k}><td className={`${td} w-56`}>{ASSUMPTION_META[k].label}</td><td className={td}>{A[k]} {ASSUMPTION_META[k].unit}</td><td className={`${td} text-slate-500`}>{ASSUMPTION_META[k].note}</td></tr>)}</tbody>
      </table>
      <h2 className="mt-5 text-base font-bold">Sources &amp; data notes</h2>
      <ul className="mt-1 list-disc pl-4">
        {SOURCES.map((s) => <li key={s.url}>{s.title}: {s.url}</li>)}
        <li>Building footprints © OpenStreetMap contributors (ODbL); heights estimated from tags or building type. Site engineering attributes are illustrative stand-ins for SDP asset records.</li>
        <li>Supplier documents in the sample packs are fictitious test data.</li>
      </ul>
    </div>
  );
}
