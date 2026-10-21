/* Planning assumptions for SolarTwin. Every value is a transparent, editable screening assumption — not an SDP,
   TNB or regulator figure. Sources point to the published references they are anchored on. */
export interface Assumptions {
  specificYield: number;      // kWh/kWp/yr, unshaded, performance ratio included
  gridEF: number;             // tCO2e/MWh
  tariffCommercial: number;   // RM/kWh avoided for self-consumed energy (C&I)
  exportRate: number;         // RM/kWh credited for exported energy
  capexRoof: number;          // RM/kWp, commercial rooftop
  capexCanopy: number;        // RM/kWp, solar carport incl. structure
  capexHome: number;          // RM/kWp, residential rooftop (CREAM aggregation)
  omPct: number;              // O&M, % of CAPEX per year
  creamLeaseRate: number;     // RM per kWp per month paid to the homeowner (roof lease)
  homeLoadKwh: number;        // kWh/yr per landed home
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  specificYield: 1350,
  gridEF: 0.74,
  tariffCommercial: 0.47,
  exportRate: 0.2,
  capexRoof: 2700,
  capexCanopy: 4300,
  capexHome: 3900,
  omPct: 1,
  creamLeaseRate: 7,
  homeLoadKwh: 4300,
};

export const ASSUMPTION_META: Record<keyof Assumptions, { label: string; unit: string; min: number; max: number; step: number; note: string }> = {
  specificYield: { label: 'Specific yield', unit: 'kWh/kWp/yr', min: 1000, max: 1600, step: 10, note: 'Klang Valley rooftop PV, PR ≈ 0.80 (PVGIS / SEDA range 1,200–1,450)' },
  gridEF: { label: 'Grid emission factor', unit: 'tCO₂e/MWh', min: 0.4, max: 0.9, step: 0.01, note: '2024 provisional Peninsular grid factor (ST) — illustrative use' },
  tariffCommercial: { label: 'Avoided C&I tariff', unit: 'RM/kWh', min: 0.3, max: 0.7, step: 0.01, note: 'Illustrative blended commercial tariff' },
  exportRate: { label: 'Export credit', unit: 'RM/kWh', min: 0, max: 0.5, step: 0.01, note: 'Illustrative export / offset value' },
  capexRoof: { label: 'Rooftop CAPEX', unit: 'RM/kWp', min: 1800, max: 4000, step: 50, note: 'Illustrative C&I EPC price' },
  capexCanopy: { label: 'Carport CAPEX', unit: 'RM/kWp', min: 3000, max: 6000, step: 50, note: 'Illustrative, includes canopy steel and footings' },
  capexHome: { label: 'Residential CAPEX', unit: 'RM/kWp', min: 2800, max: 5000, step: 50, note: 'Illustrative aggregated residential EPC price' },
  omPct: { label: 'O&M', unit: '% CAPEX/yr', min: 0.5, max: 3, step: 0.1, note: 'Illustrative' },
  creamLeaseRate: { label: 'CREAM roof lease', unit: 'RM/kWp/month', min: 2, max: 15, step: 0.5, note: 'Illustrative homeowner roof-lease payment — not an SDP/GSPARX offer' },
  homeLoadKwh: { label: 'Home consumption', unit: 'kWh/yr', min: 2000, max: 8000, step: 100, note: 'Illustrative landed-home usage' },
};

export const SOURCES = [
  { title: 'Sime Darby Property — Sustainability Strategy & Roadmap 2030', url: 'https://www.simedarbyproperty.com/sustainability', tag: 'context' },
  { title: 'SDP — nation’s first residential solar project under NETR (CREAM)', url: 'https://www.simedarbyproperty.com/press-releases/sime-darby-property-launches-nations-first-residential-solar-project-under-netr', tag: 'context' },
  { title: 'Suruhanjaya Tenaga — CREAM guideline', url: 'https://st.gov.my/sites/default/files/2026-03/CREAM-GUIDELINE_FINAL.pdf', tag: 'rules' },
  { title: 'Suruhanjaya Tenaga — CREAM FAQ (landed residential; townhouses not eligible)', url: 'https://www.st.gov.my/contents/2025/CREAM/CREAM%20FAQ_1%20_V2.pdf', tag: 'rules' },
  { title: 'Grid emission factor in Malaysia 2022–2024 (provisional)', url: 'https://myenergystats.st.gov.my/documents/d/guest/grid-emission-factor-gef-in-malaysia-2022-2024-provisional-', tag: 'environment' },
  { title: 'EU JRC PVGIS — PV performance estimates', url: 'https://re.jrc.ec.europa.eu/pvg_tools/en/', tag: 'solar' },
  { title: 'OpenStreetMap — building footprints © OpenStreetMap contributors (ODbL)', url: 'https://www.openstreetmap.org/way/1308938137', tag: 'data' },
];
