import { ArrowRight, Boxes, Building, Car, Check, Grid3x3, House, SolarPanel } from 'lucide-react';
import { USE_CASES, type UseCase } from '../../data/ecospec/usecases';
import { useSpecStore } from '../../store/ecospec';
import { builtProduct, useAppPick } from '../../store/app';
import { Btn, cx } from '../../components/ui';

const ICON: Record<UseCase['id'], typeof Boxes> = { 'concrete-c30': Boxes, 'paver-80': Grid3x3, 'pv-module': SolarPanel };

export function StepUseCase() {
  const { useCaseIds, useCaseId, qty, set } = useSpecStore()();
  const { handoff, pvHandoff, modules, canopySpecs } = useAppPick('handoff', 'pvHandoff', 'modules', 'canopySpecs');
  const siteFor = (u: UseCase) => (u.id === 'pv-module' ? pvHandoff : handoff);
  const cases = USE_CASES.filter((u) => useCaseIds.includes(u.id)), uc = cases.find((u) => u.id === useCaseId)!;
  const panels = uc.id === 'pv-module';
  const PvIcon = pvHandoff?.kind === 'carpark' ? Car : pvHandoff?.kind === 'home' ? House : Building;
  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <h3 className="text-lg font-bold text-white">{panels ? 'Solar panel specification' : 'What are you specifying?'}</h3>
      <p className="mt-1 text-sm text-slate-400">
        {panels
          ? 'Only PV modules that meet the same performance requirement are compared, then ranked by verified embodied carbon and cost. The winner is built on the SolarTwin site.'
          : 'Pick a material. Only products that meet the same performance requirement are compared, then ranked by verified embodied carbon and cost.'}
      </p>
      <div className={cx('mt-5 grid gap-4', cases.length > 1 && 'md:grid-cols-2')}>
        {cases.map((u) => {
          const active = u.id === useCaseId, Icon = ICON[u.id], site = siteFor(u);
          const built = site ? builtProduct({ modules, canopySpecs }, u.id, site.siteId) : undefined;
          return (
            <button key={u.id} type="button" onClick={() => set({ useCaseId: u.id })}
              className={cx('rounded-2xl p-5 text-left ring-1 transition', active ? 'bg-emerald-400/10 ring-emerald-300/40 shadow-[0_0_40px_-12px_rgba(52,211,153,0.5)]' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]')}>
              <div className="flex items-center gap-2.5">
                <div className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', active ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-slate-300')}><Icon size={20} /></div>
                <div>
                  <div className="font-semibold text-white">{u.title}</div>
                  <div className="text-[11px] text-slate-400">Functional unit: per {u.fuLabel}</div>
                </div>
              </div>
              {built && site && (
                <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-sky-400/10 px-2 py-1 text-[11px] text-sky-100 ring-1 ring-sky-300/25">
                  <Check size={12} className="shrink-0 text-sky-300" /> Built on {site.siteName}: <b>{built}</b>
                </div>
              )}
              <p className="mt-3 text-xs text-slate-300">{u.description}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {u.requirements.map((r) => (
                  <li key={r.key} title={r.why} className="rounded-lg bg-black/30 px-2 py-1 text-[11px] text-slate-200 ring-1 ring-white/10">{r.label} {r.op === '>=' ? '≥' : '≤'} {r.value}{r.unit ? ` ${r.unit}` : ''}</li>
                ))}
              </ul>
              <div className="mt-3 text-[11px] text-slate-500">Baseline: {u.baseline.label}: {u.baseline.gwp} kgCO₂e / RM {u.baseline.price} per {u.fuLabel}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
        <label className="block">
          <span className="text-xs font-medium text-slate-300">Project quantity</span>
          <div className="mt-1 flex items-center gap-2">
            <input type="number" min={1} value={qty[useCaseId]} onChange={(e) => set({ qty: { ...qty, [useCaseId]: Math.max(1, +e.target.value || 1) } })}
              className="w-36 rounded-lg bg-black/40 px-3 py-2 text-lg font-semibold text-white ring-1 ring-white/10 outline-none focus:ring-emerald-300/50" />
            <span className="text-slate-400">{uc.fuLabel}</span>
          </div>
        </label>
        <p className="flex-1 text-xs text-slate-400">
          {panels
            ? pvHandoff
              ? <span className="flex items-center gap-1.5 text-sky-200"><PvIcon size={13} className="shrink-0" /> Auto-filled from the SolarTwin {pvHandoff.kind === 'carpark' ? 'canopy deck' : pvHandoff.kind === 'home' ? 'home panel design' : 'rooftop panel design'} at {pvHandoff.siteName}: {pvHandoff.panels.toLocaleString()} mono PERC modules = {Math.round(pvHandoff.kwp).toLocaleString()} kWp. The confirmed module is built on the site and re-sizes its kWp by efficiency.</span>
              : 'Tip: design solar panels on a rooftop or home (or a canopy on a car park) in SolarTwin and press "Choose solar panels" to fill this automatically.'
            : handoff
              ? <span className="flex items-center gap-1.5 text-sky-200"><Car size={13} className="shrink-0" /> Auto-filled from the SolarTwin canopy at {handoff.siteName}: {handoff.columns} columns × 3.9 m³ footings = {handoff.footingConcreteM3} m³ concrete; {handoff.paverAreaM2.toLocaleString()} m² of paving.</span>
              : 'Tip: design a solar canopy on a car park in SolarTwin and press "Choose canopy materials" to fill this automatically.'}
        </p>
        <Btn tone="leaf" onClick={() => set({ step: 2 })}>Add supplier documents <ArrowRight size={15} /></Btn>
      </div>
    </div>
  );
}
