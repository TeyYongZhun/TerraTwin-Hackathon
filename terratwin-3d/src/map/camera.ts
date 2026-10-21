/* Map instance holder and cinematic camera moves (intro flyover, fly-to-site, slow orbit). */
import type { Map as MLMap } from 'maplibre-gl';
import type { Site } from '../data/sites';
import { dist } from '../lib/geo';

export const mapRef: { current: MLMap | null } = { current: null };
export const ELMINA = { center: [101.5085, 3.1822] as [number, number], zoom: 15.7, pitch: 60, bearing: -24 };

let orbitRaf = 0, spinRaf = 0;
const stopAll = () => { cancelAnimationFrame(orbitRaf); cancelAnimationFrame(spinRaf); orbitRaf = spinRaf = 0; };

/** Slow globe spin behind the intro hero. */
export function spinGlobe() {
  const map = mapRef.current;
  if (!map) return;
  stopAll();
  const tick = () => {
    const c = map.getCenter();
    map.jumpTo({ center: [c.lng + 0.06, c.lat] });
    spinRaf = requestAnimationFrame(tick);
  };
  spinRaf = requestAnimationFrame(tick);
}

/** Gentle orbit around the current centre until the user touches the map. */
export function startOrbit(speed = 0.045) {
  const map = mapRef.current;
  if (!map) return;
  cancelAnimationFrame(orbitRaf);
  const tick = () => { map.setBearing(map.getBearing() + speed); orbitRaf = requestAnimationFrame(tick); };
  orbitRaf = requestAnimationFrame(tick);
}
export const stopOrbit = () => { cancelAnimationFrame(orbitRaf); orbitRaf = 0; };

/** Globe → Malaysia → Elmina. Buildings rise as the camera arrives. */
export function flyIntro(onArrive: () => void) {
  const map = mapRef.current;
  if (!map) return onArrive();
  stopAll();
  map.flyTo({ ...ELMINA, duration: 6500, curve: 1.55, essential: true });
  const t0 = performance.now();
  let grown = false;
  const grow = () => {
    const k = Math.min(1, (performance.now() - t0 - 4300) / 2400);
    if (k > 0) map.setGlobalStateProperty('grow', 1 - Math.pow(1 - k, 3));
    if (k < 1) requestAnimationFrame(grow);
    else if (!grown) { grown = true; onArrive(); startOrbit(0.025); }
  };
  requestAnimationFrame(grow);
}

export function skipIntro() {
  const map = mapRef.current;
  if (!map) return;
  stopAll();
  map.jumpTo(ELMINA);
  map.setGlobalStateProperty('grow', 1);
}

export function flyToSite(s: Site, opts: { orbit?: boolean; pitch?: number } = {}) {
  const map = mapRef.current;
  if (!map) return;
  stopAll();
  const r = Math.max(20, ...s.pts.map((p) => dist(p, s.center)));
  const zoom = Math.max(15.4, Math.min(19.3, 19.6 - Math.log2(r / 14)));
  map.flyTo({ center: s.centerLL, zoom, pitch: opts.pitch ?? 62, bearing: map.getBearing() + 35, duration: 2200, essential: true, padding: { left: 340, right: 420, top: 40, bottom: 120 } });
  if (opts.orbit !== false) map.once('moveend', () => startOrbit());
}

export function flyHome() {
  const map = mapRef.current;
  if (!map) return;
  stopAll();
  map.flyTo({ ...ELMINA, duration: 2000, essential: true, padding: { left: 0, right: 0, top: 0, bottom: 0 } });
}
