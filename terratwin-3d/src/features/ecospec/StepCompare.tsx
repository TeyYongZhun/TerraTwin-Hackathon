/* Comparison matrix: one column per product, green / amber / red cells, the evidence quote and page on hover. */
import { type ReactNode, createContext, useContext, useState } from 'react';
import { ArrowRight, CircleCheck, CircleX, CircleAlert, ShieldAlert } from 'lucide-react';
import { useEco } from '../../store/ecospec';
import { useRanking } from './useRanking';
import { Btn, cx } from '../../components/ui';

type Tone = 'pass' | 'fail' | 'warn' | 'neutral';
const TONE: Record<Tone, string> = {
  pass: 'bg-emerald-400/10 text-emerald-100 ring-emerald-300/20', fail: 'bg-rose-500/12 text-rose-100 ring-rose-400/25',
  warn: 'bg-amber-400/10 text-amber-100 ring-amber-300/20', neutral: 'bg-white/[0.03] text-slate-200 ring-white/5',
};
const ICON = { pass: CircleCheck, fail: CircleX, warn: CircleAlert, neutral: null } as const;

type Tip = { x: number; y: number; quote: string; page: number | null } | null;
const TipCtx = createContext<(t: Tip) => void>(() => {});

function Cell({ tone, children, quote, page }: { tone: Tone; children: ReactNode; quote?: string | null; page?: number | null }) {
  const I = ICON[tone], setTip = useContext(TipCtx);
  const show = (e: React.MouseEvent<HTMLDivElement>) => { if (!quote) return; const r = e.currentTarget.getBoundingClientRect(); setTip({ x: r.left, y: r.bottom + 6, quote, page: page ?? null }); };
  return (
    <td className="p-1 align-top">
      <div onMouseEnter={show} onMouseLeave={() => setTip(null)} className={cx('flex min-h-[38px] items-start gap-1.5 rounded-lg px-2 py-1.5 text-[12px] ring-1', TONE[tone], quote && 'cursor-help')}>
        {I && <I size={13} className="mt-0.5 shrink-0" />}
        <div className="min-w-0">{children}</div>
      </div>
    </td>
  );
}

