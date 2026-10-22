/* TerraTwin Copilot: natural language → strict tool calls that the client executes on the 3D app. */
import { Router } from 'express';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { COPILOT_TOOLS } from '../../src/lib/copilot/tools';
import { FALLBACK, MODEL, aiEnabled, claude, toAiError } from '../claude';
import { COPILOT_SYSTEM } from '../prompts';

const Body = z.object({
  message: z.string().min(1).max(1000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).max(10).optional(),
  context: z.object({}).passthrough(),
});

export const copilot = Router();

copilot.post('/', async (req, res) => {
  const body = Body.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid request' });
  const context = JSON.stringify(body.data.context);
  if (context.length > 30_000) return res.status(413).json({ error: 'Context too large' });
  if (!aiEnabled()) return res.status(503).json({ error: 'AI not configured', code: 'no_ai' });
  try {
    const msg = await claude().beta.messages.create({
      model: MODEL, max_tokens: 4000, ...FALLBACK,
      output_config: { effort: 'low' },
      system: `${COPILOT_SYSTEM}\n\nCurrent app context (JSON):\n${context}`,
      tools: COPILOT_TOOLS as unknown as Anthropic.Beta.BetaToolUnion[],
      tool_choice: { type: 'auto' },
      messages: [...(body.data.history ?? []), { role: 'user', content: body.data.message }],
    });
    if (msg.stop_reason === 'refusal') return res.json({ reply: 'Claude declined that request.', actions: [], model: msg.model });
    const actions = msg.content.filter((b) => b.type === 'tool_use').map((b) => ({ name: b.name, input: b.input }));
    const reply = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
    res.json({ reply: reply || (actions.length ? 'Done.' : ''), actions, model: msg.model });
  } catch (e) {
    const err = toAiError(e);
    console.error('[copilot]', err.code, err.message);
    res.status(err.status).json({ error: err.message, code: err.code });
  }
});
