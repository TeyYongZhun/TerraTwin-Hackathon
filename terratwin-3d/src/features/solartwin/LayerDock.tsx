/* Layer toggles + heat legend + recentre. */
import { Car, Flame, LocateFixed, Moon, PanelsTopLeft, Tag, Satellite, Grid3x3 } from 'lucide-react';
import { type Layers, type MapStyleId, useAppPick } from '../../store/app';
import { flyHome } from '../../map/camera';
import { HEAT_STOPS } from '../../map/MapView';
import { cx } from '../../components/ui';

const ITEMS: { k: keyof Layers; label: string; icon: typeof Flame }[] = [
  { k: 'heat', label: 'Solar heat', icon: Flame }, { k: 'shadows', label: 'Shadows', icon: Moon },
  { k: 'panels', label: 'PV panels', icon: PanelsTopLeft }, { k: 'canopies', label: 'Canopies', icon: Car }, { k: 'labels', label: 'Labels', icon: Tag },
];
const LOOKS: { id: MapStyleId; icon: typeof Flame; label: string }[] = [{ id: 'satellite', icon: Satellite, label: 'Satellite' }, { id: 'night', icon: Moon, label: 'Night' }, { id: 'blueprint', icon: Grid3x3, label: 'Blueprint' }];

export function LayerDock({ className }: { className?: string }) {
  const { layers, toggleLayer, mapStyle, demoStep, set } = useAppPick('layers', 'toggleLayer', 'mapStyle', 'demoStep', 'set');
  return (
    <div className={cx('pointer-events-auto flex flex-col items-end gap-2', className)}>
      {layers.heat && demoStep === null && (
        <div className="glass rounded-xl px-3 py-2">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400" title="Percentile rank within rooftops, car parks or homes">Solar score rank</div>
          <div className="h-2 w-36 rounded-full" style={{ background: `linear-gradient(90deg, ${HEAT_STOPS.map(([p, c]) => `${c} ${p * 100}%`).join(', ')})` }} />
          <div className="mt-0.5 flex justify-between text-[10px] text-slate-400"><span>lower</span><span>best</span></div>
        </div>
      )}
      <div className="glass flex items-center gap-0.5 rounded-xl p-1">
        {ITEMS.map((it) => (
          <button key={it.k} type="button" title={it.label} aria-pressed={layers[it.k]} onClick={() => toggleLayer(it.k)}
            className={cx('grid h-8 w-8 place-items-center rounded-lg transition', layers[it.k] ? 'bg-white/10 text-amber-200' : 'text-slate-500 hover:text-slate-200')}>
            <it.icon size={15} />
          </button>
        ))}
        <span className="mx-0.5 h-5 w-px bg-white/10" />
        {LOOKS.map((l) => (
          <button key={l.id} type="button" title={l.label} onClick={() => set({ mapStyle: l.id })}
            className={cx('grid h-8 w-8 place-items-center rounded-lg transition lg:hidden', mapStyle === l.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-200')}>
            <l.icon size={15} />
          </button>
        ))}
        <button type="button" title="Recentre on Elmina" onClick={flyHome} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:text-white"><LocateFixed size={15} /></button>
      </div>
    </div>
  );
}
