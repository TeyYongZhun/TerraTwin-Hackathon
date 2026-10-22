/* Shortlist: gate-then-rank (total score) result, cost-vs-carbon bubble chart, premium cap, streamed memo, confirm to Net-Zero
   (a PV module picked for a SolarTwin site is also built on that site). */
import { Fragment, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { ArrowRight, Award, ChevronDown, CircleCheck, Download, FileText, Hammer, LoaderCircle, RotateCcw, ShieldAlert, SlidersHorizontal, Sparkles, TriangleAlert, Gauge } from 'lucide-react';
import { useSpecStore } from '../../store/ecospec';
import { builtProduct, useAppPick } from '../../store/app';
import { useRanking } from './useRanking';
import { memoPayload, offlineMemo } from './memo';
import { DEFAULT_SCORE_WEIGHTS, type Ranked, type ScoreWeights, standardOption } from '../../lib/ecospec/rank';
import type { Grade } from '../../lib/ecospec/evidence';
import { BASE_MODULE, pvSpecFrom, withModule } from '../../lib/solar/modules';
import { DEFAULT_WEIGHTS, evaluateSite } from '../../lib/solar/evaluate';
import { type UseCase, useCaseById } from '../../data/ecospec/usecases';
import { getSites } from '../../data/sites';
import { flyToSite } from '../../map/camera';
import { streamSSE, typeOut } from '../../lib/api';
import { Btn, Pill, cx, rm } from '../../components/ui';
import { Markdownish } from '../../components/Markdownish';

/** Status palette (reserved): verified = good, partial = warning, unverified = critical; always shown with icon + label. */
const GRADE: Record<Grade, { color: string; label: string; icon: typeof CircleCheck }> = {
  verified: { color: '#0ca30c', label: 'Verified EPD', icon: CircleCheck },
  partial: { color: '#fab219', label: 'Self-declared carbon', icon: TriangleAlert },
  unverified: { color: '#d03b3b', label: 'Unverified / greenwashing', icon: ShieldAlert },
};
const tipStyle = { background: 'rgba(2,6,23,0.94)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 10, fontSize: 11, color: '#e2e8f0' };

interface Pt { x: number; y: number; name: string; r: Ranked | null; below?: boolean; sel?: boolean; onPick?: () => void }

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
    <g style={{ cursor: 'pointer' }} onClick={payload.onPick}>
      {payload.sel && <circle cx={x} cy={y} r={14} fill="none" stroke="#7dd3fc" strokeWidth={2.5} />}
      <path d={`M${x - 7},${y} L${x},${y - 7} L${x + 7},${y} L${x},${y + 7} Z`} fill="#64748b" stroke="#0b1222" strokeWidth={2} />
      <text x={x + 18} y={y + 4} fontSize={10} fill="#94a3b8">Standard</text></g>
  );
  const r = payload.r, g = GRADE[r.evidence.grade], rad = r.recommended ? 13 : 10;
  return (
    <g style={{ cursor: 'pointer' }} onClick={payload.onPick}>
      {r.recommended && <circle cx={x} cy={y} r={rad + 7} fill={g.color} opacity={0.18}><animate attributeName="r" values={`${rad + 4};${rad + 10};${rad + 4}`} dur="2s" repeatCount="indefinite" /></circle>}
      {payload.sel && <circle cx={x} cy={y} r={rad + 8} fill="none" stroke="#7dd3fc" strokeWidth={2.5} />}
      <circle cx={x} cy={y} r={rad} fill={r.gatePass ? g.color : 'transparent'} stroke={r.gatePass ? '#0b1222' : g.color} strokeWidth={r.gatePass ? 2 : 2.5} />
      {r.evidence.greenwash.length > 0 && <circle cx={x} cy={y} r={rad + 4} fill="none" stroke="#d03b3b" strokeWidth={2} strokeDasharray="3 2" />}
      {payload.below
        ? <text x={x} y={y + rad + 15} fontSize={11} fill="#e2e8f0" textAnchor="middle">{payload.name}</text>
        : <text x={x + rad + 6} y={y + 4} fontSize={11} fill="#e2e8f0">{payload.name}</text>}
    </g>
  );
}

/* Plain-language read of each option against the standard product: how green it is, what it costs and how it
   performs, plus its total score. The technical figures behind it (kgCO₂e, RM per unit, abatement, part-scores,
   evidence, spec checks) sit in Details. */
