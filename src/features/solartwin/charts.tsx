/* SolarTwin charts: 24 h demand vs PV, monthly shading bars and the sun-path diagram. Colours use the validated
   categorical slots (blue / orange / aqua); text stays in ink tokens; each multi-series chart carries a legend. */
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { mytDate, sunPosition } from '../../lib/solar/sun';
import { SERIES } from '../../components/ui';

const INK = { muted: '#8b93a5', grid: 'rgba(148,163,184,0.12)', axis: 'rgba(148,163,184,0.25)' };
const tipStyle = { background: 'rgba(2,6,23,0.94)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 10, fontSize: 11, color: '#e2e8f0' };
const kwh = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)} MWh` : `${v.toFixed(v < 10 ? 1 : 0)} kWh`);

export function DemandChart({ pv, load }: { pv: number[]; load: number[] }) {
  const data = pv.map((p, h) => ({ h, pv: p, load: load[h] }));
  return (
    <div>
      <div className="mb-1 flex gap-3 text-[11px] text-slate-300">
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 rounded" style={{ background: SERIES[1] }} /> PV generation</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 rounded" style={{ background: SERIES[0] }} /> Building load</span>
        <span className="ml-auto text-slate-500">average day, kWh/h</span>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="gPv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SERIES[1]} stopOpacity={0.45} /><stop offset="100%" stopColor={SERIES[1]} stopOpacity={0.04} /></linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={INK.grid} />
            <XAxis dataKey="h" tick={{ fill: INK.muted, fontSize: 10 }} tickLine={false} axisLine={{ stroke: INK.axis }} ticks={[0, 6, 12, 18, 23]} tickFormatter={(h) => `${h}:00`} />
            <YAxis tick={{ fill: INK.muted, fontSize: 10 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))} />
            <Tooltip contentStyle={tipStyle} labelFormatter={(h) => `${h}:00 – ${Number(h) + 1}:00`} formatter={(v, n) => [kwh(Number(v)), n === 'pv' ? 'PV generation' : 'Building load']} cursor={{ stroke: 'rgba(226,232,240,0.35)' }} />
            <Area type="monotone" dataKey="load" stroke={SERIES[0]} strokeWidth={2} fill={SERIES[0]} fillOpacity={0.1} isAnimationActive />
            <Area type="monotone" dataKey="pv" stroke={SERIES[1]} strokeWidth={2} fill="url(#gPv)" isAnimationActive />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function MonthlyShading({ values }: { values: number[] }) {
  const data = values.map((v, i) => ({ m: i, v: v * 100 }));
  return (
    <div className="h-24">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -26 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={INK.grid} />
          <XAxis dataKey="m" tick={{ fill: INK.muted, fontSize: 10 }} tickLine={false} axisLine={{ stroke: INK.axis }} tickFormatter={(m) => MONTHS[m]} interval={0} />
          <YAxis tick={{ fill: INK.muted, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[0, (max: number) => Math.max(5, Math.ceil(max))]} />
          <Tooltip contentStyle={tipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }} labelFormatter={(m) => MONTH_NAMES[Number(m)]} formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Shading loss']} />
          <Bar dataKey="v" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Polar sun-path diagram (zenith at centre, horizon at the rim) for the solstices and equinox, with the current sun. */
export function SunPath({ month, day, hour, size = 150 }: { month: number; day: number; hour: number; size?: number }) {
  const R = size / 2 - 14, c = size / 2;
  const pt = (alt: number, bearing: number) => {
    const r = R * (1 - alt / 90), a = (bearing * Math.PI) / 180;
    return [c + r * Math.sin(a), c - r * Math.cos(a)] as const;
  };
  const path = (m: number, d: number) => {
    const pts: string[] = [];
    for (let h = 6; h <= 20; h += 0.25) {
      const s = sunPosition(mytDate(2026, m, d, h)), alt = (s.altitude * 180) / Math.PI;
      if (alt > 0) pts.push(pt(alt, s.bearing).join(','));
    }
    return pts.join(' ');
  };
  const days = [{ m: 6, d: 21, label: 'Jun 21', col: SERIES[0] }, { m: 3, d: 20, label: 'Equinox', col: SERIES[1] }, { m: 12, d: 21, label: 'Dec 21', col: SERIES[2] }];
  const now = sunPosition(mytDate(2026, month, day, hour)), nowAlt = (now.altitude * 180) / Math.PI;
  const [nx, ny] = pt(Math.max(0, nowAlt), now.bearing);
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} role="img" aria-label="Sun path diagram">
        {[0, 30, 60].map((alt) => <circle key={alt} cx={c} cy={c} r={R * (1 - alt / 90)} fill="none" stroke={INK.grid} />)}
        <line x1={c - R} y1={c} x2={c + R} y2={c} stroke={INK.grid} /><line x1={c} y1={c - R} x2={c} y2={c + R} stroke={INK.grid} />
        {(['N', 'E', 'S', 'W'] as const).map((l, i) => { const [x, y] = pt(-14, i * 90); return <text key={l} x={x} y={y + 3} textAnchor="middle" fontSize={10} fill={INK.muted}>{l}</text>; })}
        {days.map((d) => <polyline key={d.label} points={path(d.m, d.d)} fill="none" stroke={d.col} strokeWidth={2} strokeLinecap="round" />)}
        {nowAlt > 0 && (<><circle cx={nx} cy={ny} r={7} fill="#fde68a" opacity={0.25} /><circle cx={nx} cy={ny} r={4.5} fill="#fde68a" stroke="#0b1222" strokeWidth={2} /></>)}
      </svg>
      <ul className="space-y-1 text-[11px] text-slate-300">
        {days.map((d) => <li key={d.label} className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded" style={{ background: d.col }} />{d.label}</li>)}
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-200" /> Sun now ({nowAlt > 0 ? `${nowAlt.toFixed(0)}° up, ${Math.round(now.bearing)}°` : 'below horizon'})</li>
      </ul>
    </div>
  );
}
