// Identity normalisation (08 §2, 16 §4: lives in core, never in api/web).
// libphonenumber-js `min` metadata is the one runtime dependency of core (12 §H D39).
// Its metadata is versioned: an update can change phone_e164 and therefore identity keys —
// treated as a re-resolution event (09 §5, 17).

import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import type { ConsentState } from './types.js';

export type PhoneRegion = 'IN';

/** E.164 or null. Invalid, short-code and emergency numbers are null (the raw value is kept by the caller). */
export function normalisePhone(raw: unknown, region: PhoneRegion = 'IN'): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  let s = String(raw).trim();
  if (!s) return null;
  // Common Indian export formats: "91 98123 40001", "0091...", "919812340001" (country code, no plus).
  const digits = s.replace(/[\s\-().]/g, '');
  if (/^00\d+$/.test(digits)) s = '+' + digits.slice(2);
  else if (region === 'IN' && /^91\d{10}$/.test(digits)) s = '+' + digits;
  try {
    const p = parsePhoneNumberFromString(s, region);
    if (!p || !p.isValid()) return null;
    return p.number;
  } catch {
    return null;
  }
}

/** trim + lowercase; a stable key, not a validity oracle (17). Invalid shape → null. */
export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  if (!s || /\s/.test(s)) return null;
  const at = s.indexOf('@');
  if (at <= 0 || at !== s.lastIndexOf('@') || at === s.length - 1) return null;
  return s;
}

const GRANTED = /^(y|yes|true|1|granted|opt(ed)?[-_ ]?in)$/i;
const DENIED = /^(n|no|false|0|denied|opt(ed)?[-_ ]?out)$/i;

/**
 * 08 §2 — blank → null (field absent), which is different from 'unknown' (field present, value unclear).
 * `valueMap` (ColumnMapping.consentValueMap) extends the built-in vocab.
 */
export function normaliseConsent(
  raw: unknown,
  valueMap: { granted?: string[]; denied?: string[] } = {},
): ConsentState | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'boolean') return raw ? 'granted' : 'denied';
  const s = String(raw).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if ((valueMap.granted ?? []).some((v) => v.toLowerCase() === lower)) return 'granted';
  if ((valueMap.denied ?? []).some((v) => v.toLowerCase() === lower)) return 'denied';
  if (GRANTED.test(s)) return 'granted';
  if (DENIED.test(s)) return 'denied';
  return 'unknown';
}

/** D37 — deny wins across sources: denied > unknown > granted > null. */
export function strictestConsent(...states: (ConsentState | null | undefined)[]): ConsentState | null {
  const rank: Record<ConsentState, number> = { granted: 1, unknown: 2, denied: 3 };
  let best: ConsentState | null = null;
  for (const s of states) {
    if (!s) continue;
    if (best === null || rank[s] > rank[best]) best = s;
  }
  return best;
}
