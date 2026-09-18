// A-RBI-002 — Microfinance recovery contact only between 09:00 and 18:00 IST. Ported verbatim (D42).
import type { Rule } from '@preflight/core';
import { missing } from '@preflight/core';
import { RBI_RECOVERY_2022 } from '../citations.js';
import { PACK_ID, allIds, cannot, rescheduleFix, windowCheck } from '../helpers.js';

const WINDOW = ['09:00', '18:00'] as const;

export const rule: Rule = {
  id: 'A-RBI-002',
  pack: PACK_ID,
  layer: 'A',
  tier: 0,
  category: 'timing',
  title: 'Microfinance recovery contact only between 09:00 and 18:00 IST',
  severity: 'block',
  citation: RBI_RECOVERY_2022,
  requires: ['campaign.purpose', 'campaign.borrowerSegment', 'campaign.scheduledAt'],
  appliesTo: (ctx) => {
    if (missing(ctx.campaign.borrowerSegment)) return 'unknown';
    return ctx.campaign.purpose === 'collections' && ctx.campaign.borrowerSegment === 'microfinance';
  },
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
      return `Send window ${String(d.sendTimeIST)}–${String(d.sendWindowEnd)} IST runs outside the ${String(d.window)} window for microfinance recovery contact. All ${ctx.contacts.length} recipients affected.`;
    }
    return (
      `Scheduled for ${String(d.sendTimeIST)} IST — outside the ${String(d.window)} window for microfinance recovery contact. ` +
      `All ${ctx.contacts.length} recipients affected. Microfinance borrowers get the narrower window.`
    );
  },
  suggestFix: (ctx) => rescheduleFix(ctx, WINDOW[0]),
};
