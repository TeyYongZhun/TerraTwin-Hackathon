/* Guided demo, timed to the 3-minute pitch: SolarTwin, then eco materials for the panels and the canopy, then the
   money (CREAM roof lease for homes, bill savings for sites that can't join CREAM). Plays end to end with captions;
   the caption can pause the demo and step back or forward a beat. */
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Pause, Play, Square } from 'lucide-react';
import { useApp } from '../../store/app';
import { type SpecStore, useEco, usePanelSpec } from '../../store/ecospec';
import { type SiteKind, getSites } from '../../data/sites';
import { siteGeometry } from '../../lib/solar/siteGeometry';
import { pvSpecFrom } from '../../lib/solar/modules';
import { computeAnalytics } from '../../hooks/useAnalytics';
import { flyHome, flyToSite } from '../../map/camera';
import { loadSamplePack } from '../ecospec/extract';
import { rankCandidates } from '../../lib/ecospec/rank';
import { useCaseById } from '../../data/ecospec/usecases';
import { rm } from '../../components/ui';

const MALL = 'way/1308938137', CARPARK = 'way/1344498805';
const app = () => useApp.getState(), eco = () => useEco.getState(), panels = () => usePanelSpec.getState();

/** Runs `fn` after `ms` unless the demo has moved on (Previous, Next or Stop). With `hold`, it also waits while the
    demo is paused and runs on resume, so pausing on a shortlist keeps it on screen instead of flying off to build. */
const later = (ms: number, fn: () => void, hold = false) => {
  const at = app().demoStep;
  const go = () => {
    if (app().demoStep !== at) return;
    if (hold && app().demoPaused) {
      const off = useApp.subscribe((s) => { if (!s.demoPaused || s.demoStep !== at) { off(); go(); } });
      return;
    }
    fn();
  };
  setTimeout(go, ms);
};

/** Stops the day playback at late morning, so the beat is shown in daylight. */
const daylight = () => { app().set({ playing: false }); app().setSun({ month: 10, day: 21, hour: 11 }); };

/** Opens a spec tab pointed at a site, as the drawer's buttons do. Every beat sets up its own view this way, so a beat
    plays the same whether it is reached forwards or by going back. */
function openSpec(module: 'panelspec' | 'ecospec', siteId: string) {
  const s = getSites().byId.get(siteId)!, view = { module, selectedId: s.id, tab: s.kind };
  app().set(module === 'panelspec'
    ? { ...view, pvHandoff: { siteId: s.id, siteName: s.name, kind: s.kind, kwp: s.kwp, panels: s.panels } }
    : { ...view, handoff: { siteId: s.id, siteName: s.name, ...siteGeometry(s).canopy!.quantities } });
}

/** Opens a spec tab on its documents step and loads the sample pack for one use case, as "Load sample pack" does. */
function loadPack(store: SpecStore, useCaseId: string) {
  const st = store.getState();
  st.set({ useCaseId, step: 2, docs: st.docs.filter((d) => d.useCaseId !== useCaseId), memo: '', memoSrc: null });
  loadSamplePack(store, useCaseId);
}

/** Picks the shortlist's recommendation, then flies back to the site and builds it there, as "Confirm & build in 3D" does. */
function confirmAndBuild(store: SpecStore, siteId: string, kind: SiteKind) {
  const e = store.getState(), uc = useCaseById(e.useCaseId), qty = e.qty[uc.id], site = getSites().byId.get(siteId)!;
  const cands = e.docs.filter((d) => d.useCaseId === uc.id && d.extraction).map((d) => ({ id: d.id, fileName: d.fileName, ex: d.extraction!, source: d.source ?? 'cache' }));
  const rec = rankCandidates(uc, qty, cands, { premiumCapPct: e.premiumCap, weights: e.weights, pv: { kind, assumptions: app().assumptions } }).recommended;
  if (!rec) return;
  const spec = uc.id === 'pv-module' ? pvSpecFrom(rec.c.ex, rec.norm) : null, canopy = kind === 'carpark';
  app().addPick({ useCaseId: `${uc.id}:${siteId}`, useCase: `${uc.title} · ${site.name}`, product: rec.c.ex.product_name, supplier: rec.c.ex.supplier, quantity: qty, unit: uc.fuLabel, tco2: rec.tco2 ?? 0, tco2Saved: rec.savedT ?? 0, cost: rec.totalCost ?? 0, premium: rec.premiumPct ?? 0 });
  app().set({ module: 'solar' });
  app().select(siteId, kind);
  flyToSite(site);
  setTimeout(() => {
    if (spec) app().setModule(siteId, spec);
    else app().setCanopySpec(siteId, uc.id === 'paver-80' ? 'paver' : 'concrete', rec.c.ex.product_name);
    app().toggleIn(canopy ? 'canopies' : 'arrays', siteId, true);
    app().toggleLayer(canopy ? 'canopies' : 'panels', true);
  }, 900);
}

