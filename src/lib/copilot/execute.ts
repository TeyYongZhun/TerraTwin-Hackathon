/* Runs Copilot actions against the app, plus an offline keyword parser used when no API key is configured. */
import type { CopilotAction } from './tools';
import { useApp } from '../../store/app';
import { useEco } from '../../store/ecospec';
import { getSites, type Site, type SiteKind } from '../../data/sites';
import { computeAnalytics } from '../../hooks/useAnalytics';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const STOP = new Set(['the', 'car', 'park', 'parks', 'site', 'roof', 'show', 'fly', 'take', 'zoom', 'open', 'select', 'add', 'portfolio', 'and', 'for', 'with', 'best', 'top', 'please', 'play', 'day', 'time', 'design', 'solar', 'canopy', 'biggest']);

/** Best site for a free-text query, with a match score: exact (100) > every query word in the name (50+) > shared words.
    Among full matches, names mostly covered by the query win (so "Elmina Sales Gallery" beats its car park). */
export function matchSite(query: string, kind?: SiteKind): { site: Site; score: number } | null {
  const q = norm(query);
  if (!q) return null;
  const words = q.split(' ').filter((w) => w.length > 2 && !STOP.has(w));
  let best: { site: Site; score: number } | null = null;
  for (const s of getSites().sites) {
    if (kind && s.kind !== kind) continue;
    const n = norm(s.name), hits = words.filter((w) => n.includes(w));
    let score = n === q ? 100 : words.length && hits.length === words.length ? 50 + 10 * (hits.join('').length / n.replace(/ /g, '').length) : hits.length * 10;
    if (!score) continue;
    if (s.featured) score += 3;
    if (!best || score > best.score || (score === best.score && s.kwp > best.site.kwp)) best = { site: s, score };
  }
  return best;
}
export const findSite = (query: string, kind?: SiteKind) => matchSite(query, kind)?.site ?? null;

const topOf = (kind: SiteKind) => { const st = useApp.getState(); return computeAnalytics(st.weights, st.assumptions, st.modules).byKind[kind]; };

/** Execute actions in order; returns a human-readable line per action. */
export function runActions(actions: CopilotAction[]): string[] {
  const app = useApp.getState(), log: string[] = [];
  for (const a of actions) {
    switch (a.name) {
      case 'fly_to_site': {
        const s = findSite(a.input.query);
        if (!s) { log.push(`Couldn't find "${a.input.query}"`); break; }
        app.set({ module: 'solar' }); app.select(s.id, s.kind); log.push(`Flew to ${s.name}`); break;
      }
      case 'show_ranking':
        app.set({ module: 'solar', tab: a.input.kind, listQuery: a.input.search ?? '', hideBlockers: !!a.input.hide_blockers });
        log.push(`Showing ${a.input.kind === 'roof' ? 'rooftops' : a.input.kind === 'carpark' ? 'car parks' : 'CREAM homes'}${a.input.search ? ` matching "${a.input.search}"` : ''}${a.input.hide_blockers ? ' without blockers' : ''}`); break;
      case 'set_sun': {
        const { month, day, hour, play } = a.input, cur = useApp.getState().sun;
        app.setSun({ month: month ?? cur.month, day: day ?? (month ? 21 : cur.day), hour: hour !== null ? Math.max(6.5, Math.min(20, hour)) : cur.hour });
        if (play !== null) app.set({ playing: play });
        log.push(`Sun set to ${(month ?? cur.month)}/${day ?? (month ? 21 : cur.day)} ${hour !== null ? `${Math.floor(hour)}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}` : ''}${play ? ', playing the day' : ''}`); break;
      }
      case 'set_weights': {
        const c = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
        app.set({ weights: { capacity: c(a.input.capacity), shading: c(a.input.shading), demand: c(a.input.demand), readiness: c(a.input.readiness) } });
        log.push('Re-weighted the solar score'); break;
      }
      case 'set_layers':
        for (const k of ['heat', 'shadows', 'panels', 'canopies', 'labels'] as const) if (a.input[k] !== null) app.toggleLayer(k, a.input[k]!);
        log.push('Updated map layers'); break;
      case 'set_map_style': app.set({ mapStyle: a.input.style }); log.push(`${a.input.style[0].toUpperCase()}${a.input.style.slice(1)} look`); break;
      case 'design_canopy': {
        const s = findSite(a.input.query, 'carpark') ?? (/big|large/i.test(a.input.query) ? [...getSites().sites].filter((x) => x.kind === 'carpark').sort((x, y) => y.area - x.area)[0] : topOf('carpark')[0]?.site);
        if (!s) { log.push('No car park found'); break; }
        app.set({ module: 'solar' }); app.select(s.id, 'carpark'); app.toggleIn('canopies', s.id, true); log.push(`Designed a solar canopy on ${s.name}`); break;
      }
      case 'open_module':
        app.set({ module: a.input.module });
        if (a.input.module === 'ecospec' && a.input.use_case) useEco.getState().set({ useCaseId: a.input.use_case });
        log.push(`Opened ${a.input.module === 'solar' ? 'SolarTwin' : a.input.module === 'panelspec' ? 'Solar Panels' : a.input.module === 'ecospec' ? 'Canopy Materials' : 'the Net-Zero dashboard'}`); break;
      case 'add_to_portfolio': {
        const s = findSite(a.input.query);
        if (!s) { log.push(`Couldn't find "${a.input.query}"`); break; }
        app.toggleIn('portfolio', s.id, true); log.push(`Added ${s.name} to the portfolio`); break;
      }
      case 'join_cream_pool': {
        const n = Math.max(1, Math.min(50, Math.round(a.input.top_n)));
        const rows = topOf('home').slice(0, n);
        for (const r of rows) app.toggleIn('creamPool', r.site.id, true);
        app.set({ module: 'solar', tab: 'home' });
        log.push(`Enrolled ${rows.reduce((t, r) => t + r.site.homes, 0)} homes (${n} rows) in the CREAM pool`); break;
      }
    }
  }
  return log;
}

