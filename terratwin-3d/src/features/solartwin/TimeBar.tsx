/* Bottom sun-time bar: drag or play the day to sweep live shadows and lighting across the township. */
import { useEffect, useMemo } from 'react';
import { Pause, Play, Sunrise, Sunset } from 'lucide-react';
import { useApp, useAppPick } from '../../store/app';
import { mytDate, sunPosition, sunTimes } from '../../lib/solar/sun';
import { cx, hhmm } from '../../components/ui';
export { PRESETS as DATE_PRESETS };

const PRESETS = [
  { label: 'Mar equinox', month: 3, day: 20 }, { label: 'Jun solstice', month: 6, day: 21 },
  { label: 'Sep equinox', month: 9, day: 22 }, { label: 'Dec solstice', month: 12, day: 21 },
];
const MIN = 6.5, MAX = 20;

export function TimeBar({ className }: { className?: string }) {
  const { sun, playing, setSun, set } = useAppPick('sun', 'playing', 'setSun', 'set');
  const times = useMemo(() => sunTimes(mytDate(2026, sun.month, sun.day, 12)), [sun.month, sun.day]);
  const pos = sunPosition(mytDate(2026, sun.month, sun.day, sun.hour)), alt = (pos.altitude * 180) / Math.PI;
  const today = new Date();

  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000); // no jump after a backgrounded tab resumes
      last = t;
      const { sun: s } = useApp.getState();
      let h = s.hour + dt * 0.9; // ~0.9 h of sun time per second
      if (h > MAX) h = MIN;
      setSun({ hour: h });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, setSun]);

  const pct = (h: number) => ((h - MIN) / (MAX - MIN)) * 100;
  const date = new Date(2026, sun.month - 1, sun.day).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });

  return (
    <div className={cx('pointer-events-auto glass flex items-center gap-3 rounded-2xl px-3 py-2', className)}>
      <button type="button" aria-label={playing ? 'Pause' : 'Play the day'} onClick={() => set({ playing: !playing })}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-slate-950 shadow-lg hover:brightness-110">
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div className="w-[64px] shrink-0 leading-tight">
        <div className="num text-lg font-bold text-white">{hhmm(sun.hour)}</div>
        <div className="text-[10px] text-slate-400">{date} · MYT</div>
      </div>
      <div className="relative min-w-[180px] flex-1">
        <div className="pointer-events-none absolute -top-0.5 left-0 right-0 h-1 rounded-full" style={{
          background: `linear-gradient(90deg, transparent ${pct(times.sunrise) - 2}%, rgba(251,146,60,.5) ${pct(times.sunrise)}%, rgba(253,230,138,.5) ${pct(times.noon)}%, rgba(251,146,60,.5) ${pct(times.sunset)}%, transparent ${pct(times.sunset) + 2}%)`,
        }} />
        <input aria-label="Time of day" className="range" type="range" min={MIN} max={MAX} step={0.05} value={sun.hour} onChange={(e) => { set({ playing: false }); setSun({ hour: +e.target.value }); }} />
        <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><Sunrise size={10} /> {hhmm(times.sunrise)}</span>
          <span>{alt > 0 ? `Sun ${alt.toFixed(0)}° · ${Math.round(pos.bearing)}°` : 'Sun below horizon'}</span>
          <span className="flex items-center gap-1">{hhmm(times.sunset)} <Sunset size={10} /></span>
        </div>
      </div>
      <select aria-label="Date" value={`${sun.month}-${sun.day}`} onChange={(e) => { const [month, day] = e.target.value.split('-').map(Number); setSun({ month, day }); }}
        className="shrink-0 rounded-lg bg-white/5 px-2 py-1.5 text-[11px] text-slate-200 ring-1 ring-white/10 outline-none hover:bg-white/10 [&>option]:bg-slate-900">
        <option value={`${today.getMonth() + 1}-${today.getDate()}`}>Today</option>
        {PRESETS.map((p) => <option key={p.label} value={`${p.month}-${p.day}`}>{p.label}</option>)}
        {!PRESETS.some((p) => p.month === sun.month && p.day === sun.day) && !(sun.month === today.getMonth() + 1 && sun.day === today.getDate()) && <option value={`${sun.month}-${sun.day}`}>{date}</option>}
      </select>
    </div>
  );
}
