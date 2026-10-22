/* Spec-module state: chosen use case, project quantity, uploaded supplier documents and their extractions. EcoSpec
   (the Canopy Materials tab) and PanelSpec (the Solar Panels tab) each have their own store; the step screens read
   whichever store `SpecContext` provides. */
import { createContext, useContext } from 'react';
import { type StoreApi, type UseBoundStore, create } from 'zustand';
import type { Extraction } from '../lib/ecospec/schema';
import { USE_CASES, type UseCase } from '../data/ecospec/usecases';
import { DEFAULT_SCORE_WEIGHTS, type ScoreWeights } from '../lib/ecospec/rank';

export type DocStatus = 'queued' | 'reading' | 'done' | 'error';
export interface DocItem {
  id: string; fileName: string; size: number; useCaseId: string; status: DocStatus;
  sha256?: string; extraction?: Extraction; source?: 'claude' | 'cache'; error?: string; startedAt?: number;
}

interface EcoState {
  /** Use cases this module offers. */
  useCaseIds: UseCase['id'][];
  useCaseId: string; qty: Record<string, number>; step: 1 | 2 | 3 | 4; docs: DocItem[];
  premiumCap: number; weights: ScoreWeights; forceLive: boolean; memo: string; memoSrc: 'claude' | 'offline' | null;
  set: (p: Partial<EcoState>) => void;
  upsertDoc: (d: Partial<DocItem> & { id: string }) => void;
  removeDoc: (id: string) => void;
}
export type SpecStore = UseBoundStore<StoreApi<EcoState>>;

function createSpecStore(useCaseIds: UseCase['id'][]): SpecStore {
  return create<EcoState>((set, get) => ({
    useCaseIds, useCaseId: useCaseIds[0],
    qty: Object.fromEntries(USE_CASES.filter((u) => useCaseIds.includes(u.id)).map((u) => [u.id, u.defaultQty])),
    step: 1, docs: [], premiumCap: 25, weights: { ...DEFAULT_SCORE_WEIGHTS }, forceLive: false, memo: '', memoSrc: null,
    set: (p) => set(p),
    upsertDoc: (d) => {
      const docs = get().docs, i = docs.findIndex((x) => x.id === d.id);
      set({ docs: i < 0 ? [...docs, d as DocItem] : docs.map((x, j) => (j === i ? { ...x, ...d } : x)) });
    },
    removeDoc: (id) => set({ docs: get().docs.filter((d) => d.id !== id) }),
  }));
}

/** EcoSpec: the Canopy Materials tab (car-park footing concrete and pavers). */
export const useEco = createSpecStore(['concrete-c30', 'paver-80']);
/** PanelSpec: the Solar Panels tab (PV modules). */
export const usePanelSpec = createSpecStore(['pv-module']);

export const SpecContext = createContext<SpecStore>(useEco);
/** The store of the spec module being rendered. */
export const useSpecStore = () => useContext(SpecContext);
