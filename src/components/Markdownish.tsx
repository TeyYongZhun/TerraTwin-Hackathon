/* Tiny renderer for the subset of Markdown the AI briefs use (## headings, - bullets, **bold**, _italic_). */
import type { ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>
      : p.length > 2 && p.startsWith('_') && p.endsWith('_') ? <em key={i} className="text-slate-400">{p.slice(1, -1)}</em> : p);
}

export function Markdownish({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-slate-300">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (b.startsWith('## ')) return <h4 key={i} className="pt-1 text-sm font-semibold text-white">{inline(b.slice(3))}</h4>;
        if (b.startsWith('# ')) return <h3 key={i} className="text-base font-bold text-white">{inline(b.slice(2))}</h3>;
        if (lines.every((l) => /^[-*] /.test(l))) return <ul key={i} className="list-disc space-y-1 pl-4">{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>;
        return <p key={i}>{lines.map((l, j) => (/^[-*] /.test(l) ? <span key={j} className="block pl-3">• {inline(l.slice(2))}</span> : <span key={j}>{inline(l)}{j < lines.length - 1 && ' '}</span>))}</p>;
      })}
    </div>
  );
}
