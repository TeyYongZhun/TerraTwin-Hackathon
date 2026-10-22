/* SolarTwin: streamed AI feasibility brief for one site. */
import { Router } from 'express';
import { z } from 'zod';
import { aiEnabled, streamText } from '../claude';
import { BRIEF_SYSTEM } from '../prompts';

const BriefBody = z.object({ site: z.object({ name: z.string().max(200) }).passthrough(), metrics: z.object({}).passthrough(), redFlags: z.array(z.object({}).passthrough()).max(40) }).passthrough();

export const solartwin = Router();

solartwin.post('/brief', async (req, res) => {
  const body = BriefBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid request' });
  const user = JSON.stringify(body.data);
  if (user.length > 40_000) return res.status(413).json({ error: 'Payload too large' });
  if (!aiEnabled()) return res.status(503).json({ error: 'AI not configured', code: 'no_ai' });
  await streamText(res, { system: BRIEF_SYSTEM, user: `Write the feasibility brief for this site:\n\n${user}`, maxTokens: 3000 });
});
