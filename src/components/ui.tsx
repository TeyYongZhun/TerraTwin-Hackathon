/* Small shared UI primitives: glass panels, pills, stats, animated counters and the score ring. */
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { animate, motion } from 'motion/react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Pill({ children, tone = 'slate', className }: { children: ReactNode; tone?: 'slate' | 'amber' | 'emerald' | 'rose' | 'sky' | 'violet'; className?: string }) {
  const tones = {
    slate: 'bg-slate-500/15 text-slate-300 ring-slate-400/20', amber: 'bg-amber-400/15 text-amber-200 ring-amber-300/25',
    emerald: 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/25', rose: 'bg-rose-500/15 text-rose-200 ring-rose-400/25',
    sky: 'bg-sky-400/15 text-sky-200 ring-sky-300/25', violet: 'bg-violet-400/15 text-violet-200 ring-violet-300/25',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1', tones[tone], className)}>{children}</span>;
}

/** Animated number that tweens when its value changes. */
export function CountUp({ value, decimals = 0, duration = 1.1, prefix = '', suffix = '' }: { value: number; decimals?: number; duration?: number; prefix?: string; suffix?: string }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const c = animate(from.current, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => { from.current = x; setV(x); } });
    return () => c.stop();
  }, [value, duration]);
  return <span className="num">{prefix}{v.toLocaleString('en-MY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

export function Stat({ label, value, unit, sub, accent }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; accent?: string }) {
  return (
    <div className="glass-soft rounded-xl px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</div>
      <div className={cx('mt-0.5 text-lg font-semibold leading-tight text-white num', accent)}>{value}{unit && <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

/** Same amber sequential ramp as the map heat, so a score reads identically in the list and in 3D. */
export function scoreColor(score: number) {
  return score >= 85 ? '#ffd166' : score >= 70 ? '#f5a524' : score >= 55 ? '#d9741c' : score >= 40 ? '#a8541a' : '#7c3d14';
}
export const scoreInk = (score: number) => (score >= 55 ? '#0b0b0b' : '#f8fafc');
/** Validated categorical slots (dark): 1 blue, 2 orange, 3 aqua. */
export const SERIES = ['#3987e5', '#d95926', '#199e70'] as const;

export function ScoreRing({ score, size = 92, label = 'Solar score' }: { score: number; size?: number; label?: string }) {
  const r = size / 2 - 7, c = 2 * Math.PI * r, col = scoreColor(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(148,163,184,0.18)" strokeWidth={7} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={7} fill="none" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - score / 100) }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${col}88)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-white"><CountUp value={score} /></div>
        <div className="text-[9px] uppercase tracking-wider text-slate-400">{label}</div>
      </div>
    </div>
  );
}

export function Section({ title, icon, right, children, className }: { title: string; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('border-t border-white/5 px-4 py-3', className)}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{icon}{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Btn({ children, onClick, tone = 'ghost', className, disabled, title }: { children: ReactNode; onClick?: () => void; tone?: 'primary' | 'ghost' | 'leaf' | 'sky'; className?: string; disabled?: boolean; title?: string }) {
  const tones = {
    primary: 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:brightness-110 shadow-[0_8px_24px_-8px_rgba(251,146,60,0.7)]',
    leaf: 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 hover:brightness-110 shadow-[0_8px_24px_-8px_rgba(52,211,153,0.6)]',
    sky: 'bg-gradient-to-r from-sky-400 to-indigo-500 text-white hover:brightness-110',
    ghost: 'bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/10',
  };
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40', tones[tone], className)}>
      {children}
    </button>
  );
}

export const rm = (n: number, d = 0) => (Number.isFinite(n) ? 'RM ' + (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : Math.abs(n) >= 1e4 ? (n / 1e3).toFixed(0) + 'k' : n.toLocaleString('en-MY', { maximumFractionDigits: d })) : '—');
export const hhmm = (h: number) => { const m = Math.round(h * 60); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
