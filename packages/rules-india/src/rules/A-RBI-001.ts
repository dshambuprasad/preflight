// A-RBI-001 — Recovery contact only between 08:00 and 19:00 IST. Ported verbatim from PreflightCore (D42).
import type { Rule } from '@preflight/core';
import { RBI_RECOVERY_2022 } from '../citations.js';
import { PACK_ID, allIds, cannot, rescheduleFix, windowCheck } from '../helpers.js';
import { missing } from '@preflight/core';

const WINDOW = ['08:00', '19:00'] as const;

export const rule: Rule = {
  id: 'A-RBI-001',
  pack: PACK_ID,
  layer: 'A',
  tier: 0,
  category: 'timing',
  title: 'Recovery contact only between 08:00 and 19:00 IST',
  severity: 'block',
  citation: RBI_RECOVERY_2022,
  requires: ['campaign.purpose', 'campaign.scheduledAt'],
  note: 'Covers every form of contact — calls, WhatsApp, SMS and email — not calls alone. HDFC Bank has been penalised under this.',
  appliesTo: (ctx) => (missing(ctx.campaign.purpose) ? 'unknown' : ctx.campaign.purpose === 'collections'),
  evaluate(ctx) {
    const r = windowCheck(ctx, WINDOW[0], WINDOW[1]);
    if (r.status === 'cannot_evaluate') return cannot(r.missing, r.reason);
    if (!r.breach) return { status: 'pass' };
    return {
      status: 'fail',
      affected: allIds(ctx),
      what: { kind: 'schedule', field: 'scheduledAt', excerpt: `${ctx.local?.hhmm} IST` },
      detail: r.detail,
    };
  },
  explain(ctx, result) {
    const d = result.detail ?? {};
    if (d.sendWindowEnd) {
      return `Send window ${String(d.sendTimeIST)}–${String(d.sendWindowEnd)} IST overlaps the period outside the permitted ${String(d.window)} recovery window. All ${ctx.contacts.length} recipients affected.`;
    }
    return (
      `Scheduled for ${String(d.sendTimeIST)} IST — outside the permitted ${String(d.window)} recovery window. ` +
      `All ${ctx.contacts.length} recipients affected. The restriction covers messages, not just calls.`
    );
  },
  suggestFix: (ctx) => rescheduleFix(ctx, WINDOW[0]),
};
