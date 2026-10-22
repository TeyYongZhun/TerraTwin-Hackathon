/* Client for the TerraTwin API (Express + Claude). Every call has an offline path so the demo never breaks. */

export interface Health { ai: boolean; model: string }

export async function getHealth(): Promise<Health> {
  try {
    const r = await fetch('/api/health');
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as Health;
  } catch {
    return { ai: false, model: 'offline' };
  }
}

export async function postJSON<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `HTTP ${r.status}`);
  return data as T;
}

/** Server-sent events: `data: {"type":"delta","text":…}` … `data: {"type":"done"}` or `{"type":"error","message":…}`.
    `reset` means a fallback model took over mid-stream, so the partial text so far must be discarded. */
export async function streamSSE(url: string, body: unknown, onText: (chunk: string) => void, signal?: AbortSignal, onReset?: () => void): Promise<void> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!r.ok || !r.body) {
    const data = await r.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `HTTP ${r.status}`);
  }
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const ev = JSON.parse(line.slice(5).trim()) as { type: string; text?: string; message?: string };
      if (ev.type === 'delta' && ev.text) onText(ev.text);
      else if (ev.type === 'reset') onReset?.();
      else if (ev.type === 'error') throw new Error(ev.message || 'Stream error');
      else if (ev.type === 'done') return;
    }
  }
}

/** Plays back pre-written text as if streamed (offline mode). */
export async function typeOut(text: string, onText: (chunk: string) => void, signal?: AbortSignal) {
  const words = text.split(/(\s+)/);
  for (let i = 0; i < words.length; i += 3) {
    if (signal?.aborted) return;
    onText(words.slice(i, i + 3).join(''));
    await new Promise((r) => setTimeout(r, 18));
  }
}
