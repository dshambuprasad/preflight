// A-IN-004 — Purpose-bound consent for promotional messages (DPDP s.6; 13 May 2027). Tier 0/1.
import type { Rule } from '@preflight/core';
import { missing } from '@preflight/core';
import { DPDP_2023 } from '../citations.js';
import { PACK_ID, dropRowsFix, isPromotional } from '../helpers.js';

export const rule: Rule = {
  id: 'A-IN-004',
  pack: PACK_ID,
  layer: 'A',
  tier: 0,
  category: 'consent',
  title: 'Consent is purpose-bound — service consent does not cover promotion',
  severity: 'block',
  severityBefore: 'warn',
  effectiveFrom: '2027-05-13',
  citation: DPDP_2023,
  requires: ['contact.consentPromotional'],
  note: 'For a lender A-RBI-006 subsumes this and lands 250 days earlier. DPDP is the general case; RBI is the sharp one.',
  appliesTo: (ctx) => isPromotional(ctx),
  evaluate(ctx) {
    const stated = ctx.contacts.filter((c) => !missing(c.consentPromotional));
    if (stated.length === 0) return { status: 'cannot_evaluate', missing: ['contact.consentPromotional'] };
    const affected = ctx.contacts.filter((c) => c.consentPromotional !== 'granted').map((c) => c.id);
    if (affected.length === 0) return { status: 'pass' };
    return { status: 'fail', affected, what: { kind: 'rows' }, detail: { basis: 'DPDP s.6 — consent is specific to the purpose it was given for' } };
  },
  explain(ctx, result) {
    const n = result.affected.length;
    return `${n} of ${ctx.contacts.length} recipients gave no consent specific to promotional use. Under DPDP, consent for service updates does not extend to promotion.`;
  },
  suggestFix: (_ctx, result) => dropRowsFix(result.affected, `Drop ${result.affected.length} recipient${result.affected.length === 1 ? '' : 's'} without promotional consent`),
};
