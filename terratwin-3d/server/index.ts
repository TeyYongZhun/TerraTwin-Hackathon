/* TerraTwin AI API server. Dev: Vite proxies /api here. Production (`npm start`): also serves the built app. */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { MODEL, aiEnabled } from './claude';
import { ecospec } from './routes/ecospec';
import { solartwin } from './routes/solartwin';
import { copilot } from './routes/copilot';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '36mb' })); // 25 MB PDF ≈ 34 MB base64

app.get('/api/health', (_req, res) => res.json({ ai: aiEnabled(), model: aiEnabled() ? MODEL : 'offline' }));
app.use('/api/ecospec', ecospec);
app.use('/api/solartwin', solartwin);
app.use('/api/copilot', copilot);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
if (process.env.NODE_ENV === 'production' && existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(`${dist}index.html`));
}

app.use((err: Error & { status?: number; type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Upload too large (max 25 MB PDF)' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(err.status ?? 500).json({ error: 'Server error' });
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`TerraTwin API on http://localhost:${port} · AI ${aiEnabled() ? `live (${MODEL})` : 'offline: demo cache only (set ANTHROPIC_API_KEY in .env)'}`);
});
