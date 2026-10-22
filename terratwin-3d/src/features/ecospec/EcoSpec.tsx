/* The spec modules: four-step green-procurement agents over the dimmed 3D map. EcoSpec (the "Canopy Materials" tab)
   specs the car-park canopy materials (concrete, pavers); PanelSpec (the "Solar Panels" tab) specs the PV modules, and
   its pick is built on the site. Both run the same steps against their own store. */
import { useEffect } from 'react';
import { motion } from 'motion/react';
import { Building, Car, Check, House, Info, Recycle, SolarPanel, X } from 'lucide-react';
import { builtProduct, useApp, useAppPick } from '../../store/app';
import { SpecContext, type SpecStore, useEco, usePanelSpec } from '../../store/ecospec';
import { getSites } from '../../data/sites';
import { useCaseById } from '../../data/ecospec/usecases';
import { siteGeometry } from '../../lib/solar/siteGeometry';
import { Btn, cx } from '../../components/ui';
import { StepUseCase } from './StepUseCase';
import { StepDocs } from './StepDocs';
import { StepCompare } from './StepCompare';
import { StepShortlist } from './StepShortlist';

interface Brand { title: string; subtitle: string; icon: typeof Recycle; badge: string; firstStep: string }

/** Point a spec module at the site selected in SolarTwin. PanelSpec takes any site; EcoSpec takes a car park, and a
    rooftop or home leaves it in its default, site-less state (canopy materials only apply to car parks). A site that
    is already fully built opens on the shortlist to show what was chosen; otherwise step 1 opens on the next use case
    still to do. Returning to the same site carries on where it was left; with nothing selected, the last session stays. */
function syncToSelection(store: SpecStore, panels: boolean) {
  const app = useApp.getState(), s = app.selectedId ? getSites().byId.get(app.selectedId) : undefined;
  if (!s) return;
  const st = store.getState(), fresh = { memo: '', memoSrc: null };
  if (!panels && s.kind !== 'carpark') {
    app.set({ handoff: null });
    st.set({ ...fresh, step: 1, qty: { ...st.qty, 'concrete-c30': useCaseById('concrete-c30').defaultQty, 'paver-80': useCaseById('paver-80').defaultQty } });
    return;
  }
  if ((panels ? app.pvHandoff : app.handoff)?.siteId === s.id) return;
  if (panels) app.set({ pvHandoff: { siteId: s.id, siteName: s.name, kind: s.kind, kwp: s.kwp, panels: s.panels } });
  else app.set({ handoff: { siteId: s.id, siteName: s.name, ...siteGeometry(s).canopy!.quantities } });
  const todo = st.useCaseIds.filter((u) => !builtProduct(app, u, s.id));
  const loaded = st.docs.some((d) => d.useCaseId === st.useCaseId && d.status === 'done');
  if (!todo.length && loaded) st.set({ ...fresh, step: 4 });
  else st.set({ ...fresh, step: 1, useCaseId: todo.length && !todo.includes(st.useCaseId as (typeof todo)[number]) ? todo[0] : st.useCaseId });
}

