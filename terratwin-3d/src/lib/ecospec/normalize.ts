/* Converts declared carbon and price into the use case's functional unit (per m³ or per m²), or marks the value
   "not comparable". Conversions use the document's own mass / density / thickness first; a use-case default is
   used only as a last resort and is flagged as an assumption. */
import type { Extraction } from './schema';
import type { UseCase } from '../../data/ecospec/usecases';

export interface Normalized {
  gwp: number | null; gwpNote: string; gwpAssumed: boolean;
  price: number | null; priceNote: string;
}

type Basis = 'm3' | 'm2' | 't' | 'kg' | null;
export function unitBasis(unit: string | null): Basis {
  if (!unit) return null;
  const u = unit.toLowerCase().replace(/\s+/g, '').replace('³', '3').replace('²', '2');
  if (/(per|\/)(1)?m3|m3$/.test(u)) return 'm3';
  if (/(per|\/)(1)?m2|m2$/.test(u)) return 'm2';
  if (/(per|\/)(1)?(t|tonne|ton|1000kg)$/.test(u) || /pertonne/.test(u)) return 't';
  if (/(per|\/)(1)?kg$/.test(u)) return 'kg';
  return null;
}

const r = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export function normalize(ex: Extraction, uc: UseCase): Normalized {
  const s = ex.specs;
  let gwp: number | null = null, gwpNote = '', gwpAssumed = false;
  const basis = unitBasis(ex.gwp.declared_unit);
  const v = ex.gwp.value;
  if (v === null) gwpNote = 'No GWP stated';
  else if (basis === uc.fu) { gwp = v; gwpNote = `Declared per ${uc.fuLabel}`; }
  else if (basis === 't' || basis === 'kg') {
    const perKg = basis === 't' ? v / 1000 : v;
    if (uc.fu === 'm2') {
      let mass = s.mass_per_m2_kg.value, how = 'stated mass per m²';
      if (mass === null && s.density_kg_m3.value !== null && s.thickness_mm.value !== null) { mass = s.density_kg_m3.value * (s.thickness_mm.value / 1000); how = 'density × thickness'; }
      if (mass === null && uc.normalise.densityKgM3 && uc.normalise.thicknessMm) { mass = uc.normalise.densityKgM3 * (uc.normalise.thicknessMm / 1000); how = 'assumed density × thickness'; gwpAssumed = true; }
      if (mass !== null) { gwp = r(perKg * mass); gwpNote = `${v} kgCO₂e/${basis === 't' ? 't' : 'kg'} × ${r(mass, 0)} kg/m² (${how})`; }
    } else {
      let dens = s.density_kg_m3.value, how = 'stated density';
      if (dens === null && uc.normalise.densityKgM3) { dens = uc.normalise.densityKgM3; how = 'assumed density'; gwpAssumed = true; }
      if (dens !== null) { gwp = r(perKg * dens); gwpNote = `${v} kgCO₂e/${basis === 't' ? 't' : 'kg'} × ${dens} kg/m³ (${how})`; }
    }
  }
  if (v !== null && gwp === null) gwpNote = `Declared unit "${ex.gwp.declared_unit ?? 'unknown'}" cannot be converted to per ${uc.fuLabel}: not comparable`;

  let price: number | null = null, priceNote = '';
  const pb = unitBasis(ex.price.unit);
  if (ex.price.value === null) priceNote = 'No price stated';
  else if (pb === uc.fu || pb === null) { price = ex.price.value; priceNote = pb ? `RM per ${uc.fuLabel}` : 'Unit not stated: assumed per functional unit'; }
  else priceNote = `Price unit "${ex.price.unit}" is not per ${uc.fuLabel}: not comparable`;
  return { gwp, gwpNote, gwpAssumed, price, priceNote };
}
