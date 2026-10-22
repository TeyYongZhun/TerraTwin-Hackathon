/* PV module physics for building a site with the module chosen in the Solar Panels tab. Mono PERC 550 W is the baseline the
   screening (precompute, CAPEX, yield) is built on. A chosen module re-sizes the array on the same usable area by its
   efficiency, changes the yield by its temperature coefficient and adds its price premium to CAPEX. */
import type { Site, SiteKind } from '../../data/sites';
import type { Assumptions } from '../../data/assumptions';
import { useCaseById } from '../../data/ecospec/usecases';
import type { Extraction } from '../ecospec/schema';
import type { Normalized } from '../ecospec/normalize';

export type PvTech = 'perc' | 'topcon' | 'hjt' | 'thin_film';
export interface PvSpec {
  product: string; supplier: string; tech: PvTech; watt: number;
  /** Module efficiency at STC (fraction) */ efficiency: number;
  /** Temperature coefficient of Pmax (%/°C) */ tempCoeff: number;
  /** Normalised embodied carbon (kgCO₂e/kWp) and module price (RM/kWp) */ gwpPerKwp: number; pricePerKwp: number;
  /** The standard reference module, picked in the Solar Panels tab in place of a supplier's. */ standard?: boolean;
}

const PV = useCaseById('pv-module').baseline;
/** The reference module: the screening's 550 W panel, priced and carbon-rated as EcoSpec's PV baseline. */
export const BASE_MODULE: PvSpec = {
  product: 'Mono PERC 550 W (baseline)', supplier: '', tech: 'perc', watt: 550, efficiency: 550 / (2.278 * 1.134 * 1000), tempCoeff: -0.35,
  gwpPerKwp: PV.gwp, pricePerKwp: PV.price,
};
export const moduleOf = (m?: PvSpec | null) => m ?? BASE_MODULE;

export const TECH_LABEL: Record<PvTech, string> = { perc: 'Mono PERC', topcon: 'TOPCon', hjt: 'HJT', thin_film: 'Thin-film' };
/** Panel colour in 3D: dark enough to read as PV, light enough to stand out on asphalt and under dusk lighting. */
export const TECH_COLOR: Record<PvTech, string> = { perc: '#1d4ed8', topcon: '#1e40af', hjt: '#4338ca', thin_film: '#7c5a36' };

/** Cell technology from the product name, else from its datasheet physics (only used for labels and colour). */
export function pvTech(name: string, efficiency: number, tempCoeff: number): PvTech {
  if (/hjt|heterojunction/i.test(name)) return 'hjt';
  if (/topcon/i.test(name)) return 'topcon';
  if (/cdte|cigs|thin[- ]?film/i.test(name)) return 'thin_film';
  if (/perc/i.test(name)) return 'perc';
  return efficiency < 0.205 ? 'thin_film' : tempCoeff >= -0.27 ? 'hjt' : tempCoeff >= -0.32 ? 'topcon' : 'perc';
}

/** Irradiance-weighted cell temperature above STC under Klang Valley sun (°C), illustrative. */
const DT_CELL = 25;
/** Share of the baseline CAPEX that scales with area (racking, canopy steel and footings, labour), not with kWp. */
const AREA_SHARE: Record<SiteKind, number> = { roof: 0.25, carpark: 0.55, home: 0.3 };

/** Yield per kWp relative to the baseline module; the specific-yield assumption already includes PERC heat losses. */
export const heatFactor = (m: PvSpec) => (1 + (m.tempCoeff * DT_CELL) / 100) / (1 + (BASE_MODULE.tempCoeff * DT_CELL) / 100);

/** RM per kWp: area-bound costs are spread over the extra watts of a more efficient module, plus its price premium. */
export function capexPerKwp(kind: SiteKind, m: PvSpec, A: Assumptions): number {
  const rate = kind === 'carpark' ? A.capexCanopy : kind === 'home' ? A.capexHome : A.capexRoof;
  return rate * (1 - AREA_SHARE[kind] * (1 - BASE_MODULE.efficiency / m.efficiency)) + m.pricePerKwp - BASE_MODULE.pricePerKwp;
}

/** System cost per kWh generated with this module, relative to the baseline module (1 = same): CAPEX per kWp over yield
    per kWp. A dearer module that fits more power on the same area and loses less to heat can cost less per kWh. */
export function costPerKwhRatio(kind: SiteKind, m: PvSpec, A: Assumptions): number {
  return capexPerKwp(kind, m, A) / heatFactor(m) / capexPerKwp(kind, BASE_MODULE, A);
}

/** The baseline site re-sized for another module on the same usable area: kWp scales with module efficiency. */
export function withModule(base: Site, m: PvSpec): Site {
  const kwp = (base.kwp * m.efficiency) / BASE_MODULE.efficiency;
  return { ...base, kwp, panels: Math.round((kwp * 1000) / m.watt), module: m };
}

/** The module the Solar Panels tab recommended, from its extraction and normalised carbon / price; null if a value is missing. */
export function pvSpecFrom(ex: Extraction, norm: Normalized): PvSpec | null {
  const eff = ex.specs.module_efficiency_pct.value, tc = ex.specs.temp_coefficient_pct_per_c.value;
  if (eff === null || tc === null || norm.gwp === null || norm.price === null) return null;
  return {
    product: ex.product_name, supplier: ex.supplier, tech: pvTech(ex.product_name, eff / 100, tc), watt: ex.specs.module_power_w.value ?? BASE_MODULE.watt,
    efficiency: eff / 100, tempCoeff: tc, gwpPerKwp: norm.gwp, pricePerKwp: norm.price,
  };
}