type Tone = 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';
const INK: Record<Tone, string> = { emerald: 'text-emerald-300', sky: 'text-sky-300', amber: 'text-amber-300', rose: 'text-rose-300', slate: 'text-slate-300' };
const BAR: Record<Tone, string> = { emerald: 'bg-emerald-400', sky: 'bg-sky-400', amber: 'bg-amber-400', rose: 'bg-rose-400', slate: 'bg-slate-400' };
interface Plain { big: string; word: string; tone: Tone; bar: number }

function ecoOf(r: Ranked): Plain {
  if (r.standard) return { big: 'Standard carbon', word: 'The comparison point', tone: 'slate', bar: 0 };
  const p = r.savedPct;
  if (p === null) return { big: 'Carbon unknown', word: 'No comparable carbon figure', tone: 'slate', bar: 0 };
  const pct = Math.round(Math.abs(p)), big = p >= 0.5 ? `${pct}% less carbon` : p <= -0.5 ? `${pct}% more carbon` : 'Same carbon';
  // A saving only counts once a verified EPD backs it; otherwise it is the supplier's claim.
  if (r.evidence.grade !== 'verified') {
    const greenwash = r.evidence.greenwash.length > 0;
    return { big: `Claims ${big.toLowerCase()}`, word: greenwash ? 'Greenwashing risk, not verified' : 'Not verified by an EPD', tone: greenwash ? 'rose' : 'amber', bar: Math.max(0, p) };
  }
  const word = p >= 35 ? 'Very low carbon' : p >= 20 ? 'Low carbon' : p > 5 ? 'Some carbon saving' : p > -0.5 ? 'No real saving' : 'Worse than standard';
  return { big, word, tone: p >= 20 ? 'emerald' : p > 5 ? 'sky' : 'slate', bar: Math.max(0, p) };
}

/** What an option means for the whole project on the linked SolarTwin site, against building it with the standard
    product: panels by what the system earns and when the extra pays back, canopy materials by their share of the
    canopy budget. */
type Impact =
  | { kind: 'pv'; extra: number; capex0: number; more: number; savings0: number; payback: number; payback0: number }
  | { kind: 'canopy'; extra: number; capex: number };

/** The cost read leads with the project impact; the extra on the material's own price is the fallback (and sits in
    Details). The bar is how much the option adds to the cost. */
function costOf(r: Ranked, cap: number, im: Impact | null, baseCost: number): Plain {
  if (r.standard) return { big: 'Standard price', word: 'The comparison point', tone: 'slate', bar: 0 };
  const p = r.premiumPct;
  if (p === null || r.totalCost === null) return { big: 'Price unknown', word: 'No comparable price', tone: 'slate', bar: 0 };
  const over = p > cap, overWord = `Over the ${cap}% limit`;
  if (im?.kind === 'pv') {
    // What it saves first, then what it takes up front: the extra saved on bills each year against the extra spent.
    const share = (im.extra / im.capex0) * 100, flat = Math.abs(im.more) < im.savings0 * 0.01;
    const back = im.extra > 0 && im.more > 0 ? im.extra / im.more : null;
    const big = flat ? 'Saves about the same' : im.more < 0 ? `Saves ${rm(-im.more)} a year less` : `Saves ${rm(im.more)} more a year`;
    const upFront = share >= 0.5 ? `+${rm(im.extra)} up front` : share <= -0.5 ? `${rm(-im.extra)} less up front` : 'no extra up-front cost';
    const word = over ? `${upFront}, ${overWord.toLowerCase()}` : `${upFront}${back !== null ? `, back in ${back.toFixed(1)} yrs` : ''}`;
    return { big, word, tone: over || (!flat && im.more < 0) ? 'rose' : back === null || back <= 5 ? 'emerald' : 'amber', bar: Math.min(100, Math.max(0, share) * 5) };
  }
  if (r.costRatio !== null) {
    // Panels with no linked site: what the system costs per kWh it generates, then the extra on the panels.
    const d = (r.costRatio - 1) * 100, extra = r.totalCost - baseCost;
    const big = Math.abs(d) < 0.5 ? 'Same cost per kWh' : d < 0 ? `${(-d).toFixed(1)}% cheaper per kWh` : `${d.toFixed(1)}% dearer per kWh`;
    const onPanels = p >= 0.5 ? `+${rm(extra)} on the panels` : p <= -0.5 ? `${rm(-extra)} less on the panels` : 'same price';
    return { big, word: over ? `${onPanels}, ${overWord.toLowerCase()}` : onPanels, tone: over || d >= 0.5 ? 'rose' : 'emerald', bar: Math.min(100, Math.max(0, p) * 2) };
  }
  if (im?.kind === 'canopy') {
    const share = (im.extra / im.capex) * 100;
    const big = share >= 0.05 ? `Adds ${share.toFixed(1)}% to the canopy budget` : share <= -0.05 ? `Saves ${(-share).toFixed(1)}% of the canopy budget` : 'No extra cost';
    const word = over ? overWord : im.extra > 0 ? `+${rm(im.extra)} in total` : im.extra < 0 ? `${rm(-im.extra)} less in total` : 'Same price as standard';
    return { big, word, tone: over ? 'rose' : share <= 2 ? 'emerald' : 'amber', bar: Math.min(100, Math.max(0, share) * 20) };
  }
  const extra = r.totalCost - baseCost, pct = Math.round(Math.abs(p));
  const big = p >= 0.5 ? `+${rm(extra)} extra` : p <= -0.5 ? `${rm(-extra)} cheaper` : 'Same price';
  const word = over ? overWord : p >= 0.5 ? `${pct}% above the standard price` : p <= -0.5 ? `${pct}% below the standard price` : 'No extra cost';
  return { big, word, tone: over ? 'rose' : p <= 10 ? 'emerald' : 'amber', bar: Math.min(100, Math.max(0, p) * 2) };
}

