// A-RBI-004 — Recovery agent identity sent to borrower before first contact (DLD 2025 para 8(v)). Tier 1.
import type { Rule } from '@preflight/core';
import { missing } from '@preflight/core';
import { RBI_DLD_2025 } from '../citations.js';
import { PACK_ID, cannot } from '../helpers.js';

export const rule: Rule = {
  id: 'A-RBI-004',
  pack: PACK_ID,
  layer: 'A',
  tier: 1,
  category: 'identity',
  title: 'Recovery agent identity sent to borrower before first contact',
  severity: 'block',
  citation: RBI_DLD_2025,
  requires: ['campaign.purpose', 'history.contactEvents'],
  note: 'A sequence rule: it needs each borrower\'s prior contact history. Cold-start applies — with no history it reports cannot evaluate, never pass.',
  appliesTo: (ctx) => (missing(ctx.campaign.purpose) ? 'unknown' : ctx.campaign.purpose === 'collections'),
  evaluate(ctx) {
    if (!ctx.history) return cannot(['history.contactEvents']);
    // SPEC-GAP: no connector exposes an "agent details sent" event; the proxy used here is "any prior
    // outbound contact exists for this borrower". A borrower with no history at all cannot be shown to
    // have been notified and is reported, not passed.
    const to = ctx.campaign.scheduledAt;
    const affected = ctx.contacts
      .filter((c) => c.identityKey && !c.identityKey.startsWith('row:'))
      .filter((c) => {
        const events = ctx.history!.events(c.identityKey!, '1970-01-01T00:00:00Z', to);
        return !events.some((e) => e.kind === 'sent' || e.kind === 'delivered' || e.kind === 'read');
      })
      .map((c) => c.id);
    if (affected.length === 0) return { status: 'pass' };
    return { status: 'fail', affected, what: { kind: 'rows' }, detail: { proxy: 'no prior outbound contact on record' } };
  },
  explain(_ctx, result) {
    const n = result.affected.length;
    return `${n} borrower${n === 1 ? '' : 's'} have no prior contact on record, so the recovery agent's details cannot be shown to have reached them before this first contact.`;
  },
};
