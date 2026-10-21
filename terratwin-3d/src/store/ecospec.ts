/* EcoSpec AI state: chosen use case, project quantity, uploaded supplier documents and their extractions. */
import { create } from 'zustand';
import type { Extraction } from '../lib/ecospec/schema';
import { USE_CASES } from '../data/ecospec/usecases';

export type DocStatus = 'queued' | 'reading' | 'done' | 'error';
export interface DocItem {
  id: string; fileName: string; size: number; useCaseId: string; status: DocStatus;
  sha256?: string; extraction?: Extraction; source?: 'claude' | 'cache'; error?: string; startedAt?: number;
}

interface EcoState {
  useCaseId: string; qty: Record<string, number>; step: 1 | 2 | 3 | 4; docs: DocItem[];
  premiumCap: number; forceLive: boolean; memo: string; memoSrc: 'claude' | 'offline' | null;
  set: (p: Partial<EcoState>) => void;
  upsertDoc: (d: Partial<DocItem> & { id: string }) => void;
  removeDoc: (id: string) => void;
}

export const useEco = create<EcoState>((set, get) => ({
  useCaseId: USE_CASES[0].id,
  qty: Object.fromEntries(USE_CASES.map((u) => [u.id, u.defaultQty])),
  step: 1, docs: [], premiumCap: 25, forceLive: false, memo: '', memoSrc: null,
  set: (p) => set(p),
  upsertDoc: (d) => {
    const docs = get().docs, i = docs.findIndex((x) => x.id === d.id);
    set({ docs: i < 0 ? [...docs, d as DocItem] : docs.map((x, j) => (j === i ? { ...x, ...d } : x)) });
  },
  removeDoc: (id) => set({ docs: get().docs.filter((d) => d.id !== id) }),
}));
