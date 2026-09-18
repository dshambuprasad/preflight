// A-RBI-012 — Sales calls/visits only between 09:00 and 19:00 IST (85N(4)). Ported verbatim (D42).
import type { Rule } from '@preflight/core';
import { RBI_RBC_2026 } from '../citations.js';
import { PACK_ID, allIds, cannot, rescheduleFix, windowCheck } from '../helpers.js';

const WINDOW = ['09:00', '19:00'] as const;

export const rule: Rule = {
  id: 'A-RBI-012',
  pack: PACK_ID,
  layer: 'A',
  tier: 0,
  category: 'timing',
  title: 'Sales calls/visits only between 09:00 and 19:00 IST',
  severity: 'block',
  severityBefore: 'warn',
  effectiveFrom: '2027-01-01',
  citation: RBI_RBC_2026,
  requires: ['campaign.scheduledAt', 'campaign.channel'],
  note: 'Para 85N(4): "telephonic contacts and / or visits to customers normally between 09:00 hours and 19:00 hours". PRIMARY text covers CALLS AND VISITS, not messages — secondary reporting overstated this as a messaging window. Inert for whatsapp/sms/email; retained for a future voice channel.',
  appliesTo: (ctx) => ['voice', 'visit'].includes(ctx.campaign.channel) && ctx.effectivePurpose === 'promotional',
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
    return (
      `Scheduled for ${String(d.sendTimeIST)} IST — outside the ${String(d.window)} window for sales and promotional contact. ` +
      `All ${ctx.contacts.length} recipients affected. Note this is a NARROWER window than the 08:00–19:00 recovery one; ` +
      `the two are easy to confuse.`
    );
  },
  suggestFix: (ctx) => rescheduleFix(ctx, WINDOW[0]),
};
