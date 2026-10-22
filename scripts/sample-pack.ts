/* FICTITIOUS sample supplier pack for the Canopy Materials and Solar Panels tabs. Every supplier, product, certificate and EPD number here is invented
   test data. Each document is designed to exercise one check: verified winner, greenwashing, baseline, expired
   certificate + failed grade, self-declared carbon, per-tonne normalisation, missing slip test, fully verified;
   for PV modules: per-Wp price, per-m² EPD normalisation, carbon-neutral greenwashing + expired eco-label, and a
   lowest-carbon module that fails the efficiency gate and has no degradation figure. */
import type { Extraction, NumFieldT } from '../src/lib/ecospec/schema';

export interface Row { label: string; value: string }
export interface Page { title: string; rows?: Row[]; paras?: string[]; /** brochure style: headline claims above the table */ parasFirst?: boolean }
export interface SampleDoc { file: string; useCaseId: 'concrete-c30' | 'paver-80' | 'pv-module'; supplier: string; product: string; docTitle: string; pages: Page[]; build: (q: Q) => Extraction }
type Q = { row: (label: string) => { quote: string; page: number }; para: (start: string) => { quote: string; page: number } };

const OP = 'Malaysia Green Building EPD Programme (fictitious)';
const none: NumFieldT = { value: null, unit: null, quote: null, page: null };
const num = (q: Q, label: string, value: number, unit: string): NumFieldT => ({ value, unit, ...q.row(label) });
const noSpecs = {
  compressive_strength_mpa: none, water_cement_ratio: none, water_absorption_pct: none, slip_resistance_ptv: none, thickness_mm: none, mass_per_m2_kg: none, density_kg_m3: none, recycled_content_pct: none,
  module_power_w: none, module_efficiency_pct: none, temp_coefficient_pct_per_c: none, annual_degradation_pct: none,
};
const noEpd = { present: false, registration_number: null, programme_operator: null, standards: [], third_party_verified: null, valid_until: null, quote: null, page: null };

