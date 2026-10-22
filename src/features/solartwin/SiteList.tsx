/* Left panel: township totals, Buildings / Car parks / CREAM homes tabs, live score weights and the ranked list. */
import { useMemo, useState } from 'react';
import { Building, Car, ChevronDown, House, RotateCcw, Search, SlidersHorizontal, TriangleAlert, Settings2 } from 'lucide-react';
import { useAppPick } from '../../store/app';
import { useAnalytics } from '../../hooks/useAnalytics';
import type { SiteKind } from '../../data/sites';
import { DEFAULT_WEIGHTS, type Weights, fmt } from '../../lib/solar/evaluate';
import { CountUp, cx, rm, scoreColor, scoreInk } from '../../components/ui';

const TABS: { id: SiteKind; label: string; icon: typeof Building }[] = [
  { id: 'roof', label: 'Buildings', icon: Building }, { id: 'carpark', label: 'Car parks', icon: Car }, { id: 'home', label: 'Homes', icon: House },
];
const W_LABEL: Record<keyof Weights, string> = { capacity: 'Usable capacity', shading: 'Low shading', demand: 'Demand match', readiness: 'Data readiness' };

export function SiteList() {
  const { tab, selectedId, hoverId, weights, creamPool, listQuery: q, hideBlockers: hideHigh, set, select, setWeight } = useAppPick('tab', 'selectedId', 'hoverId', 'weights', 'creamPool', 'listQuery', 'hideBlockers', 'set', 'select', 'setWeight');
  const a = useAnalytics();
  const [limit, setLimit] = useState(60);
  const [showW, setShowW] = useState(false);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return a.byKind[tab].filter((r) => (!s || r.site.name.toLowerCase().includes(s) || r.site.subtitle.toLowerCase().includes(s)) && (!hideHigh || !r.ev.flags.some((f) => f.severity === 'high')));
  }, [a, tab, q, hideHigh]);
  const t = a.totals[tab];
  const pool = creamPool.map((id) => a.byId.get(id)).filter(Boolean);
  const poolHomes = pool.reduce((s, r) => s + r!.site.homes, 0), poolKwp = pool.reduce((s, r) => s + r!.site.kwp, 0);

  return (
    <aside className="pointer-events-auto glass absolute bottom-3 left-3 top-[76px] z-20 flex w-[340px] flex-col overflow-hidden rounded-2xl">
      <div className="px-4 pb-2 pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Solar opportunity ranking</h2>
          <span className="text-[10px] text-slate-500">{a.township.sites.toLocaleString()} sites screened</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="glass-soft rounded-lg py-1.5"><div className="text-base font-bold text-amber-300"><CountUp value={t.kwp / 1000} decimals={1} /></div><div className="text-[10px] text-slate-400">MWp</div></div>
          <div className="glass-soft rounded-lg py-1.5"><div className="text-base font-bold text-emerald-300"><CountUp value={t.tco2} /></div><div className="text-[10px] text-slate-400">tCO₂e / yr</div></div>
          <div className="glass-soft rounded-lg py-1.5"><div className="text-base font-bold text-sky-300"><CountUp value={tab === 'home' ? t.homes : t.sites} /></div><div className="text-[10px] text-slate-400">{tab === 'home' ? 'homes' : 'sites'}</div></div>
        </div>
      </div>

      <div className="mx-3 grid grid-cols-3 gap-1 rounded-xl bg-black/25 p-1" role="tablist">
        {TABS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => { set({ tab: x.id }); setLimit(60); }}
            className={cx('flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition', tab === x.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200')}>
            <x.icon size={13} /> {x.label}
          </button>
        ))}
      </div>

      {tab === 'home' && (
        <div className="mx-3 mt-2 flex items-center justify-between rounded-xl bg-emerald-400/10 px-3 py-2 text-xs ring-1 ring-emerald-300/20">
          <span className="text-emerald-200">CREAM pool</span>
          <span className="num text-emerald-100"><b>{poolHomes}</b> homes · <b>{fmt(poolKwp, 1)}</b> kWp</span>
        </div>
      )}

      <div className="mx-3 mt-2">
        <button type="button" onClick={() => setShowW(!showW)} className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs font-semibold text-slate-300 hover:text-white">
          <span className="flex items-center gap-1.5"><SlidersHorizontal size={13} /> Scoring weights <span className="font-normal text-slate-500">(re-ranks live)</span></span>
          <ChevronDown size={14} className={cx('transition', showW && 'rotate-180')} />
        </button>
        {showW && (
          <div className="mt-1 space-y-2 rounded-xl bg-black/20 p-3">
            {(Object.keys(W_LABEL) as (keyof Weights)[]).map((k) => (
              <label key={k} className="block text-[11px] text-slate-300">
                <div className="mb-1 flex justify-between"><span>{W_LABEL[k]}</span><span className="num text-slate-400">{weights[k]}</span></div>
                <input className="range" type="range" min={0} max={100} step={5} value={weights[k]} onChange={(e) => setWeight(k, +e.target.value)} />
              </label>
            ))}
            <div className="flex justify-between pt-1">
              <button type="button" className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white" onClick={() => set({ weights: { ...DEFAULT_WEIGHTS } })}><RotateCcw size={11} /> Reset</button>
              <button type="button" className="flex items-center gap-1 text-[11px] text-sky-300 hover:text-sky-200" onClick={() => set({ assumptionsOpen: true })}><Settings2 size={11} /> Assumptions &amp; sources</button>
            </div>
          </div>
        )}
      </div>

      <div className="mx-3 mt-2 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1.5 rounded-lg bg-black/25 px-2 py-1.5 ring-1 ring-white/5">
          <Search size={13} className="text-slate-500" />
          <input value={q} onChange={(e) => set({ listQuery: e.target.value })} placeholder="Search sites…" className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500" />
        </div>
        <button type="button" onClick={() => set({ hideBlockers: !hideHigh })} title="Hide sites with high-severity red flags"
          className={cx('flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] ring-1', hideHigh ? 'bg-rose-500/15 text-rose-200 ring-rose-400/30' : 'text-slate-400 ring-white/10 hover:text-white')}>
          <TriangleAlert size={12} /> No blockers
        </button>
      </div>

      <ol className="scroll-thin mt-2 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {rows.slice(0, limit).map((r) => {
          const high = r.ev.flags.filter((f) => f.severity === 'high').length, med = r.ev.flags.filter((f) => f.severity === 'medium').length;
          const active = r.site.id === selectedId, hov = r.site.id === hoverId;
          return (
            <li key={r.site.id}>
              <button type="button" onClick={() => select(r.site.id)} onMouseEnter={() => set({ hoverId: r.site.id })} onMouseLeave={() => set({ hoverId: null })}
                className={cx('flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition', active ? 'bg-cyan-400/10 ring-1 ring-cyan-300/40' : hov ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]')}>
                <span className="num w-6 shrink-0 text-center text-[11px] text-slate-500">{r.rank}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium text-slate-100">{r.site.name}</span>
                    {r.site.featured && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" title="Featured site" />}
                    {creamPool.includes(r.site.id) && <span className="shrink-0 rounded bg-emerald-400/20 px-1 text-[9px] text-emerald-200">POOL</span>}
                  </span>
                  <span className="num flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{fmt(r.site.kwp, r.site.kwp < 100 ? 1 : 0)} kWp</span>
                    <span>{(r.site.shadingLoss * 100).toFixed(1)}% shade</span>
                    {r.site.kind === 'home' ? <span>RM {fmt(r.ev.finance.monthlyLease ?? 0)}/home/mo</span> : <span className={r.ev.finance.annualSavings > 0 ? '' : 'text-rose-300'}>{rm(r.ev.finance.annualSavings / 12)}/mo</span>}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="num rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: scoreColor(r.ev.score), color: scoreInk(r.ev.score) }}>{r.ev.score.toFixed(0)}</span>
                  <span className="flex gap-0.5">
                    {high > 0 && <span className="rounded bg-rose-500/20 px-1 text-[9px] text-rose-200">{high}H</span>}
                    {med > 0 && <span className="rounded bg-amber-500/15 px-1 text-[9px] text-amber-200">{med}M</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {rows.length > limit && (
          <li><button type="button" onClick={() => setLimit(limit + 60)} className="w-full rounded-xl py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white">Show more ({rows.length - limit} remaining)</button></li>
        )}
        {!rows.length && <li className="py-6 text-center text-xs text-slate-500">No sites match.</li>}
      </ol>
    </aside>
  );
}
