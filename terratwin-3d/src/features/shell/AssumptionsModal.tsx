/* Editable screening assumptions with their published anchors. Every number in the app recomputes live. */
import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, RotateCcw, X } from 'lucide-react';
import { useAppPick } from '../../store/app';
import { ASSUMPTION_META, type Assumptions, DEFAULT_ASSUMPTIONS, SOURCES } from '../../data/assumptions';

export function AssumptionsModal() {
  const { assumptionsOpen, assumptions, setAssumption, set } = useAppPick('assumptionsOpen', 'assumptions', 'setAssumption', 'set');
  return (
    <AnimatePresence>
      {assumptionsOpen && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => set({ assumptionsOpen: false })}>
          <motion.div role="dialog" aria-modal aria-label="Assumptions and sources" className="glass max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-2xl"
            initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
              <div>
                <h2 className="font-bold text-white">Screening assumptions &amp; sources</h2>
                <p className="text-xs text-slate-400">Transparent, editable planning values. They are not SDP, TNB or regulator figures. Every score and total recomputes live.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => set({ assumptionsOpen: false })} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
            </div>
            <div className="scroll-thin grid max-h-[70vh] gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_260px]">
              <div className="space-y-3">
                {(Object.keys(ASSUMPTION_META) as (keyof Assumptions)[]).map((k) => {
                  const m = ASSUMPTION_META[k];
                  return (
                    <label key={k} className="block">
                      <div className="flex items-baseline justify-between text-xs"><span className="font-medium text-slate-200">{m.label}</span><span className="num text-white">{assumptions[k]} <span className="text-slate-400">{m.unit}</span></span></div>
                      <input className="range mt-1.5" type="range" min={m.min} max={m.max} step={m.step} value={assumptions[k]} onChange={(e) => setAssumption(k, +e.target.value)} />
                      <div className="mt-0.5 text-[10px] text-slate-500">{m.note}</div>
                    </label>
                  );
                })}
                <button type="button" onClick={() => set({ assumptions: { ...DEFAULT_ASSUMPTIONS } })} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"><RotateCcw size={12} /> Reset to defaults</button>
              </div>
              <div>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sources</h3>
                <ul className="space-y-2">
                  {SOURCES.map((s) => (
                    <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="group flex gap-1.5 text-xs text-sky-300 hover:text-sky-200"><ExternalLink size={12} className="mt-0.5 shrink-0" /><span>{s.title}</span></a></li>
                  ))}
                </ul>
                <div className="mt-4 rounded-xl bg-white/5 p-3 text-[11px] text-slate-400">
                  <b className="text-slate-200">Method.</b> Footprints from OpenStreetMap; heights from tags or building type. Shading uses a shadow-polygon model over 284 sun positions (21st of each month, 07:00–19:00) weighted by irradiance. Demand match is Σmin(PV, load) / ΣPV over a typical day.
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
