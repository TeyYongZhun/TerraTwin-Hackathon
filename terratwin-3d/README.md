# TerraTwin AI 3D: the Net-Zero Township Copilot

A live 3D digital twin of **City of Elmina** (Sime Darby Property, Shah Alam) for the PLANET hackathon challenge. It joins four modules into one story:

| Module | Carbon | What it does |
|---|---|---|
| **SolarTwin** | Operational | Ranks 262 rooftops, 9 car parks and 1,821 landed-home rows (≈6,900 homes) by usable area, shading loss and daytime demand match. It flags missing data and engineering checks, designs solar carports, and shows residents their CREAM roof-lease income. |
| **Solar Panels** | Both | Runs the supplier-document pipeline below on PV module datasheets: gates on efficiency, heat tolerance and degradation, ranks by verified embodied carbon per kWp, and builds the chosen module on the SolarTwin site, re-sizing its kWp, yield and CAPEX. |
| **Canopy Materials** | Embodied | Reads car-park canopy supplier PDFs (footing concrete, pavers) with Claude: specs, prices, EPDs, certificates and every green claim, each with its verbatim quote and page. It gates by performance, flags greenwashing, normalises carbon to the functional unit, shortlists verified low-carbon options, and builds the chosen footings and paving into the canopy. |
| **Net-Zero dashboard** | Both | Rolls the chosen sites and materials into SSR2030 progress, IFRS S2-style metrics and a printable decision pack. |

## Run it

Requires Node 20.19+ (tested on Node 24).

```bash
cd terratwin-3d
npm install
cp .env.example .env        # optional: add ANTHROPIC_API_KEY for live Claude
npm run dev                 # API on :8787 + app on http://localhost:5173
```

- **Without an API key**, everything still works. The badge shows **Demo cache**:
  - The sample supplier pack extracts from the bundled cache.
  - Briefs and memos are written offline from the same numbers.
  - The Copilot uses keyword rules.
- **With a key**, the badge shows **Live Claude**. Uploaded PDFs, site briefs, procurement memos and the Copilot then call `claude-opus-5-5`.

Production build, served from one port:

```bash
npm run build && npm start   # http://localhost:8787
```

## A 2-minute tour

Press **Play 2-min guided demo** on the landing screen, or **Demo** in the top bar. The demo runs these steps:

1. **Fly in.** The globe flies to Elmina and 2,188 real OpenStreetMap buildings rise in 3D, coloured by solar score.
2. **Open Elmina Lakeside Mall and design its array.** It holds 3.6 MWp, with a panel layout drawn in 3D and red flags such as the missing structural load certificate and the Power System Study.
3. **Play the day.** Shadows sweep across the township and the light follows the sun.
4. **Design a solar canopy** on a mall car park. It produces columns, footing concrete, pavers and steel.
5. **Hand off to Canopy Materials.** The canopy quantities flow in and the sample paver bids are read.
6. **Compare.** Greenwashing claims ("carbon-neutral" with no certificate) are flagged red, and a missing slip test fails the gate.
7. **Shortlist.** The verified lowest-carbon paver within the cost-premium cap wins, with its abatement cost in RM per tCO₂e.
8. **CREAM.** The top terrace rows join the pool, with roof-lease income per home.
9. **Net-Zero dashboard.** It shows progress toward the SSR2030 40% cut and the decision pack.

Press **Ctrl K** to open the Copilot. Try "show car parks at 5pm in December and play the day" or "join the top 10 terrace rows to the CREAM pool".

## How it works

**SolarTwin engine** (`src/lib/solar/`). These are pure functions with unit tests.

- **Sun.** SunCalc gives the sun position at Elmina in Malaysia time.
- **Shadows.** Each shadow is the convex hull of a footprint and its translation by (H − h) / tan(altitude), pointing away from the sun.
- **Annual shading loss.** 284 sun positions (the 21st of each month, 07:00–19:00), weighted by sin(alt)^1.15, tested against neighbouring buildings and tree canopies.
- **Usable area and panels.** 1 m edge setback, rooftop plant zones excluded, 550 W modules laid along the roof's long axis, with walkways.
- **Carports.** Double-row canopy strips over the bays, separated by drive aisles, with a bill of quantities.
- **PV module choice.** Selecting a site does not draw its panels. "Design solar array in 3D" on a rooftop or home (or "Design solar canopy in 3D" on a car park) draws the array, and "Choose solar panels" opens the **Solar Panels** tab with its kWp: the same four steps as Canopy Materials, for PV modules only. Confirming a module (the recommendation or any other option) rebuilds the site with it (`src/lib/solar/modules.ts`):
  - kWp scales with module efficiency on the same usable area;
  - yield per kWp follows the temperature coefficient;
  - CAPEX adds the module's price premium, with area-bound costs spread over the extra watts.
