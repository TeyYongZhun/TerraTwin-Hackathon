import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { useApp } from '../../store/app';

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed left-1/2 top-20 z-50 flex -translate-x-1/2 flex-col items-center gap-2" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = t.tone === 'warn' ? TriangleAlert : t.tone === 'info' ? Info : CircleCheck;
          return (
            <motion.div key={t.id} layout initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}
              className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm text-slate-100">
              <Icon size={15} className={t.tone === 'warn' ? 'text-amber-300' : t.tone === 'info' ? 'text-sky-300' : 'text-emerald-300'} /> {t.text}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
