// A-IN-003 — promotional vs service classification (04 §5).
//
// This is a GATE, not a rule: it decides whether the consent, DND and opt-out rules
// apply at all. Getting it wrong silently switches four other rules off, so the
// failure mode is deliberately asymmetric:
//
//   - clearly service        -> 'service'
//   - clearly promotional    -> 'promotional'
//   - both signals present   -> 'mixed'    (the dangerous, common real-world case)
//   - neither                -> 'unknown'
//
// 'mixed' and 'unknown' are BOTH evaluated as promotional downstream (the stricter
// reading). The engine reports the ambiguity rather than hiding it. (D12)
//
// Deterministic keyword heuristic on purpose. The M5 advisory classifier may only tighten.
// Marker lists are tenant-extensible (22 B8) — built-ins below, tenant additions appended.

import type { Classification } from './types.js';

const PROMOTIONAL = [
  'offer', 'offers', 'discount', 'cashback', 'pre-approved', 'preapproved',
  'pre-qualified', 'prequalified', 'limited time', 'limited period', 'apply now',
  'upgrade', 'exclusive', 'special price', 'sale', 'lowest rate', 'best rate',
  'instant loan', 'top-up', 'top up', 'refer', 'bonus', 'reward', 'free',
  'hurry', 'last chance', "don't miss", 'claim now', 'avail',
];

const SERVICE = [
  'emi', 'due', 'overdue', 'statement', 'receipt', 'payment received', 'credited',
  'debited', 'otp', 'one time password', 'balance', 'reminder', 'installment',
  'instalment', 'outstanding', 'repayment', 'auto-debit', 'auto debit', 'nach',
  'mandate', 'account number', 'transaction', 'kyc',
];

function hits(haystack: string, needles: readonly string[]): string[] {
  const found: string[] = [];
  for (const n of needles) if (n && haystack.includes(n)) found.push(n);
  return found;
}

export interface ClassificationMarkers {
  promotional?: string[];
  service?: string[];
}

export function classify(message: unknown, extra: ClassificationMarkers = {}): Classification {
  const text = String(message ?? '').toLowerCase();
  const promotionalMarkers = hits(text, [...PROMOTIONAL, ...(extra.promotional ?? []).map((m) => m.toLowerCase())]);
  const serviceMarkers = hits(text, [...SERVICE, ...(extra.service ?? []).map((m) => m.toLowerCase())]);
  const p = promotionalMarkers.length > 0;
  const s = serviceMarkers.length > 0;

  if (p && s)
    return {
      classification: 'mixed', evaluateAs: 'promotional', confidence: 'low',
      promotionalMarkers, serviceMarkers,
      reason:
        'Contains both service and promotional language. Evaluated under the stricter (promotional) reading. A service message that also promotes is the most common way lenders breach promotional-consent rules.',
    };
  if (p)
    return {
      classification: 'promotional', evaluateAs: 'promotional', confidence: 'high',
      promotionalMarkers, serviceMarkers,
      reason: 'Promotional language detected.',
    };
  if (s)
    return {
      classification: 'service', evaluateAs: 'service', confidence: 'high',
      promotionalMarkers, serviceMarkers,
      reason: 'Service/transactional language only.',
    };
  return {
    classification: 'unknown', evaluateAs: 'promotional', confidence: 'low',
    promotionalMarkers, serviceMarkers,
    reason:
      'No decisive markers found. Evaluated under the stricter (promotional) reading — this is a guess and should be confirmed.',
  };
}
