import { useMemo } from 'react';
import { useEco } from '../../store/ecospec';
import { useCaseById } from '../../data/ecospec/usecases';
import { rankCandidates } from '../../lib/ecospec/rank';

/** Ranked candidates for the current use case, quantity and premium cap. */
export function useRanking() {
  const { useCaseId, qty, docs, premiumCap } = useEco();
  const uc = useCaseById(useCaseId), q = qty[useCaseId];
  return useMemo(() => {
    const cands = docs.filter((d) => d.useCaseId === useCaseId && d.status === 'done' && d.extraction)
      .map((d) => ({ id: d.id, fileName: d.fileName, ex: d.extraction!, source: d.source ?? 'cache' }));
    return { uc, qty: q, ...rankCandidates(uc, q, cands, { premiumCapPct: premiumCap }) };
  }, [uc, q, docs, useCaseId, premiumCap]);
}