/** Money under the current assumptions and the modules built so far: the top CREAM row, the mall, township totals. */
function money() {
  const st = app(), an = computeAnalytics(st.weights, st.assumptions, st.modules);
  const leaseYr = an.byKind.home.reduce((t, r) => t + (r.ev.finance.monthlyLease ?? 0) * r.site.homes * 12, 0);
  const savingsYr = [...an.byKind.roof, ...an.byKind.carpark].reduce((t, r) => t + r.ev.finance.annualSavings, 0);
  return { home: an.byKind.home[0].ev.finance, mall: an.byId.get(MALL)!.ev.finance, leaseYr, savingsYr };
}

/** Captions that quote live figures are functions, read when the step is shown. */
type Text = string | (() => string);
const text = (t: Text) => (typeof t === 'function' ? t() : t);

const STEPS: { title: Text; sub: Text; ms: number; run: () => void }[] = [
  // Part 1 · SolarTwin: where solar should go.
  {
    title: '2,092 real rooftops, car parks and homes, screened for solar', sub: 'OpenStreetMap footprints of City of Elmina, coloured by solar score', ms: 10000,
    run: () => { app().set({ module: 'solar', tab: 'roof', selectedId: null, mapStyle: 'satellite', playing: false, listQuery: '', hideBlockers: false }); app().setSun({ month: 10, day: 21, hour: 10.5 }); flyHome(); },
  },
  { title: 'Elmina Lakeside Mall: 3.6 MWp on one roof', sub: 'Panels laid out in 3D after setbacks and rooftop plant. Red flags: structural load certificate missing, Power System Study needed', ms: 15000,
    // Selecting a roof no longer draws its panels, so the demo designs its panels once the camera has arrived.
    run: () => { daylight(); app().set({ module: 'solar' }); app().select(MALL, 'roof'); later(1800, () => { app().toggleLayer('panels', true); app().toggleIn('arrays', MALL, true); }); } },
  { title: 'Live shadows from sunrise to sunset', sub: 'Shading loss is modelled from every neighbouring building and tree, all year round', ms: 15000,
    run: () => { app().set({ module: 'solar' }); app().select(MALL, 'roof'); app().setSun({ month: 12, day: 21, hour: 7.6 }); app().set({ playing: true }); } },

  // Part 2 · Eco materials for the panels, then the canopy.
  { title: 'Solar Panels reads the supplier datasheets', sub: 'AI pulls every spec, price and green claim from each PDF, with the quote and page it came from', ms: 10000,
    // Stop the day at late morning, so the panel build and the canopy that follow are shown in daylight.
    run: () => { daylight(); openSpec('panelspec', MALL); loadPack(usePanelSpec, 'pv-module'); } },
  { title: 'Rules decide, not the AI', sub: 'The lowest-carbon panel fails the efficiency gate. "Carbon-neutral" on an expired eco-label is flagged as greenwashing.', ms: 15000,
    run: () => { openSpec('panelspec', MALL); panels().set({ step: 3 }); } },
  { title: 'The top-scoring panel is built on the roof', sub: 'The best total score for carbon, cost and efficiency wins, and the roof is rebuilt with it', ms: 10000,
    run: () => { openSpec('panelspec', MALL); panels().set({ step: 4 }); later(3500, () => confirmAndBuild(usePanelSpec, MALL, 'roof'), true); } },
  { title: 'Car parks become solar canopies', sub: 'Carport strips, columns and footings: a bill of quantities for the next step', ms: 10000,
    run: () => { daylight(); app().set({ module: 'solar' }); app().select(CARPARK, 'carpark'); later(1800, () => app().toggleIn('canopies', CARPARK, true)); } },
  { title: 'Canopy Materials: the same checks for the paving', sub: 'The canopy quantities flow in and AI reads each paver bid', ms: 6000,
    run: () => { openSpec('ecospec', CARPARK); loadPack(useEco, 'paver-80'); } },
  { title: 'Greenwashing flagged automatically', sub: '"Carbon-neutral" with no certificate is flagged red, and a missing slip test fails the gate', ms: 7000,
    run: () => { openSpec('ecospec', CARPARK); eco().set({ step: 3 }); } },
  { title: 'Top-scoring paving, built into the canopy', sub: 'A verified EPD and the best total score for carbon, cost and strength', ms: 7000,
    run: () => { openSpec('ecospec', CARPARK); eco().set({ step: 4 }); later(2500, () => confirmAndBuild(useEco, CARPARK, 'carpark'), true); } },

  // Part 3 · Money, with CREAM or without.
  {
    title: 'Homes earn a roof lease through CREAM', ms: 17000,
    sub: () => { const lease = money().home.monthlyLease ?? 0; return `No upfront cost: about ${rm(lease)} a month per home, ${rm(lease * 12 * 25)} over 25 years`; },
    run: () => {
      const st = app(), homes = computeAnalytics(st.weights, st.assumptions, st.modules).byKind.home.slice(0, 12);
      st.set({ module: 'solar', tab: 'home' });
      for (const r of homes) st.toggleIn('creamPool', r.site.id, true);
      st.select(homes[0].site.id, 'home');
    },
  },
  {
    title: 'Malls, offices and apartments can\'t join CREAM', ms: 15000,
    sub: () => { const m = money().mall; return `They cut their own bill instead: the mall saves ${rm(m.annualSavings / 12)} a month and pays back in ${m.paybackYears.toFixed(1)} years`; },
    run: () => { app().set({ module: 'solar' }); app().select(MALL, 'roof'); },
  },
  {
    title: 'Across the township', ms: 8000,
    sub: () => { const t = money(); return `${rm(t.leaseYr)} a year in roof leases for homeowners, ${rm(t.savingsYr)} a year in bill savings for businesses`; },
    run: () => {},
  },
];

