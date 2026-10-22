/* Ctrl+K command bar. Claude turns requests into strict tool calls; offline, a keyword parser covers the demo. */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bot, CircleCheck, Command, CornerDownLeft, LoaderCircle } from 'lucide-react';
import { useApp, useAppPick } from '../../store/app';
import { useEco } from '../../store/ecospec';
import { computeAnalytics } from '../../hooks/useAnalytics';
import { postJSON } from '../../lib/api';
import type { CopilotAction } from '../../lib/copilot/tools';
import { offlineCopilot, runActions } from '../../lib/copilot/execute';
import { Pill } from '../../components/ui';

const SUGGESTIONS = [
  'Fly to Elmina Lakeside Mall',
  'Show car parks at 5pm in December and play the day',
  'Design a solar canopy on the biggest car park',
  'Prioritise low shading',
  'Join the top 10 terrace rows to the CREAM pool',
  'Open Canopy Materials for pavers',
  'Switch to night mode',
];

interface Turn { q: string; reply: string; log: string[]; src: 'claude' | 'offline' }

function context() {
  const st = useApp.getState(), a = computeAnalytics(st.weights, st.assumptions, st.modules);
  const top = (k: 'roof' | 'carpark' | 'home', n: number) => a.byKind[k].slice(0, n).map((r) => ({ name: r.site.name, score: Math.round(r.ev.score), kwp: Math.round(r.site.kwp), shadingPct: +(r.site.shadingLoss * 100).toFixed(1) }));
  return {
    module: st.module, tab: st.tab, mapStyle: st.mapStyle, sun: st.sun, weights: st.weights, layers: st.layers,
    selected: st.selectedId ? a.byId.get(st.selectedId)?.site.name : null,
    sites: { rooftops: top('roof', 15), carParks: top('carpark', 9), homeRows: top('home', 5) },
    portfolio: st.portfolio.length, creamPoolRows: st.creamPool.length, ecospecUseCase: useEco.getState().useCaseId,
  };
}

export function Copilot() {
  const { copilotOpen, ai, set } = useAppPick('copilotOpen', 'ai', 'set');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (copilotOpen) setTimeout(() => input.current?.focus(), 50); }, [copilotOpen]);

  const submit = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setBusy(true); setQ('');
    let actions: CopilotAction[] = [], reply = '', src: Turn['src'] = 'offline';
    try {
      if (!ai?.ai) throw new Error('offline');
      const history = turns.slice(-3).flatMap((t) => [{ role: 'user' as const, content: t.q }, { role: 'assistant' as const, content: t.reply || t.log.join('. ') }]);
      const r = await postJSON<{ reply: string; actions: CopilotAction[] }>('/api/copilot', { message: msg, history, context: context() });
      actions = r.actions; reply = r.reply; src = 'claude';
    } catch {
      ({ actions, reply } = offlineCopilot(msg));
    }
    const log = runActions(actions);
    setTurns((t) => [...t.slice(-5), { q: msg, reply, log, src }]);
    setBusy(false);
  };

  return (
    <AnimatePresence>
      {copilotOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 pt-[14vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => set({ copilotOpen: false })}>
          <motion.div role="dialog" aria-label="TerraTwin Copilot" className="glass w-full max-w-2xl overflow-hidden rounded-2xl" initial={{ y: -12, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -12, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
            <form className="flex items-center gap-3 border-b border-white/5 px-4 py-3" onSubmit={(e) => { e.preventDefault(); submit(q); }}>
              {busy ? <LoaderCircle size={18} className="animate-spin text-amber-300" /> : <Command size={18} className="text-amber-300" />}
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask TerraTwin… e.g. “show car parks with the best demand match at 5pm in December”"
                className="flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-slate-500" />
              <Pill tone={ai?.ai ? 'emerald' : 'amber'}>{ai?.ai ? 'Claude' : 'Offline'}</Pill>
              <kbd className="flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400"><CornerDownLeft size={10} /> Enter</kbd>
            </form>
            <div className="scroll-thin max-h-[50vh] overflow-y-auto p-3">
              {turns.length > 0 && (
                <ul className="mb-3 space-y-2">
                  {turns.map((t, i) => (
                    <li key={i} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                      <div className="text-sm text-white">{t.q}</div>
                      {t.log.length > 0 && <ul className="mt-1.5 flex flex-wrap gap-1.5">{t.log.map((l) => <li key={l} className="flex items-center gap-1 rounded-md bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-200 ring-1 ring-emerald-300/20"><CircleCheck size={11} /> {l}</li>)}</ul>}
                      {t.reply && <p className="mt-1.5 flex gap-1.5 text-[13px] text-slate-300"><Bot size={14} className="mt-0.5 shrink-0 text-sky-300" /> {t.reply}</p>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="px-1 text-[10px] uppercase tracking-wider text-slate-500">Try</div>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => <li key={s}><button type="button" onClick={() => submit(s)} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 ring-1 ring-white/10 hover:bg-white/10">{s}</button></li>)}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
