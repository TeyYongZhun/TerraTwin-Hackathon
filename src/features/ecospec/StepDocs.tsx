/* Upload supplier PDFs (or load the fictitious sample pack) and watch fields appear as they are extracted. */
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, FileText, LoaderCircle, PackageOpen, ShieldAlert, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { type DocItem, useSpecStore } from '../../store/ecospec';
import { useApp } from '../../store/app';
import { useCaseById } from '../../data/ecospec/usecases';
import { assessEvidence } from '../../lib/ecospec/evidence';
import { addFiles, loadSamplePack } from './extract';
import { Btn, Pill, cx } from '../../components/ui';

export function StepDocs() {
  const store = useSpecStore(), { useCaseId, docs, forceLive, set, removeDoc } = store();
  const ai = useApp((s) => s.ai);
  const uc = useCaseById(useCaseId);
  const mine = docs.filter((d) => d.useCaseId === useCaseId);
  const done = mine.filter((d) => d.status === 'done').length, busy = mine.some((d) => d.status === 'reading' || d.status === 'queued');
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const onFiles = (list: FileList | null) => { if (list?.length) addFiles(store, [...list], useCaseId); };

  return (
    <div className="px-6 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Supplier documents · {uc.title}</h3>
          <p className="text-sm text-slate-400">Datasheets, EPDs, certificates or quotations. Each PDF is read by {ai?.ai ? 'Claude' : 'the extractor'}; every value keeps its verbatim quote and page.</p>
        </div>
        <div className="flex items-center gap-2">
          {ai?.ai && (
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400" title="Ignore the cache and send sample PDFs to Claude">
              <input type="checkbox" checked={forceLive} onChange={(e) => set({ forceLive: e.target.checked })} className="accent-emerald-400" /> Force live extraction
            </label>
          )}
          <Pill tone={ai?.ai ? 'emerald' : 'amber'}>{ai?.ai ? `Live Claude · ${ai.model}` : 'Demo cache (no API key)'}</Pill>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_280px]">
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
          onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
          className={cx('flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-7 text-center transition', drag ? 'border-emerald-300 bg-emerald-400/10' : 'border-white/15 bg-white/[0.02] hover:border-white/30')}>
          <Upload size={26} className="text-emerald-300" />
          <div className="mt-2 font-semibold text-white">Drop supplier PDFs here</div>
          <div className="text-xs text-slate-400">or click to browse · PDF only · max 25 MB each</div>
          <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
        </div>
        <div className="flex flex-col justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-400/10 to-sky-400/10 p-4 ring-1 ring-white/10">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><PackageOpen size={16} className="text-emerald-300" /> Sample supplier pack</div>
          <p className="text-[11px] text-slate-400">4 fictitious {uc.id === 'pv-module' ? uc.short : uc.short.toLowerCase()} bids, each built to trigger a different check: verified EPD, greenwashing, expired certificate, unit conversion, missing test.</p>
          <Btn tone="leaf" onClick={() => loadSamplePack(store, useCaseId)} disabled={busy}>Load sample pack</Btn>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AnimatePresence>{mine.map((d) => <DocCard key={d.id} d={d} onRemove={() => removeDoc(d.id)} />)}</AnimatePresence>
      </div>
      {!mine.length && <p className="mt-6 text-center text-sm text-slate-500">No documents yet.</p>}

      <div className="mt-6 flex justify-between">
        <Btn onClick={() => set({ step: 1 })}>Back</Btn>
        <Btn tone="leaf" disabled={done < 1} onClick={() => set({ step: 3 })}>Compare {done} product{done === 1 ? '' : 's'} <ArrowRight size={15} /></Btn>
      </div>
    </div>
  );
}

function DocCard({ d, onRemove }: { d: DocItem; onRemove: () => void }) {
  const ex = d.extraction, ev = ex ? assessEvidence(ex) : null;
  const chips: [string, string | null][] = ex ? [
    d.useCaseId === 'pv-module'
      ? ['Efficiency', ex.specs.module_efficiency_pct.value !== null ? `${ex.specs.module_efficiency_pct.value}%` : null]
      : ['Strength', ex.specs.compressive_strength_mpa.value !== null ? `${ex.specs.compressive_strength_mpa.value} MPa` : null],
    ['GWP', ex.gwp.value !== null ? `${ex.gwp.value} ${ex.gwp.declared_unit ?? ''}` : null],
    ['Price', ex.price.value !== null ? `RM ${ex.price.value} ${ex.price.unit?.replace('RM', '') ?? ''}` : null],
    ['EPD', ex.epd.present ? ex.epd.registration_number ?? 'yes' : null],
    ['Claims', String(ex.claims.length)],
  ] : [];
  return (
    <motion.article layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
      className={cx('relative overflow-hidden rounded-2xl p-4 ring-1', d.status === 'error' ? 'bg-rose-500/5 ring-rose-400/30' : ev?.greenwash.length ? 'bg-rose-500/[0.04] ring-rose-400/25' : 'bg-white/[0.03] ring-white/10')}>
      {d.status === 'reading' && <motion.div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-300 to-transparent" animate={{ x: ['-100%', '100%'] }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} />}
      <div className="flex items-start gap-2">
        <FileText size={18} className="mt-0.5 shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white" title={d.fileName}>{ex?.product_name ?? d.fileName}</div>
          <div className="truncate text-[11px] text-slate-400">{ex ? ex.supplier : `${(d.size / 1024).toFixed(0)} KB`}</div>
        </div>
        <button type="button" aria-label="Remove" onClick={onRemove} className="text-slate-500 hover:text-rose-300"><Trash2 size={14} /></button>
      </div>
      {(d.status === 'queued' || d.status === 'reading') && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-200"><LoaderCircle size={12} className="animate-spin" /> {d.status === 'queued' ? 'Queued' : 'Reading specs, EPD and claims…'}</div>
          {[70, 55, 80].map((w, i) => <div key={i} className="h-2 animate-pulse rounded bg-white/10" style={{ width: `${w}%` }} />)}
        </div>
      )}
      {d.status === 'error' && <p className="mt-3 text-[11px] text-rose-200">{d.error}</p>}
      {ex && (
        <>
          <ul className="mt-3 flex flex-wrap gap-1">
            {chips.map(([k, v], i) => (
              <motion.li key={k} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}
                className={cx('rounded-md px-1.5 py-0.5 text-[10px] ring-1', v === null ? 'bg-amber-400/10 text-amber-200 ring-amber-300/20' : 'bg-black/30 text-slate-200 ring-white/10')}>
                <span className="text-slate-400">{k}</span> {v ?? 'missing'}
              </motion.li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between">
            {ev!.greenwash.length
              ? <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-300"><ShieldAlert size={13} /> Greenwashing risk</span>
              : ev!.grade === 'verified' ? <span className="flex items-center gap-1 text-[11px] text-emerald-300"><ShieldCheck size={13} /> Verified carbon</span>
                : <span className="flex items-center gap-1 text-[11px] text-amber-300"><ShieldAlert size={13} /> Partly verified</span>}
            <Pill tone={d.source === 'claude' ? 'emerald' : 'slate'}>{d.source === 'claude' ? 'Claude' : 'Cache'}</Pill>
          </div>
        </>
      )}
    </motion.article>
  );
}
