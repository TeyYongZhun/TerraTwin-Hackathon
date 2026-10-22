/* Spec modules (Canopy Materials, Solar Panels): PDF → structured extraction (Claude, cached by SHA-256) and the streamed procurement memo. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { ExtractionSchema, type Extraction } from '../../src/lib/ecospec/schema';
import { USE_CASES, useCaseById } from '../../src/data/ecospec/usecases';
import bundled from '../../src/data/ecospec/sample-extractions.json';
import { AiError, FALLBACK, MODEL, aiEnabled, claude, streamText, toAiError } from '../claude';
import { EXTRACT_SYSTEM, MEMO_SYSTEM, extractUserPrompt } from '../prompts';

export const MAX_PDF_BYTES = 25 * 1024 * 1024;
const CACHE_DIR = fileURLToPath(new URL('../.cache/extractions/', import.meta.url));
const BUNDLED = bundled as Record<string, { extraction: Extraction; source: string }>;

const ExtractBody = z.object({
  fileName: z.string().min(1).max(200),
  data: z.string().min(8).max(Math.ceil((MAX_PDF_BYTES * 4) / 3) + 16),
  useCaseId: z.enum(USE_CASES.map((u) => u.id) as [string, ...string[]]),
  force: z.boolean().optional(),
});

function readCache(sha: string): { extraction: Extraction; source: string } | null {
  if (BUNDLED[sha]) return BUNDLED[sha];
  const f = `${CACHE_DIR}${sha}.json`;
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

export async function extractWithClaude(pdfBase64: string, fileName: string, useCaseId: string): Promise<Extraction> {
  const uc = useCaseById(useCaseId);
  const reqs = uc.requirements.map((r) => `${r.label} ${r.op} ${r.value}${r.unit ? ' ' + r.unit : ''}`).join('; ') + '; embodied carbon (GWP); unit price; EPD and certificates';
  const msg = await claude().beta.messages.parse({
    model: MODEL, max_tokens: 16000, ...FALLBACK,
    output_config: { effort: 'medium', format: betaZodOutputFormat(ExtractionSchema) },
    system: EXTRACT_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }, title: fileName },
        { type: 'text', text: extractUserPrompt(fileName, uc.title, reqs) },
      ],
    }],
  });
  if (msg.stop_reason === 'refusal') throw new AiError('Claude declined to process this document.', 422, 'refusal');
  if (msg.stop_reason === 'max_tokens') throw new AiError('The extraction was cut off (document too long).', 422, 'max_tokens');
  if (!msg.parsed_output) throw new AiError('Claude returned no parsable extraction.', 502, 'parse');
  return msg.parsed_output;
}

export const ecospec = Router();

ecospec.post('/extract', async (req, res) => {
  const body = ExtractBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid request', details: body.error.issues.slice(0, 3) });
  const { fileName, data, useCaseId, force } = body.data;
  const buf = Buffer.from(data, 'base64');
  if (buf.length > MAX_PDF_BYTES) return res.status(413).json({ error: 'PDF is larger than 25 MB' });
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return res.status(415).json({ error: 'Not a PDF file' });
  const sha256 = createHash('sha256').update(buf).digest('hex');

  const cached = force ? null : readCache(sha256);
  if (cached) return res.json({ sha256, extraction: cached.extraction, source: 'cache', cacheSource: cached.source });
  if (!aiEnabled()) return res.status(503).json({ error: 'Live extraction needs an Anthropic API key: add ANTHROPIC_API_KEY to .env in the project root and restart.', code: 'no_ai' });

  try {
    const extraction = await extractWithClaude(buf.toString('base64'), fileName, useCaseId);
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(`${CACHE_DIR}${sha256}.json`, JSON.stringify({ fileName, useCaseId, source: `claude ${MODEL}`, extraction }, null, 1));
    res.json({ sha256, extraction, source: 'claude', model: MODEL });
  } catch (e) {
    const err = toAiError(e);
    console.error('[extract]', fileName, err.code, err.message);
    res.status(err.status).json({ error: err.message, code: err.code });
  }
});

const MemoBody = z.object({ useCase: z.string().max(200), quantity: z.number(), unit: z.string().max(10) }).passthrough();
ecospec.post('/memo', async (req, res) => {
  const body = MemoBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid request' });
  const user = JSON.stringify(body.data);
  if (user.length > 60_000) return res.status(413).json({ error: 'Payload too large' });
  if (!aiEnabled()) return res.status(503).json({ error: 'AI not configured', code: 'no_ai' });
  await streamText(res, { system: MEMO_SYSTEM, user: `Write the memo for this ranked comparison:\n\n${user}` });
});
