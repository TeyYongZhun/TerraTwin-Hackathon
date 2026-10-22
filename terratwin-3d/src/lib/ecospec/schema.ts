/* Extraction schema for supplier documents (datasheets, EPDs, certificates, quotations). Shared by the server's
   Claude structured-output call and the client. Every value carries the verbatim quote and page it came from,
   because citations cannot be combined with structured outputs. */
import { z } from 'zod';

const Evidence = { quote: z.string().nullable().describe('Verbatim text from the document supporting the value (max ~25 words), or null if absent'), page: z.number().int().nullable().describe('1-based page number of the quote, or null') };

export const NumField = z.object({
  value: z.number().nullable().describe('Numeric value exactly as stated in the document, or null if the document does not state it'),
  unit: z.string().nullable().describe('Unit as stated, e.g. "MPa", "%", "RM/m3", "kg/m2"'),
  ...Evidence,
});

export const SPEC_KEYS = ['compressive_strength_mpa', 'water_cement_ratio', 'water_absorption_pct', 'slip_resistance_ptv', 'thickness_mm', 'mass_per_m2_kg', 'density_kg_m3', 'recycled_content_pct',
  'module_power_w', 'module_efficiency_pct', 'temp_coefficient_pct_per_c', 'annual_degradation_pct'] as const;
export type SpecKey = (typeof SPEC_KEYS)[number];

export const ExtractionSchema = z.object({
  product_name: z.string(),
  supplier: z.string(),
  material_type: z.enum(['ready_mix_concrete', 'interlocking_paver', 'pv_module', 'other']),
  document_kinds: z.array(z.enum(['datasheet', 'epd', 'certificate', 'quotation', 'test_report', 'brochure'])).describe('All document kinds contained in the file'),
  specs: z.object({
    compressive_strength_mpa: NumField.describe('28-day characteristic or mean compressive strength'),
    water_cement_ratio: NumField.describe('Maximum free water/cement (binder) ratio'),
    water_absorption_pct: NumField,
    slip_resistance_ptv: NumField.describe('Wet pendulum test value (PTV/USRV)'),
    thickness_mm: NumField,
    mass_per_m2_kg: NumField.describe('Mass per square metre of laid product'),
    density_kg_m3: NumField,
    recycled_content_pct: NumField,
    module_power_w: NumField.describe('PV modules: rated power Pmax at STC, in W'),
    module_efficiency_pct: NumField.describe('PV modules: module efficiency at STC, in %'),
    temp_coefficient_pct_per_c: NumField.describe('PV modules: temperature coefficient of Pmax in %/°C, as a signed number (e.g. -0.30)'),
    annual_degradation_pct: NumField.describe('PV modules: linear annual power degradation in % per year'),
  }),
  price: NumField.describe('Unit price in RM; unit such as "RM/m3", "RM/m2", "RM/kWp", "RM/Wp" or "RM/module"'),
  warranty_years: NumField,
  gwp: z.object({
    value: z.number().nullable().describe('Global warming potential (kgCO2e) as declared'),
    declared_unit: z.string().nullable().describe('Declared/functional unit of the GWP, e.g. "kgCO2e/m3", "kgCO2e/t", "kgCO2e/m2", "kgCO2e/kWp", "kgCO2e/module"'),
    lifecycle_stages: z.string().nullable().describe('Life-cycle modules covered, e.g. "A1-A3"'),
    basis: z.enum(['epd', 'self_declared', 'none']).describe('epd = from an Environmental Product Declaration; self_declared = supplier estimate / own LCA / marketing; none = not stated'),
    ...Evidence,
  }),
  epd: z.object({
    present: z.boolean(),
    registration_number: z.string().nullable(),
    programme_operator: z.string().nullable(),
    standards: z.array(z.string()).describe('Standards named, e.g. "ISO 14025", "EN 15804+A2"'),
    third_party_verified: z.boolean().nullable(),
    valid_until: z.string().nullable().describe('ISO date YYYY-MM-DD'),
    ...Evidence,
  }),
  certifications: z.array(z.object({
    scheme: z.enum(['SIRIM_ECO_LABEL', 'MYHIJAU', 'SINGAPORE_GREEN_LABEL', 'ISO_14001', 'OTHER']),
    name: z.string(),
    certificate_number: z.string().nullable(),
    valid_until: z.string().nullable().describe('ISO date YYYY-MM-DD'),
    ...Evidence,
  })),
  claims: z.array(z.object({
    claim: z.string().describe('Environmental / sustainability marketing claim, paraphrased in a few words'),
    quote: z.string().describe('Verbatim claim text'),
    page: z.number().int(),
    cited_evidence: z.string().nullable().describe('Evidence the document itself cites for this claim (certificate, EPD number, test), or null if none is cited'),
  })),
  notes: z.array(z.string()).describe('Missing, ambiguous or inconsistent information a procurement engineer should know about'),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type NumFieldT = z.infer<typeof NumField>;