function perfOf(r: Ranked, uc: UseCase): Plain {
  if (r.standard) return { big: 'Meets the spec', word: 'The comparison point', tone: 'slate', bar: 50 };
  const g = r.gate.find((x) => x.req.key === uc.performance.key)!, req = g.req, u = req.unit === '%' ? '%' : req.unit ? ' ' + req.unit : '';
  const limit = `${req.value}${u} ${req.op === '>=' ? 'minimum' : 'maximum'}`;
  if (g.value === null) return { big: `${uc.performance.label} not stated`, word: `Needs the ${limit}`, tone: 'rose', bar: 0 };
  const word = g.status === 'pass' ? `${req.op === '>=' ? 'Above' : 'Under'} the ${limit}` : `${req.op === '>=' ? 'Below' : 'Over'} the ${limit}`;
  return { big: `${g.value}${u} ${uc.performance.label.toLowerCase()}`, word, tone: g.status !== 'pass' ? 'rose' : (r.scores.performance ?? 50) >= 55 ? 'emerald' : 'sky', bar: r.scores.performance ?? 0 };
}

/** The total score out of 100 (the standard scores 50), or that an option is not eligible for one. */
function ScoreChip({ r }: { r: Ranked }) {
  if (r.score === null) return <span className="text-right text-[10px] leading-tight text-slate-500">Not<br />eligible</span>;
  return <span className="leading-none"><span className={cx('num text-lg font-bold', r.recommended ? 'text-emerald-300' : 'text-white')}>{Math.round(r.score)}</span><span className="text-[10px] text-slate-500">/100</span></span>;
}

/** One plain line with a small bar: how green, how costly or how well it performs, against the standard product. */
function Meter({ label, p, max, faded }: { label: string; p: Plain; max: number; faded?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-[11px]">
      <span className="w-[58px] shrink-0 text-slate-500">{label}</span>
      <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white/10">
        <span className={cx('block h-full rounded-full', BAR[p.tone], faded && 'opacity-40')} style={{ width: `${Math.min(100, (p.bar / max) * 100)}%` }} />
      </span>
      <span className={cx('shrink-0 font-semibold', INK[p.tone])}>{p.big}</span>
      <span className="min-w-0 text-slate-400">{p.word}</span>
    </div>
  );
}