const MONTHS = ['jan(uary)?', 'feb(ruary)?', 'mar(ch)?', 'apr(il)?', 'may', 'june?', 'july?', 'aug(ust)?', 'sep(t|tember)?', 'oct(ober)?', 'nov(ember)?', 'dec(ember)?'];

/** Offline fallback: a handful of keyword rules covering the demo commands. */
export function offlineCopilot(text: string): { actions: CopilotAction[]; reply: string } {
  const t = text.toLowerCase(), actions: CopilotAction[] = [];
  const kind: SiteKind | null = /car ?park|canop|carport/.test(t) ? 'carpark' : /home|terrace|house|cream|resident/.test(t) ? 'home' : /roof|mall|building|school/.test(t) ? 'roof' : null;

  if (/night/.test(t)) actions.push({ name: 'set_map_style', input: { style: 'night' } });
  else if (/blueprint/.test(t)) actions.push({ name: 'set_map_style', input: { style: 'blueprint' } });
  else if (/satellite/.test(t)) actions.push({ name: 'set_map_style', input: { style: 'satellite' } });

  const month = MONTHS.findIndex((m) => new RegExp(`\\b${m}\\b`).test(t)) + 1 ||(/solstice/.test(t) ? 12 : /equinox/.test(t) ? 3 : null);
  const hm = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  let hour: number | null = hm ? (+hm[1] % 12) + (hm[3] === 'pm' ? 12 : 0) + (hm[2] ? +hm[2] / 60 : 0) : /noon|midday/.test(t) ? 13.2 : /sunset|evening/.test(t) ? 18.6 : /morning|sunrise/.test(t) ? 8 : null;
  if (hour !== null) hour = Math.max(6.5, Math.min(20, hour));
  const play = /play|animate|time.?lapse|sweep/.test(t) ? true : null;
  if (month || hour !== null || play) actions.push({ name: 'set_sun', input: { month: month || null, day: null, hour, play } });

  if (/shad/.test(t) && /priorit|weight|focus|least|low/.test(t)) actions.push({ name: 'set_weights', input: { capacity: 20, shading: 60, demand: 15, readiness: 5 } });
  if (/demand|self.?consum/.test(t) && /priorit|weight|focus|best/.test(t)) actions.push({ name: 'set_weights', input: { capacity: 20, shading: 15, demand: 60, readiness: 5 } });

  const join = t.match(/(?:join|enrol|enroll|add)\D*(\d+)\D*(?:home|terrace|row|house)/);
  if (join || /join .*cream|cream pool/.test(t)) actions.push({ name: 'join_cream_pool', input: { top_n: join ? +join[1] : 10 } });
  else if (/canop|carport/.test(t) && /design|build|add|put/.test(t)) actions.push({ name: 'design_canopy', input: { query: findSite(text, 'carpark')?.name ?? (/big|large/.test(t) ? 'biggest' : 'best') } });
  else if (/panelspec|pv (module|panel)|solar panel|panel spec/.test(t)) actions.push({ name: 'open_module', input: { module: 'panelspec', use_case: null } });
  else if (/ecospec|material|concrete|paver|supplier|greenwash/.test(t)) actions.push({ name: 'open_module', input: { module: 'ecospec', use_case: /paver|paving/.test(t) ? 'paver-80' : /concrete/.test(t) ? 'concrete-c30' : null } });
  else if (/dashboard|net.?zero|ssr|ifrs/.test(t) && !/add/.test(t)) actions.push({ name: 'open_module', input: { module: 'dashboard', use_case: null } });
  else {
    // Offline, only act on a confident name match (every meaningful word of the request appears in the site name).
    const m = matchSite(text), site = m && m.score >= 50 ? m.site : null;
    if (site && /add .*portfolio/.test(t)) actions.push({ name: 'add_to_portfolio', input: { query: site.name } });
    else if (site && (/fly|go to|zoom|show|open|select|take me/.test(t) || norm(text).length < 40)) actions.push({ name: 'fly_to_site', input: { query: site.name } });
    else if (kind) actions.push({ name: 'show_ranking', input: { kind, search: null, hide_blockers: /no blocker|without blocker|ready/.test(t) } });
  }
  return { actions, reply: actions.length ? '' : 'Offline mode understands map, time, ranking, canopy, CREAM, solar panels, canopy materials and dashboard commands. Add an API key for free-form requests.' };
}
