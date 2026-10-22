import { useMemo } from 'react';
import { useSpecStore } from '../../store/ecospec';
import { useCaseById } from '../../data/ecospec/usecases';
import { rankCandidates } from '../../lib/ecospec/rank';
import { useAppPick } from '../../store/app';

/** Ranked candidates for the current use case, quantity, premium cap and score weights. */
export function useRanking() {
  const { useCaseId, qty, docs, premiumCap, weights } = useSpecStore()();
  const { pvHandoff, assumptions } = useAppPick('pvHandoff', 'assumptions');
  const kind = pvHandoff?.kind ?? 'roof';
  const uc = useCaseById(useCaseId), q = qty[useCaseId];
  return useMemo(() => {
    const cands = docs.filter((d) => d.useCaseId === useCaseId && d.status === 'done' && d.extraction)
      .map((d) => ({ id: d.id, fileName: d.fileName, ex: d.extraction!, source: d.source ?? 'cache' }));
    return { uc, qty: q, ...rankCandidates(uc, q, cands, { premiumCapPct: premiumCap, weights, pv: { kind, assumptions } }) };
  }, [uc, q, docs, useCaseId, premiumCap, weights, kind, assumptions]);
}