/** The technical figures behind an option's plain summary. */
function Details({ r, uc, weights, impact }: { r: Ranked; uc: UseCase; weights: ScoreWeights; impact: Impact | null }) {
  const b = uc.baseline, fu = uc.fuLabel, G = GRADE[r.evidence.grade], unit = (u: string) => (u ? ' ' + u : '');
  const tw = weights.eco + weights.cost + weights.performance || 1, share = (v: number) => Math.round((v / tw) * 100), s = r.scores;
  const parts = `Eco ${Math.round(s.eco)} × ${share(weights.eco)}% + Cost ${Math.round(s.cost)} × ${share(weights.cost)}% + ${uc.performance.label} ${s.performance === null ? 'n/a' : Math.round(s.performance)} × ${share(weights.performance)}%`;
  const items: [string, string][] = [
    ['Embodied carbon', `${r.norm.gwp ?? '—'} kgCO₂e per ${fu} (standard ${b.gwp})${r.tco2 !== null ? ` · ${r.tco2.toFixed(1)} tCO₂e in total` : ''}${r.savedT !== null ? ` · ${r.savedT >= 0 ? 'saves' : 'adds'} ${Math.abs(r.savedT).toFixed(1)} t` : ''}`],
    ['Price', `RM ${r.norm.price ?? '—'} per ${fu} (standard RM ${b.price}${r.premiumPct !== null ? `, ${r.premiumPct >= 0 ? '+' : '−'}${Math.abs(r.premiumPct).toFixed(0)}%` : ''})${r.totalCost !== null ? ` · ${rm(r.totalCost)} in total` : ''}`],
    ...(impact?.kind === 'pv' ? [['Project impact', `${impact.extra >= 0 ? 'Extra' : 'Saves'} ${rm(Math.abs(impact.extra))} up front (${Math.abs((impact.extra / impact.capex0) * 100).toFixed(1)}% of the ${rm(impact.capex0)} system) · ${impact.more >= 0 ? '+' : '−'}${rm(Math.abs(impact.more))} a year in bill savings${impact.extra > 0 && impact.more > 0 ? ` · extra pays back in ${(impact.extra / impact.more).toFixed(1)} yrs` : ''}${Number.isFinite(impact.payback) ? ` · system pays back in ${impact.payback.toFixed(1)} yrs (standard ${impact.payback0.toFixed(1)})` : ''}`] as [string, string]]
      : impact?.kind === 'canopy' ? [['Project impact', `${impact.extra >= 0 ? '+' : '−'}${rm(Math.abs(impact.extra))} = ${Math.abs((impact.extra / impact.capex) * 100).toFixed(1)}% of the ${rm(impact.capex)} canopy (panels, steel and footings)`] as [string, string]] : []),
    ...(r.costRatio !== null ? [['Cost per kWh', `${Math.abs((r.costRatio - 1) * 100).toFixed(1)}% ${r.costRatio <= 1 ? 'below' : 'above'} the standard panel (system cost per kWp ÷ yield per kWp; the Cost score uses this)`] as [string, string]] : []),
    ['Abatement cost', r.abatement !== null ? `${rm(r.abatement)} extra per tCO₂e avoided` : '—'],
    ['Total score', r.score !== null ? `${r.score.toFixed(1)}/100 = ${parts} (the standard scores 50 on each)` : `Not scored: not eligible (would be ${parts})`],
  ];
  const notes = [r.norm.gwpNote, r.norm.priceNote].filter(Boolean);
  if (r.standard) return (
    <div className="mt-2 space-y-2 rounded-lg bg-black/25 p-2.5 text-[11px] text-slate-300">
      <dl className="grid grid-cols-[104px_1fr] gap-x-3 gap-y-1">
        <dt className="text-slate-400">Embodied carbon</dt><dd className="num">{b.gwp} kgCO₂e per {fu}{r.tco2 !== null && ` · ${r.tco2.toFixed(1)} tCO₂e in total`}</dd>
        <dt className="text-slate-400">Price</dt><dd className="num">RM {b.price} per {fu}{r.totalCost !== null && ` · ${rm(r.totalCost)} in total`}</dd>
      </dl>
      <p className="text-slate-500">Conventional reference values set in the app, not a supplier document. Every other option's carbon saving and extra cost is measured against this product.</p>
    </div>
  );
  return (
    <div className="mt-2 space-y-2 rounded-lg bg-black/25 p-2.5 text-[11px] text-slate-300">
      <dl className="grid grid-cols-[104px_1fr] gap-x-3 gap-y-1">
        {items.map(([k, v]) => <Fragment key={k}><dt className="text-slate-400">{k}</dt><dd className="num">{v}</dd></Fragment>)}
        <dt className="text-slate-400">Evidence</dt>
        <dd>
          <span className="flex items-center gap-1" style={{ color: G.color }}><G.icon size={12} /> {G.label}</span>
          {r.evidence.flags.map((f) => <div key={f.text} className={f.tone === 'red' ? 'text-rose-300' : f.tone === 'amber' ? 'text-amber-200' : 'text-slate-300'}>{f.text}</div>)}
        </dd>
        <dt className="text-slate-400">Spec checks</dt>
        <dd>
          {r.gate.map((g) => (
            <div key={g.req.key}>{g.status === 'pass' ? '✓' : '✗'} {g.req.label}: {g.value === null ? 'not stated' : `${g.value}${unit(g.req.unit)}`} <span className="text-slate-500">(needs {g.req.op} {g.req.value}{unit(g.req.unit)})</span></div>
          ))}
        </dd>
      </dl>
      {notes.length > 0 && <p className="text-slate-500">{notes.join(' ')}</p>}
    </div>
  );
}

