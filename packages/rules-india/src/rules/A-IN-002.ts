// A-IN-002 — DND/NCPR scrubbing for promotional SMS and voice (TCCCPR 2018). Tier 1.
import type { Rule } from '@preflight/core';
import { TRAI_TCCCPR_2018 } from '../citations.js';
import { PACK_ID, cannot, dropRowsFix, isPromotional } from '../helpers.js';

export const rule: Rule = {
  id: 'A-IN-002',
  pack: PACK_ID,
  layer: 'A',
  tier: 1,
  category: 'consent',
  title: 'Promotional SMS/voice scrubbed against the DND register',
  severity: 'block',
  citation: TRAI_TCCCPR_2018,
  requires: ['campaign.channel', 'consent.dnd'],
  note: 'Numbers on the National Customer Preference Register must not receive promotional SMS or voice. Not applicable to WhatsApp or email.',
  appliesTo: (ctx) => ['sms', 'voice'].includes(ctx.campaign.channel) && isPromotional(ctx),
  evaluate(ctx) {
    if (!ctx.consent || typeof ctx.consent.dnd !== 'function') return cannot(['consent.dnd']);
    const affected = ctx.contacts
      .filter((c) => c.identityKey && !c.identityKey.startsWith('row:'))
      .filter((c) => ctx.consent!.dnd!(c.identityKey!) === true)
      .map((c) => c.id);
    if (affected.length === 0) return { status: 'pass' };
    return { status: 'fail', affected, what: { kind: 'rows' }, detail: { register: 'NCPR' } };
  },
  explain(_ctx, result) {
    const n = result.affected.length;
    return `${n} recipient${n === 1 ? '' : 's'} are registered on the DND/NCPR list and must not receive promotional SMS or calls.`;
  },
  suggestFix: (_ctx, result) => dropRowsFix(result.affected, `Drop ${result.affected.length} DND-registered recipient${result.affected.length === 1 ? '' : 's'}`),
};