export const SAMPLE_DOCS: SampleDoc[] = [
  {
    file: 'concrete-verdemix-ggbs50.pdf', useCaseId: 'concrete-c30', supplier: 'Lestari Readymix Sdn Bhd', product: 'VerdeMix GGBS-50 Grade C30', docTitle: 'Product Data Sheet & EPD Summary',
    pages: [
      { title: 'Product Data Sheet', rows: [
        { label: 'Product', value: 'VerdeMix GGBS-50 Grade C30' },
        { label: 'Binder', value: '50% OPC / 50% GGBS (ground granulated blast-furnace slag)' },
        { label: 'Characteristic cube strength (28 days)', value: '34 MPa' },
        { label: 'Maximum free water/binder ratio', value: '0.48' },
        { label: 'Slump class', value: 'S3 (100-150 mm)' },
        { label: 'Fresh density', value: '2380 kg/m3' },
        { label: 'Supply price (Klang Valley, ex-plant)', value: 'RM 318 per m3' },
      ], paras: [
        '28-day strength verified by accredited laboratory cube tests (report LRM-QC-2026-118).',
        'Up to 43% lower embodied carbon than a conventional OPC C30 mix (see EPD on page 2).',
      ] },
      { title: 'Environmental Product Declaration - Summary', rows: [
        { label: 'EPD registration no.', value: 'EPD-MY-GGBS-0421' },
        { label: 'Programme operator', value: OP },
        { label: 'Standards', value: 'ISO 14025 and EN 15804+A2' },
        { label: 'Verification', value: 'Independent third-party verified' },
        { label: 'Declared unit', value: '1 m3 of ready-mixed concrete' },
        { label: 'GWP-total (A1-A3)', value: '182 kgCO2e per m3' },
        { label: 'Valid until', value: '2029-03-31' },
      ] },
    ],
    build: (q) => ({
      product_name: 'VerdeMix GGBS-50 Grade C30', supplier: 'Lestari Readymix Sdn Bhd', material_type: 'ready_mix_concrete', document_kinds: ['datasheet', 'epd'],
      specs: { ...noSpecs, compressive_strength_mpa: num(q, 'Characteristic cube strength (28 days)', 34, 'MPa'), water_cement_ratio: num(q, 'Maximum free water/binder ratio', 0.48, ''), density_kg_m3: num(q, 'Fresh density', 2380, 'kg/m3') },
      price: num(q, 'Supply price (Klang Valley, ex-plant)', 318, 'RM/m3'), warranty_years: none,
      gwp: { value: 182, declared_unit: 'kgCO2e/m3', lifecycle_stages: 'A1-A3', basis: 'epd', ...q.row('GWP-total (A1-A3)') },
      epd: { present: true, registration_number: 'EPD-MY-GGBS-0421', programme_operator: OP, standards: ['ISO 14025', 'EN 15804+A2'], third_party_verified: true, valid_until: '2029-03-31', ...q.row('EPD registration no.') },
      certifications: [],
      claims: [{ claim: 'Up to 43% lower embodied carbon than OPC C30', ...q.para('Up to 43%'), cited_evidence: 'EPD-MY-GGBS-0421' }],
      notes: [],
    }),
  },
  {
    file: 'concrete-ecocrete-40r.pdf', useCaseId: 'concrete-c30', supplier: 'Hijau Konkrit Trading', product: 'EcoCrete 40R Grade C30', docTitle: 'Product Brochure',
    pages: [
      { title: 'EcoCrete 40R - the green choice', parasFirst: true, paras: [
        'ECO-FRIENDLY concrete with 40% recycled content!',
        'Up to 35% lower carbon footprint - the green choice for every project.',
      ], rows: [
        { label: 'Grade', value: 'C30' },
        { label: '28-day cube strength', value: '32 MPa' },
        { label: 'Water/cement ratio', value: '0.50' },
        { label: 'Recycled content', value: '40% (recycled concrete aggregate)' },
        { label: 'Carbon footprint', value: 'approx. 190 kgCO2e per m3 (internal estimate)' },
        { label: 'Price', value: 'RM 305 per m3' },
      ] },
      { title: 'Terms', paras: ['Certificates and test reports available on request.', 'Prices valid for 30 days from the date of this brochure.'] },
    ],
    build: (q) => ({
      product_name: 'EcoCrete 40R Grade C30', supplier: 'Hijau Konkrit Trading', material_type: 'ready_mix_concrete', document_kinds: ['brochure'],
      specs: { ...noSpecs, compressive_strength_mpa: num(q, '28-day cube strength', 32, 'MPa'), water_cement_ratio: num(q, 'Water/cement ratio', 0.5, ''), recycled_content_pct: num(q, 'Recycled content', 40, '%') },
      price: num(q, 'Price', 305, 'RM/m3'), warranty_years: none,
      gwp: { value: 190, declared_unit: 'kgCO2e/m3', lifecycle_stages: null, basis: 'self_declared', ...q.row('Carbon footprint') },
      epd: noEpd, certifications: [],
      claims: [
        { claim: 'Eco-friendly, 40% recycled content', ...q.para('ECO-FRIENDLY'), cited_evidence: null },
        { claim: 'Up to 35% lower carbon footprint', ...q.para('Up to 35%'), cited_evidence: null },
      ],
      notes: ['No EPD or eco-label certificate is provided; the carbon figure is an internal estimate.', 'Certificates and test reports are only "available on request".'],
    }),
  },
  {
    file: 'concrete-standardmix-opc.pdf', useCaseId: 'concrete-c30', supplier: 'Prima Ready-Mix Sdn Bhd', product: 'StandardMix OPC Grade C30', docTitle: 'Product Data Sheet',
    pages: [
      { title: 'Product Data Sheet', rows: [
        { label: 'Product', value: 'StandardMix OPC Grade C30' },
        { label: 'Cement', value: 'CEM I Ordinary Portland Cement' },
        { label: 'Characteristic cube strength (28 days)', value: '35 MPa' },
        { label: 'Maximum free water/cement ratio', value: '0.50' },
        { label: 'Fresh density', value: '2400 kg/m3' },
        { label: 'Price', value: 'RM 278 per m3' },
      ] },
      { title: 'Sector EPD reference', rows: [
        { label: 'EPD registration no.', value: 'EPD-MY-SECTOR-RMC-0007' },
        { label: 'Programme operator', value: OP },
        { label: 'Standards', value: 'ISO 14025, EN 15804+A2' },
        { label: 'Verification', value: 'Third-party verified (industry-average sector EPD)' },
        { label: 'Declared unit', value: '1 m3 Grade C30 ready-mix concrete' },
        { label: 'GWP-total (A1-A3)', value: '318 kgCO2e per m3' },
        { label: 'Valid until', value: '2028-12-31' },
      ] },
    ],
    build: (q) => ({
      product_name: 'StandardMix OPC Grade C30', supplier: 'Prima Ready-Mix Sdn Bhd', material_type: 'ready_mix_concrete', document_kinds: ['datasheet', 'epd'],
      specs: { ...noSpecs, compressive_strength_mpa: num(q, 'Characteristic cube strength (28 days)', 35, 'MPa'), water_cement_ratio: num(q, 'Maximum free water/cement ratio', 0.5, ''), density_kg_m3: num(q, 'Fresh density', 2400, 'kg/m3') },
      price: num(q, 'Price', 278, 'RM/m3'), warranty_years: none,
      gwp: { value: 318, declared_unit: 'kgCO2e/m3', lifecycle_stages: 'A1-A3', basis: 'epd', ...q.row('GWP-total (A1-A3)') },
      epd: { present: true, registration_number: 'EPD-MY-SECTOR-RMC-0007', programme_operator: OP, standards: ['ISO 14025', 'EN 15804+A2'], third_party_verified: true, valid_until: '2028-12-31', ...q.row('EPD registration no.') },
      certifications: [], claims: [],
      notes: ['The EPD is an industry-average sector EPD, not specific to this product.'],
    }),
  },
  {
    file: 'concrete-lowcarb-c28.pdf', useCaseId: 'concrete-c30', supplier: 'Sinar Bina Concrete Sdn Bhd', product: 'LowCarb Blend C28/30', docTitle: 'Technical Data & Certificate',
    pages: [
      { title: 'Technical Data', rows: [
        { label: 'Product', value: 'LowCarb Blend (fly ash) C28/30' },
        { label: '28-day cube strength', value: '28 MPa' },
        { label: 'Maximum water/cement ratio', value: '0.55' },
        { label: 'GWP (A1-A3)', value: '205 kgCO2e/m3' },
        { label: 'Price', value: 'RM 289 per m3' },
      ], paras: ['Certified green: SIRIM Eco-Label certificate no. ECO-SL-2291.'] },
      { title: 'Certificate', rows: [
        { label: 'Scheme', value: 'SIRIM Eco-Labelling Scheme' },
        { label: 'Certificate no.', value: 'ECO-SL-2291' },
        { label: 'Product category', value: 'Low-carbon ready-mixed concrete' },
        { label: 'Valid until', value: '2024-06-30' },
      ] },
    ],
    build: (q) => ({
      product_name: 'LowCarb Blend C28/30', supplier: 'Sinar Bina Concrete Sdn Bhd', material_type: 'ready_mix_concrete', document_kinds: ['datasheet', 'certificate'],
      specs: { ...noSpecs, compressive_strength_mpa: num(q, '28-day cube strength', 28, 'MPa'), water_cement_ratio: num(q, 'Maximum water/cement ratio', 0.55, '') },
      price: num(q, 'Price', 289, 'RM/m3'), warranty_years: none,
      gwp: { value: 205, declared_unit: 'kgCO2e/m3', lifecycle_stages: 'A1-A3', basis: 'self_declared', ...q.row('GWP (A1-A3)') },
      epd: noEpd,
      certifications: [{ scheme: 'SIRIM_ECO_LABEL', name: 'SIRIM Eco-Labelling Scheme', certificate_number: 'ECO-SL-2291', valid_until: '2024-06-30', ...q.row('Valid until') }],
      claims: [{ claim: 'Certified green (SIRIM Eco-Label)', ...q.para('Certified green'), cited_evidence: 'SIRIM Eco-Label ECO-SL-2291' }],
      notes: ['Strength class C28/30 is below the specified C30 cube strength.', 'The SIRIM Eco-Label certificate expired on 2024-06-30.', 'No EPD is provided for the GWP figure.'],
    }),
  },
  {
    file: 'paver-repave-r30.pdf', useCaseId: 'paver-80', supplier: 'Taman Paving Industries', product: 'RePave R30 80 mm', docTitle: 'Product Data Sheet',
    pages: [
      { title: 'Product Data Sheet', rows: [
        { label: 'Product', value: 'RePave R30 interlocking paver, 80 mm' },
        { label: 'Thickness', value: '80 mm' },
        { label: 'Compressive strength (mean)', value: '50 MPa' },
        { label: 'Water absorption', value: '5.2%' },
        { label: 'Slip resistance (wet pendulum)', value: '52 PTV' },
        { label: 'Recycled aggregate content', value: '30%' },
        { label: 'Mass per m2', value: '178 kg' },
        { label: 'Price', value: 'RM 42 per m2' },
        { label: 'Warranty', value: '10 years' },
      ] },
      { title: 'Sustainability', rows: [
        { label: 'MyHIJAU registration', value: 'MH-P-08812' },
        { label: 'MyHIJAU listing valid until', value: '2027-08-31' },
        { label: 'Carbon footprint (manufacturer LCA, A1-A3)', value: '17.5 kgCO2e per m2' },
      ], paras: ['Made with 30% recycled aggregate - listed in the MyHIJAU Directory.'] },
    ],
    build: (q) => ({
      product_name: 'RePave R30 interlocking paver, 80 mm', supplier: 'Taman Paving Industries', material_type: 'interlocking_paver', document_kinds: ['datasheet'],
      specs: { ...noSpecs, compressive_strength_mpa: num(q, 'Compressive strength (mean)', 50, 'MPa'), water_absorption_pct: num(q, 'Water absorption', 5.2, '%'), slip_resistance_ptv: num(q, 'Slip resistance (wet pendulum)', 52, 'PTV'), thickness_mm: num(q, 'Thickness', 80, 'mm'), mass_per_m2_kg: num(q, 'Mass per m2', 178, 'kg/m2'), recycled_content_pct: num(q, 'Recycled aggregate content', 30, '%') },
      price: num(q, 'Price', 42, 'RM/m2'), warranty_years: num(q, 'Warranty', 10, 'years'),
      gwp: { value: 17.5, declared_unit: 'kgCO2e/m2', lifecycle_stages: 'A1-A3', basis: 'self_declared', ...q.row('Carbon footprint (manufacturer LCA, A1-A3)') },
      epd: noEpd,
      certifications: [{ scheme: 'MYHIJAU', name: 'MyHIJAU Directory listing', certificate_number: 'MH-P-08812', valid_until: '2027-08-31', ...q.row('MyHIJAU registration') }],
      claims: [{ claim: '30% recycled aggregate, MyHIJAU listed', ...q.para('Made with 30%'), cited_evidence: 'MyHIJAU MH-P-08812' }],
      notes: ['The carbon footprint comes from the manufacturer\'s own LCA, not a verified EPD.'],
    }),
  },
  {
    file: 'paver-durablock-classic.pdf', useCaseId: 'paver-80', supplier: 'Kota Precast Sdn Bhd', product: 'DuraBlock Classic 80 mm', docTitle: 'Product Data Sheet & EPD Summary',
    pages: [
      { title: 'Product Data Sheet', rows: [
        { label: 'Product', value: 'DuraBlock Classic interlocking paver' },
        { label: 'Thickness', value: '80 mm' },
        { label: 'Compressive strength', value: '55 MPa' },
        { label: 'Water absorption', value: '4.8%' },
        { label: 'Slip resistance (PTV, wet)', value: '48' },
        { label: 'Mass per m2 laid', value: '182 kg' },
        { label: 'Price', value: 'RM 38 per m2' },
        { label: 'Warranty', value: '15 years' },
      ] },
      { title: 'Environmental Product Declaration - Summary', rows: [
        { label: 'EPD registration no.', value: 'EPD-MY-PAV-1120' },
        { label: 'Programme operator', value: OP },
        { label: 'Standards', value: 'ISO 14025 and EN 15804+A2' },
        { label: 'Verification', value: 'Independent third-party verified' },
        { label: 'Declared unit', value: '1 tonne of concrete paving blocks' },
        { label: 'GWP-total (A1-A3)', value: '112 kgCO2e per tonne' },
        { label: 'Valid until', value: '2028-05-31' },
      ] },
    ],
    build: (q) => ({
      product_name: 'DuraBlock Classic interlocking paver', supplier: 'Kota Precast Sdn Bhd', material_type: 'interlocking_paver', document_kinds: ['datasheet', 'epd'],
      specs: { ...noSpecs, compressive_strength_mpa: num(q, 'Compressive strength', 55, 'MPa'), water_absorption_pct: num(q, 'Water absorption', 4.8, '%'), slip_resistance_ptv: num(q, 'Slip resistance (PTV, wet)', 48, 'PTV'), thickness_mm: num(q, 'Thickness', 80, 'mm'), mass_per_m2_kg: num(q, 'Mass per m2 laid', 182, 'kg/m2') },
      price: num(q, 'Price', 38, 'RM/m2'), warranty_years: num(q, 'Warranty', 15, 'years'),
      gwp: { value: 112, declared_unit: 'kgCO2e/t', lifecycle_stages: 'A1-A3', basis: 'epd', ...q.row('GWP-total (A1-A3)') },
      epd: { present: true, registration_number: 'EPD-MY-PAV-1120', programme_operator: OP, standards: ['ISO 14025', 'EN 15804+A2'], third_party_verified: true, valid_until: '2028-05-31', ...q.row('EPD registration no.') },
      certifications: [], claims: [],
      notes: ['GWP is declared per tonne; convert to per m2 using the 182 kg/m2 laid mass.'],
    }),
  },
  {
    file: 'paver-greenstep-eco.pdf', useCaseId: 'paver-80', supplier: 'Alam Hijau Pavers', product: 'GreenStep Eco Paver 80 mm', docTitle: 'Brochure',
    pages: [
      { title: 'GreenStep Eco Paver', parasFirst: true, paras: [
        "The world's first CARBON-NEUTRAL paver!",
        '100% natural, zero-impact production.',
      ], rows: [
        { label: 'Thickness', value: '80 mm' },
        { label: 'Compressive strength', value: '49 MPa' },
        { label: 'Water absorption', value: '5.8%' },
        { label: 'Carbon footprint', value: '14 kgCO2e per m2 (before offsets)' },
        { label: 'Price', value: 'RM 46 per m2' },
      ] },
      { title: 'Notes', paras: ['Carbon neutrality achieved through purchased offsets.', 'Slip resistance testing scheduled for next production batch.'] },
    ],
    build: (q) => ({
      product_name: 'GreenStep Eco Paver 80 mm', supplier: 'Alam Hijau Pavers', material_type: 'interlocking_paver', document_kinds: ['brochure'],
      specs: { ...noSpecs, compressive_strength_mpa: num(q, 'Compressive strength', 49, 'MPa'), water_absorption_pct: num(q, 'Water absorption', 5.8, '%'), thickness_mm: num(q, 'Thickness', 80, 'mm') },
      price: num(q, 'Price', 46, 'RM/m2'), warranty_years: none,
      gwp: { value: 14, declared_unit: 'kgCO2e/m2', lifecycle_stages: null, basis: 'self_declared', ...q.row('Carbon footprint') },
      epd: noEpd, certifications: [],
      claims: [
        { claim: 'Carbon-neutral paver', ...q.para("The world's first"), cited_evidence: null },
        { claim: '100% natural, zero-impact production', ...q.para('100% natural'), cited_evidence: null },
      ],
      notes: ['No slip-resistance test result; testing is only "scheduled".', 'Carbon neutrality relies on unspecified purchased offsets with no certificate.'],
    }),
  },
  {
    file: 'paver-terrablock-ggbs.pdf', useCaseId: 'paver-80', supplier: 'Seri Precast Sdn Bhd', product: 'TerraBlock GGBS 80 mm', docTitle: 'Data Sheet, EPD & Eco-Label',
    pages: [
      { title: 'Product Data Sheet', rows: [
        { label: 'Product', value: 'TerraBlock GGBS interlocking paver' },
        { label: 'Thickness', value: '80 mm' },
        { label: 'Compressive strength', value: '52 MPa' },
        { label: 'Water absorption', value: '4.5%' },
        { label: 'Slip resistance (wet pendulum)', value: '55 PTV' },
        { label: 'Binder', value: '45% GGBS cement replacement' },
        { label: 'Mass per m2', value: '180 kg' },
        { label: 'Price', value: 'RM 44 per m2' },
        { label: 'Warranty', value: '15 years' },
      ], paras: ['37% lower embodied carbon than standard grey pavers (EPD-MY-PAV-1305).'] },
      { title: 'EPD & Eco-Label', rows: [
        { label: 'EPD registration no.', value: 'EPD-MY-PAV-1305' },
        { label: 'Programme operator', value: OP },
        { label: 'Standards', value: 'ISO 14025 and EN 15804+A2' },
        { label: 'Verification', value: 'Independent third-party verified' },
        { label: 'Declared unit', value: '1 m2 of 80 mm paving' },
        { label: 'GWP-total (A1-A3)', value: '15.2 kgCO2e per m2' },
        { label: 'EPD valid until', value: '2030-01-31' },
        { label: 'SIRIM Eco-Label certificate no.', value: 'ECO-SL-3108' },
        { label: 'SIRIM Eco-Label valid until', value: '2028-11-30' },
      ] },
    ],
    build: (q) => ({
      product_name: 'TerraBlock GGBS interlocking paver', supplier: 'Seri Precast Sdn Bhd', material_type: 'interlocking_paver', document_kinds: ['datasheet', 'epd', 'certificate'],
      specs: { ...noSpecs, compressive_strength_mpa: num(q, 'Compressive strength', 52, 'MPa'), water_absorption_pct: num(q, 'Water absorption', 4.5, '%'), slip_resistance_ptv: num(q, 'Slip resistance (wet pendulum)', 55, 'PTV'), thickness_mm: num(q, 'Thickness', 80, 'mm'), mass_per_m2_kg: num(q, 'Mass per m2', 180, 'kg/m2') },
      price: num(q, 'Price', 44, 'RM/m2'), warranty_years: num(q, 'Warranty', 15, 'years'),
      gwp: { value: 15.2, declared_unit: 'kgCO2e/m2', lifecycle_stages: 'A1-A3', basis: 'epd', ...q.row('GWP-total (A1-A3)') },
      epd: { present: true, registration_number: 'EPD-MY-PAV-1305', programme_operator: OP, standards: ['ISO 14025', 'EN 15804+A2'], third_party_verified: true, valid_until: '2030-01-31', ...q.row('EPD registration no.') },
      certifications: [{ scheme: 'SIRIM_ECO_LABEL', name: 'SIRIM Eco-Label', certificate_number: 'ECO-SL-3108', valid_until: '2028-11-30', ...q.row('SIRIM Eco-Label certificate no.') }],
      claims: [{ claim: '37% lower embodied carbon than standard pavers', ...q.para('37% lower'), cited_evidence: 'EPD-MY-PAV-1305' }],
      notes: [],
    }),
  },
  {
    file: 'pv-solarispeak-topcon580.pdf', useCaseId: 'pv-module', supplier: 'Suria Teknologi Sdn Bhd', product: 'SolarisPeak TOPCon 580 W', docTitle: 'Module Datasheet & EPD Summary',
    pages: [
      { title: 'Module Datasheet', rows: [
        { label: 'Product', value: 'SolarisPeak TOPCon 580 W monofacial module' },
        { label: 'Cell technology', value: 'n-type TOPCon, 144 half-cut cells' },
        { label: 'Rated power (Pmax, STC)', value: '580 W' },
        { label: 'Module efficiency', value: '22.5%' },
        { label: 'Temperature coefficient of Pmax', value: '-0.30 %/°C' },
        { label: 'Annual power degradation', value: '0.40% per year (30-year linear warranty)' },
        { label: 'Dimensions', value: '2278 x 1134 x 30 mm' },
        { label: 'Weight', value: '28.5 kg' },
        { label: 'Price (ex-works Klang)', value: 'RM 0.51 per Wp' },
      ], paras: ['23% lower embodied carbon than a mono PERC module (EPD-MY-PV-0612).'] },
      { title: 'Environmental Product Declaration - Summary', rows: [
        { label: 'EPD registration no.', value: 'EPD-MY-PV-0612' },
        { label: 'Programme operator', value: OP },
        { label: 'Standards', value: 'ISO 14025 and EN 15804+A2' },
        { label: 'Verification', value: 'Independent third-party verified' },
        { label: 'Declared unit', value: '1 kWp of PV module' },
        { label: 'GWP-total (A1-A3)', value: '430 kgCO2e per kWp' },
        { label: 'Valid until', value: '2029-06-30' },
      ] },
    ],
    build: (q) => ({
      product_name: 'SolarisPeak TOPCon 580 W', supplier: 'Suria Teknologi Sdn Bhd', material_type: 'pv_module', document_kinds: ['datasheet', 'epd'],
      specs: { ...noSpecs, module_power_w: num(q, 'Rated power (Pmax, STC)', 580, 'W'), module_efficiency_pct: num(q, 'Module efficiency', 22.5, '%'), temp_coefficient_pct_per_c: num(q, 'Temperature coefficient of Pmax', -0.3, '%/°C'), annual_degradation_pct: num(q, 'Annual power degradation', 0.4, '%/yr') },
      price: num(q, 'Price (ex-works Klang)', 0.51, 'RM/Wp'), warranty_years: num(q, 'Annual power degradation', 30, 'years'),
      gwp: { value: 430, declared_unit: 'kgCO2e/kWp', lifecycle_stages: 'A1-A3', basis: 'epd', ...q.row('GWP-total (A1-A3)') },
      epd: { present: true, registration_number: 'EPD-MY-PV-0612', programme_operator: OP, standards: ['ISO 14025', 'EN 15804+A2'], third_party_verified: true, valid_until: '2029-06-30', ...q.row('EPD registration no.') },
      certifications: [],
      claims: [{ claim: '23% lower embodied carbon than mono PERC', ...q.para('23% lower'), cited_evidence: 'EPD-MY-PV-0612' }],
      notes: ['Price is quoted per Wp; multiply by 1,000 for per kWp.'],
    }),
  },
  {
    file: 'pv-heliomax-hjt600.pdf', useCaseId: 'pv-module', supplier: 'HelioMax Solar Sdn Bhd', product: 'HelioMax HJT 600 W', docTitle: 'Datasheet & EPD',
    pages: [
      { title: 'Module Datasheet', rows: [
        { label: 'Product', value: 'HelioMax HJT 600 W bifacial glass-glass module' },
        { label: 'Cell technology', value: 'n-type heterojunction (HJT), 120 half-cut cells' },
        { label: 'Rated power (Pmax)', value: '600 W' },
        { label: 'Module efficiency', value: '23.2%' },
        { label: 'Temperature coefficient (Pmax)', value: '-0.24 %/°C' },
        { label: 'Linear degradation', value: '0.25% per year (30-year power warranty)' },
        { label: 'Dimensions', value: '2278 x 1134 x 30 mm' },
        { label: 'Weight', value: '32.0 kg' },
        { label: 'Price', value: 'RM 585 per kWp' },
      ], paras: ['Our lowest-carbon module, made with a low-temperature HJT process (EPD-MY-PV-0788).'] },
      { title: 'Environmental Product Declaration', rows: [
        { label: 'EPD registration no.', value: 'EPD-MY-PV-0788' },
        { label: 'Programme operator', value: OP },
        { label: 'Standards', value: 'ISO 14025 and EN 15804+A2' },
        { label: 'Verification', value: 'Independent third-party verified' },
        { label: 'Declared unit', value: '1 m2 of module area' },
        { label: 'GWP-total (A1-A3)', value: '88 kgCO2e per m2' },
        { label: 'Valid until', value: '2030-02-28' },
      ] },
    ],
    build: (q) => ({
      product_name: 'HelioMax HJT 600 W', supplier: 'HelioMax Solar Sdn Bhd', material_type: 'pv_module', document_kinds: ['datasheet', 'epd'],
      specs: { ...noSpecs, module_power_w: num(q, 'Rated power (Pmax)', 600, 'W'), module_efficiency_pct: num(q, 'Module efficiency', 23.2, '%'), temp_coefficient_pct_per_c: num(q, 'Temperature coefficient (Pmax)', -0.24, '%/°C'), annual_degradation_pct: num(q, 'Linear degradation', 0.25, '%/yr') },
      price: num(q, 'Price', 585, 'RM/kWp'), warranty_years: num(q, 'Linear degradation', 30, 'years'),
      gwp: { value: 88, declared_unit: 'kgCO2e/m2', lifecycle_stages: 'A1-A3', basis: 'epd', ...q.row('GWP-total (A1-A3)') },
      epd: { present: true, registration_number: 'EPD-MY-PV-0788', programme_operator: OP, standards: ['ISO 14025', 'EN 15804+A2'], third_party_verified: true, valid_until: '2030-02-28', ...q.row('EPD registration no.') },
      certifications: [],
      claims: [{ claim: 'Lowest-carbon module in the range', ...q.para('Our lowest-carbon'), cited_evidence: 'EPD-MY-PV-0788' }],
      notes: ['GWP is declared per m2 of module area; convert to per kWp with the stated 23.2% module efficiency.'],
    }),
  },
  {
    file: 'pv-everbright-perc550.pdf', useCaseId: 'pv-module', supplier: 'EverBright Energy Trading', product: 'EverBright EcoMax PERC 550 W', docTitle: 'Product Brochure',
    pages: [
      { title: 'EverBright EcoMax - clean energy, zero guilt', parasFirst: true, paras: [
        'CARBON-NEUTRAL solar panels for a greener tomorrow!',
        'Certified green: SIRIM Eco-Label ECO-SL-4410.',
      ], rows: [
        { label: 'Cell technology', value: 'p-type mono PERC, 144 half-cut cells' },
        { label: 'Rated power', value: '550 W' },
        { label: 'Module efficiency', value: '21.3%' },
        { label: 'Temperature coefficient of Pmax', value: '-0.35 %/°C' },
        { label: 'Annual degradation', value: '0.55% per year' },
        { label: 'Carbon footprint', value: 'approx. 300 kgCO2e per kWp (internal estimate)' },
        { label: 'Price', value: 'RM 255 per module' },
      ] },
      { title: 'Certificate', rows: [
        { label: 'Scheme', value: 'SIRIM Eco-Labelling Scheme' },
        { label: 'Certificate no.', value: 'ECO-SL-4410' },
        { label: 'Product category', value: 'Photovoltaic modules' },
        { label: 'Valid until', value: '2025-03-31' },
      ] },
    ],
    build: (q) => ({
      product_name: 'EverBright EcoMax PERC 550 W', supplier: 'EverBright Energy Trading', material_type: 'pv_module', document_kinds: ['brochure', 'certificate'],
      specs: { ...noSpecs, module_power_w: num(q, 'Rated power', 550, 'W'), module_efficiency_pct: num(q, 'Module efficiency', 21.3, '%'), temp_coefficient_pct_per_c: num(q, 'Temperature coefficient of Pmax', -0.35, '%/°C'), annual_degradation_pct: num(q, 'Annual degradation', 0.55, '%/yr') },
      price: num(q, 'Price', 255, 'RM/module'), warranty_years: none,
      gwp: { value: 300, declared_unit: 'kgCO2e/kWp', lifecycle_stages: null, basis: 'self_declared', ...q.row('Carbon footprint') },
      epd: noEpd,
      certifications: [{ scheme: 'SIRIM_ECO_LABEL', name: 'SIRIM Eco-Labelling Scheme', certificate_number: 'ECO-SL-4410', valid_until: '2025-03-31', ...q.row('Valid until') }],
      claims: [
        { claim: 'Carbon-neutral solar panels', ...q.para('CARBON-NEUTRAL'), cited_evidence: null },
        { claim: 'Certified green (SIRIM Eco-Label)', ...q.para('Certified green'), cited_evidence: 'SIRIM Eco-Label ECO-SL-4410' },
      ],
      notes: ['No EPD; the carbon figure is an internal estimate.', 'The SIRIM Eco-Label certificate expired on 2025-03-31.', 'Price is per 550 W module.'],
    }),
  },
  {
    file: 'pv-thincell-cdte545.pdf', useCaseId: 'pv-module', supplier: 'ThinCell Malaysia Sdn Bhd', product: 'ThinCell T7 CdTe 545 W', docTitle: 'Datasheet & EPD Summary',
    pages: [
      { title: 'Module Datasheet', rows: [
        { label: 'Technology', value: 'Thin-film cadmium telluride (CdTe), glass-glass' },
        { label: 'Rated power (Pmax)', value: '545 W' },
        { label: 'Module efficiency', value: '19.7%' },
        { label: 'Temperature coefficient of Pmax', value: '-0.28 %/°C' },
        { label: 'Dimensions', value: '2300 x 1200 x 35 mm' },
        { label: 'Weight', value: '35.5 kg' },
        { label: 'Price', value: 'RM 520 per kWp' },
      ], paras: ['The lowest-carbon PV technology we make (EPD-MY-PV-0455).', 'Degradation warranty terms for the Malaysian market to be confirmed.'] },
      { title: 'Environmental Product Declaration - Summary', rows: [
        { label: 'EPD registration no.', value: 'EPD-MY-PV-0455' },
        { label: 'Programme operator', value: OP },
        { label: 'Standards', value: 'ISO 14025 and EN 15804+A2' },
        { label: 'Verification', value: 'Independent third-party verified' },
        { label: 'Declared unit', value: '1 kWp of PV module' },
        { label: 'GWP-total (A1-A3)', value: '240 kgCO2e per kWp' },
        { label: 'Valid until', value: '2028-09-30' },
      ] },
    ],
    build: (q) => ({
      product_name: 'ThinCell T7 CdTe 545 W', supplier: 'ThinCell Malaysia Sdn Bhd', material_type: 'pv_module', document_kinds: ['datasheet', 'epd'],
      specs: { ...noSpecs, module_power_w: num(q, 'Rated power (Pmax)', 545, 'W'), module_efficiency_pct: num(q, 'Module efficiency', 19.7, '%'), temp_coefficient_pct_per_c: num(q, 'Temperature coefficient of Pmax', -0.28, '%/°C') },
      price: num(q, 'Price', 520, 'RM/kWp'), warranty_years: none,
      gwp: { value: 240, declared_unit: 'kgCO2e/kWp', lifecycle_stages: 'A1-A3', basis: 'epd', ...q.row('GWP-total (A1-A3)') },
      epd: { present: true, registration_number: 'EPD-MY-PV-0455', programme_operator: OP, standards: ['ISO 14025', 'EN 15804+A2'], third_party_verified: true, valid_until: '2028-09-30', ...q.row('EPD registration no.') },
      certifications: [],
      claims: [{ claim: 'Lowest-carbon PV technology', ...q.para('The lowest-carbon'), cited_evidence: 'EPD-MY-PV-0455' }],
      notes: ['No annual degradation figure: warranty terms are "to be confirmed".', 'Module efficiency of 19.7% is below the 21% project requirement.'],
    }),
  },
];

/** Resolve quotes against the rendered page text, so ground-truth extractions are verbatim by construction. */
export function groundTruth(doc: SampleDoc): Extraction {
  const q: Q = {
    row: (label) => {
      for (let i = 0; i < doc.pages.length; i++) {
        const r = doc.pages[i].rows?.find((x) => x.label === label);
        if (r) return { quote: `${r.label}: ${r.value}`, page: i + 1 };
      }
      throw new Error(`${doc.file}: no row "${label}"`);
    },
    para: (start) => {
      for (let i = 0; i < doc.pages.length; i++) {
        const p = doc.pages[i].paras?.find((x) => x.startsWith(start));
        if (p) return { quote: p, page: i + 1 };
      }
      throw new Error(`${doc.file}: no paragraph "${start}"`);
    },
  };
  return doc.build(q);
}
