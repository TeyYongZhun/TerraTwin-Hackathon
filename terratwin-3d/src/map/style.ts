/* One base style holding all three looks (Satellite / Night / Blueprint) so switching never reloads our 3D layers.
   Imagery © Esri, Maxar, Earthstar Geographics · vector tiles © OpenFreeMap, OpenMapTiles, © OpenStreetMap contributors. */
import type { Map as MLMap, StyleSpecification } from 'maplibre-gl';
import type { MapStyleId } from '../store/app';

export const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const FONT = ['Noto Sans Regular'];

export function baseStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    projection: { type: 'globe' },
    sky: { 'sky-color': '#0b1a33', 'horizon-color': '#9cc3ff', 'sky-horizon-blend': 0.6, 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 8, 0.6, 12, 0.15] },
    light: { anchor: 'map', position: [1.4, 120, 40], color: '#fff6e8', intensity: 0.45 },
    state: { grow: { default: 0 } },
    sources: {
      esri: { type: 'raster', tiles: [ESRI], tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
      ofm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors' },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#030712' } },
      { id: 'sat', type: 'raster', source: 'esri', paint: { 'raster-fade-duration': 200, 'raster-saturation': -0.05, 'raster-contrast': 0.08 } },
      { id: 'ofm-landuse', type: 'fill', source: 'ofm', 'source-layer': 'landcover', paint: { 'fill-color': '#0f2a1e', 'fill-opacity': 0 } },
      { id: 'ofm-park', type: 'fill', source: 'ofm', 'source-layer': 'park', paint: { 'fill-color': '#0f2a1e', 'fill-opacity': 0 } },
      { id: 'ofm-water', type: 'fill', source: 'ofm', 'source-layer': 'water', paint: { 'fill-color': '#0b2545', 'fill-opacity': 0 } },
      {
        id: 'ofm-roads', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]],
        paint: {
          'line-color': '#1e293b', 'line-opacity': 0,
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, ['match', ['get', 'class'], ['motorway', 'trunk'], 1.6, 'primary', 1.2, 0.5], 18, ['match', ['get', 'class'], ['motorway', 'trunk'], 22, ['primary', 'secondary'], 16, 'service', 5, 9]],
        },
      },
      {
        id: 'ofm-road-labels', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name', minzoom: 14.5,
        layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']], 'text-font': FONT, 'text-size': 11, 'text-letter-spacing': 0.04 },
        paint: { 'text-color': '#e2e8f0', 'text-halo-color': 'rgba(2,6,23,0.85)', 'text-halo-width': 1.4 },
      },
      {
        id: 'ofm-places', type: 'symbol', source: 'ofm', 'source-layer': 'place', maxzoom: 15,
        layout: { 'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']], 'text-font': FONT, 'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 13, 14], 'text-transform': 'uppercase', 'text-letter-spacing': 0.12 },
        paint: { 'text-color': '#f8fafc', 'text-halo-color': 'rgba(2,6,23,0.8)', 'text-halo-width': 1.6 },
      },
    ],
  };
}

/** Re-skin the base layers for the chosen look. `daylight` (0–1) dims satellite imagery towards dusk. */
export function applyLook(map: MLMap, look: MapStyleId, daylight: number) {
  const P = (id: string, k: Parameters<MLMap['setPaintProperty']>[1], v: Parameters<MLMap['setPaintProperty']>[2]) => map.getLayer(id) && map.setPaintProperty(id, k, v);
  const sat = look === 'satellite';
  map.setLayoutProperty('sat', 'visibility', sat ? 'visible' : 'none');
  P('sat', 'raster-brightness-max', 0.25 + 0.75 * daylight);
  P('sat', 'raster-saturation', -0.05 - 0.45 * (1 - daylight));
  const bg = look === 'blueprint' ? '#0a2a5c' : '#030712';
  P('bg', 'background-color', bg);
  P('ofm-water', 'fill-opacity', sat ? 0 : 1);
  P('ofm-water', 'fill-color', look === 'blueprint' ? '#08356f' : '#06152b');
  P('ofm-park', 'fill-opacity', sat ? 0 : look === 'blueprint' ? 0 : 0.8);
  P('ofm-landuse', 'fill-opacity', sat ? 0 : look === 'blueprint' ? 0 : 0.35);
  P('ofm-roads', 'line-opacity', sat ? 0 : 1);
  P('ofm-roads', 'line-color', look === 'blueprint' ? '#5aa9ff' : '#1f2b40');
  P('ofm-road-labels', 'text-color', look === 'blueprint' ? '#bfe0ff' : '#e2e8f0');
}
