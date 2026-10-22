/* Full-screen 3D digital twin of City of Elmina: satellite / night / blueprint looks, solar-score heat extrusions,
   live sun-driven shadows and lighting, panel and solar-canopy build-outs. */
import { useEffect, useRef, useState } from 'react';
import { type ExpressionSpecification, type GeoJSONSource, Map as MLMap, type MapMouseEvent, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre resolves its worker relative to its own module, which Vite's dep bundling moves; point it at the
// self-contained worker file explicitly (works in dev and in the production build).
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
setWorkerUrl(workerUrl);
import { applyLook, baseStyle } from './style';
import { mapRef, flyToSite, spinGlobe, stopOrbit } from './camera';
import { type CanopyReveal, EMPTY, canopyFC, fidOf, labelsFC, outlineFC, panelsFC, shadowsFC, townshipFC } from './sources';
import { type CanopySpec, useApp, useAppPick, type MapStyleId } from '../store/app';
import { useAnalytics } from '../hooks/useAnalytics';
import { getSites, type SiteKind } from '../data/sites';
import { getTownship, CATEGORY_LABEL } from '../data/township';
import { mytDate, sunPosition } from '../lib/solar/sun';
import { fmt } from '../lib/solar/evaluate';
import type { PvSpec } from '../lib/solar/modules';

/** Single-hue amber sequential ramp (monotone lightness, validated against the dark UI surface). */
export const HEAT_STOPS: [number, string][] = [[0, '#7c3d14'], [0.35, '#a8541a'], [0.65, '#d9741c'], [0.85, '#f5a524'], [1, '#ffd166']];
const HEAT: ExpressionSpecification = ['interpolate', ['linear'], ['get', 'pct'], ...HEAT_STOPS.flat()] as ExpressionSpecification;
const NEUTRAL: Record<MapStyleId, string> = { satellite: '#e7e5e4', night: '#1e293b', blueprint: '#bfdbfe' };

function colorExpr(heat: boolean, look: MapStyleId, fallback = NEUTRAL[look]): ExpressionSpecification {
  const e: unknown[] = ['case',
    ['boolean', ['feature-state', 'selected'], false], '#e0f2fe',
    ['boolean', ['feature-state', 'hover'], false], '#67e8f9',
    ['==', ['get', 'cream'], 1], '#34d399'];
  if (heat) e.push(['>=', ['get', 'pct'], 0], HEAT);
  e.push(fallback);
  return e as ExpressionSpecification;
}

const mix = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, '0')).join('');
};

function addLayers(map: MLMap) {
  const src = (id: string, extra: object = {}) => map.addSource(id, { type: 'geojson', data: EMPTY, ...extra });
  src('buildings', { attribution: 'Buildings © OpenStreetMap contributors (ODbL)' });
  src('carparks'); src('shadows'); src('panels'); src('canopy'); src('outline'); src('labels');
  const before = 'ofm-road-labels';
  map.addLayer({ id: 'carparks-fill', type: 'fill', source: 'carparks', paint: { 'fill-color': colorExpr(true, 'satellite', '#64748b'), 'fill-opacity': ['case', ['>=', ['get', 'pct'], 0], 0.5, 0.12] } }, before);
  map.addLayer({ id: 'carparks-line', type: 'line', source: 'carparks', paint: { 'line-color': '#e2e8f0', 'line-opacity': 0.45, 'line-width': 1, 'line-dasharray': [2, 2] } }, before);
  map.addLayer({ id: 'shadows', type: 'fill', source: 'shadows', paint: { 'fill-color': '#020617', 'fill-opacity': 0.34, 'fill-antialias': false } }, before);
  map.addLayer({
    id: 'buildings-3d', type: 'fill-extrusion', source: 'buildings',
    paint: { 'fill-extrusion-color': colorExpr(true, 'satellite'), 'fill-extrusion-height': ['*', ['get', 'h'], ['global-state', 'grow']] as ExpressionSpecification, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.93, 'fill-extrusion-vertical-gradient': true },
  }, before);
  map.addLayer({
    id: 'panels-3d', type: 'fill-extrusion', source: 'panels',
    paint: { 'fill-extrusion-color': ['get', 'c'], 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'top'], 'fill-extrusion-opacity': 1 },
  }, before);
  map.addLayer({
    id: 'canopy-3d', type: 'fill-extrusion', source: 'canopy',
    paint: { 'fill-extrusion-color': ['get', 'c'], 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'top'], 'fill-extrusion-opacity': 1 },
  }, before);
  map.addLayer({ id: 'outline', type: 'line', source: 'outline', paint: { 'line-color': '#22d3ee', 'line-width': 3, 'line-blur': 0.6 } }, before);
  map.addLayer({
    id: 'site-labels', type: 'symbol', source: 'labels', minzoom: 14,
    layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': ['case', ['==', ['get', 'sel'], 1], 14, 12], 'text-anchor': 'bottom', 'text-offset': [0, -1.4], 'text-allow-overlap': false, 'text-max-width': 12 },
    paint: { 'text-color': ['case', ['==', ['get', 'sel'], 1], '#67e8f9', '#ffffff'], 'text-halo-color': 'rgba(2,6,23,0.9)', 'text-halo-width': 1.8 },
  });
}

