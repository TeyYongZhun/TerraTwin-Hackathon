/* EcoSpec AI: a four-step green-procurement agent over the dimmed 3D map. */
import { useEffect } from 'react';
import { motion } from 'motion/react';
import { Car, Check, Recycle, X } from 'lucide-react';
import { useAppPick } from '../../store/app';
import { useEco } from '../../store/ecospec';
import { cx } from '../../components/ui';
import { StepUseCase } from './StepUseCase';
import { StepDocs } from './StepDocs';
import { StepCompare } from './StepCompare';
import { StepShortlist } from './StepShortlist';

const STEPS = ['Use case & spec', 'Supplier documents', 'Compare evidence', 'Shortlist & memo'] as const;

export function EcoSpec() {
  const { step, useCaseId, docs, set } = useEco();
  const { handoff, set: setApp } = useAppPick('handoff', 'set');
  const done = docs.filter((d) => d.useCaseId === useCaseId && d.status === 'done').length;
  const reachable = (s: number) => s <= 2 || done >= 1;

  // Quantities designed in SolarTwin flow into both use cases.
  useEffect(() => {
    if (!handoff) return;
    set({ qty: { 'concrete-c30': handoff.footingConcreteM3, 'paver-80': handoff.paverAreaM2 } });
  }, [handoff, set]);

  return (
    <>
      <div className="pointer-events-auto absolute inset-0 z-10 bg-slate-950/55 backdrop-blur-[3px]" />
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        className="pointer-events-auto glass absolute inset-x-3 bottom-3 top-[76px] z-20 mx-auto flex max-w-[1320px] flex-col overflow-hidden rounded-2xl" aria-label="EcoSpec AI">
        <header className="flex flex-wrap items-center gap-4 border-b border-white/5 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-300 to-teal-500 text-slate-950"><Recycle size={18} /></div>
            <div className="leading-tight">
              <h2 className="font-bold text-white">EcoSpec AI</h2>
              <p className="text-[11px] text-slate-400">Spec-to-spec green material matching · embodied carbon</p>
            </div>
          </div>
          <ol className="flex flex-1 items-center justify-center gap-1">
            {STEPS.map((label, i) => {
              const s = (i + 1) as 1 | 2 | 3 | 4, active = step === s, past = step > s;
              return (
                <li key={label} className="flex items-center">
                  <button type="button" disabled={!reachable(s)} onClick={() => set({ step: s })}
                    className={cx('flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40', active ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30' : 'text-slate-400 hover:text-white')}>
                    <span className={cx('grid h-5 w-5 place-items-center rounded-full text-[10px]', active ? 'bg-emerald-400 text-slate-950' : past ? 'bg-emerald-400/30 text-emerald-100' : 'bg-white/10')}>{past ? <Check size={11} /> : s}</span>
                    <span className="hidden lg:inline">{label}</span>
                  </button>
                  {i < STEPS.length - 1 && <span className="mx-1 h-px w-5 bg-white/10" />}
                </li>
              );
            })}
          </ol>
          <div className="flex items-center gap-2">
            {handoff && (
              <span className="hidden items-center gap-1.5 rounded-xl bg-sky-400/10 px-2.5 py-1.5 text-[11px] text-sky-200 ring-1 ring-sky-300/20 md:flex" title="Quantities from the SolarTwin canopy design">
                <Car size={12} /> From SolarTwin: {handoff.siteName}
              </span>
            )}
            <button type="button" aria-label="Back to map" onClick={() => setApp({ module: 'solar' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
          </div>
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {step === 1 && <StepUseCase />}
          {step === 2 && <StepDocs />}
          {step === 3 && <StepCompare />}
          {step === 4 && <StepShortlist />}
        </div>
      </motion.section>
    </>
  );
}
