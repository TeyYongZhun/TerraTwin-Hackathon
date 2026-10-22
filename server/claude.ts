/* Claude client, shared request options, SSE streaming and typed error mapping. */
import Anthropic from '@anthropic-ai/sdk';
import type { Response } from 'express';

export const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
/** Server-side refusal fallback: a declined request is re-run on Anthropic's recommended fallback model. */
export const FALLBACK: { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: 'default' } = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };

/** The SDK resolves credentials itself (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an `ant auth` profile). */
export const aiEnabled = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.TERRATWIN_AI === '1');

let client: Anthropic | null = null;
export const claude = () => (client ??= new Anthropic());

export class AiError extends Error {
  constructor(message: string, public status = 502, public code = 'ai_error') { super(message); }
}

/** Map SDK errors to an HTTP status + user-safe message. Most specific first. */
export function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new AiError('Anthropic API key rejected — check ANTHROPIC_API_KEY in .env', 401, 'auth');
  if (e instanceof Anthropic.RateLimitError) return new AiError('Claude rate limit reached — retry shortly', 429, 'rate_limit');
  if (e instanceof Anthropic.BadRequestError) return new AiError(`Claude rejected the request: ${e.message}`, 400, 'bad_request');
  if (e instanceof Anthropic.APIError) return new AiError(`Claude API error ${e.status ?? ''}: ${e.message}`, 502, 'api_error');
  if (e instanceof Anthropic.APIConnectionError) return new AiError('Could not reach the Claude API', 503, 'connection');
  return new AiError(e instanceof Error ? e.message : 'Unknown AI error', 500);
}

/** Stream a text response as SSE frames: delta / reset (a fallback model took over) / done / error. */
export async function streamText(res: Response, params: { system: string; user: string; maxTokens?: number }) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const send = (o: object) => res.write(`data: ${JSON.stringify(o)}\n\n`);
  const stream = claude().beta.messages.stream({
    model: MODEL, max_tokens: params.maxTokens ?? 4000, ...FALLBACK,
    output_config: { effort: 'low' },
    system: params.system,
    messages: [{ role: 'user', content: params.user }],
  });
  res.on('close', () => stream.abort());
  stream.on('streamEvent', (ev) => {
    // A mid-stream decline hands over to the fallback model: tell the client to discard the partial text.
    if (ev.type === 'content_block_start' && ev.content_block.type === 'fallback') send({ type: 'reset', model: ev.content_block.to.model });
  });
  stream.on('text', (text) => send({ type: 'delta', text }));
  try {
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') send({ type: 'error', message: 'Claude declined this request.' });
    else send({ type: 'done', model: final.model, stop: final.stop_reason });
  } catch (e) {
    if (!res.writableEnded) send({ type: 'error', message: toAiError(e).message });
  }
  res.end();
}
