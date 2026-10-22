/* Spec use cases for the Canopy Materials and Solar Panels tabs: a functional unit, the performance gate every
   candidate must pass, and a conventional reference for carbon and cost savings. Thresholds are illustrative project
   specifications, not SDP standards. */
import type { SpecKey } from '../../lib/ecospec/schema';

export interface Requirement { key: SpecKey; label: string; op: '>=' | '<='; value: number; unit: string; why: string }
export interface UseCase {
  id: 'concrete-c30' | 'paver-80' | 'pv-module';
  title: string; short: string; fu: 'm3' | 'm2' | 'kWp'; fuLabel: string;
  description: string;
  requirements: Requirement[];
  /** The headline performance spec (one of the requirements): drawn as the third bar and scored. */
  performance: { key: SpecKey; label: string };
  /** Conventional reference: OPC concrete / standard grey paver / mono PERC module. */
  baseline: { label: string; gwp: number; price: number };
  /** Which SolarTwin design quantity feeds this use case. */
  handoffQty: 'footingConcreteM3' | 'paverAreaM2' | 'kwp';
  defaultQty: number;
  /** Fallback thickness/density used only when a per-tonne GWP must be normalised and the document omits them. */
  normalise: { thicknessMm?: number; densityKgM3?: number };
}

export const USE_CASES: UseCase[] = [
  {
    id: 'concrete-c30', title: 'Ready-mix concrete, Grade C30', short: 'Concrete C30', fu: 'm3', fuLabel: 'm³',
    description: 'Pad footings for solar-carport columns. Any mix must meet the structural grade and durability limit; then the highest total score wins, balancing carbon cut, extra cost and strength.',
    requirements: [
      { key: 'compressive_strength_mpa', label: '28-day cube strength', op: '>=', value: 30, unit: 'MPa', why: 'Grade C30 structural footing' },
      { key: 'water_cement_ratio', label: 'Max water/binder ratio', op: '<=', value: 0.55, unit: '', why: 'Durability for buried footings' },
    ],
    performance: { key: 'compressive_strength_mpa', label: 'Strength' },
    baseline: { label: 'Conventional OPC C30 (sector average)', gwp: 318, price: 278 },
    handoffQty: 'footingConcreteM3', defaultQty: 180, normalise: { densityKgM3: 2400 },
  },
  {
    id: 'paver-80', title: 'Interlocking concrete pavers, 80 mm', short: 'Pavers 80 mm', fu: 'm2', fuLabel: 'm²',
    description: 'Vehicular-grade paving under the solar canopies. Strength, absorption and wet slip resistance are mandatory; then the highest total score wins, balancing carbon cut, extra cost and strength.',
    requirements: [
      { key: 'compressive_strength_mpa', label: 'Compressive strength', op: '>=', value: 49, unit: 'MPa', why: 'Vehicular traffic (BS 6717-style spec)' },
      { key: 'water_absorption_pct', label: 'Water absorption', op: '<=', value: 6, unit: '%', why: 'Freeze-free durability, EN 1338 class-2 style' },
      { key: 'slip_resistance_ptv', label: 'Wet slip resistance', op: '>=', value: 40, unit: 'PTV', why: 'Pedestrian safety in car parks' },
    ],
    performance: { key: 'compressive_strength_mpa', label: 'Strength' },
    baseline: { label: 'Standard grey 80 mm paver', gwp: 24, price: 36 },
    handoffQty: 'paverAreaM2', defaultQty: 14800, normalise: { thicknessMm: 80, densityKgM3: 2250 },
  },
  {
    id: 'pv-module', title: 'Solar PV modules', short: 'PV modules', fu: 'kWp', fuLabel: 'kWp',
    description: 'The panels on the rooftop, home or car-park canopy. Efficiency, heat tolerance and degradation are mandatory; then the highest total score wins, balancing embodied-carbon cut, extra cost and efficiency. The winner is built on the site.',
    requirements: [
      { key: 'module_efficiency_pct', label: 'Module efficiency', op: '>=', value: 21, unit: '%', why: 'Fits the designed capacity on the usable roof area' },
      { key: 'temp_coefficient_pct_per_c', label: 'Temp. coefficient of Pmax', op: '>=', value: -0.35, unit: '%/°C', why: 'Malaysian cells run about 25 °C above STC' },
      { key: 'annual_degradation_pct', label: 'Annual degradation', op: '<=', value: 0.55, unit: '%/yr', why: '25-year linear power warranty' },
    ],
    performance: { key: 'module_efficiency_pct', label: 'Efficiency' },
    baseline: { label: 'Conventional mono PERC module', gwp: 560, price: 480 },
    handoffQty: 'kwp', defaultQty: 740, normalise: {},
  },
];

export const useCaseById = (id: string) => USE_CASES.find((u) => u.id === id) ?? USE_CASES[0];
