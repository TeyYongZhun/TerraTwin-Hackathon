/* Landing hero over the spinning globe. "Fly to City of Elmina" runs the cinematic intro. */
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Leaf, Play, Recycle, Sun } from 'lucide-react';
import { useApp } from '../../store/app';
import { useAnalytics } from '../../hooks/useAnalytics';
import { flyIntro, skipIntro } from '../../map/camera';
import { Btn, CountUp } from '../../components/ui';

export function Intro({ onDemo }: { onDemo: () => void }) {
  const set = useApp((s) => s.set);
  const a = useAnalytics();
  const [flying, setFlying] = useState(false);
  const go = (then?: () => void) => { setFlying(true); flyIntro(() => { set({ started: true }); then?.(); }); };

  return (
    <AnimatePresence>
      {!flying ? (
        <motion.div key="hero" className="absolute inset-0 z-30 flex items-center bg-gradient-to-r from-slate-950/90 via-slate-950/55 to-transparent px-6 md:px-16"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -40, transition: { duration: 0.6 } }}>
          <div className="max-w-xl">
            <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Sime Darby Property · City of Elmina · PLANET challenge
            </motion.div>
            <motion.h1 initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="text-5xl font-extrabold tracking-tight text-white md:text-7xl">
              Terra<span className="text-grad">Twin</span>
            </motion.h1>
            <motion.p initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }} className="mt-2 text-xl font-medium text-slate-200 md:text-2xl">
              The Net-Zero Township Copilot
            </motion.p>
            <motion.p initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }} className="mt-4 max-w-lg text-slate-300">
              A live 3D digital twin of {a.township.sites.toLocaleString()} real rooftops and car parks. It shows where Elmina should build solar, then picks the
              <em> verified</em> low-carbon materials to build it with.
            </motion.p>

            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.55 }} className="mt-6 grid grid-cols-2 gap-3">
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 text-amber-300"><Sun size={18} /><span className="font-semibold">SolarTwin</span></div>
                <p className="mt-1 text-xs text-slate-400">Operational carbon: ranks roofs, car parks &amp; CREAM homes by usable area, shading and demand match.</p>
              </div>
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 text-emerald-300"><Recycle size={18} /><span className="font-semibold">Solar Panels &amp; Canopy Materials</span></div>
                <p className="mt-1 text-xs text-slate-400">Embodied carbon: reads supplier PDFs for PV panels and canopy materials, flags greenwashing, shortlists verified low-carbon specs.</p>
              </div>
            </motion.div>

            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.65 }} className="mt-6 grid grid-cols-3 gap-4">
              <div><div className="text-3xl font-bold text-white"><CountUp value={a.township.kwp / 1000} decimals={1} /> <span className="text-base text-slate-400">MWp</span></div><div className="text-xs text-slate-400">technical solar potential</div></div>
              <div><div className="text-3xl font-bold text-white"><CountUp value={a.township.tco2 / 1000} decimals={1} />k <span className="text-base text-slate-400">t</span></div><div className="text-xs text-slate-400">CO₂e avoidable per year</div></div>
              <div><div className="text-3xl font-bold text-white"><CountUp value={a.totals.home.homes} /></div><div className="text-xs text-slate-400">landed homes CREAM-ready</div></div>
            </motion.div>

            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8 }} className="mt-8 flex flex-wrap items-center gap-3">
              <Btn tone="primary" className="px-5 py-3 text-base" onClick={() => go()}>Fly to City of Elmina <ArrowRight size={18} /></Btn>
              <Btn className="px-4 py-3 text-base" onClick={() => go(onDemo)}><Play size={16} /> Play guided demo</Btn>
              <button type="button" className="text-xs text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline" onClick={() => { skipIntro(); set({ started: true }); }}>Skip intro</button>
            </motion.div>
            <p className="mt-8 flex items-center gap-1.5 text-[11px] text-slate-500"><Leaf size={12} /> Footprints © OpenStreetMap contributors · imagery © Esri · engineering attributes and prices are illustrative.</p>
          </div>
        </motion.div>
      ) : (
        <motion.div key="flying" className="pointer-events-none absolute bottom-10 left-1/2 z-30 -translate-x-1/2 rounded-full glass px-4 py-2 text-sm text-slate-200"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          Flying to City of Elmina, Shah Alam · raising {a.township.sites.toLocaleString()} screened sites from OpenStreetMap…
        </motion.div>
      )}
    </AnimatePresence>
  );
}