export function DemoRunner() {
  const step = useApp((s) => s.demoStep), paused = useApp((s) => s.demoPaused), set = useApp((s) => s.set);
  /** Time left on the current beat; pausing banks it and resuming spends the rest. */
  const left = useRef(0);
  /** Whether the day was playing when the demo paused, so resuming plays it again. */
  const dayWasPlaying = useRef(false);

  useEffect(() => {
    if (step === null) { if (app().demoPaused) set({ demoPaused: false }); return; }
    if (step >= STEPS.length) { set({ demoStep: null }); return; }
    STEPS[step].run();
    left.current = STEPS[step].ms;
    // A beat reached while paused (Previous or Next) shows its view but holds there, day playback included.
    if (app().demoPaused) { dayWasPlaying.current = app().playing; set({ playing: false }); }
  }, [step, set]);

  useEffect(() => {
    if (step === null || step >= STEPS.length || paused) return;
    const start = performance.now(), t = setTimeout(() => set({ demoStep: step + 1 }), left.current);
    return () => { clearTimeout(t); left.current -= performance.now() - start; };
  }, [step, paused, set]);

  const togglePause = () => {
    if (paused) set({ demoPaused: false, ...(dayWasPlaying.current ? { playing: true } : {}) });
    else { dayWasPlaying.current = app().playing; set({ demoPaused: true, playing: false }); }
  };

  const s = step !== null && step < STEPS.length ? STEPS[step] : null;
  const btn = 'rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <AnimatePresence>
      {s && (
        <motion.div key={step} className="pointer-events-auto fixed bottom-24 left-1/2 z-40 w-[min(680px,92vw)] -translate-x-1/2" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          <div className="glass overflow-hidden rounded-2xl">
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="num mt-0.5 whitespace-nowrap rounded-lg bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-200">{step! + 1}/{STEPS.length}{paused ? ' · Paused' : ''}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white">{text(s.title)}</div>
                <div className="text-xs text-slate-300">{text(s.sub)}</div>
              </div>
              <button type="button" aria-label="Previous beat" title="Previous beat" disabled={step === 0} onClick={() => set({ demoStep: step! - 1 })} className={btn}><ChevronLeft size={18} /></button>
              <button type="button" aria-label={paused ? 'Resume demo' : 'Pause demo'} title={paused ? 'Resume' : 'Pause'} onClick={togglePause} className={btn}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
              <button type="button" aria-label="Next beat" title="Next beat" onClick={() => set({ demoStep: step! + 1 })} className={btn}><ChevronRight size={18} /></button>
              <button type="button" aria-label="Stop demo" title="Stop demo" onClick={() => set({ demoStep: null, playing: false })} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"><Square size={14} /></button>
            </div>
            <div className="h-0.5 bg-gradient-to-r from-amber-400 to-emerald-400"
              style={{ animationName: 'demo-progress', animationDuration: `${s.ms}ms`, animationTimingFunction: 'linear', animationFillMode: 'both', animationPlayState: paused ? 'paused' : 'running' }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
