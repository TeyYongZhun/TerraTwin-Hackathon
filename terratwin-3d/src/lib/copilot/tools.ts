/* TerraTwin Copilot tools: strict JSON-Schema definitions sent to Claude, and the typed actions the client runs. */

export type CopilotAction =
  | { name: 'fly_to_site'; input: { query: string } }
  | { name: 'show_ranking'; input: { kind: 'roof' | 'carpark' | 'home'; search: string | null; hide_blockers: boolean | null } }
  | { name: 'set_sun'; input: { month: number | null; day: number | null; hour: number | null; play: boolean | null } }
  | { name: 'set_weights'; input: { capacity: number; shading: number; demand: number; readiness: number } }
  | { name: 'set_layers'; input: { heat: boolean | null; shadows: boolean | null; panels: boolean | null; canopies: boolean | null; labels: boolean | null } }
  | { name: 'set_map_style'; input: { style: 'satellite' | 'night' | 'blueprint' } }
  | { name: 'design_canopy'; input: { query: string } }
  | { name: 'open_module'; input: { module: 'solar' | 'panelspec' | 'ecospec' | 'dashboard'; use_case: 'concrete-c30' | 'paver-80' | null } }
  | { name: 'add_to_portfolio'; input: { query: string } }
  | { name: 'join_cream_pool'; input: { top_n: number } };

const nullable = (schema: object, description: string) => ({ anyOf: [schema, { type: 'null' }], description });
const obj = (properties: Record<string, object>) => ({ type: 'object' as const, properties, required: Object.keys(properties), additionalProperties: false });

export const COPILOT_TOOLS = [
  { name: 'fly_to_site', description: 'Select a site and fly the 3D camera to it. Use a site name from the context list (fuzzy match is fine).', input_schema: obj({ query: { type: 'string', description: 'Site name, e.g. "Elmina Lakeside Mall"' } }) },
  {
    name: 'show_ranking', description: 'Open the SolarTwin ranking on a tab, optionally filtered by text and hiding sites with high-severity red flags.',
    input_schema: obj({ kind: { type: 'string', enum: ['roof', 'carpark', 'home'], description: 'roof = commercial/institutional rooftops, carpark = solar canopy car parks, home = landed homes (CREAM)' }, search: nullable({ type: 'string' }, 'Text filter on site names, or null'), hide_blockers: nullable({ type: 'boolean' }, 'true to hide sites with high-severity red flags') }),
  },
  {
    name: 'set_sun', description: 'Set the sun date/time for live shadows (Malaysia time). Null keeps the current value. play=true animates the day.',
    input_schema: obj({ month: nullable({ type: 'integer' }, '1-12'), day: nullable({ type: 'integer' }, '1-31'), hour: nullable({ type: 'number' }, 'Decimal hour 6.5-20, e.g. 17.5 for 5:30 pm'), play: nullable({ type: 'boolean' }, 'Start or stop the day animation') }),
  },
  {
    name: 'set_weights', description: 'Set the solar scoring weights (each 0-100) and re-rank all sites.',
    input_schema: obj({ capacity: { type: 'number', description: 'Usable capacity weight' }, shading: { type: 'number', description: 'Low shading weight' }, demand: { type: 'number', description: 'Daytime demand match weight' }, readiness: { type: 'number', description: 'Data readiness weight' } }),
  },
  {
    name: 'set_layers', description: 'Turn map layers on or off. Null leaves a layer unchanged.',
    input_schema: obj({ heat: nullable({ type: 'boolean' }, 'Solar score colouring'), shadows: nullable({ type: 'boolean' }, 'Live shadows'), panels: nullable({ type: 'boolean' }, 'PV panels'), canopies: nullable({ type: 'boolean' }, 'Solar carport canopies'), labels: nullable({ type: 'boolean' }, 'Labels') }),
  },
  { name: 'set_map_style', description: 'Switch the map look.', input_schema: obj({ style: { type: 'string', enum: ['satellite', 'night', 'blueprint'] } }) },
  { name: 'design_canopy', description: 'Design a 3D solar carport canopy over a car park (selects it and builds the canopy).', input_schema: obj({ query: { type: 'string', description: 'Car park name from the context list' } }) },
  {
    name: 'open_module', description: 'Open a module: "solar" = SolarTwin, "panelspec" = the Solar Panels tab (PV panels), "ecospec" = the Canopy Materials tab (car-park canopy concrete and pavers), "dashboard" = the Net-Zero dashboard. For Canopy Materials optionally choose the material use case.',
    input_schema: obj({ module: { type: 'string', enum: ['solar', 'panelspec', 'ecospec', 'dashboard'] }, use_case: nullable({ type: 'string', enum: ['concrete-c30', 'paver-80'] }, 'Canopy Materials use case, or null') }),
  },
  { name: 'add_to_portfolio', description: 'Add a site to the Net-Zero portfolio.', input_schema: obj({ query: { type: 'string', description: 'Site name' } }) },
  { name: 'join_cream_pool', description: 'Enrol the top-N ranked landed-home rows into the CREAM rooftop-lease pool.', input_schema: obj({ top_n: { type: 'integer', description: 'How many top-ranked home rows, 1-50' } }) },
].map((t) => ({ ...t, strict: true }));