export function StepShortlist() {
  const store = useSpecStore(), { useCaseIds, premiumCap, weights, memo, memoSrc, set } = store();
  const wTotal = weights.eco + weights.cost + weights.performance || 1;
  const { ai, handoff, pvHandoff, modules, canopySpecs, assumptions, addPick, toast, set: setApp, setModule, setCanopySpec, toggleIn, toggleLayer, select } = useAppPick('ai', 'handoff', 'pvHandoff', 'modules', 'canopySpecs', 'assumptions', 'addPick', 'toast', 'set', 'setModule', 'setCanopySpec', 'toggleIn', 'toggleLayer', 'select');
  const { uc, qty, rows, recommended: rec, baseline } = useRanking();
  /** The SolarTwin site the confirmed choice is built on: PV modules on the array, footings / pavers on the canopy. */
  const pv = uc.id === 'pv-module', site = pv ? pvHandoff : handoff;
  /** What is already built on that site for this use case (confirmed here before). */
  const built = site ? builtProduct({ modules, canopySpecs }, uc.id, site.siteId) : undefined;
  /** The module's next use case still to build on the site (e.g. pavers once the footings are done). */
  const nextId = site && built ? useCaseIds.find((u) => u !== uc.id && !builtProduct({ modules, canopySpecs }, u, site.siteId)) : undefined;
  const next = nextId ? useCaseById(nextId) : undefined;
  // The user's choice: what is already built on the site, else the recommendation, unless another option is clicked
  // (any option can be chosen, with warnings).
  const [pickId, setPickId] = useState<string | null>(null);
  /** The option whose technical details are open. */
  const [openId, setOpenId] = useState<string | null>(null);
  /** The standard product every option is compared with, mid-sentence ("a conventional mono PERC module"). */
  const standard = uc.baseline.label.charAt(0).toLowerCase() + uc.baseline.label.slice(1);
  /** The standard product itself, listed last as an option people can pick; it is never the recommendation. */
  const std = useMemo(() => standardOption(uc, qty), [uc, qty]);
  const options = [...rows, std];
  /** Each option's impact on the linked site's whole project (none without a linked site). */
  const impactOf = useMemo(() => {
    const base = site ? getSites().byId.get(site.siteId) : undefined;
    if (!base) return (): Impact | null => null;
    if (pv) {
      const f0 = evaluateSite(base, DEFAULT_WEIGHTS, assumptions).finance;
      return (r: Ranked): Impact | null => {
        const spec = r.standard ? null : pvSpecFrom(r.c.ex, r.norm);
        if (!r.standard && !spec) return null;
        const f = spec ? evaluateSite(withModule(base, spec), DEFAULT_WEIGHTS, assumptions).finance : f0;
        return { kind: 'pv', extra: f.capex - f0.capex, capex0: f0.capex, more: f.annualSavings - f0.annualSavings, savings0: f0.annualSavings, payback: f.paybackYears, payback0: f0.paybackYears };
      };
    }
    const capex = evaluateSite(modules[base.id] ? withModule(base, modules[base.id]) : base, DEFAULT_WEIGHTS, assumptions).finance.capex;
    return (r: Ranked): Impact | null => (r.totalCost === null ? null : { kind: 'canopy', extra: r.totalCost - uc.baseline.price * qty, capex });
  }, [site, pv, assumptions, modules, uc, qty]);
  const builtRow = built ? options.find((r) => r.c.ex.product_name === built) : undefined;
  const chosen = options.find((r) => r.c.id === pickId) ?? builtRow ?? rec ?? null, own = !!chosen && chosen !== rec;
  const chosenSpec = pv && chosen ? (chosen.standard ? { ...BASE_MODULE, product: chosen.c.ex.product_name, standard: true } : pvSpecFrom(chosen.c.ex, chosen.norm)) : null;
  /** A PV module can only be built from a datasheet with efficiency, temperature coefficient, carbon and price. */
  const blocked = !chosen || (pv && !!site && !chosenSpec);
  const [memoState, setMemoState] = useState<'idle' | 'loading' | 'done'>(memo ? 'done' : 'idle');
  const abort = useRef<AbortController | null>(null);

  // Short two-word names keep the direct labels legible.
  const pts: Pt[] = placeLabels(rows.filter((r) => r.norm.gwp !== null && r.norm.price !== null)
    .map((r) => ({ x: r.norm.price!, y: r.norm.gwp!, name: r.c.ex.product_name.split(/[\s,(]+/).slice(0, 2).join(' '), r, sel: r === chosen, onPick: () => setPickId(r.c.id) })));
  const basePt: Pt = { x: uc.baseline.price, y: uc.baseline.gwp, name: 'Standard', r: null, sel: chosen === std, onPick: () => setPickId(std.c.id) };

  const runMemo = async () => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    set({ memo: '' }); setMemoState('loading');
    const push = (t: string) => set({ memo: store.getState().memo + t });
    try {
      if (!ai?.ai) throw new Error('offline');
      set({ memoSrc: 'claude' });
      await streamSSE('/api/ecospec/memo', memoPayload(uc, qty, rows, baseline, premiumCap, weights, site?.siteName), push, ctl.signal, () => set({ memo: '' }));
    } catch (e) {
      if (ctl.signal.aborted) return;
      if ((e as Error).message !== 'offline') toast(`Claude unavailable (${(e as Error).message}) — offline memo`, 'warn');
      set({ memo: '', memoSrc: 'offline' });
      await typeOut(offlineMemo(uc, qty, rows, site?.siteName), push, ctl.signal);
    }
    if (!ctl.signal.aborted) setMemoState('done');
  };

  const confirm = () => {
    const c = chosen;
    if (!c || blocked) return;
    addPick({
      useCaseId: site ? `${uc.id}:${site.siteId}` : uc.id, useCase: site ? `${uc.title} · ${site.siteName}` : uc.title, product: c.c.ex.product_name, supplier: c.c.ex.supplier,
      quantity: qty, unit: uc.fuLabel, tco2: c.tco2 ?? 0, tco2Saved: c.savedT ?? 0, cost: c.totalCost ?? 0, premium: c.premiumPct ?? 0,
    });
    const spec = chosenSpec;
    if (!site) { toast(`${c.c.ex.product_name} added to the Net-Zero dashboard (−${(c.savedT ?? 0).toFixed(1)} tCO₂e)`); return; }
    const kind = pvHandoff && pv ? pvHandoff.kind : 'carpark', canopy = kind === 'carpark', target = getSites().byId.get(site.siteId);
    setApp({ module: 'solar' });
    select(site.siteId, kind);
    // The site is usually still selected from the drawer, so selecting it again does not move the camera: fly there
    // explicitly, and build once the flight is under way so the build-out plays in view.
    if (target) flyToSite(target);
    window.setTimeout(() => {
      // PanelSpec lays the panels; EcoSpec builds only the canopy part it specified (footings or paving).
      if (spec) setModule(site.siteId, spec);
      else setCanopySpec(site.siteId, uc.id === 'paver-80' ? 'paver' : 'concrete', c.c.ex.product_name);
      toggleIn(canopy ? 'canopies' : 'arrays', site.siteId, true);
      toggleLayer(canopy ? 'canopies' : 'panels', true);
    }, 900);
    toast(`Building ${site.siteName} ${pv ? 'panels' : uc.id === 'paver-80' ? 'paving' : 'footings'} with ${c.c.ex.product_name}${c.eligible ? '' : ' (not recommended)'}${c.standard ? ' (standard product, no carbon saving)' : ` (−${(c.savedT ?? 0).toFixed(1)} tCO₂e embodied)`}`, c.eligible ? 'ok' : 'warn');
  };

  const exportCsv = () => {
    const head = ['rank', 'product', 'supplier', 'gate_pass', 'evidence_grade', 'greenwashing', `gwp_per_${uc.fu}`, `price_per_${uc.fu}`, 'total_tco2e', 'saved_tco2e', 'premium_pct', 'abatement_rm_per_t', 'total_score', 'recommended', 'reasons'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = options.map((r) => [r.standard ? 'standard' : r.order, r.c.ex.product_name, r.c.ex.supplier, r.gatePass, r.evidence.grade, r.evidence.greenwash.length > 0, r.norm.gwp, r.norm.price, r.tco2?.toFixed(2), r.savedT?.toFixed(2), r.premiumPct?.toFixed(1), r.abatement?.toFixed(0), r.score?.toFixed(1), r.recommended, r.reasons.join('; ')].map(esc).join(','));
    const url = URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: `ecospec-${uc.id}-shortlist.csv` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-4 px-5 py-5 xl:grid-cols-[1.15fr_1fr]">
      <div className="space-y-4">
        {site && built && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-sky-400/10 px-4 py-3 text-sm text-sky-100 ring-1 ring-sky-300/25">
            <CircleCheck size={18} className="shrink-0 text-sky-300" />
            <p className="flex-1"><b>{site.siteName}</b> is built with <b>{built}</b> ({pv ? 'PV panels' : uc.id === 'paver-80' ? 'paving' : 'footings'}), confirmed here before. Confirm another option to rebuild it.</p>
            {next && <Btn tone="leaf" className="shrink-0" onClick={() => set({ useCaseId: next.id, step: 1, memo: '', memoSrc: null })}>Next: {next.short} <ArrowRight size={14} /></Btn>}
          </div>
        )}
        {/* Hero: the chosen option (the recommendation unless the user picks another) */}
        <div className={cx('rounded-2xl p-4 ring-1', chosen?.eligible ? 'bg-gradient-to-br from-emerald-400/15 to-teal-500/5 ring-emerald-300/30' : 'bg-amber-400/10 ring-amber-300/25')}>
          {chosen ? (
            <>
              <div className="flex flex-wrap items-center gap-4">
                {!own ? <Award className="text-emerald-300" size={34} /> : chosen.eligible ? <CircleCheck className="text-sky-300" size={34} /> : <TriangleAlert className="text-amber-300" size={34} />}
                <div className="min-w-0 flex-1">
                  <div className={cx('text-[11px] uppercase tracking-wider', chosen.eligible ? 'text-emerald-200' : 'text-amber-200')}>{own ? 'Your choice' : 'Recommended'} for {qty.toLocaleString()} {uc.fuLabel}</div>
                  <div className="truncate text-lg font-bold text-white">{chosen.c.ex.product_name}</div>
                  <div className="text-xs text-slate-300">
                    {chosen.standard ? 'The standard product: no carbon saving and no extra cost'
                      : <>{chosen.c.ex.supplier} · {chosen.eligible ? chosen.evidence.flags.find((f) => f.tone === 'green')?.text ?? 'Eligible' : <span className="text-amber-200">Not recommended: {chosen.reasons.join('; ')}</span>}</>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Total score</div>
                  {chosen.score !== null
                    ? <div className="num text-3xl font-bold text-white">{Math.round(chosen.score)}<span className="text-sm font-normal text-slate-400">/100</span></div>
                    : <div className="text-sm font-semibold text-amber-200">Not eligible</div>}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                {[{ p: ecoOf(chosen), label: 'How green' }, { p: costOf(chosen, premiumCap, impactOf(chosen), baseline.cost), label: 'What it costs' }, { p: perfOf(chosen, uc), label: uc.performance.label }].map(({ p, label }) => (
                  <div key={label}><div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div><div className={cx('text-base font-bold', INK[p.tone])}>{p.big}</div><div className="text-[10px] text-slate-400">{p.word}</div></div>
                ))}
              </div>
              <p className="num mt-2 text-[11px] text-slate-400">
                {chosen.standard ? 'Every other option is compared with this one' : `Compared with a ${standard}`}{!chosen.standard && chosen.savedT !== null && ` · saves ${chosen.savedT.toFixed(1)} tCO₂e`}{chosen.totalCost !== null && ` · ${rm(chosen.totalCost)} in total`}{chosen.abatement !== null && ` · ${rm(chosen.abatement)} per tCO₂e avoided`}
              </p>
              {own && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-2.5 text-xs text-slate-300">
                  {rec ? <>Recommended: <b className="text-white">{rec.c.ex.product_name}</b> (score {Math.round(rec.score ?? 0)}, {rec.savedT !== null ? `−${rec.savedT.toFixed(1)} t` : '—'}, {(rec.premiumPct ?? 0) >= 0 ? '+' : ''}{(rec.premiumPct ?? 0).toFixed(0)}%)</> : 'No option is eligible for a recommendation.'}
                  {rec && <button type="button" className="ml-auto text-sky-300 hover:text-sky-200" onClick={() => setPickId(rec.c.id)}>Use the recommendation</button>}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 text-sm text-amber-100"><TriangleAlert size={20} /> No product passes the gate with verified carbon evidence within a {premiumCap}% premium. Raise the cap, request EPDs, or choose an option from the list.</div>
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
            <Gauge size={14} className="text-slate-400" /> Max extra cost vs standard
            <input className="range max-w-[220px]" type="range" min={0} max={50} step={1} value={premiumCap} onChange={(e) => set({ premiumCap: +e.target.value })} />
            <b className="num w-10 text-white">{premiumCap}%</b>
          </label>
          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1.5"><SlidersHorizontal size={13} className="text-slate-400" /> Score weights <span className="text-slate-500">(re-ranks live)</span></span>
              <button type="button" className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white" onClick={() => set({ weights: { ...DEFAULT_SCORE_WEIGHTS } })}><RotateCcw size={11} /> Reset</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['eco', 'cost', 'performance'] as const).map((k) => (
                <label key={k} className="block text-[11px] text-slate-300">
                  <div className="mb-1 flex justify-between"><span>{k === 'eco' ? 'Eco' : k === 'cost' ? 'Cost' : uc.performance.label}</span><span className="num text-slate-400">{Math.round((weights[k] / wTotal) * 100)}%</span></div>
                  <input className="range" type="range" min={0} max={100} step={5} value={weights[k]} onChange={(e) => set({ weights: { ...weights, [k]: +e.target.value } })} />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Ranked list: click any option to choose it */}
        <p className="text-[11px] text-slate-400">Each option is compared with a {standard}, listed last as the standard (score 50). The recommendation is the highest total score among options that pass the spec, have verified carbon and stay within the cost limit. Click an option to choose it. {builtRow ? 'What is built on the site' : 'The recommendation'} is pre-selected.</p>
        <ol className="space-y-2" role="radiogroup" aria-label="Options">
          {options.map((r) => {
            const G = GRADE[r.evidence.grade], sel = r === chosen;
            return (
              <motion.li layout key={r.c.id} role="radio" aria-checked={sel} tabIndex={0} onClick={() => setPickId(r.c.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setPickId(r.c.id)}
                className={cx('cursor-pointer rounded-xl px-3 py-2.5 transition',
                  r.recommended ? 'bg-emerald-400/10' : 'bg-white/[0.03] hover:bg-white/[0.06]',
                  sel ? 'ring-2 ring-sky-300/70' : r.recommended ? 'ring-1 ring-emerald-300/40' : 'ring-1 ring-white/10')}>
                <div className="flex items-center gap-2.5">
                  <span className={cx('grid h-4 w-4 shrink-0 place-items-center rounded-full ring-1', sel ? 'bg-sky-400 ring-sky-300' : 'ring-white/25')}>{sel && <span className="h-1.5 w-1.5 rounded-full bg-slate-950" />}</span>
                  <span className="num w-4 text-center text-xs text-slate-500">{r.standard ? '' : r.order}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5"><span className="truncate text-[13px] font-semibold text-white">{r.c.ex.product_name}</span>{r.recommended && <Pill tone="emerald">Recommended</Pill>}{r.standard && <Pill>Standard</Pill>}{built === r.c.ex.product_name && <Pill tone="sky">Built</Pill>}</div>
                    <div className="mt-1 space-y-0.5">
                      <Meter label="Eco" p={ecoOf(r)} max={60} faded={!r.standard && r.evidence.grade !== 'verified'} />
                      <Meter label="Cost" p={costOf(r, premiumCap, impactOf(r), baseline.cost)} max={100} />
                      <Meter label={uc.performance.label} p={perfOf(r, uc)} max={100} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <ScoreChip r={r} />
                    {r.standard
                      ? <span className="text-[11px] text-slate-400">Reference</span>
                      : <span className="flex items-center gap-1 text-[11px]" style={{ color: G.color }}><G.icon size={13} /> <span className={r.gatePass ? undefined : 'text-rose-300'}>{r.gatePass ? 'Gate ✓' : 'Gate ✗'}</span></span>}
                  </div>
                </div>
                {r.reasons.length > 0 && <div className="mt-1 pl-12 text-[11px] text-slate-400">{r.reasons.map((x) => <span key={x} className={cx('mr-2', /Greenwash/.test(x) && 'font-semibold text-rose-300')}>{/Greenwash/.test(x) ? '⚠ ' : '• '}{x}</span>)}</div>}
                <div className="pl-12">
                  <button type="button" aria-expanded={openId === r.c.id} className="mt-1 flex items-center gap-1 text-[11px] text-sky-300 hover:text-sky-200"
                    onClick={(e) => { e.stopPropagation(); setOpenId(openId === r.c.id ? null : r.c.id); }} onKeyDown={(e) => e.stopPropagation()}>
                    <ChevronDown size={12} className={cx('transition', openId === r.c.id && 'rotate-180')} /> {openId === r.c.id ? 'Hide details' : 'Details'}
                  </button>
                  {openId === r.c.id && <Details r={r} uc={uc} weights={weights} impact={impactOf(r)} />}
                </div>
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
          <Btn tone={own && !chosen?.eligible ? 'primary' : 'leaf'} onClick={confirm} disabled={blocked}
            title={blocked && chosen ? 'This datasheet lacks the efficiency, temperature coefficient, carbon or price needed to build it' : site && chosen ? `Build ${site.siteName} with ${chosen.c.ex.product_name}` : undefined}>
            {site
              ? <><Hammer size={14} /> {own && !chosen?.eligible ? 'Build anyway in 3D' : 'Confirm & build in 3D'}</>
              : <><CircleCheck size={14} /> {own && !chosen?.eligible ? 'Confirm anyway' : 'Confirm choice'}</>}
          </Btn>
          <Btn onClick={exportCsv} disabled={!rows.length}><Download size={14} /> CSV</Btn>
          <Btn onClick={() => setApp({ module: 'dashboard' })}>Net-Zero dashboard →</Btn>
        </div>
      </div>
    </div>
  );
}
