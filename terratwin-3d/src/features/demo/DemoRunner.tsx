/* Guided 2-minute demo: plays the pitch story end to end with captions. */
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Square } from 'lucide-react';
import { useApp } from '../../store/app';
import { useEco } from '../../store/ecospec';
import { getSites } from '../../data/sites';
import { siteGeometry } from '../../lib/solar/siteGeometry';
import { computeAnalytics } from '../../hooks/useAnalytics';
import { flyHome } from '../../map/camera';
import { loadSamplePack } from '../ecospec/extract';
import { rankCandidates } from '../../lib/ecospec/rank';
import { useCaseById } from '../../data/ecospec/usecases';

const MALL = 'way/1308938137', CARPARK = 'way/1344498805', GALLERY = 'way/1308938138';
const app = () => useApp.getState(), eco = () => useEco.getState();

const STEPS: { title: string; sub: string; ms: number; run: () => void }[] = [
  {
    title: '2,092 real rooftops, car parks and homes, screened for solar', sub: 'OpenStreetMap footprints of City of Elmina, coloured by solar score', ms: 6500,
    run: () => { app().set({ module: 'solar', tab: 'roof', selectedId: null, mapStyle: 'satellite', playing: false, listQuery: '', hideBlockers: false }); app().setSun({ month: 10, day: 21, hour: 10.5 }); flyHome(); },
  },
  { title: 'Elmina Lakeside Mall: 3.6 MWp on one roof', sub: 'Usable area after setbacks and rooftop plant, panels laid out in 3D, red flag: structural load certificate missing', ms: 8500, run: () => app().select(MALL, 'roof') },
  { title: 'Live shadows from sunrise to sunset', sub: 'Shading loss is modelled from every neighbouring building and tree, all year round', ms: 9000, run: () => { app().setSun({ month: 12, day: 21, hour: 7.6 }); app().set({ playing: true }); } },
  {
    title: 'Car parks become solar canopies', sub: 'Carport strips, columns and footings: a bill of quantities for the next step', ms: 8000,
    run: () => { app().set({ playing: false }); app().setSun({ month: 10, day: 21, hour: 11 }); app().select(CARPARK, 'carpark'); setTimeout(() => app().toggleIn('canopies', CARPARK, true), 1800); },
  },
  {
    title: 'EcoSpec AI reads the supplier PDFs', sub: 'Specs, prices, EPDs, certificates and every green claim, each with its page-level evidence', ms: 7500,
    run: () => {
      const s = getSites().byId.get(CARPARK)!, q = siteGeometry(s).canopy!.quantities;
      app().set({ module: 'ecospec', handoff: { siteId: s.id, siteName: s.name, paverAreaM2: q.paverAreaM2, footingConcreteM3: q.footingConcreteM3, columns: q.columns, steelTonnes: q.steelTonnes } });
      eco().set({ useCaseId: 'paver-80', step: 2, docs: eco().docs.filter((d) => d.useCaseId !== 'paver-80'), memo: '', memoSrc: null });
      loadSamplePack('paver-80');
    },
  },
  { title: 'Greenwashing flagged automatically', sub: '"Carbon-neutral" with no certificate is flagged red. Expired eco-labels don\'t count. Missing tests fail the gate.', ms: 8500, run: () => eco().set({ step: 3 }) },
  {
    title: 'Gate, then rank: verified lowest carbon within budget', sub: 'Abatement cost in RM per tonne CO₂e avoided, ready for the procurement memo', ms: 8500,
    run: () => {
      const e = eco(), uc = useCaseById('paver-80'), qty = e.qty['paver-80'];
      const cands = e.docs.filter((d) => d.useCaseId === 'paver-80' && d.extraction).map((d) => ({ id: d.id, fileName: d.fileName, ex: d.extraction!, source: d.source ?? 'cache' }));
      const rec = rankCandidates(uc, qty, cands, { premiumCapPct: e.premiumCap }).recommended;
      e.set({ step: 4 });
      if (rec) app().addPick({ useCaseId: uc.id, useCase: uc.title, product: rec.c.ex.product_name, supplier: rec.c.ex.supplier, quantity: qty, unit: uc.fuLabel, tco2: rec.tco2 ?? 0, tco2Saved: rec.savedT ?? 0, cost: rec.totalCost ?? 0, premium: rec.premiumPct ?? 0 });
    },
  },
  {
    title: 'Residents earn from their roofs through CREAM', sub: 'Top-ranked terrace rows join the pool: roofs light up with panels and lease income per home', ms: 8000,
    run: () => {
      const st = app(), homes = computeAnalytics(st.weights, st.assumptions).byKind.home.slice(0, 12);
      st.set({ module: 'solar', tab: 'home' });
      for (const r of homes) st.toggleIn('creamPool', r.site.id, true);
      st.select(homes[0].site.id, 'home');
    },
  },
  {
    title: 'One Net-Zero view: operational + embodied carbon', sub: 'Progress toward SSR2030, IFRS S2-style metrics and a printable decision pack', ms: 10000,
    run: () => { for (const id of [MALL, GALLERY, CARPARK]) app().toggleIn('portfolio', id, true); app().set({ module: 'dashboard', selectedId: null }); },
  },
];

export function DemoRunner() {
  const step = useApp((s) => s.demoStep), set = useApp((s) => s.set);
  useEffect(() => {
    if (step === null) return;
    if (step >= STEPS.length) { set({ demoStep: null }); return; }
    STEPS[step].run();
    const t = setTimeout(() => set({ demoStep: step + 1 }), STEPS[step].ms);
    return () => clearTimeout(t);
  }, [step, set]);

  const s = step !== null && step < STEPS.length ? STEPS[step] : null;
  return (
    <AnimatePresence>
      {s && (
        <motion.div key={step} className="pointer-events-auto fixed bottom-24 left-1/2 z-40 w-[min(680px,92vw)] -translate-x-1/2" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          <div className="glass overflow-hidden rounded-2xl">
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="num mt-0.5 rounded-lg bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-200">{step! + 1}/{STEPS.length}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white">{s.title}</div>
                <div className="text-xs text-slate-300">{s.sub}</div>
              </div>
              <button type="button" aria-label="Next" onClick={() => set({ demoStep: step! + 1 })} className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"><ChevronRight size={18} /></button>
              <button type="button" aria-label="Stop demo" onClick={() => set({ demoStep: null, playing: false })} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"><Square size={14} /></button>
            </div>
            <motion.div className="h-0.5 bg-gradient-to-r from-amber-400 to-emerald-400" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: s.ms / 1000, ease: 'linear' }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
