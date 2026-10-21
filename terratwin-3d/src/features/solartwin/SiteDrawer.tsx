/* Right drawer for the selected site: score breakdown, yield, shading, demand match, red flags, finance,
   car-park canopy design (→ EcoSpec AI), CREAM resident offer and the AI site brief. */
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight, Building, Car, CircleCheck, ExternalLink, FileText, House, Info, Leaf, LoaderCircle, Plus, Check, Sparkles, Sun, TriangleAlert, Wallet, X, Zap, CloudSun,
} from 'lucide-react';
import { useApp, useAppPick } from '../../store/app';
import { useAnalytics } from '../../hooks/useAnalytics';
import { type Severity, fmt } from '../../lib/solar/evaluate';
import { type SiteGeometry, siteGeometry } from '../../lib/solar/siteGeometry';
import { monthlyShading, shadedFraction } from '../../lib/solar/shadingLoss';
import { mytDate, sunPosition } from '../../lib/solar/sun';
import { Btn, CountUp, Pill, ScoreRing, Section, Stat, cx, rm } from '../../components/ui';
import { Markdownish } from '../../components/Markdownish';
import { DemandChart, MonthlyShading, SunPath } from './charts';
import { briefPayload, offlineBrief } from './brief';
import { streamSSE, typeOut } from '../../lib/api';

const SEV: Record<Severity, { label: string; cls: string; icon: typeof Info }> = {
  high: { label: 'High', cls: 'bg-rose-500/12 text-rose-200 ring-rose-400/30', icon: TriangleAlert },
  medium: { label: 'Medium', cls: 'bg-amber-500/10 text-amber-200 ring-amber-400/25', icon: TriangleAlert },
  low: { label: 'Low', cls: 'bg-sky-500/10 text-sky-200 ring-sky-400/20', icon: Info },
  info: { label: 'Scheme', cls: 'bg-violet-500/10 text-violet-200 ring-violet-400/20', icon: Info },
};

/** The only sun-driven part of the drawer. It subscribes to the sun itself so day playback re-renders just this
    section; `children` (the monthly chart) is created by the drawer and so is not re-rendered each frame. */
function ShadingSection({ geo, children }: { geo: SiteGeometry; children: ReactNode }) {
  const sun = useApp((st) => st.sun);
  const shadeNow = useMemo(() => {
    const p = sunPosition(mytDate(2026, sun.month, sun.day, sun.hour));
    return p.altitude > 0 ? shadedFraction(geo.target, geo.neighbours, p) : NaN;
  }, [geo, sun]);
  return (
    <Section title="Shading & sun" icon={<CloudSun size={12} />} right={<span className="text-[11px] text-slate-400">Now: <b className="num text-white">{Number.isNaN(shadeNow) ? 'night' : `${Math.round(shadeNow * 100)}% shaded`}</b></span>}>
      <SunPath month={sun.month} day={sun.day} hour={sun.hour} />
      {children}
    </Section>
  );
}

