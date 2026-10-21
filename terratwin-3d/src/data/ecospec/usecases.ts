/* EcoSpec AI use cases: a functional unit, the performance gate every candidate must pass, and a conventional
   reference for carbon and cost savings. Thresholds are illustrative project specifications, not SDP standards. */
import type { SpecKey } from '../../lib/ecospec/schema';

export interface Requirement { key: SpecKey; label: string; op: '>=' | '<='; value: number; unit: string; why: string }
export interface UseCase {
  id: 'concrete-c30' | 'paver-80';
  title: string; short: string; fu: 'm3' | 'm2'; fuLabel: string;
  description: string;
  requirements: Requirement[];
  /** Conventional reference: OPC concrete / standard grey paver. */
  baseline: { label: string; gwp: number; price: number };
  /** Which SolarTwin canopy quantity feeds this use case. */
  handoffQty: 'footingConcreteM3' | 'paverAreaM2';
  defaultQty: number;
  /** Fallback thickness/density used only when a per-tonne GWP must be normalised and the document omits them. */
  normalise: { thicknessMm?: number; densityKgM3?: number };
}

export const USE_CASES: UseCase[] = [
  {
    id: 'concrete-c30', title: 'Ready-mix concrete, Grade C30', short: 'Concrete C30', fu: 'm3', fuLabel: 'm³',
    description: 'Pad footings for solar-carport columns. Any mix must meet the structural grade and durability limit; then the lowest verified carbon wins.',
    requirements: [
      { key: 'compressive_strength_mpa', label: '28-day cube strength', op: '>=', value: 30, unit: 'MPa', why: 'Grade C30 structural footing' },
      { key: 'water_cement_ratio', label: 'Max water/binder ratio', op: '<=', value: 0.55, unit: '', why: 'Durability for buried footings' },
    ],
    baseline: { label: 'Conventional OPC C30 (sector average)', gwp: 318, price: 278 },
    handoffQty: 'footingConcreteM3', defaultQty: 180, normalise: { densityKgM3: 2400 },
  },
  {
    id: 'paver-80', title: 'Interlocking concrete pavers, 80 mm', short: 'Pavers 80 mm', fu: 'm2', fuLabel: 'm²',
    description: 'Vehicular-grade paving under the solar canopies. Strength, absorption and wet slip resistance are mandatory.',
    requirements: [
      { key: 'compressive_strength_mpa', label: 'Compressive strength', op: '>=', value: 49, unit: 'MPa', why: 'Vehicular traffic (BS 6717-style spec)' },
      { key: 'water_absorption_pct', label: 'Water absorption', op: '<=', value: 6, unit: '%', why: 'Freeze-free durability, EN 1338 class-2 style' },
      { key: 'slip_resistance_ptv', label: 'Wet slip resistance', op: '>=', value: 40, unit: 'PTV', why: 'Pedestrian safety in car parks' },
    ],
    baseline: { label: 'Standard grey 80 mm paver', gwp: 24, price: 36 },
    handoffQty: 'paverAreaM2', defaultQty: 14800, normalise: { thicknessMm: 80, densityKgM3: 2250 },
  },
];

export const useCaseById = (id: string) => USE_CASES.find((u) => u.id === id) ?? USE_CASES[0];
