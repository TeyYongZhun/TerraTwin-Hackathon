/* Sun position for City of Elmina (SunCalc). Times are Malaysia Time (MYT, UTC+8, no DST). */
import * as SunCalc from 'suncalc';
import { ORIGIN } from '../geo';

/** altitude in radians; bearing = compass direction the sun shines FROM, degrees clockwise from north. */
export interface SunPos { altitude: number; bearing: number }

/** Build a Date from MYT wall-clock components. month is 1–12, hour may be fractional. */
export function mytDate(year: number, month: number, day: number, hour: number): Date {
  const h = Math.floor(hour), m = Math.round((hour - h) * 60);
  return new Date(Date.UTC(year, month - 1, day, h - 8, m));
}

export function sunPosition(date: Date, lngLat = ORIGIN): SunPos {
  // SunCalc v2 returns degrees: refraction-corrected altitude and azimuth clockwise from north.
  const p = SunCalc.getPosition(date, lngLat[1], lngLat[0]);
  return { altitude: (p.altitude * Math.PI) / 180, bearing: ((p.azimuth % 360) + 360) % 360 };
}

export function sunTimes(date: Date, lngLat = ORIGIN) {
  const t = SunCalc.getTimes(date, lngLat[1], lngLat[0]);
  const toMyt = (d: Date | null, fallback: number) => (d ? ((d.getUTCHours() + 8) % 24) + d.getUTCMinutes() / 60 : fallback);
  return { sunrise: toMyt(t.sunrise, 7.2), sunset: toMyt(t.sunset, 19.3), noon: toMyt(t.solarNoon, 13.2) };
}

/** Annual sample set: 21st of every month, 07:00–19:00 every 30 min, weighted by clear-sky irradiance ≈ sin(alt)^1.15. */
export interface SunSample extends SunPos { weight: number; month: number; hour: number }
let cached: SunSample[] | null = null;
export function annualSunSamples(): SunSample[] {
  if (cached) return cached;
  const out: SunSample[] = [];
  for (let month = 1; month <= 12; month++)
    for (let hour = 7; hour <= 19; hour += 0.5) {
      const s = sunPosition(mytDate(2026, month, 21, hour));
      if (s.altitude > 0.03) out.push({ ...s, weight: Math.pow(Math.sin(s.altitude), 1.15), month, hour });
    }
  return (cached = out);
}