interface Hover { x: number; y: number; sid: string }

export function MapView() {
  const el = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const analytics = useAnalytics();
  const { mapStyle, layers, sun, selectedId, hoverId, portfolio, creamPool, canopies, arrays, modules, canopySpecs } = useAppPick('mapStyle', 'layers', 'sun', 'selectedId', 'hoverId', 'portfolio', 'creamPool', 'canopies', 'arrays', 'modules', 'canopySpecs');
  const lastSel = useRef<string | null>(null), lastHover = useRef<string | null>(null);
  const reveal = useRef<{ id: string; t: number } | null>(null), canopyReveal = useRef<CanopyReveal | null>(null);
  const prevCanopies = useRef<string[]>([]), prevArrays = useRef<string[]>([]), sunFrame = useRef(0);
  // Module / material choices last drawn by each layer, to spot a (re)build and replay its animation.
  const drawnPanelModules = useRef<Record<string, PvSpec>>({}), drawnCanopyModules = useRef<Record<string, PvSpec>>({});
  const drawnCanopySpecs = useRef<Record<string, CanopySpec>>({});

  // Create the map once.
  useEffect(() => {
    const map = new MLMap({
      container: el.current!, style: baseStyle(), center: [104, 6], zoom: 1.9, pitch: 0, maxPitch: 80,
      attributionControl: { compact: true }, canvasContextAttributes: { antialias: true }, fadeDuration: 150,
    });
    mapRef.current = map;
    if (import.meta.env.DEV) (window as unknown as { __map: MLMap }).__map = map;
    map.on('error', (e) => console.warn('[map]', e.error?.message ?? e));
    map.on('load', () => { addLayers(map); setReady(true); if (!useApp.getState().started) spinGlobe(); });
    for (const ev of ['mousedown', 'touchstart', 'wheel'] as const) map.on(ev, () => stopOrbit());

    const pick = (e: MapMouseEvent) => {
      if (!map.getLayer('buildings-3d')) return null;
      const f = map.queryRenderedFeatures(e.point, { layers: ['buildings-3d', 'carparks-fill'] })[0];
      return f ? (f.properties.sid as string) : null;
    };
    map.on('mousemove', (e) => {
      const sid = pick(e), site = sid ? getSites().byId.get(sid) : undefined;
      map.getCanvas().style.cursor = site ? 'pointer' : '';
      if (useApp.getState().hoverId !== (site?.id ?? null)) useApp.getState().set({ hoverId: site?.id ?? null });
      setHover(site ? { x: e.point.x, y: e.point.y, sid: site.id } : null);
    });
    map.on('mouseout', () => { setHover(null); useApp.getState().set({ hoverId: null }); });
    map.on('click', (e) => {
      const sid = pick(e), st = useApp.getState();
      if (!st.started) return;
      const site = sid ? getSites().byId.get(sid) : undefined;
      if (site) { st.select(site.id, site.kind as SiteKind); if (st.module !== 'solar') st.set({ module: 'solar' }); }
      else if (sid) {
        const b = getTownship().byId.get(sid);
        st.toast(`${b?.name || CATEGORY_LABEL[b?.category ?? 'utility']} — not screened (too small or non-eligible roof)`, 'info');
      } else st.select(null);
    });
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Township data (scores / CREAM membership).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const { buildings, carparks } = townshipFC(analytics, new Set(creamPool));
    (map.getSource('buildings') as GeoJSONSource).setData(buildings);
    (map.getSource('carparks') as GeoJSONSource).setData(carparks);
    // setData drops feature-state on the re-tiled features; restore the selection highlight.
    if (lastSel.current) for (const s of ['buildings', 'carparks']) map.setFeatureState({ source: s, id: fidOf.get(lastSel.current)! }, { selected: true });
  }, [ready, analytics, creamPool]);

  // Look + heat colouring + labels.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setPaintProperty('buildings-3d', 'fill-extrusion-color', colorExpr(layers.heat, mapStyle));
    map.setPaintProperty('buildings-3d', 'fill-extrusion-opacity', mapStyle === 'blueprint' ? 0.78 : 0.93);
    map.setPaintProperty('carparks-fill', 'fill-color', colorExpr(layers.heat, mapStyle, '#64748b'));
    for (const id of ['site-labels', 'ofm-road-labels', 'ofm-places']) map.setLayoutProperty(id, 'visibility', layers.labels ? 'visible' : 'none');
  }, [ready, layers.heat, layers.labels, mapStyle]);

  // Sun: shadows, light, sky and dusk dimming. Applied at most once per frame from the latest state. A newer sun
  // value must not cancel the queued frame: during day playback one arrives every frame, so it would never run.
  useEffect(() => () => { cancelAnimationFrame(sunFrame.current); sunFrame.current = 0; }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || sunFrame.current) return;
    sunFrame.current = requestAnimationFrame(() => {
      sunFrame.current = 0;
      const { sun: sn, layers: ly, mapStyle: look } = useApp.getState();
      const p = sunPosition(mytDate(2026, sn.month, sn.day, sn.hour)), altDeg = (p.altitude * 180) / Math.PI;
      const daylight = Math.max(0, Math.min(1, Math.sin(p.altitude) * 2.6 + 0.08));
      (map.getSource('shadows') as GeoJSONSource).setData(ly.shadows ? shadowsFC(p) : EMPTY);
      map.setPaintProperty('shadows', 'fill-opacity', 0.22 + 0.3 * daylight);
      map.setLight(altDeg > 0
        ? { anchor: 'map', position: [1.5, p.bearing, Math.max(8, Math.min(85, 90 - altDeg))], color: mix('#ffb070', '#fff8ec', altDeg / 35), intensity: 0.28 + 0.27 * daylight }
        : { anchor: 'map', position: [1.5, 200, 30], color: '#93b4ff', intensity: 0.2 });
      map.setSky({
        'sky-color': mix('#0b1026', '#5d9cff', daylight), 'horizon-color': altDeg < 8 && altDeg > -6 ? '#fb923c' : mix('#1e293b', '#dbeafe', daylight),
        'sky-horizon-blend': 0.6, 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 8, 0.6, 12, 0.12],
      });
      applyLook(map, look, look === 'satellite' ? daylight : 1);
    });
  }, [ready, sun, layers.shadows, mapStyle]);

  // Selection: highlight, outline, labels, camera.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const site = selectedId ? getSites().byId.get(selectedId) ?? null : null;
    for (const [id, on] of [[lastSel.current, false], [selectedId, true]] as const)
      if (id && fidOf.has(id)) for (const s of ['buildings', 'carparks']) map.setFeatureState({ source: s, id: fidOf.get(id)! }, { selected: on });
    lastSel.current = selectedId;
    (map.getSource('outline') as GeoJSONSource).setData(outlineFC(site));
    (map.getSource('labels') as GeoJSONSource).setData(labelsFC(site));
    if (site) { flyToSite(site); reveal.current = { id: site.id, t: 0 }; }
  }, [ready, selectedId]);

  // Hover highlight (from map or list).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const [id, on] of [[lastHover.current, false], [hoverId, true]] as const)
      if (id && fidOf.has(id)) for (const s of ['buildings', 'carparks']) map.setFeatureState({ source: s, id: fidOf.get(id)! }, { hover: on });
    lastHover.current = hoverId;
  }, [ready, hoverId]);

  // Rooftop / home PV arrays: designed arrays + portfolio + CREAM pool, under the PV panels layer. Selecting a site
  // does not draw its panels (the building stays as it is until "Design solar array in 3D"); re-selecting a site that
  // has panels replays their build-out.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const { byId } = getSites();
    // Designing an array, or building it with a (new) module, replays its build-out straight away.
    const rebuilt = arrays.find((id) => !prevArrays.current.includes(id))
      ?? Object.keys(modules).find((id) => modules[id] !== drawnPanelModules.current[id] && byId.get(id)?.kind !== 'carpark');
    prevArrays.current = arrays;
    drawnPanelModules.current = modules;
    if (rebuilt) reveal.current = { id: rebuilt, t: 0 };
    const ids = new Set(layers.panels ? [...arrays, ...portfolio, ...creamPool] : []);
    const sites = [...ids].map((id) => byId.get(id)!).filter((s) => s && s.kind !== 'carpark');
    const src = map.getSource('panels') as GeoJSONSource;
    let raf = 0;
    const t0 = performance.now();
    const step = () => {
      const r = reveal.current;
      if (r) r.t = Math.min(1, (performance.now() - t0) / 1400);
      src.setData(panelsFC(sites, r ?? undefined, modules));
      if (r && r.t < 1) raf = requestAnimationFrame(step);
    };
    // Let the camera start moving before the array builds out.
    const timer = window.setTimeout(step, reveal.current && reveal.current.t === 0 && !rebuilt ? 900 : 0);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [ready, selectedId, arrays, portfolio, creamPool, layers.panels, modules]);

  // Solar carport canopies. A new canopy, or canopy materials confirmed in the Canopy Materials tab, build the structure out again;
  // PV panels confirmed in the Solar Panels tab are laid onto the existing deck.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const structure = canopies.find((id) => !prevCanopies.current.includes(id)) ?? canopies.find((id) => canopySpecs[id] !== drawnCanopySpecs.current[id]);
    const panels = canopies.find((id) => modules[id] !== drawnCanopyModules.current[id]);
    prevCanopies.current = canopies;
    drawnCanopyModules.current = modules;
    drawnCanopySpecs.current = canopySpecs;
    const { byId } = getSites();
    const sites = layers.canopies ? canopies.map((id) => byId.get(id)!).filter(Boolean) : [];
    const src = map.getSource('canopy') as GeoJSONSource;
    const target: CanopyReveal | null = structure ? { id: structure, t: 0, part: 'structure' } : panels ? { id: panels, t: 0, part: 'panels' } : null;
    if (!target || !layers.canopies) { src.setData(canopyFC(sites, undefined, modules, canopySpecs)); return; }
    canopyReveal.current = target;
    const t0 = performance.now(), duration = target.part === 'panels' ? 1400 : 2200;
    let raf = 0;
    const step = () => {
      target.t = Math.min(1, (performance.now() - t0) / duration);
      src.setData(canopyFC(sites, target, modules, canopySpecs));
      if (target.t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ready, canopies, layers.canopies, modules, canopySpecs]);

  const h = hover ? analytics.byId.get(hover.sid) : null;
  return (
    <div className="absolute inset-0">
      {/* Inline size: maplibre-gl.css (unlayered) forces position:relative, which beats Tailwind's layered utilities. */}
      <div ref={el} style={{ position: 'absolute', inset: 0 }} />
      {h && hover && (
        <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[130%] rounded-xl glass px-3 py-2 text-xs" style={{ left: hover.x, top: hover.y }}>
          <div className="font-semibold text-white">{h.site.name}</div>
          <div className="mt-0.5 flex gap-3 text-slate-300">
            <span>Score <b className="text-amber-300">{h.ev.score.toFixed(0)}</b></span>
            <span>{fmt(h.site.kwp, h.site.kwp < 100 ? 1 : 0)} kWp</span>
            <span>#{h.rank} {h.site.kind === 'roof' ? 'rooftop' : h.site.kind === 'carpark' ? 'car park' : 'home'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
