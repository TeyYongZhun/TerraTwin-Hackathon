// Fetches real building footprints, car parks, parks, trees and water for City of Elmina from OpenStreetMap
// (via the Overpass API) and writes a compact GeoJSON used by the 3D map.
// Data © OpenStreetMap contributors, ODbL. Run: npm run fetch:osm
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/data/osm/elmina.osm.json');
// South, West, North, East — City of Elmina core around Elmina Lakeside Mall (3.1814, 101.5101).
export const BBOX = [3.165, 101.48, 3.205, 101.53];
const MIRRORS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
// Split the area into tiles and the feature types into separate queries: public Overpass mirrors
// reject or time out on one large request.
function tiles(n) {
  const [s, w, no, e] = BBOX, out = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
    out.push([s + ((no - s) * i) / n, w + ((e - w) * j) / n, s + ((no - s) * (i + 1)) / n, w + ((e - w) * (j + 1)) / n].map((x) => x.toFixed(5)).join(','));
  return out;
}
const QUERIES = [
  ...tiles(2).map((t) => `[out:json][timeout:90];(way["building"](${t});relation["building"](${t}););out geom tags;`),
  `[out:json][timeout:90];(way["amenity"="parking"](${BBOX.join(',')});way["leisure"~"park|pitch|playground|garden"](${BBOX.join(',')}););out geom tags;`,
  `[out:json][timeout:90];(way["natural"~"water|wood|tree_row|scrub"](${BBOX.join(',')});way["landuse"~"grass|forest|recreation_ground"](${BBOX.join(',')});way["water"](${BBOX.join(',')});node["natural"="tree"](${BBOX.join(',')}););out geom tags;`,
];

async function fetchOverpass(query) {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of MIRRORS) {
      try {
        process.stdout.write(`  ${url.split('/')[2]} ... `);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TerraTwin-hackathon/0.1 (data prep)', Accept: 'application/json' },
          body: 'data=' + encodeURIComponent(query),
          signal: AbortSignal.timeout(100_000),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        console.log(`${json.elements.length} elements`);
        return json.elements;
      } catch (e) {
        console.log('failed: ' + e.message);
      }
    }
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
  throw new Error('All Overpass mirrors failed. Try again later.');
}

const round = (n) => Math.round(n * 1e7) / 1e7;
const ring = (geom) => {
  const pts = geom.map((p) => [round(p.lon), round(p.lat)]);
  const [a, z] = [pts[0], pts[pts.length - 1]];
  if (a[0] !== z[0] || a[1] !== z[1]) pts.push(a);
  return pts;
};

function classify(t) {
  if (t.building) return 'building';
  if (t.amenity === 'parking') return 'parking';
  if (t.natural === 'water' || t.water) return 'water';
  if (t.natural === 'tree') return 'tree';
  if (['wood', 'tree_row', 'scrub'].includes(t.natural) || t.landuse === 'forest') return 'trees';
  return 'green';
}

const KEEP = ['name', 'building', 'building:levels', 'height', 'roof:shape', 'roof:levels', 'amenity', 'shop', 'leisure', 'natural', 'landuse', 'parking', 'addr:street', 'addr:housenumber', 'operator'];

const seen = new Set(), elements = [];
for (const [i, q] of QUERIES.entries()) {
  console.log(`Query ${i + 1}/${QUERIES.length}`);
  for (const el of await fetchOverpass(q)) {
    const key = el.type + el.id;
    if (!seen.has(key)) { seen.add(key); elements.push(el); }
  }
}
const features = [];
for (const el of elements) {
  const t = el.tags || {};
  const props = { osmId: `${el.type}/${el.id}`, kind: classify(t) };
  for (const k of KEEP) if (t[k] !== undefined) props[k.replace(':', '_')] = t[k];
  if (el.type === 'node') {
    features.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [round(el.lon), round(el.lat)] } });
  } else if (el.type === 'way' && el.geometry?.length >= 4) {
    if (props.kind === 'trees' && t.natural === 'tree_row') {
      features.push({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: el.geometry.map((p) => [round(p.lon), round(p.lat)]) } });
    } else {
      features.push({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [ring(el.geometry)] } });
    }
  } else if (el.type === 'relation' && el.members) {
    const outers = el.members.filter((m) => m.role === 'outer' && m.geometry?.length >= 4).map((m) => [ring(m.geometry)]);
    if (outers.length) features.push({ type: 'Feature', properties: props, geometry: outers.length === 1 ? { type: 'Polygon', coordinates: outers[0] } : { type: 'MultiPolygon', coordinates: outers } });
  }
}
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ type: 'FeatureCollection', attribution: '© OpenStreetMap contributors (ODbL)', bbox: [BBOX[1], BBOX[0], BBOX[3], BBOX[2]], fetchedAt: new Date().toISOString(), features }));
const counts = features.reduce((m, f) => ((m[f.properties.kind] = (m[f.properties.kind] || 0) + 1), m), {});
console.log('Wrote', OUT, counts);
