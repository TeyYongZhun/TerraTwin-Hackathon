/* Deterministic evidence rules. The AI extracts what each document says; these rules (not the model) decide
   whether a claim is backed by valid third-party evidence, so the greenwashing verdict is auditable. */
import type { Extraction } from './schema';

export type EvidenceStatus = 'verified' | 'self_declared' | 'expired' | 'missing';
export type Grade = 'verified' | 'partial' | 'unverified';
export interface Greenwash { claim: string; quote: string; page: number; reason: string }
export interface EvidenceFlag { tone: 'red' | 'amber' | 'green'; text: string }
export interface EvidenceResult {
  gwpStatus: EvidenceStatus; epdStatus: 'valid' | 'expired' | 'unverified' | 'none';
  validLabels: string[]; expiredLabels: string[];
  greenwash: Greenwash[]; grade: Grade; flags: EvidenceFlag[];
}

const ECO_LABELS = new Set(['SIRIM_ECO_LABEL', 'MYHIJAU', 'SINGAPORE_GREEN_LABEL']);
const isFuture = (d: string | null, today: Date) => !!d && !Number.isNaN(Date.parse(d)) && new Date(d + 'T23:59:59') >= today;

export function assessEvidence(ex: Extraction, today = new Date()): EvidenceResult {
  const flags: EvidenceFlag[] = [];
  const e = ex.epd;
  const stdOk = e.standards.some((s) => /14025|15804/.test(s));
  const epdStatus: EvidenceResult['epdStatus'] = !e.present ? 'none'
    : e.valid_until && !isFuture(e.valid_until, today) ? 'expired'
      : e.third_party_verified && stdOk && isFuture(e.valid_until, today) ? 'valid' : 'unverified';

  const labels = ex.certifications.filter((c) => ECO_LABELS.has(c.scheme));
  const validLabels = labels.filter((c) => isFuture(c.valid_until, today)).map((c) => `${c.name}${c.certificate_number ? ' ' + c.certificate_number : ''}`);
  const expiredLabels = labels.filter((c) => c.valid_until && !isFuture(c.valid_until, today)).map((c) => `${c.name}${c.certificate_number ? ' ' + c.certificate_number : ''} (expired ${c.valid_until})`);

  const gwpStatus: EvidenceStatus = ex.gwp.value === null ? 'missing'
    : ex.gwp.basis === 'epd' && epdStatus === 'valid' ? 'verified'
      : ex.gwp.basis === 'epd' && epdStatus === 'expired' ? 'expired' : 'self_declared';

  const thirdParty = epdStatus === 'valid' || validLabels.length > 0;
  const greenwash: Greenwash[] = [];
  for (const c of ex.claims) {
    const cited = (c.cited_evidence ?? '').toLowerCase();
    const citesExpired = !!cited && ex.certifications.some((x) => x.certificate_number && cited.includes(x.certificate_number.toLowerCase()) && !isFuture(x.valid_until, today));
    if (citesExpired) greenwash.push({ claim: c.claim, quote: c.quote, page: c.page, reason: 'Claim relies on an expired certificate' });
    else if (!thirdParty) greenwash.push({ claim: c.claim, quote: c.quote, page: c.page, reason: 'Unverified claim: missing SIRIM Eco-Label / MyHIJAU certificate or ISO 14025 EPD' });
    else if (/carbon[- ]neutral|net[- ]zero|zero[- ]impact/i.test(c.claim + c.quote) && epdStatus !== 'valid') greenwash.push({ claim: c.claim, quote: c.quote, page: c.page, reason: 'Absolute "carbon neutral / zero impact" claim without a verified EPD' });
  }

  if (epdStatus === 'valid') flags.push({ tone: 'green', text: `Verified EPD ${e.registration_number ?? ''} (${e.standards.join(', ')}), valid to ${e.valid_until}` });
  else if (epdStatus === 'expired') flags.push({ tone: 'red', text: `EPD expired ${e.valid_until}` });
  else if (epdStatus === 'unverified') flags.push({ tone: 'amber', text: 'EPD present but third-party verification / ISO 14025 not evidenced' });
  for (const l of validLabels) flags.push({ tone: 'green', text: `Eco-label: ${l}` });
  for (const l of expiredLabels) flags.push({ tone: 'red', text: `Expired eco-label: ${l}` });
  if (gwpStatus === 'self_declared') flags.push({ tone: 'amber', text: 'Carbon figure is self-declared (no verified EPD)' });
  if (gwpStatus === 'missing') flags.push({ tone: 'red', text: 'No embodied-carbon figure provided' });
  for (const g of greenwash) flags.push({ tone: 'red', text: `⚠ Greenwashing risk: "${g.claim}" (${g.reason})` });

  const grade: Grade = greenwash.length || gwpStatus === 'missing' || gwpStatus === 'expired' ? 'unverified'
    : gwpStatus === 'verified' ? 'verified' : validLabels.length ? 'partial' : 'unverified';
  return { gwpStatus, epdStatus, validLabels, expiredLabels, greenwash, grade, flags };
}
