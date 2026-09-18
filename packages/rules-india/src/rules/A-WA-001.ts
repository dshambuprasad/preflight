// A-WA-001 — Outside the 24-hour customer-service window, only an approved template (Meta). Tier 1.
import type { Rule } from '@preflight/core';
import { missing } from '@preflight/core';
import { META_WA } from '../citations.js';
import { PACK_ID, cannot } from '../helpers.js';

export const rule: Rule = {
  id: 'A-WA-001',
  pack: PACK_ID,
  layer: 'A',
  tier: 1,
  category: 'delivery',
  title: 'Outside the 24-hour window, only an approved template',
  severity: 'block',
  citation: META_WA,
  requires: ['campaign.channel', 'history.contactEvents'],
  note: 'Needs the last inbound message per contact — available from WATI/DoubleTick, not from Meta Cloud API. Cold-start applies.',
  appliesTo: (ctx) => ctx.campaign.channel === 'whatsapp',
  evaluate(ctx) {
    if (ctx.campaign.template && !missing(ctx.campaign.template.body)) {
      return { status: 'pass', detail: { reason: 'template send — session window does not apply' } };
    }
    if (!ctx.history) return cannot(['history.contactEvents']);
    const to = ctx.campaign.scheduledAt;
    const fromMs = Date.parse(to) - 24 * 3600_000;
    if (Number.isNaN(fromMs)) return cannot(['campaign.scheduledAt']);
    const from = new Date(fromMs).toISOString();
    const affected = ctx.contacts
      .filter((c) => c.identityKey && !c.identityKey.startsWith('row:'))
      .filter((c) => !ctx.history!.events(c.identityKey!, from, to).some((e) => e.kind === 'inbound' && e.channel === 'whatsapp'))
      .map((c) => c.id);
    if (affected.length === 0) return { status: 'pass' };
    return { status: 'fail', affected, what: { kind: 'rows' }, detail: { windowHours: 24 } };
  },
  explain(_ctx, result) {
    const n = result.affected.length;
    return `${n} recipient${n === 1 ? '' : 's'} have no inbound WhatsApp message in the 24 hours before the send, so a free-form message will be rejected — use an approved template.`;
  },
};
