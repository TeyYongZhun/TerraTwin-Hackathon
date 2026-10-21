/* Evaluates every site under the current weights / assumptions and ranks them within each kind. */
import { useMemo } from 'react';
import { type Site, type SiteKind, getSites } from '../data/sites';
import type { Assumptions } from '../data/assumptions';
import { type Evaluation, type Weights, evaluateSite } from '../lib/solar/evaluate';
import { useApp } from '../store/app';

export interface Ranked { site: Site; ev: Evaluation; rank: number; /** percentile within its kind, 1 = best */ pct: number }
export interface KindTotals { sites: number; kwp: number; mwh: number; tco2: number; capex: number; homes: number }
export interface Analytics {
  byKind: Record<SiteKind, Ranked[]>; byId: Map<string, Ranked>;
  totals: Record<SiteKind, KindTotals>; township: KindTotals;
}

const KINDS: SiteKind[] = ['roof', 'carpark', 'home'];

export function computeAnalytics(w: Weights, A: Assumptions): Analytics {
  const byKind: Record<SiteKind, Ranked[]> = { roof: [], carpark: [], home: [] }, byId = new Map<string, Ranked>();
  for (const site of getSites().sites) {
    const r: Ranked = { site, ev: evaluateSite(site, w, A), rank: 0, pct: 0 };
    byKind[site.kind].push(r);
    byId.set(site.id, r);
  }
  const zero = (): KindTotals => ({ sites: 0, kwp: 0, mwh: 0, tco2: 0, capex: 0, homes: 0 });
  const totals = { roof: zero(), carpark: zero(), home: zero() }, township = zero();
  for (const k of KINDS) {
    const arr = byKind[k].sort((a, b) => b.ev.score - a.ev.score);
    arr.forEach((r, i) => {
      r.rank = i + 1;
      r.pct = arr.length > 1 ? 1 - i / (arr.length - 1) : 1;
      for (const t of [totals[k], township]) {
        t.sites++; t.kwp += r.site.kwp; t.mwh += r.ev.annualKwh / 1000; t.tco2 += r.ev.finance.tco2; t.capex += r.ev.finance.capex; t.homes += r.site.homes;
      }
    });
  }
  return { byKind, byId, totals, township };
}

export function useAnalytics(): Analytics {
  const weights = useApp((s) => s.weights), assumptions = useApp((s) => s.assumptions);
  return useMemo(() => computeAnalytics(weights, assumptions), [weights, assumptions]);
}
