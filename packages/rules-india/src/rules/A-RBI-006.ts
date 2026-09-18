// A-RBI-006 — Explicit consent before promotional communication (85L; 1 Jan 2027). Ported (D42).
import type { Rule } from '@preflight/core';
import { missing } from '@preflight/core';
import { RBI_RBC_2026 } from '../citations.js';
import { PACK_ID, dropRowsFix, isPromotional } from '../helpers.js';

export const rule: Rule = {
  id: 'A-RBI-006',
  pack: PACK_ID,
  layer: 'A',
  tier: 0,
  category: 'consent',
  title: 'Explicit consent before promotional communication',
  severity: 'block',
  severityBefore: 'warn',
  effectiveFrom: '2027-01-01',
  citation: RBI_RBC_2026,
  requires: ['contact.consentPromotional'],
  appliesTo: (ctx) => isPromotional(ctx),
  evaluate(ctx) {
    const stated = ctx.contacts.filter((c) => !missing(c.consentPromotional));
    if (stated.length === 0) {
      return { status: 'cannot_evaluate', missing: ['contact.consentPromotional'] };
    }
    const noConsent = ctx.contacts.filter((c) => c.consentPromotional !== 'granted'); // unknown/denied/absent is NOT consent
    if (noConsent.length === 0) return { status: 'pass' };
    return {
      status: 'fail',
      affected: noConsent.map((c) => c.id),
      what: { kind: 'rows' },
      detail: {
        unknownCount: ctx.contacts.length - stated.length,
        note: 'Contacts with no recorded consent are counted as not consented. Absence of a record is not consent.',
      },
    };
  },
  explain(ctx, result) {
    const n = result.affected.length;
    const d = result.detail ?? {};
    return (
      `${n} of ${ctx.contacts.length} recipients have no recorded consent for promotional communication.` +
      (d.unknownCount ? ` (${String(d.unknownCount)} have no consent field at all — absence of a record is not consent.)` : '')
    );
  },
  suggestFix: (_ctx, result) => dropRowsFix(result.affected, `Drop ${result.affected.length} recipient${result.affected.length === 1 ? '' : 's'} without consent`),
};
