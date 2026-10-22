/* Top bar: brand, module switcher, map look, AI status, copilot and guided demo. */
import { Command, Gauge, Moon, Play, Recycle, Satellite, SolarPanel, Sun, Grid3x3, Square } from 'lucide-react';
import { type MapStyleId, type Module, useAppPick } from '../../store/app';
import { cx } from '../../components/ui';

const MODULES: { id: Module; label: string; icon: typeof Sun; tint: string }[] = [
  { id: 'solar', label: 'SolarTwin', icon: Sun, tint: 'text-amber-300' },
  { id: 'panelspec', label: 'Solar Panels', icon: SolarPanel, tint: 'text-orange-300' },
  { id: 'ecospec', label: 'Canopy Materials', icon: Recycle, tint: 'text-emerald-300' },
  { id: 'dashboard', label: 'Net-Zero', icon: Gauge, tint: 'text-sky-300' },
];
const LOOKS: { id: MapStyleId; label: string; icon: typeof Sun }[] = [
  { id: 'satellite', label: 'Satellite', icon: Satellite }, { id: 'night', label: 'Night', icon: Moon }, { id: 'blueprint', label: 'Blueprint', icon: Grid3x3 },
];

export function TopBar({ onDemo, onStopDemo }: { onDemo: () => void; onStopDemo: () => void }) {
  const { module, mapStyle, ai, demoStep, set } = useAppPick('module', 'mapStyle', 'ai', 'demoStep', 'set');
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3">
      <div className="pointer-events-auto glass flex items-center gap-2.5 rounded-2xl px-3 py-2">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-amber-300 via-orange-400 to-emerald-400 text-slate-950 shadow-lg"><Sun size={18} strokeWidth={2.5} /></div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">Terra<span className="text-grad">Twin</span> AI</div>
          <div className="text-[10px] text-slate-400">Net-Zero Township Copilot · City of Elmina</div>
        </div>
      </div>

      <nav className="pointer-events-auto glass flex items-center gap-1 rounded-2xl p-1" aria-label="Modules">
        {MODULES.map((m) => (
          <button key={m.id} type="button" onClick={() => set({ module: m.id })}
            className={cx('flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition', module === m.id ? 'bg-white/10 text-white ring-1 ring-white/15' : 'text-slate-400 hover:text-slate-200')}>
            <m.icon size={15} className={module === m.id ? m.tint : ''} /> <span className="hidden sm:inline">{m.label}</span>
          </button>
        ))}
      </nav>

      <div className="pointer-events-auto flex items-center gap-2">
        <div className="glass hidden items-center gap-0.5 rounded-2xl p-1 lg:flex" role="group" aria-label="Map look">
          {LOOKS.map((l) => (
            <button key={l.id} type="button" title={l.label} onClick={() => set({ mapStyle: l.id })}
              className={cx('grid h-8 w-8 place-items-center rounded-xl transition', mapStyle === l.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white')}>
              <l.icon size={15} />
            </button>
          ))}
        </div>
        <div className={cx('glass hidden items-center gap-1.5 rounded-2xl px-3 py-2 text-xs md:flex', ai?.ai ? 'text-emerald-300' : 'text-amber-300')} title={ai?.ai ? `Model ${ai.model}` : 'No API key: using the cached demo extractions and offline rules'}>
          <span className={cx('h-2 w-2 rounded-full', ai?.ai ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400')} />
          {ai === null ? 'Checking AI…' : ai.ai ? 'Live Claude' : 'Demo cache'}
        </div>
        <button type="button" onClick={() => set({ copilotOpen: true })} className="glass flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-slate-200 hover:text-white">
          <Command size={14} /> <span className="hidden md:inline">Ask Copilot</span> <kbd className="rounded bg-white/10 px-1.5 text-[10px] text-slate-400">Ctrl K</kbd>
        </button>
        {demoStep === null ? (
          <button type="button" onClick={onDemo} className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-lg hover:brightness-110">
            <Play size={14} /> <span className="hidden md:inline">Demo</span>
          </button>
        ) : (
          <button type="button" onClick={onStopDemo} className="flex items-center gap-1.5 rounded-2xl bg-rose-500 px-3 py-2 text-sm font-semibold text-white shadow-lg">
            <Square size={12} /> Stop demo
          </button>
        )}
      </div>
    </header>
  );
}
