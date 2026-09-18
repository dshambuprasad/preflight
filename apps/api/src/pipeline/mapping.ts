// 08 §2 basic header mapping (M1 basic; the M4 wizard replaces the UI, not this table).
import { normaliseConsent, normaliseEmail, normaliseLanguage, normalisePhone } from '@preflight/core';
import type { ConsentState } from '@preflight/core';

export type Target = 'externalId' | 'phone' | 'email' | 'preferredLanguage' | 'consentPromotional' | `attribute:${string}` | 'ignore';

const ALIASES: Record<string, Target> = {
  id: 'externalId', customerid: 'externalId', externalid: 'externalId', custid: 'externalId',
  phone: 'phone', mobile: 'phone', msisdn: 'phone', contactnumber: 'phone', phonenumber: 'phone', mobilenumber: 'phone',
  email: 'email', emailid: 'email', emailaddress: 'email',
  language: 'preferredLanguage', preferredlanguage: 'preferredLanguage', lang: 'preferredLanguage', preflang: 'preferredLanguage',
  consent: 'consentPromotional', consentpromotional: 'consentPromotional', promoconsent: 'consentPromotional', optin: 'consentPromotional',
  state: 'attribute:state', region: 'attribute:state',
};

export function suggestMapping(headers: readonly string[]): Record<string, Target> {
  const out: Record<string, Target> = {};
  const taken = new Set<Target>();
  for (const h of headers) {
    const key = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = ALIASES[key];
    if (target && !target.startsWith('attribute:') && taken.has(target)) continue; // at most one column per target (15 §6)
    if (target) {
      out[h] = target;
      taken.add(target);
    }
  }
  return out;
}

export interface NormalisedRow {
  externalId: string | null;
  phoneE164: string | null;
  emailNorm: string | null;
  preferredLanguage: string | null;
  consentPromotional: ConsentState | null;
  attributes: Record<string, string>;
}

export function normaliseRow(raw: Record<string, string>, mapping: Record<string, Target>, consentValueMap?: { granted?: string[]; denied?: string[] }): NormalisedRow {
  const out: NormalisedRow = { externalId: null, phoneE164: null, emailNorm: null, preferredLanguage: null, consentPromotional: null, attributes: {} };
  for (const [header, target] of Object.entries(mapping)) {
    const value = raw[header];
    if (value === undefined) continue;
    switch (target) {
      case 'externalId': out.externalId = value.trim() || null; break;
      case 'phone': out.phoneE164 = normalisePhone(value); break;
      case 'email': out.emailNorm = normaliseEmail(value); break;
      case 'preferredLanguage': out.preferredLanguage = normaliseLanguage(value); break;
      case 'consentPromotional': out.consentPromotional = normaliseConsent(value, consentValueMap); break;
      case 'ignore': break;
      default:
        if (target.startsWith('attribute:')) out.attributes[target.slice('attribute:'.length)] = value;
    }
  }
  return out;
}
