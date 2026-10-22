/* Client-side extraction pipeline: validate → hash → demo cache or live Claude via the API, 4 at a time, into the given spec store. */
import cacheJson from '../../data/ecospec/sample-extractions.json';
import pack from '../../data/ecospec/sample-pack.json';
import type { Extraction } from '../../lib/ecospec/schema';
import { postJSON } from '../../lib/api';
import type { SpecStore } from '../../store/ecospec';
import { useApp } from '../../store/app';

const CACHE = cacheJson as Record<string, { fileName: string; useCaseId: string; source: string; extraction: Extraction }>;
export const SAMPLE_PACK = pack as { file: string; useCaseId: string; supplier: string; product: string; sha256: string; bytes: number }[];
const MAX = 25 * 1024 * 1024;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64 = (buf: ArrayBuffer) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let active = 0;
const queue: (() => Promise<void>)[] = [];
const pump = () => {
  while (active < 4 && queue.length) {
    const job = queue.shift()!;
    active++;
    job().finally(() => { active--; pump(); });
  }
};

/** Queue PDFs for extraction, skipping any already loaded for this use case (same name and size), so loading the
    sample pack twice or re-dropping a file does not list the same product twice. */
export function addFiles(store: SpecStore, files: File[], useCaseId: string) {
  const eco = store.getState(), key = (name: string, size: number) => `${name}:${size}`;
  const have = new Set(eco.docs.filter((d) => d.useCaseId === useCaseId && d.status !== 'error').map((d) => key(d.fileName, d.size)));
  const skipped: string[] = [];
  for (const f of files) {
    if (have.has(key(f.name, f.size))) { skipped.push(f.name); continue; }
    have.add(key(f.name, f.size));
    const id = `${f.name}:${f.size}:${Math.random().toString(36).slice(2, 7)}`;
    eco.upsertDoc({ id, fileName: f.name, size: f.size, useCaseId, status: 'queued' });
    queue.push(() => runOne(store, id, f, useCaseId));
  }
  if (skipped.length) useApp.getState().toast(skipped.length === files.length ? 'These documents are already loaded' : `Skipped ${skipped.length} already-loaded document${skipped.length > 1 ? 's' : ''}`, 'info');
  pump();
}

async function runOne(store: SpecStore, id: string, file: File, useCaseId: string) {
  const { upsertDoc, forceLive } = store.getState();
  upsertDoc({ id, status: 'reading', startedAt: performance.now() });
  try {
    if (file.size > MAX) throw new Error('PDF is larger than 25 MB');
    const buf = await file.arrayBuffer();
    if (buf.byteLength < 5 || new TextDecoder().decode(new Uint8Array(buf, 0, 5)) !== '%PDF-') throw new Error('Not a PDF file');
    const sha256 = hex(await crypto.subtle.digest('SHA-256', buf));
    const ai = useApp.getState().ai?.ai;
    const cached = CACHE[sha256];
    if (cached && !(ai && forceLive)) {
      await wait(900 + Math.random() * 1400); // let the reading animation play
      upsertDoc({ id, sha256, status: 'done', extraction: cached.extraction, source: 'cache' });
      return;
    }
    const r = await postJSON<{ sha256: string; extraction: Extraction; source: 'claude' | 'cache' }>('/api/ecospec/extract', { fileName: file.name, data: b64(buf), useCaseId, force: forceLive });
    upsertDoc({ id, sha256: r.sha256, status: 'done', extraction: r.extraction, source: r.source });
  } catch (e) {
    const msg = (e as Error).message;
    upsertDoc({ id, status: 'error', error: /Failed to fetch|HTTP 50[24]/.test(msg) ? 'API server not reachable: run `npm run dev`. Sample-pack PDFs still work offline.' : msg });
  }
}

export async function loadSamplePack(store: SpecStore, useCaseId: string) {
  const items = SAMPLE_PACK.filter((p) => p.useCaseId === useCaseId);
  const files = await Promise.all(items.map(async (p) => new File([await (await fetch(`/samples/${p.file}`)).blob()], p.file, { type: 'application/pdf' })));
  addFiles(store, files, useCaseId);
}
