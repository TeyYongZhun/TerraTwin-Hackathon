/* Writes the FICTITIOUS sample supplier pack to public/samples/*.pdf and the matching demo cache
   (src/data/ecospec/sample-extractions.json, keyed by SHA-256 of each PDF). Run: npm run make:pdfs
   The cache holds the pack's ground truth so the demo works offline; `npm run precompute` replaces it with
   live Claude extractions when an API key is configured. */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { ExtractionSchema } from '../src/lib/ecospec/schema';
import { SAMPLE_DOCS, type SampleDoc, groundTruth } from './sample-pack';

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const FIXED = new Date('2026-09-01T00:00:00Z');

async function render(doc: SampleDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${doc.product} - ${doc.docTitle}`);
  pdf.setAuthor(`${doc.supplier} (fictitious)`);
  pdf.setSubject('FICTITIOUS TEST DATA for the TerraTwin AI hackathon demo');
  pdf.setProducer('TerraTwin AI sample pack');
  pdf.setCreator('TerraTwin AI sample pack');
  pdf.setCreationDate(FIXED);
  pdf.setModificationDate(FIXED);
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  doc.pages.forEach((pg, i) => {
    const page = pdf.addPage([595, 842]);
    const green = doc.useCaseId === 'paver-80' ? rgb(0.13, 0.45, 0.4) : rgb(0.2, 0.3, 0.5);
    page.drawRectangle({ x: 0, y: 772, width: 595, height: 70, color: green });
    page.drawText(doc.supplier, { x: 40, y: 810, size: 16, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`${doc.product}  |  ${doc.docTitle}`, { x: 40, y: 790, size: 10, font, color: rgb(0.9, 0.95, 0.95) });
    page.drawText('FICTITIOUS TEST DATA', { x: 150, y: 330, size: 46, font: bold, color: rgb(0.85, 0.2, 0.2), opacity: 0.12, rotate: degrees(35) });
    let y = 735;
    page.drawText(pg.title, { x: 40, y, size: 14, font: bold, color: rgb(0.1, 0.1, 0.12) });
    y -= 28;
    const paras = () => {
      for (const p of pg.paras ?? []) { page.drawText(p, { x: 40, y, size: pg.parasFirst ? 13 : 10.5, font: pg.parasFirst ? bold : font, color: rgb(0.15, 0.15, 0.2) }); y -= pg.parasFirst ? 24 : 20; }
      y -= 8;
    };
    const rows = () => {
      for (const r of pg.rows ?? []) {
        page.drawLine({ start: { x: 40, y: y - 6 }, end: { x: 555, y: y - 6 }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) });
        page.drawText(`${r.label}: ${r.value}`, { x: 44, y, size: 10.5, font, color: rgb(0.1, 0.1, 0.12) });
        y -= 22;
      }
      y -= 8;
    };
    if (pg.parasFirst) { paras(); rows(); } else { rows(); paras(); }
    page.drawText(`${doc.supplier} is a fictitious company. All values are invented test data.  Page ${i + 1} of ${doc.pages.length}`, { x: 40, y: 30, size: 8, font, color: rgb(0.45, 0.45, 0.5) });
  });
  return pdf.save({ useObjectStreams: false });
}

const outDir = root('public/samples');
mkdirSync(outDir, { recursive: true });
mkdirSync(root('src/data/ecospec'), { recursive: true });
const cache: Record<string, { fileName: string; useCaseId: string; source: string; extraction: unknown }> = {};
const manifest: { file: string; useCaseId: string; supplier: string; product: string; sha256: string; bytes: number }[] = [];
for (const doc of SAMPLE_DOCS) {
  const bytes = await render(doc);
  writeFileSync(`${outDir}/${doc.file}`, bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const extraction = ExtractionSchema.parse(groundTruth(doc));
  cache[sha256] = { fileName: doc.file, useCaseId: doc.useCaseId, source: 'sample-pack ground truth', extraction };
  manifest.push({ file: doc.file, useCaseId: doc.useCaseId, supplier: doc.supplier, product: doc.product, sha256, bytes: bytes.length });
  console.log(`  ${doc.file.padEnd(34)} ${sha256.slice(0, 12)}…  ${bytes.length} B`);
}
writeFileSync(root('src/data/ecospec/sample-extractions.json'), JSON.stringify(cache, null, 1));
writeFileSync(root('src/data/ecospec/sample-pack.json'), JSON.stringify(manifest, null, 1));
console.log(`✔ ${SAMPLE_DOCS.length} PDFs → public/samples, cache → src/data/ecospec/sample-extractions.json`);