export function StepCompare() {
  const { set } = useEco();
  const { uc, rows } = useRanking();
  const [tip, setTip] = useState<Tip>(null);
  const cols = [...rows].sort((a, b) => a.c.fileName.localeCompare(b.c.fileName));
  const fmtV = (v: number | null, unit: string) => (v === null ? 'missing' : `${v}${unit ? ' ' + unit : ''}`);

  return (
    <TipCtx.Provider value={setTip}>
    <div className="px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Spec-to-spec comparison · {uc.title}</h3>
          <p className="text-sm text-slate-400">Hover any cell to see the verbatim evidence and page. Red = fails or unverified, amber = missing or self-declared, green = verified.</p>
        </div>
        <Btn tone="leaf" onClick={() => set({ step: 4 })}>Rank &amp; shortlist <ArrowRight size={15} /></Btn>
      </div>

      <div className="scroll-thin mt-4 overflow-x-auto pb-2">
        <table className="w-full min-w-[820px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="w-44" />
              {cols.map((r) => (
                <th key={r.c.id} className="p-1 text-left align-bottom">
                  <div className={cx('rounded-xl px-2.5 py-2 ring-1', r.evidence.greenwash.length ? 'bg-rose-500/10 ring-rose-400/30' : 'bg-white/5 ring-white/10')}>
                    <div className="text-[13px] font-semibold text-white">{r.c.ex.product_name}</div>
                    <div className="text-[11px] font-normal text-slate-400">{r.c.ex.supplier}</div>
                    {r.evidence.greenwash.length > 0 && <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-300"><ShieldAlert size={12} /> Greenwashing risk</div>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr><td colSpan={cols.length + 1} className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Performance gate (must pass)</td></tr>
            {uc.requirements.map((req) => (
              <tr key={req.key}>
                <th className="pr-2 text-left text-[12px] font-medium text-slate-300">{req.label}<div className="text-[10px] font-normal text-slate-500">{req.op === '>=' ? '≥' : '≤'} {req.value} {req.unit}</div></th>
                {cols.map((r) => {
                  const g = r.gate.find((x) => x.req.key === req.key)!;
                  return <Cell key={r.c.id} tone={g.status === 'pass' ? 'pass' : g.status === 'fail' ? 'fail' : 'warn'} quote={g.quote} page={g.page}>{fmtV(g.value, req.unit)}{g.status === 'missing' && <div className="text-[10px] opacity-80">no test evidence</div>}</Cell>;
                })}
              </tr>
            ))}
            <tr><td colSpan={cols.length + 1} className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Carbon &amp; cost (per {uc.fuLabel})</td></tr>
            <tr>
              <th className="pr-2 text-left text-[12px] font-medium text-slate-300">Embodied carbon<div className="text-[10px] font-normal text-slate-500">kgCO₂e, normalised</div></th>
              {cols.map((r) => (
                <Cell key={r.c.id} tone={r.evidence.gwpStatus === 'verified' ? 'pass' : r.evidence.gwpStatus === 'self_declared' ? 'warn' : 'fail'} quote={r.c.ex.gwp.quote} page={r.c.ex.gwp.page}>
                  <b className="num">{r.norm.gwp ?? '—'}</b> <span className="text-[10px] opacity-80">{r.evidence.gwpStatus.replace('_', '-')}</span>
                  {r.norm.gwpNote && r.c.ex.gwp.declared_unit && !r.norm.gwpNote.startsWith('Declared') && <div className="text-[10px] opacity-80">{r.norm.gwpNote}</div>}
                </Cell>
              ))}
            </tr>
            <tr>
              <th className="pr-2 text-left text-[12px] font-medium text-slate-300">Price<div className="text-[10px] font-normal text-slate-500">RM per {uc.fuLabel}</div></th>
              {cols.map((r) => <Cell key={r.c.id} tone={r.norm.price === null ? 'warn' : 'neutral'} quote={r.c.ex.price.quote} page={r.c.ex.price.page}><b className="num">{r.norm.price ?? 'missing'}</b></Cell>)}
            </tr>
            <tr><td colSpan={cols.length + 1} className="px-1 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Evidence &amp; claims</td></tr>
            <tr>
              <th className="pr-2 text-left text-[12px] font-medium text-slate-300">EPD<div className="text-[10px] font-normal text-slate-500">ISO 14025 / EN 15804</div></th>
              {cols.map((r) => (
                <Cell key={r.c.id} tone={r.evidence.epdStatus === 'valid' ? 'pass' : r.evidence.epdStatus === 'none' ? 'warn' : 'fail'} quote={r.c.ex.epd.quote} page={r.c.ex.epd.page}>
                  {r.evidence.epdStatus === 'none' ? 'No EPD' : <>{r.c.ex.epd.registration_number}<div className="text-[10px] opacity-80">{r.evidence.epdStatus} · to {r.c.ex.epd.valid_until}</div></>}
                </Cell>
              ))}
            </tr>
            <tr>
              <th className="pr-2 text-left text-[12px] font-medium text-slate-300">Eco-labels<div className="text-[10px] font-normal text-slate-500">SIRIM / MyHIJAU</div></th>
              {cols.map((r) => {
                const c = r.c.ex.certifications[0];
                return (
                  <Cell key={r.c.id} tone={r.evidence.validLabels.length ? 'pass' : r.evidence.expiredLabels.length ? 'fail' : 'neutral'} quote={c?.quote} page={c?.page}>
                    {[...r.evidence.validLabels, ...r.evidence.expiredLabels].join(', ') || <span className="text-slate-500">none</span>}
                  </Cell>
                );
              })}
            </tr>
            <tr>
              <th className="pr-2 text-left text-[12px] font-medium text-slate-300">Marketing claims</th>
              {cols.map((r) => (
                <Cell key={r.c.id} tone={r.evidence.greenwash.length ? 'fail' : r.c.ex.claims.length ? 'pass' : 'neutral'} quote={r.c.ex.claims[0]?.quote} page={r.c.ex.claims[0]?.page}>
                  {r.c.ex.claims.length ? (
                    <ul className="space-y-1">
                      {r.c.ex.claims.map((cl) => {
                        const gw = r.evidence.greenwash.find((g) => g.quote === cl.quote);
                        return <li key={cl.quote}>“{cl.claim}”{gw && <div className="text-[10px] font-semibold text-rose-300">⚠ {gw.reason}</div>}</li>;
                      })}
                    </ul>
                  ) : <span className="text-slate-500">none</span>}
                </Cell>
              ))}
            </tr>
            <tr>
              <th className="pr-2 text-left text-[12px] font-medium text-slate-300">Extractor notes</th>
              {cols.map((r) => <Cell key={r.c.id} tone="neutral">{r.c.ex.notes.length ? <ul className="list-disc space-y-0.5 pl-3 text-[11px] text-slate-300">{r.c.ex.notes.map((n) => <li key={n}>{n}</li>)}</ul> : <span className="text-slate-500">none</span>}</Cell>)}
            </tr>
          </tbody>
        </table>
      </div>
      {tip && (
        <div className="pointer-events-none fixed z-50 w-72 rounded-lg bg-slate-950/95 p-2 text-[11px] text-slate-200 shadow-xl ring-1 ring-white/15" style={{ left: Math.min(tip.x, window.innerWidth - 300), top: tip.y }}>
          <span className="text-slate-400">Page {tip.page ?? '?'} · </span>“{tip.quote}”
        </div>
      )}
    </div>
    </TipCtx.Provider>
  );
}
