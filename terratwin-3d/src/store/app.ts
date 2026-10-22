/* Global UI state (Zustand). Analytics are derived from this state in hooks — nothing heavy is stored here. */
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { SiteKind } from '../data/sites';
import { type Assumptions, DEFAULT_ASSUMPTIONS } from '../data/assumptions';
import { DEFAULT_WEIGHTS, type Weights } from '../lib/solar/evaluate';
import type { PvSpec } from '../lib/solar/modules';

export type Module = 'solar' | 'panelspec' | 'ecospec' | 'dashboard';
export type MapStyleId = 'satellite' | 'night' | 'blueprint';
export interface SunState { month: number; day: number; hour: number }
export interface Layers { heat: boolean; shadows: boolean; panels: boolean; labels: boolean; canopies: boolean }
/** Quantities carried from a SolarTwin car-park canopy design into the Canopy Materials tab (EcoSpec). */
export interface Handoff { siteId: string; siteName: string; paverAreaM2: number; footingConcreteM3: number; columns: number; steelTonnes: number }
/** A SolarTwin PV array (rooftop, home or canopy deck) carried into the Solar Panels tab (PanelSpec); the chosen module is built on it. */
export interface PvHandoff { siteId: string; siteName: string; kind: SiteKind; kwp: number; panels: number }
/** Canopy materials confirmed in the Canopy Materials tab for one car park (product names). */
export interface CanopySpec { concrete?: string; paver?: string }

/** The product already built on a site for a spec use case: its PanelSpec module, or its EcoSpec footings / pavers. */
export function builtProduct(st: { modules: Record<string, PvSpec>; canopySpecs: Record<string, CanopySpec> }, useCaseId: string, siteId: string): string | undefined {
  return useCaseId === 'pv-module' ? st.modules[siteId]?.product : st.canopySpecs[siteId]?.[useCaseId === 'paver-80' ? 'paver' : 'concrete'];
}
/** A panel or material choice confirmed in the Solar Panels or Canopy Materials tab, counted on the Net-Zero dashboard. */
export interface MaterialPick { useCaseId: string; useCase: string; product: string; supplier: string; quantity: number; unit: string; tco2: number; tco2Saved: number; cost: number; premium: number }
export interface Toast { id: number; text: string; tone?: 'ok' | 'info' | 'warn' }

interface AppState {
  started: boolean;
  module: Module;
  mapStyle: MapStyleId;
  tab: SiteKind;
  listQuery: string;
  hideBlockers: boolean;
  selectedId: string | null;
  hoverId: string | null;
  weights: Weights;
  assumptions: Assumptions;
  sun: SunState;
  playing: boolean;
  layers: Layers;
  canopies: string[];
  /** Rooftops and homes whose solar array has been designed in the drawer. */
  arrays: string[];
  portfolio: string[];
  creamPool: string[];
  /** PV module each site is built with, chosen in the Solar Panels tab (site id → module); unset sites use the mono PERC baseline. */
  modules: Record<string, PvSpec>;
  /** Footing concrete and pavers each canopy is built with, chosen in the Canopy Materials tab (car park id → products). */
  canopySpecs: Record<string, CanopySpec>;
  handoff: Handoff | null;
  pvHandoff: PvHandoff | null;
  picks: MaterialPick[];
  ai: { ai: boolean; model: string } | null;
  copilotOpen: boolean;
  demoStep: number | null;
  assumptionsOpen: boolean;
  toasts: Toast[];
  set: (p: Partial<AppState>) => void;
  select: (id: string | null, kind?: SiteKind) => void;
  setWeight: (k: keyof Weights, v: number) => void;
  setAssumption: (k: keyof Assumptions, v: number) => void;
  setSun: (p: Partial<SunState>) => void;
  toggleLayer: (k: keyof Layers, v?: boolean) => void;
  toggleIn: (key: 'canopies' | 'arrays' | 'portfolio' | 'creamPool', id: string, on?: boolean) => void;
  setModule: (id: string, m: PvSpec | null) => void;
  setCanopySpec: (id: string, part: keyof CanopySpec, product: string) => void;
  addPick: (p: MaterialPick) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
}

const now = new Date();
let toastId = 0;

export const useApp = create<AppState>((set, get) => ({
  started: false,
  module: 'solar',
  mapStyle: 'satellite',
  tab: 'roof',
  listQuery: '',
  hideBlockers: false,
  selectedId: null,
  hoverId: null,
  weights: { ...DEFAULT_WEIGHTS },
  assumptions: { ...DEFAULT_ASSUMPTIONS },
  sun: { month: now.getMonth() + 1, day: now.getDate(), hour: 10.5 },
  playing: false,
  layers: { heat: true, shadows: true, panels: true, labels: true, canopies: true },
  canopies: [],
  arrays: [],
  portfolio: [],
  creamPool: [],
  modules: {},
  canopySpecs: {},
  handoff: null,
  pvHandoff: null,
  picks: [],
  ai: null,
  copilotOpen: false,
  demoStep: null,
  assumptionsOpen: false,
  toasts: [],
  set: (p) => set(p),
  select: (id, kind) => set(kind ? { selectedId: id, tab: kind } : { selectedId: id }),
  setWeight: (k, v) => set({ weights: { ...get().weights, [k]: v } }),
  setAssumption: (k, v) => set({ assumptions: { ...get().assumptions, [k]: v } }),
  setSun: (p) => set({ sun: { ...get().sun, ...p } }),
  toggleLayer: (k, v) => set({ layers: { ...get().layers, [k]: v ?? !get().layers[k] } }),
  toggleIn: (key, id, on) => {
    const cur = get()[key], has = cur.includes(id), want = on ?? !has;
    if (want !== has) set({ [key]: want ? [...cur, id] : cur.filter((x) => x !== id) } as Partial<AppState>);
  },
  setModule: (id, m) => {
    const next = { ...get().modules };
    if (m) next[id] = m; else delete next[id];
    set({ modules: next });
  },
  setCanopySpec: (id, part, product) => set({ canopySpecs: { ...get().canopySpecs, [id]: { ...get().canopySpecs[id], [part]: product } } }),
  addPick: (p) => set({ picks: [...get().picks.filter((x) => x.useCaseId !== p.useCaseId), p] }),
  toast: (text, tone = 'ok') => {
    const t = { id: ++toastId, text, tone };
    set({ toasts: [...get().toasts, t] });
    setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== t.id) }), 3800);
  },
}));

/** Subscribe to just these keys (shallow-compared), so a component doesn't re-render on every sun-playback frame. */
export function useAppPick<K extends keyof AppState>(...keys: K[]): Pick<AppState, K> {
  return useApp(useShallow((s) => {
    const o = {} as Pick<AppState, K>;
    for (const k of keys) o[k] = s[k];
    return o;
  }));
}
