// A-RBI-013 — Promotional DND requests passed by agents must be honoured (85N(7)). Tier 1.
import type { Rule } from '@preflight/core';
import { RBI_RBC_2026 } from '../citations.js';
import { PACK_ID, cannot, dropRowsFix, isPromotional } from '../helpers.js';

export const rule: Rule = {
  id: 'A-RBI-013',
  pack: PACK_ID,
  layer: 'A',
  tier: 1,
  category: 'consent',
  title: 'Bank-internal promotional DND list honoured',
  severity: 'block',
  citation: RBI_RBC_2026,
  requires: ['consent.current'],
  note: 'Checkable once consent_records carries an explicit denied for promotional (from any channel).',
  appliesTo: (ctx) => isPromotional(ctx),
  evaluate(ctx) {
    if (!ctx.consent) return cannot(['consent.current']);
    const affected = ctx.contacts
      .filter((c) => c.identityKey && !c.identityKey.startsWith('row:'))
      .filter((c) => ctx.consent!.current(c.identityKey!, 'promotional', null)?.state === 'denied')
      .map((c) => c.id);
    if (affected.length === 0) return { status: 'pass' };
    return { status: 'fail', affected, what: { kind: 'rows' }, detail: { list: 'promotional DND' } };
  },
  explain(_ctx, result) {
    const n = result.affected.length;
    return `${n} recipient${n === 1 ? ' is' : 's are'} on the promotional do-not-disturb list (an explicit denial is on record) and must not receive this message.`;
  },
  suggestFix: (_ctx, result) => dropRowsFix(result.affected, `Drop ${result.affected.length} DND recipient${result.affected.length === 1 ? '' : 's'}`),
};