- **Demand match.** Σmin(PV, load) / ΣPV over a typical day, using a load profile per building type.
- **Score.** A transparent weighted score with live weight sliders.
- **Red flags.** Each comes with a "how to resolve" line:
  - structural certificate missing or expired, or roof older than 15 years;
  - TNB transformer check from 180 kWp, and a Power System Study from 1 MWp;
  - shading, ownership (strata or third party), BOMBA access, and missing documents;
  - CREAM eligibility.
- **Precompute.** `scripts/precompute-solar.ts` precomputes kWp, usable area and shading for every footprint. Detailed layouts are computed live for the selected site.

**Supplier-document pipeline: Solar Panels and Canopy Materials** (`server/routes/ecospec.ts` and `src/lib/ecospec/`):

- **Extraction.** Each PDF goes to Claude as a base64 `document` block.
  - Structured outputs (`client.beta.messages.parse` with a Zod schema) return every value with its verbatim quote and page. Citations can't be combined with structured outputs, so the evidence is carried in the schema itself.
  - The prompt forbids inferring missing values.
- **Cache.** Results are cached by the PDF's SHA-256. The server checks `%PDF` magic bytes and a 25 MB limit.
- **Verdicts are deterministic and auditable** (`evidence.ts`, `normalize.ts`, `rank.ts`). The model extracts; code decides.
  - **Verified carbon:** a valid, third-party-verified EPD to ISO 14025 / EN 15804.
  - **Greenwashing:** a claim with no valid EPD or eco-label (SIRIM, MyHIJAU), or a claim that cites an expired certificate.
  - **Normalisation:** per-tonne GWP is converted to the functional unit using the document's own mass per m² or density.
  - **Ranking:** gate first (a missing value is not a pass), then rank by carbon within the premium cap.

**Claude usage** (`server/claude.ts`):

- Model `claude-opus-5-5`, with explicit effort: `medium` for extraction, `low` for briefs, memos and the Copilot.
- Server-side refusal fallback: `fallbacks: "default"` with the `server-side-fallback-2026-07-01` beta. A mid-stream hand-over resets the streamed text.
- `stop_reason` is checked before reading content.
- Typed SDK errors are mapped to HTTP statuses, and any failure falls back to the offline path.
- Briefs and memos stream over SSE.
- The Copilot uses `strict: true` tools with `tool_choice: auto`; the client executes the returned actions.

## Data and honesty notes

- **Real:** building and car-park footprints, names and substations are © OpenStreetMap contributors (ODbL), fetched with `npm run fetch:osm`. Imagery © Esri; basemap © OpenFreeMap / OpenMapTiles.
- **Estimated:** building heights (from OSM tags or building type), terrace-row home counts (about 130 m² per unit) and energy-use intensities.
- **Illustrative:**
  - Site engineering attributes (roof age, certificates, ownership, documents) are stand-ins for SDP asset records.
  - Finance values and the grid factor are editable under **Assumptions & sources**, with links to the references they are based on.
  - The SSR2030 baseline is this model's own screening estimate, not SDP's reported inventory.
- **Fictitious:** every supplier, product, EPD and certificate in `public/samples/` (each PDF is stamped "FICTITIOUS TEST DATA").
  - The bundled demo cache holds the pack's ground truth. With a key, `npm run precompute` replaces it with live Claude extractions.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | API (tsx watch) + Vite dev server |
| `npm test` | Vitest: solar engine, red flags, scoring, finance, PV module builds, supplier-document normalisation, evidence and ranking (44 tests) |
| `npm run typecheck` | `tsc --noEmit` over app, server, scripts and tests |
| `npm run fetch:osm` | Re-download OSM data for the Elmina bbox (Overpass, with mirror fallback) |
| `npm run precompute:solar` | Recompute per-site kWp / usable area / shading (about 2.5 min) |
| `npm run make:pdfs` | Regenerate the sample supplier PDFs and the demo cache |
| `npm run precompute` | Re-extract the sample pack with live Claude (needs a key) |
| `npm run build` / `npm start` | Production build, served by Express |

## Layout

```
server/        index.ts · claude.ts · prompts.ts · routes/{ecospec,solartwin,copilot}.ts
scripts/       fetch-osm.mjs · precompute-solar.ts · sample-pack.ts · make-sample-pdfs.ts · precompute-extractions.ts
src/
  map/         MapView.tsx (MapLibre 3D) · style.ts · sources.ts · camera.ts
  lib/solar/   sun · shadows · shadingLoss · panels · energy · evaluate · siteGeometry
  lib/ecospec/ schema · normalize · evidence · rank
  lib/copilot/ tools · execute
  data/        osm/elmina.osm.json · township · sites · assumptions · solar-precomputed.json · ecospec/*
  features/    intro · shell · solartwin · ecospec · dashboard · copilot · demo
tests/         solar.engine · solar.evaluate · ecospec
```