export function SiteDrawer() {
  const { selectedId, assumptions: A, portfolio, creamPool, canopies, ai, select, toggleIn, set, toast } = useAppPick('selectedId', 'assumptions', 'portfolio', 'creamPool', 'canopies', 'ai', 'select', 'toggleIn', 'set', 'toast');
  const a = useAnalytics();
  const r = selectedId ? a.byId.get(selectedId) : undefined;
  const [brief, setBrief] = useState('');
  const [briefState, setBriefState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [briefSrc, setBriefSrc] = useState<'claude' | 'offline'>('offline');
  const [showPassed, setShowPassed] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => { abort.current?.abort(); setBrief(''); setBriefState('idle'); setShowPassed(false); }, [selectedId]);

  const site = r?.site;
  const geo = useMemo(() => (site ? siteGeometry(site) : null), [site]);
  const monthly = useMemo(() => (geo ? monthlyShading(geo.target, geo.neighbours) : []), [geo]);

  if (!r || !geo) return null;
  const { site: s, ev } = r;
  const inPortfolio = portfolio.includes(s.id), inPool = creamPool.includes(s.id), hasCanopy = canopies.includes(s.id);
  const KindIcon = s.kind === 'roof' ? Building : s.kind === 'carpark' ? Car : House;
  const osmUrl = `https://www.openstreetmap.org/${s.id}`;

  const runBrief = async () => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setBrief(''); setBriefState('loading');
    const push = (t: string) => setBrief((b) => b + t);
    try {
      if (!ai?.ai) throw new Error('offline');
      setBriefSrc('claude');
      await streamSSE('/api/solartwin/brief', briefPayload(s, ev, A), push, ctl.signal, () => setBrief(''));
    } catch (e) {
      if (ctl.signal.aborted) return;
      if ((e as Error).message !== 'offline') toast(`Claude unavailable (${(e as Error).message}) — showing offline brief`, 'warn');
      setBriefSrc('offline'); setBrief('');
      await typeOut(offlineBrief(s, ev), push, ctl.signal);
    }
    if (!ctl.signal.aborted) setBriefState('done');
  };

  const togglePortfolio = () => { toggleIn('portfolio', s.id); if (!inPortfolio) toast(`${s.name} added to the Net-Zero portfolio`); };

  const toEcoSpec = () => {
    const q = geo.canopy!.quantities;
    set({ handoff: { siteId: s.id, siteName: s.name, paverAreaM2: q.paverAreaM2, footingConcreteM3: q.footingConcreteM3, columns: q.columns, steelTonnes: q.steelTonnes }, module: 'ecospec' });
  };

  return (
    <AnimatePresence>
      <motion.aside key={s.id} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="pointer-events-auto glass absolute bottom-3 right-3 top-[76px] z-20 flex w-[410px] flex-col overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 px-4 pb-3 pt-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-slate-200 ring-1 ring-white/10"><KindIcon size={18} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-white" title={s.name}>{s.name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
              <span>{s.subtitle}</span>·<span>#{r.rank} of {a.byKind[s.kind].length}</span>
              {s.featured && <Pill tone="amber">Featured</Pill>}
              <a href={osmUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky-300 hover:text-sky-200">OSM <ExternalLink size={10} /></a>
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={() => select(null)} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto">
          {/* Score */}
          <div className="flex items-center gap-4 px-4 pb-3">
            <ScoreRing score={ev.score} />
            <div className="flex-1 space-y-1.5">
              {ev.components.map((c) => (
                <div key={c.key} title={c.detail}>
                  <div className="flex justify-between text-[11px]"><span className="text-slate-300">{c.label}</span><span className="num text-slate-400">{Math.round(c.value)} <span className="text-slate-600">× {c.weight}</span></span></div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <motion.div className="h-full rounded-full bg-[#3987e5]" initial={{ width: 0 }} animate={{ width: `${c.value}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 px-4 pb-3">
            <Stat label="System" value={<CountUp value={s.kwp} decimals={s.kwp < 100 ? 1 : 0} />} unit="kWp" sub={`${fmt(s.panels)} × 550 W`} />
            <Stat label="Usable area" value={<CountUp value={s.usableArea} />} unit="m²" sub={`of ${fmt(s.area)} m²`} />
            <Stat label="Generation" value={<CountUp value={ev.annualKwh / 1000} decimals={ev.annualKwh < 1e5 ? 1 : 0} />} unit="MWh/yr" />
            <Stat label="Shading loss" value={`${(s.shadingLoss * 100).toFixed(1)}%`} sub="annual, modelled" accent={s.shadingLoss >= 0.25 ? 'text-rose-300' : s.shadingLoss >= 0.1 ? 'text-amber-300' : ''} />
            <Stat label="CO₂ avoided" value={<CountUp value={ev.finance.tco2} />} unit="t/yr" accent="text-emerald-300" />
            {s.kind === 'home'
              ? <Stat label="Roof lease" value={rm(ev.finance.monthlyLease ?? 0)} unit="/mo" sub="per home" accent="text-amber-300" />
              : <Stat label="Savings / mo" value={rm(ev.finance.annualSavings / 12)} sub={Number.isFinite(ev.finance.paybackYears) ? `payback ${ev.finance.paybackYears.toFixed(1)} yrs` : 'no payback'} accent={ev.finance.annualSavings > 0 ? 'text-amber-300' : 'text-rose-300'} />}
          </div>

          {/* Kind-specific action */}
          {s.kind === 'carpark' && (
            <Section title="Solar canopy design" icon={<Car size={12} />}>
              {!hasCanopy ? (
                <div className="rounded-xl bg-gradient-to-br from-sky-500/10 to-emerald-500/10 p-3 ring-1 ring-white/10">
                  <p className="text-xs text-slate-300">Generate a double-row carport layout: {geo.canopy!.strips.length} canopy strips, {fmt(geo.canopy!.coveredBays)} covered bays, 3.6 m clearance.</p>
                  <Btn tone="sky" className="mt-2 w-full" onClick={() => toggleIn('canopies', s.id, true)}><Sparkles size={14} /> Design solar canopy in 3D</Btn>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {[['Columns', fmt(geo.canopy!.quantities.columns)], ['Footing C30', `${fmt(geo.canopy!.quantities.footingConcreteM3)} m³`], ['Pavers', `${fmt(geo.canopy!.quantities.paverAreaM2)} m²`], ['Steel', `${fmt(geo.canopy!.quantities.steelTonnes, 1)} t`]].map(([k, v]) => (
                      <div key={k} className="glass-soft rounded-lg px-1 py-1.5"><div className="num text-xs font-semibold text-white">{v}</div><div className="text-[9px] text-slate-400">{k}</div></div>
                    ))}
                  </div>
                  <Btn tone="leaf" className="w-full" onClick={toEcoSpec}><Leaf size={14} /> Spec low-carbon materials in EcoSpec AI <ArrowRight size={14} /></Btn>
                  <button type="button" className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300" onClick={() => toggleIn('canopies', s.id, false)}>Remove canopy</button>
                </div>
              )}
            </Section>
          )}
          {s.kind !== 'home' && (
            <Section title="Business offer · Solar savings" icon={<Wallet size={12} />}>
              <div className={cx('rounded-xl p-3 ring-1', inPortfolio ? 'bg-emerald-400/10 ring-emerald-300/30' : 'bg-gradient-to-br from-amber-400/10 to-emerald-400/10 ring-white/10')}>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400">Estimated electricity-bill savings</div>
                    <div className={cx('text-2xl font-bold', ev.finance.annualSavings > 0 ? 'text-white' : 'text-rose-300')}>{rm(ev.finance.annualSavings / 12)}<span className="text-sm font-normal text-slate-400"> / month</span></div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    <div className="num">{rm(ev.finance.annualSavings)} per year</div>
                    <div className="num">{rm(ev.finance.annualSavings * 25)} over 25 yrs</div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  {s.kind === 'carpark' ? (s.demandClass === 'mall' && s.nearName ? `Canopy power supplies ${s.nearName} behind the meter` : 'Canopy power runs EV chargers and car-park lighting') : 'Behind-the-meter solar for the building'}: {ev.dm.selfConsumption >= 0.995
                    ? `all of it is used on site, avoiding the C&I tariff (RM ${A.tariffCommercial}/kWh).`
                    : `${Math.round(ev.dm.selfConsumption * 100)}% is used on site, avoiding the C&I tariff (RM ${A.tariffCommercial}/kWh), and the surplus is credited against the bill at RM ${A.exportRate}/kWh.`}
                  {ev.finance.annualSavings > 0 ? ` Pays back in ${ev.finance.paybackYears.toFixed(1)} yrs on ${rm(ev.finance.capex)} CAPEX, O&M included.` : ` Does not pay back under the current assumptions: O&M costs exceed the savings.`}
                </p>
                <Btn tone={inPortfolio ? 'ghost' : 'leaf'} className="mt-2 w-full" onClick={togglePortfolio}>
                  {inPortfolio ? <><Check size={14} /> In portfolio · remove</> : <><Zap size={14} /> Add to Net-Zero portfolio</>}
                </Btn>
              </div>
            </Section>
          )}
          {s.kind === 'home' && (
            <Section title="Resident offer · CREAM" icon={<Wallet size={12} />}>
              <div className={cx('rounded-xl p-3 ring-1', inPool ? 'bg-emerald-400/10 ring-emerald-300/30' : 'bg-gradient-to-br from-amber-400/10 to-emerald-400/10 ring-white/10')}>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400">Estimated roof-lease income per home</div>
                    <div className="text-2xl font-bold text-white">{rm(ev.finance.monthlyLease ?? 0)}<span className="text-sm font-normal text-slate-400"> / month</span></div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    <div className="num">{fmt(ev.finance.perHomeKwp ?? 0, 1)} kWp per roof</div>
                    <div className="num">{rm((ev.finance.monthlyLease ?? 0) * 12 * 25)} over 25 yrs</div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">No upfront cost: SDP aggregates rooftops into a Community Renewable Energy Aggregation Mechanism (CREAM) pool. {s.homes > 1 ? `${s.homes} homes in this row.` : ''}</p>
                <Btn tone={inPool ? 'ghost' : 'leaf'} className="mt-2 w-full" onClick={() => { toggleIn('creamPool', s.id); if (!inPool) toast(`${s.homes} home${s.homes > 1 ? 's' : ''} joined the CREAM pool`, 'ok'); }}>
                  {inPool ? <><Check size={14} /> In the CREAM pool · leave</> : <><Zap size={14} /> Join the CREAM pool</>}
                </Btn>
              </div>
            </Section>
          )}

          {/* Shading */}
          <ShadingSection geo={geo}>
            <div className="mt-2 text-[11px] text-slate-400">Monthly shading loss from neighbouring buildings and trees</div>
            <MonthlyShading values={monthly} />
          </ShadingSection>

          {/* Demand */}
          <Section title={s.kind === 'home' ? 'Home demand vs PV' : 'Daytime demand match'} icon={<Sun size={12} />}
            right={<span className="num text-[11px] text-slate-400">{Math.round(ev.dm.selfConsumption * 100)}% self-use · {Math.round(ev.dm.coverage * 100)}% of load</span>}>
            <DemandChart pv={ev.dm.pvDay} load={ev.dm.loadDay} />
            <p className="mt-1 text-[10px] text-slate-500">Typical {s.demandClass} profile{s.attrs.bills12m ? ' (calibrate with 12-month bills on file)' : '. Bills missing, so the profile is assumed'}.</p>
          </Section>

          {/* Red flags */}
          <Section title="Red-flag checklist" icon={<TriangleAlert size={12} />} right={<span className="text-[11px] text-slate-400">{ev.flags.filter((f) => f.severity !== 'info').length} open · {ev.passed.length} passed</span>}>
            <ul className="space-y-1.5">
              {ev.flags.map((f) => {
                const S = SEV[f.severity];
                return (
                  <li key={f.id} className={cx('rounded-xl px-3 py-2 ring-1', S.cls)}>
                    <div className="flex items-start gap-2">
                      <S.icon size={13} className="mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-semibold">{f.title}</span><span className="shrink-0 text-[9px] uppercase tracking-wider opacity-70">{S.label} · {f.area}</span></div>
                        <p className="mt-0.5 text-[11px] text-slate-300/90">{f.resolve}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={() => setShowPassed(!showPassed)} className="mt-2 text-[11px] text-slate-400 hover:text-white">{showPassed ? 'Hide' : 'Show'} passed checks ({ev.passed.length})</button>
            {showPassed && <ul className="mt-1 space-y-1">{ev.passed.map((p) => <li key={p} className="flex items-center gap-1.5 text-[11px] text-emerald-200"><CircleCheck size={12} /> {p}</li>)}</ul>}
            <p className="mt-2 text-[10px] text-slate-500">Roof age, certificates, ownership and documents are illustrative stand-ins for SDP asset records.</p>
          </Section>

          {/* Finance */}
          <Section title="Illustrative finance" icon={<Wallet size={12} />} right={<button type="button" className="text-[11px] text-sky-300 hover:text-sky-200" onClick={() => set({ assumptionsOpen: true })}>Assumptions</button>}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
              <dt className="text-slate-400">CAPEX</dt><dd className="num text-right text-white">{rm(ev.finance.capex)}</dd>
              <dt className="text-slate-400">{s.kind === 'home' ? 'Export value / yr' : 'Net savings / yr'}</dt><dd className="num text-right text-white">{rm(ev.finance.annualSavings)}</dd>
              <dt className="text-slate-400">Simple payback</dt><dd className="num text-right text-white">{Number.isFinite(ev.finance.paybackYears) ? `${ev.finance.paybackYears.toFixed(1)} yrs` : s.kind === 'home' ? 'CREAM (no upfront)' : '—'}</dd>
              <dt className="text-slate-400">Grid factor</dt><dd className="num text-right text-white">{A.gridEF} tCO₂e/MWh</dd>
            </dl>
          </Section>

          {/* AI brief */}
          <Section title="AI site brief" icon={<Sparkles size={12} />} right={briefState !== 'idle' && <Pill tone={briefSrc === 'claude' ? 'emerald' : 'slate'}>{briefSrc === 'claude' ? 'Claude' : 'Offline'}</Pill>}>
            {briefState === 'idle' ? (
              <p className="text-[11px] text-slate-400">Writes a feasibility brief from these metrics and red flags: verdict, blockers and next steps.</p>
            ) : (
              <div className="rounded-xl bg-black/25 p-3 ring-1 ring-white/5">
                {brief ? <Markdownish text={brief} /> : <div className="flex items-center gap-2 text-xs text-slate-400"><LoaderCircle size={14} className="animate-spin" /> Thinking through the site…</div>}
              </div>
            )}
          </Section>
        </div>

        <div className="flex gap-2 border-t border-white/5 p-3">
          <Btn tone="sky" className="flex-1" onClick={runBrief} disabled={briefState === 'loading'}>
            {briefState === 'loading' ? <LoaderCircle size={14} className="animate-spin" /> : <FileText size={14} />} {briefState === 'done' ? 'Regenerate brief' : 'AI site brief'}
          </Btn>
          <Btn tone={inPortfolio ? 'ghost' : 'primary'} className="flex-1" onClick={togglePortfolio}>
            {inPortfolio ? <><Check size={14} /> In portfolio</> : <><Plus size={14} /> Add to portfolio</>}
          </Btn>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
