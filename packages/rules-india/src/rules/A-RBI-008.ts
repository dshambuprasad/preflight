// A-RBI-008 — Promotional message carries an opt-out (85M; 1 Jan 2027). Ported (D42); per variant.
import type { Rule } from '@preflight/core';
import { RBI_RBC_2026 } from '../citations.js';
import { PACK_ID, isPromotional } from '../helpers.js';

export const OPT_OUT_DISCLOSURE = ' Reply STOP to opt out.';

export const rule: Rule = {
  id: 'A-RBI-008',
  pack: PACK_ID,
  layer: 'A',
  tier: 0,
  category: 'content',
  title: 'Promotional message carries an opt-out',
  severity: 'block',
  severityBefore: 'warn',
  effectiveFrom: '2027-01-01',
  citation: RBI_RBC_2026,
  requires: ['campaign.message'],
  perVariant: true,
  note: 'Only the PRESENCE half is a send-time check. "As easy as subscribing" and the dedicated preference link are product obligations inside the lender\'s own app — out of scope, and said so.',
  appliesTo: (ctx) => isPromotional(ctx),
  evaluate(ctx) {
    const t = String(ctx.campaign.message ?? '').toLowerCase();
    const found = ['unsubscribe', 'opt out', 'opt-out', 'stop', 'reply stop', 'to stop'].filter((k) => t.includes(k));
    if (found.length) return { status: 'pass', detail: { found } };
    return {
      status: 'fail',
      affected: [],
      what: { kind: 'message_text', excerpt: String(ctx.campaign.message ?? '') },
      detail: { reason: 'no opt-out instruction found in the message body' },
    };
  },
  explain() {
    return 'This is a promotional message with no opt-out instruction in the body.';
  },
  suggestFix: () => ({ kind: 'add_disclosure', label: 'Append "Reply STOP to opt out."', payload: { append: OPT_OUT_DISCLOSURE } }),
};
