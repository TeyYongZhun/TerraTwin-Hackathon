/* Re-extracts the sample supplier pack with live Claude and overwrites the demo cache, so the offline demo replays
   real model output. Requires ANTHROPIC_API_KEY in .env. Run: npm run precompute (after npm run make:pdfs). */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MODEL, aiEnabled, toAiError } from '../server/claude';
import { extractWithClaude } from '../server/routes/ecospec';
import { SAMPLE_DOCS } from './sample-pack';

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
if (!aiEnabled()) {
  console.error('ANTHROPIC_API_KEY is not set (terratwin-3d/.env). The bundled cache keeps the sample pack ground truth.');
  process.exit(1);
}
const cacheFile = root('src/data/ecospec/sample-extractions.json');
const cache = JSON.parse(readFileSync(cacheFile, 'utf8')) as Record<string, unknown>;
let ok = 0;
for (const doc of SAMPLE_DOCS) {
  const bytes = readFileSync(root(`public/samples/${doc.file}`));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  try {
    const t0 = Date.now();
    const extraction = await extractWithClaude(bytes.toString('base64'), doc.file, doc.useCaseId);
    cache[sha256] = { fileName: doc.file, useCaseId: doc.useCaseId, source: `claude ${MODEL}`, extraction };
    ok++;
    console.log(`  ✔ ${doc.file} (${((Date.now() - t0) / 1000).toFixed(1)}s) · ${extraction.claims.length} claims · GWP ${extraction.gwp.value} ${extraction.gwp.declared_unit}`);
  } catch (e) {
    console.error(`  ✖ ${doc.file}: ${toAiError(e).message}`);
  }
}
writeFileSync(cacheFile, JSON.stringify(cache, null, 1));
console.log(`${ok}/${SAMPLE_DOCS.length} extractions refreshed from ${MODEL} → ${cacheFile}`);
