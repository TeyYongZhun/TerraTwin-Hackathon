/* Net-Zero dashboard: operational (SolarTwin) + embodied (EcoSpec) carbon, SSR2030 progress and an IFRS S2-style card. */
import { motion } from 'motion/react';
import { Building, Car, Gauge, House, Leaf, Plus, Printer, Recycle, Sun, Trash2, X, Zap } from 'lucide-react';
import { useAppPick } from '../../store/app';
import { useAnalytics } from '../../hooks/useAnalytics';
import { SSR2030_TARGET, usePortfolio } from './usePortfolio';
import { fmt } from '../../lib/solar/evaluate';
import { Btn, CountUp, Pill, cx, rm } from '../../components/ui';

export function Dashboard() {
  const p = usePortfolio();
  const a = useAnalytics();
  const { set, toggleIn, select, assumptions } = useAppPick('set', 'toggleIn', 'select', 'assumptions');
  const pct = (t: number) => (p.baselineT ? t / p.baselineT : 0);
  const scale = Math.max(0.6, pct(p.potentialT) * 1.1);
  const addTop = () => { for (const r of [...a.byKind.roof.slice(0, 4), ...a.byKind.carpark.slice(0, 1)]) toggleIn('portfolio', r.site.id, true); };
  const contrib = [...p.all.map((r) => ({ id: r.site.id, name: r.site.name, t: r.ev.finance.tco2, kind: r.site.kind })), ...p.picks.map((m) => ({ id: m.useCaseId, name: `${m.product} (one-off)`, t: m.tco2Saved, kind: 'material' as const }))].sort((x, y) => y.t - x.t).slice(0, 10);
  const maxC = Math.max(1, ...contrib.map((c) => c.t));
  const empty = !p.all.length && !p.picks.length;

  return (
    <>
      <div className="pointer-events-auto absolute inset-0 z-10 bg-slate-950/55 backdrop-blur-[3px]" />
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="pointer-events-auto glass absolute inset-x-3 bottom-3 top-[76px] z-20 mx-auto flex max-w-[1320px] flex-col overflow-hidden rounded-2xl" aria-label="Net-Zero dashboard">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/5 px-5 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-300 to-indigo-500 text-slate-950"><Gauge size={18} /></div>
          <div className="flex-1 leading-tight">
            <h2 className="font-bold text-white">Net-Zero dashboard · City of Elmina</h2>
            <p className="text-[11px] text-slate-400">Operational carbon (SolarTwin) + embodied carbon (EcoSpec AI) → SSR2030 and IFRS S2-style metrics</p>
          </div>
          {empty && <Btn tone="primary" onClick={addTop}><Plus size={14} /> Add top 5 sites</Btn>}
          <Btn onClick={() => window.print()} disabled={empty}><Printer size={14} /> Print decision pack</Btn>
          <button type="button" aria-label="Back to map" onClick={() => set({ module: 'solar' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
        </header>

        <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: Sun, label: 'Operational CO₂e avoided', v: p.operationalT, d: 0, unit: 't / yr', tint: 'text-amber-300' },
              { icon: Recycle, label: 'Embodied CO₂e saved', v: p.embodiedT, d: 1, unit: 't one-off', tint: 'text-emerald-300' },
              { icon: Zap, label: 'Solar capacity', v: p.kwp / 1000, d: 2, unit: 'MWp', tint: 'text-sky-300' },
              { icon: House, label: 'CREAM homes enrolled', v: p.poolHomes, d: 0, unit: `RM ${fmt(p.poolLease)}/mo leases`, tint: 'text-emerald-300' },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400"><k.icon size={13} className={k.tint} /> {k.label}</div>
                <div className="mt-1 text-3xl font-bold text-white"><CountUp value={k.v} decimals={k.d} /></div>
                <div className="text-xs text-slate-400">{k.unit}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-white">SSR2030 progress: cut emissions 40% by 2030</h3>
                <span className="text-[11px] text-slate-400">vs modelled baseline {fmt(p.baselineT)} tCO₂e/yr</span>
              </div>
              <div className="relative mt-8 h-4 rounded-full bg-white/5">
                <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500" initial={{ width: 0 }} animate={{ width: `${(pct(p.operationalT) / scale) * 100}%` }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} />
                {/* Target label above the bar, technical-potential label below, so close markers never collide. */}
                {[{ v: SSR2030_TARGET, label: 'SSR2030 target 40%', line: 'bg-emerald-300', text: 'text-emerald-200 -top-5' }, { v: pct(p.potentialT), label: `Full technical potential ${Math.round(pct(p.potentialT) * 100)}%`, line: 'bg-slate-300', text: 'text-slate-300 top-6' }].map((m) => (
                  <div key={m.label} className="absolute inset-y-0" style={{ left: `${(m.v / scale) * 100}%` }}>
                    <div className={cx('absolute -translate-x-1/2 whitespace-nowrap text-[10px]', m.text)}>{m.label}</div>
                    <div className={cx('absolute -top-1 h-6 w-0.5 -translate-x-1/2', m.line)} />
                  </div>
                ))}
              </div>
              <div className="mt-9 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                <span className="text-white"><b className="text-2xl text-amber-300">{(pct(p.operationalT) * 100).toFixed(1)}%</b> cut by this portfolio</span>
                <span className="text-slate-400">{fmt(Math.max(0, SSR2030_TARGET * p.baselineT - p.operationalT))} tCO₂e/yr still to find for 40%</span>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">Baseline = modelled grid electricity of all screened buildings × {assumptions.gridEF} tCO₂e/MWh. A screening estimate, not SDP's reported inventory.</p>
            </div>

            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">IFRS S2-style climate metrics</h3><Pill tone="sky">Illustrative</Pill></div>
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-[12px]">
                <dt className="text-slate-400">Scope 2 reduction (location-based)</dt><dd className="num text-right text-white">{fmt(p.operationalT)} tCO₂e/yr</dd>
                <dt className="text-slate-400">Scope 3 cat. 1 embodied saving</dt><dd className="num text-right text-white">{fmt(p.embodiedT, 1)} tCO₂e</dd>
                <dt className="text-slate-400">Capital deployed to climate opportunities</dt><dd className="num text-right text-white">{rm(p.capex + p.materialCost)}</dd>
                <dt className="text-slate-400">Renewable generation added</dt><dd className="num text-right text-white">{fmt(p.mwh)} MWh/yr</dd>
                <dt className="text-slate-400">Annual energy savings</dt><dd className="num text-right text-white">{rm(p.savings)}</dd>
                <dt className="text-slate-400">Open high-severity site risks</dt><dd className={cx('num text-right', p.highFlags ? 'text-rose-300' : 'text-emerald-300')}>{p.highFlags}</dd>
              </dl>
            </div>
          </div>

          {empty ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
              Add sites with <b className="text-slate-200">“Add to portfolio”</b> in SolarTwin, enrol homes in the CREAM pool, and confirm materials in EcoSpec AI.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                <h3 className="mb-3 text-sm font-semibold text-white">Largest contributions <span className="font-normal text-slate-400">(tCO₂e)</span></h3>
                <ul className="space-y-2">
                  {contrib.map((c) => (
                    <li key={c.id} title={`${c.name}: ${fmt(c.t, 1)} tCO₂e`}>
                      <div className="flex justify-between text-[11px]"><span className="truncate pr-2 text-slate-300">{c.name}</span><span className="num text-slate-200">{fmt(c.t, c.t < 10 ? 1 : 0)}</span></div>
                      <div className="mt-0.5 h-2 rounded-full bg-white/5"><motion.div className="h-full rounded-full" style={{ background: c.kind === 'material' ? '#199e70' : '#3987e5' }} initial={{ width: 0 }} animate={{ width: `${(c.t / maxC) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-4 text-[11px] text-slate-400"><span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-[#3987e5]" /> Solar, per year</span><span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-[#199e70]" /> Materials, one-off</span></div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                  <h3 className="mb-2 text-sm font-semibold text-white">Solar portfolio ({p.sites.length})</h3>
                  <ul className="divide-y divide-white/5">
                    {p.sites.map((r) => {
                      const Icon = r.site.kind === 'roof' ? Building : r.site.kind === 'carpark' ? Car : House, high = r.ev.flags.filter((f) => f.severity === 'high').length;
                      return (
                        <li key={r.site.id} className="flex items-center gap-2 py-1.5 text-[12px]">
                          <Icon size={13} className="text-slate-400" />
                          <button type="button" className="min-w-0 flex-1 truncate text-left text-slate-100 hover:text-white hover:underline" onClick={() => { set({ module: 'solar' }); select(r.site.id, r.site.kind); }}>{r.site.name}</button>
                          <span className="num text-slate-400">{fmt(r.site.kwp)} kWp</span>
                          <span className="num w-20 text-right text-amber-200">{fmt(r.ev.finance.tco2)} t/yr</span>
                          {high > 0 && <span className="rounded bg-rose-500/20 px-1 text-[10px] text-rose-200">{high}H</span>}
                          <button type="button" aria-label="Remove" onClick={() => toggleIn('portfolio', r.site.id, false)} className="text-slate-500 hover:text-rose-300"><Trash2 size={12} /></button>
                        </li>
                      );
                    })}
                    {p.pool.length > 0 && <li className="flex items-center gap-2 py-1.5 text-[12px]"><House size={13} className="text-emerald-300" /><span className="flex-1 text-slate-100">CREAM pool: {p.pool.length} rows · {p.poolHomes} homes</span><span className="num text-amber-200">{fmt(p.pool.reduce((t, r) => t + r.ev.finance.tco2, 0))} t/yr</span></li>}
                  </ul>
                </div>
                <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white"><Leaf size={14} className="text-emerald-300" /> Low-carbon materials ({p.picks.length})</h3>
                  {p.picks.length ? (
                    <ul className="divide-y divide-white/5">
                      {p.picks.map((m) => (
                        <li key={m.useCaseId} className="py-1.5 text-[12px]">
                          <div className="flex justify-between"><span className="text-slate-100">{m.product}</span><span className="num text-emerald-200">−{fmt(m.tco2Saved, 1)} t</span></div>
                          <div className="text-[11px] text-slate-400">{m.useCase} · {m.quantity.toLocaleString()} {m.unit} · {m.supplier} · {m.premium >= 0 ? '+' : ''}{m.premium.toFixed(0)}% cost</div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-[12px] text-slate-400">None yet. Confirm a recommendation in EcoSpec AI.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.section>
    </>
  );
}