function SpecModule({ store, brand }: { store: SpecStore; brand: Brand }) {
  const { step, useCaseId, docs, set } = store();
  const { handoff, pvHandoff, selectedId, set: setApp } = useAppPick('handoff', 'pvHandoff', 'selectedId', 'set');
  const panels = store === usePanelSpec;
  useEffect(() => syncToSelection(store, panels), [store, panels, selectedId]);
  const sel = selectedId ? getSites().byId.get(selectedId) : undefined, notCarpark = !panels && !!sel && sel.kind !== 'carpark';
  const done = docs.filter((d) => d.useCaseId === useCaseId && d.status === 'done').length;
  const reachable = (s: number) => s <= 2 || done >= 1;
  const steps = [brand.firstStep, 'Supplier documents', 'Compare evidence', 'Shortlist & memo'];

  // Quantities designed in SolarTwin flow in: the PV array into PanelSpec, the canopy materials into EcoSpec.
  useEffect(() => {
    const qty = store.getState().qty;
    if (panels && pvHandoff) set({ qty: { ...qty, 'pv-module': Math.round(pvHandoff.kwp) } });
    if (!panels && handoff) set({ qty: { ...qty, 'concrete-c30': handoff.footingConcreteM3, 'paver-80': handoff.paverAreaM2 } });
  }, [store, panels, handoff, pvHandoff, set]);
  const from = panels ? pvHandoff : handoff;
  const FromIcon = !panels || pvHandoff?.kind === 'carpark' ? Car : pvHandoff?.kind === 'home' ? House : Building;

  return (
    <SpecContext.Provider value={store}>
      <div className="pointer-events-auto absolute inset-0 z-10 bg-slate-950/55 backdrop-blur-[3px]" />
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        className="pointer-events-auto glass absolute inset-x-3 bottom-3 top-[76px] z-20 mx-auto flex max-w-[1320px] flex-col overflow-hidden rounded-2xl" aria-label={brand.title}>
        <header className="flex flex-wrap items-center gap-4 border-b border-white/5 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className={cx('grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-slate-950', brand.badge)}><brand.icon size={18} /></div>
            <div className="leading-tight">
              <h2 className="font-bold text-white">{brand.title}</h2>
              <p className="text-[11px] text-slate-400">{brand.subtitle}</p>
            </div>
          </div>
          <ol className="flex flex-1 items-center justify-center gap-1">
            {steps.map((label, i) => {
              const s = (i + 1) as 1 | 2 | 3 | 4, active = step === s, past = step > s;
              return (
                <li key={label} className="flex items-center">
                  <button type="button" disabled={!reachable(s)} onClick={() => set({ step: s })}
                    className={cx('flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40', active ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30' : 'text-slate-400 hover:text-white')}>
                    <span className={cx('grid h-5 w-5 place-items-center rounded-full text-[10px]', active ? 'bg-emerald-400 text-slate-950' : past ? 'bg-emerald-400/30 text-emerald-100' : 'bg-white/10')}>{past ? <Check size={11} /> : s}</span>
                    <span className="hidden lg:inline">{label}</span>
                  </button>
                  {i < steps.length - 1 && <span className="mx-1 h-px w-5 bg-white/10" />}
                </li>
              );
            })}
          </ol>
          <div className="flex items-center gap-2">
            {from && (
              <span className="hidden items-center gap-1.5 rounded-xl bg-sky-400/10 px-2.5 py-1.5 text-[11px] text-sky-200 ring-1 ring-sky-300/20 md:flex" title={`Quantities from the SolarTwin ${panels ? 'panel design' : 'canopy design'}`}>
                <FromIcon size={12} /> From SolarTwin: {from.siteName}
              </span>
            )}
            <button type="button" aria-label="Back to map" onClick={() => setApp({ module: 'solar' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
          </div>
        </header>
        {notCarpark && (
          <div className="flex flex-wrap items-center gap-3 border-b border-white/5 bg-amber-400/10 px-5 py-2.5 text-xs text-amber-100">
            <Info size={15} className="shrink-0" />
            <p className="min-w-0 flex-1">
              <b>{sel!.name}</b> is a {sel!.kind === 'home' ? 'landed home' : 'rooftop'}, not a car park. Canopy Materials covers car-park canopy footings and pavers, so nothing here is built on it. Its panels are chosen in the Solar Panels tab.
            </p>
            <Btn tone="primary" onClick={() => setApp({ module: 'panelspec' })}><SolarPanel size={14} /> Open Solar Panels</Btn>
          </div>
        )}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {step === 1 && <StepUseCase />}
          {step === 2 && <StepDocs />}
          {step === 3 && <StepCompare />}
          {step === 4 && <StepShortlist />}
        </div>
      </motion.section>
    </SpecContext.Provider>
  );
}

export const EcoSpec = () => (
  <SpecModule store={useEco} brand={{ title: 'Canopy Materials', subtitle: 'Car-park canopy footings and pavers · spec-to-spec matching on embodied carbon', icon: Recycle, badge: 'from-emerald-300 to-teal-500', firstStep: 'Use case & spec' }} />
);

export const PanelSpec = () => (
  <SpecModule store={usePanelSpec} brand={{ title: 'Solar Panels', subtitle: 'PV module matching · efficiency, heat tolerance, embodied carbon', icon: SolarPanel, badge: 'from-amber-300 to-orange-500', firstStep: 'Panel spec' }} />
);
