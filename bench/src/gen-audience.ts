// Seeded PRNG audience generator (11 §5) — runs are comparable. Synthetic +91 98123 4xxxx numbers only (11 §6).
import type { Contact } from '@preflight/core';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LANGS = ['english', 'hindi', 'tamil', 'telugu', 'marathi', 'kannada', 'bengali', null];
const CONSENT = ['granted', 'granted', 'denied', 'unknown', null] as const;

export function genContacts(n: number, seed = 42, dupeRate = 0): Contact[] {
  const rnd = mulberry32(seed);
  const out: Contact[] = [];
  for (let i = 0; i < n; i++) {
    const dupe = i > 0 && rnd() < dupeRate;
    const base = dupe ? Math.floor(rnd() * i) : i;
    const phone = `+91981234${String(base % 100000).padStart(5, '0')}`;
    out.push({
      id: `row-${i + 1}`,
      externalId: `B-${base}`,
      phoneE164: phone,
      identityKey: `ext:B-${base}`,
      preferredLanguage: LANGS[Math.floor(rnd() * LANGS.length)] ?? null,
      consentPromotional: CONSENT[Math.floor(rnd() * CONSENT.length)] ?? null,
    });
  }
  return out;
}
