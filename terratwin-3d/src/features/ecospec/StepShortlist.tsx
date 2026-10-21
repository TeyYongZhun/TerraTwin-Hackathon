/* Shortlist: gate-then-rank result, cost-vs-carbon bubble chart, premium cap, streamed memo, confirm to Net-Zero. */
import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { Award, CircleCheck, Download, FileText, LoaderCircle, ShieldAlert, Sparkles, TriangleAlert, Gauge } from 'lucide-react';
import { useEco } from '../../store/ecospec';
import { useAppPick } from '../../store/app';
import { useRanking } from './useRanking';
import { memoPayload, offlineMemo } from './memo';
import type { Ranked } from '../../lib/ecospec/rank';
import type { Grade } from '../../lib/ecospec/evidence';
import { streamSSE, typeOut } from '../../lib/api';
import { Btn, CountUp, Pill, cx, rm } from '../../components/ui';
import { Markdownish } from '../../components/Markdownish';

/** Status palette (reserved): verified = good, partial = warning, unverified = critical; always shown with icon + label. */
const GRADE: Record<Grade, { color: string; label: string; icon: typeof CircleCheck }> = {
  verified: { color: '#0ca30c', label: 'Verified EPD', icon: CircleCheck },
  partial: { color: '#fab219', label: 'Self-declared carbon', icon: TriangleAlert },
  unverified: { color: '#d03b3b', label: 'Unverified / greenwashing', icon: ShieldAlert },
};
const tipStyle = { background: 'rgba(2,6,23,0.94)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 10, fontSize: 11, color: '#e2e8f0' };

interface Pt { x: number; y: number; name: string; r: Ranked | null; below?: boolean }

/** Direct labels sit to the right; a bubble with a close neighbour on its right drops its label below instead. */
function placeLabels(pts: Pt[]): Pt[] {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const xr = Math.max(1, Math.max(...xs) - Math.min(...xs)), yr = Math.max(1, Math.max(...ys) - Math.min(...ys));
  return pts.map((p) => ({ ...p, below: pts.some((q) => q !== p && q.x > p.x && (q.x - p.x) / xr < 0.3 && Math.abs(q.y - p.y) / yr < 0.25) }));
}

function Bubble(props: { cx?: number; cy?: number; payload?: Pt }) {
  const { cx: x = 0, cy: y = 0, payload } = props;
  if (!payload) return null;
  if (!payload.r) return (
    <g><path d={`M${x - 7},${y} L${x},${y - 7} L${x + 7},${y} L${x},${y + 7} Z`} fill="#64748b" stroke="#0b1222" strokeWidth={2} />
      <text x={x + 11} y={y + 4} fontSize={10} fill="#94a3b8">Baseline</text></g>
  );
  const r = payload.r, g = GRADE[r.evidence.grade], rad = r.recommended ? 13 : 10;
  return (
    <g>
      {r.recommended && <circle cx={x} cy={y} r={rad + 7} fill={g.color} opacity={0.18}><animate attributeName="r" values={`${rad + 4};${rad + 10};${rad + 4}`} dur="2s" repeatCount="indefinite" /></circle>}
      <circle cx={x} cy={y} r={rad} fill={r.gatePass ? g.color : 'transparent'} stroke={r.gatePass ? '#0b1222' : g.color} strokeWidth={r.gatePass ? 2 : 2.5} />
      {r.evidence.greenwash.length > 0 && <circle cx={x} cy={y} r={rad + 4} fill="none" stroke="#d03b3b" strokeWidth={2} strokeDasharray="3 2" />}
      {payload.below
        ? <text x={x} y={y + rad + 15} fontSize={11} fill="#e2e8f0" textAnchor="middle">{payload.name}</text>
        : <text x={x + rad + 6} y={y + 4} fontSize={11} fill="#e2e8f0">{payload.name}</text>}
    </g>
  );
}

export function StepShortlist() {
  const { premiumCap, memo, memoSrc, set } = useEco();
  const { ai, handoff, addPick, toast, set: setApp } = useAppPick('ai', 'handoff', 'addPick', 'toast', 'set');
  const { uc, qty, rows, recommended: rec, baseline } = useRanking();
  const [memoState, setMemoState] = useState<'idle' | 'loading' | 'done'>(memo ? 'done' : 'idle');
  const abort = useRef<AbortController | null>(null);

  // Short two-word names keep the direct labels legible.
  const pts: Pt[] = placeLabels(rows.filter((r) => r.norm.gwp !== null && r.norm.price !== null)
    .map((r) => ({ x: r.norm.price!, y: r.norm.gwp!, name: r.c.ex.product_name.split(/[\s,(]+/).slice(0, 2).join(' '), r })));
  const basePt: Pt = { x: uc.baseline.price, y: uc.baseline.gwp, name: 'Baseline', r: null };

  const runMemo = async () => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    set({ memo: '' }); setMemoState('loading');
    const push = (t: string) => set({ memo: useEco.getState().memo + t });
    try {
      if (!ai?.ai) throw new Error('offline');
      set({ memoSrc: 'claude' });
      await streamSSE('/api/ecospec/memo', memoPayload(uc, qty, rows, baseline, premiumCap, handoff?.siteName), push, ctl.signal, () => set({ memo: '' }));
    } catch (e) {
      if (ctl.signal.aborted) return;
      if ((e as Error).message !== 'offline') toast(`Claude unavailable (${(e as Error).message}) — offline memo`, 'warn');
      set({ memo: '', memoSrc: 'offline' });
      await typeOut(offlineMemo(uc, qty, rows, handoff?.siteName), push, ctl.signal);
    }
    if (!ctl.signal.aborted) setMemoState('done');
  };

  const confirm = () => {
    if (!rec) return;
    addPick({ useCaseId: uc.id, useCase: uc.title, product: rec.c.ex.product_name, supplier: rec.c.ex.supplier, quantity: qty, unit: uc.fuLabel, tco2: rec.tco2 ?? 0, tco2Saved: rec.savedT ?? 0, cost: rec.totalCost ?? 0, premium: rec.premiumPct ?? 0 });
    toast(`${rec.c.ex.product_name} added to the Net-Zero dashboard (−${(rec.savedT ?? 0).toFixed(1)} tCO₂e)`);
  };

  const exportCsv = () => {
    const head = ['rank', 'product', 'supplier', 'gate_pass', 'evidence_grade', 'greenwashing', `gwp_per_${uc.fu}`, `price_per_${uc.fu}`, 'total_tco2e', 'saved_tco2e', 'premium_pct', 'abatement_rm_per_t', 'recommended', 'reasons'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((r) => [r.order, r.c.ex.product_name, r.c.ex.supplier, r.gatePass, r.evidence.grade, r.evidence.greenwash.length > 0, r.norm.gwp, r.norm.price, r.tco2?.toFixed(2), r.savedT?.toFixed(2), r.premiumPct?.toFixed(1), r.abatement?.toFixed(0), r.recommended, r.reasons.join('; ')].map(esc).join(','));
    const url = URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: `ecospec-${uc.id}-shortlist.csv` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-4 px-5 py-5 xl:grid-cols-[1.15fr_1fr]">
      <div className="space-y-4">
        {/* Hero recommendation */}
        <div className={cx('rounded-2xl p-4 ring-1', rec ? 'bg-gradient-to-br from-emerald-400/15 to-teal-500/5 ring-emerald-300/30' : 'bg-amber-400/10 ring-amber-300/25')}>
          {rec ? (
            <div className="flex flex-wrap items-center gap-4">
              <Award className="text-emerald-300" size={34} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider text-emerald-200">Recommended for {qty.toLocaleString()} {uc.fuLabel}</div>
                <div className="truncate text-lg font-bold text-white">{rec.c.ex.product_name}</div>
                <div className="text-xs text-slate-300">{rec.c.ex.supplier} · {rec.evidence.flags.find((f) => f.tone === 'green')?.text}</div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><div className="text-xl font-bold text-emerald-300"><CountUp value={rec.savedT ?? 0} decimals={1} /></div><div className="text-[10px] text-slate-400">tCO₂e saved ({Math.round(rec.savedPct ?? 0)}%)</div></div>
                <div><div className="text-xl font-bold text-white">{(rec.premiumPct ?? 0) >= 0 ? '+' : ''}{(rec.premiumPct ?? 0).toFixed(0)}%</div><div className="text-[10px] text-slate-400">cost premium</div></div>
                <div><div className="text-xl font-bold text-white">{rec.abatement !== null ? rm(rec.abatement) : '—'}</div><div className="text-[10px] text-slate-400">per tCO₂e abated</div></div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-amber-100"><TriangleAlert size={20} /> No product passes the gate with verified carbon evidence within a {premiumCap}% premium. Raise the cap or request EPDs.</div>
          )}
        </div>

        {/* Bubble chart */}
        <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-white">Cost vs embodied carbon <span className="font-normal text-slate-400">(per {uc.fuLabel})</span></h4>
            <ul className="flex flex-wrap gap-3 text-[11px] text-slate-300">
              {(Object.keys(GRADE) as Grade[]).map((k) => { const G = GRADE[k]; return <li key={k} className="flex items-center gap-1"><G.icon size={12} style={{ color: G.color }} /> {G.label}</li>; })}
              <li className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-slate-300" /> Fails gate</li>
            </ul>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 14, right: 90, bottom: 18, left: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                <XAxis type="number" dataKey="x" name="Price" tick={{ fill: '#8b93a5', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgba(148,163,184,0.25)' }} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(v) => `RM ${Math.round(v)}`}
                  label={{ value: `Price, RM per ${uc.fuLabel}`, position: 'insideBottom', offset: -10, fill: '#8b93a5', fontSize: 10 }} />
                <YAxis type="number" dataKey="y" name="Carbon" tick={{ fill: '#8b93a5', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 'dataMax + 10']} width={46}
                  label={{ value: 'kgCO₂e', angle: -90, position: 'insideLeft', offset: 12, fill: '#8b93a5', fontSize: 10 }} />
                <ZAxis range={[200, 200]} />
                <Tooltip contentStyle={tipStyle} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(226,232,240,0.3)' }}
                  content={({ payload }) => {
                    const p = payload?.[0]?.payload as Pt | undefined;
                    if (!p) return null;
                    return (
                      <div style={tipStyle} className="px-3 py-2">
                        <div className="font-semibold">{p.r ? p.r.c.ex.product_name : uc.baseline.label}</div>
                        <div>RM {p.x} · {p.y} kgCO₂e per {uc.fuLabel}</div>
                        {p.r && <div className="text-slate-400">{p.r.reasons.length ? p.r.reasons.join(' · ') : 'Eligible'}</div>}
                      </div>
                    );
                  }} />
                <Scatter data={[basePt, ...pts]} shape={(p: unknown) => <Bubble {...(p as object)} />} isAnimationActive />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <label className="mt-2 flex items-center gap-3 text-xs text-slate-300">
            <Gauge size={14} className="text-slate-400" /> Max cost premium vs baseline
            <input className="range max-w-[220px]" type="range" min={0} max={50} step={1} value={premiumCap} onChange={(e) => set({ premiumCap: +e.target.value })} />
            <b className="num w-10 text-white">{premiumCap}%</b>
          </label>
        </div>
      </div>

      <div className="space-y-4">
        {/* Ranked list */}
        <ol className="space-y-2">
          {rows.map((r) => {
            const G = GRADE[r.evidence.grade];
            return (
              <motion.li layout key={r.c.id} className={cx('rounded-xl px-3 py-2.5 ring-1', r.recommended ? 'bg-emerald-400/10 ring-emerald-300/40' : 'bg-white/[0.03] ring-white/10')}>
                <div className="flex items-center gap-2.5">
                  <span className="num w-5 text-center text-xs text-slate-500">{r.order}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5"><span className="truncate text-[13px] font-semibold text-white">{r.c.ex.product_name}</span>{r.recommended && <Pill tone="emerald">Recommended</Pill>}</div>
                    <div className="num text-[11px] text-slate-400">{r.norm.gwp ?? '—'} kgCO₂e · RM {r.norm.price ?? '—'} per {uc.fuLabel}{r.savedT !== null && ` · ${r.savedT >= 0 ? '−' : '+'}${Math.abs(r.savedT).toFixed(1)} t`}</div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: G.color }}><G.icon size={13} /> {r.gatePass ? 'Gate ✓' : 'Gate ✗'}</span>
                </div>
                {r.reasons.length > 0 && <div className="mt-1 pl-7 text-[11px] text-slate-400">{r.reasons.map((x) => <span key={x} className={cx('mr-2', /Greenwash/.test(x) && 'font-semibold text-rose-300')}>{/Greenwash/.test(x) ? '⚠ ' : '• '}{x}</span>)}</div>}
              </motion.li>
            );
          })}
        </ol>

        {/* Memo */}
        <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/5">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-white"><Sparkles size={14} className="text-emerald-300" /> Procurement memo</h4>
            {memoSrc && memoState !== 'idle' && <Pill tone={memoSrc === 'claude' ? 'emerald' : 'slate'}>{memoSrc === 'claude' ? 'Claude' : 'Offline'}</Pill>}
          </div>
          {memoState === 'idle' && <p className="text-xs text-slate-400">Explains the decision for a project director: recommendation, why, rejected options, next steps.</p>}
          {memoState !== 'idle' && (memo ? <Markdownish text={memo} /> : <div className="flex items-center gap-2 text-xs text-slate-400"><LoaderCircle size={14} className="animate-spin" /> Drafting…</div>)}
        </div>

        <div className="flex flex-wrap gap-2">
          <Btn tone="sky" onClick={runMemo} disabled={memoState === 'loading' || !rows.length}>{memoState === 'loading' ? <LoaderCircle size={14} className="animate-spin" /> : <FileText size={14} />} {memoState === 'done' ? 'Regenerate memo' : 'Generate memo'}</Btn>
          <Btn tone="leaf" onClick={confirm} disabled={!rec}><CircleCheck size={14} /> Confirm choice</Btn>
          <Btn onClick={exportCsv} disabled={!rows.length}><Download size={14} /> CSV</Btn>
          <Btn onClick={() => setApp({ module: 'dashboard' })}>Net-Zero dashboard →</Btn>
        </div>
      </div>
    </div>
  );
}
