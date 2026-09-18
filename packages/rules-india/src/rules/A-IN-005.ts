// A-IN-005 — Withdrawal honoured across all channels (DPDP s.6). Tier 1.
import type { Rule } from '@preflight/core';
import { DPDP_2023 } from '../citations.js';
import { PACK_ID, cannot, dropRowsFix, isPromotional } from '../helpers.js';

const CHANNELS = ['whatsapp', 'sms', 'email', 'voice'] as const;

export const rule: Rule = {
  id: 'A-IN-005',
  pack: PACK_ID,
  layer: 'A',
  tier: 1,
  category: 'consent',
  title: 'Consent withdrawal honoured across all channels',
  severity: 'block',
  citation: DPDP_2023,
  requires: ['consent.current'],
  note: 'Opting out on SMS must stop WhatsApp and email too. v1 identity is exact-match on external id, phone or email — stated in the coverage line.',
  appliesTo: (ctx) => isPromotional(ctx),
  evaluate(ctx) {
    if (!ctx.consent) return cannot(['consent.current']);
    const affected = ctx.contacts
      .filter((c) => c.identityKey && !c.identityKey.startsWith('row:'))
      .filter((c) => CHANNELS.some((ch) => ctx.consent!.current(c.identityKey!, 'promotional', ch)?.state === 'denied'))
      .map((c) => c.id);
    if (affected.length === 0) return { status: 'pass' };
    return { status: 'fail', affected, what: { kind: 'rows' }, detail: { channels: CHANNELS } };
  },
  explain(ctx, result) {
    const n = result.affected.length;
    return `${n} recipient${n === 1 ? '' : 's'} withdrew promotional consent on another channel; the withdrawal applies to ${ctx.campaign.channel} as well.`;
  },
  suggestFix: (_ctx, result) => dropRowsFix(result.affected, `Drop ${result.affected.length} withdrawn recipient${result.affected.length === 1 ? '' : 's'}`),
};
