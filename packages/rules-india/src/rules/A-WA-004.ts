// A-WA-004 — Audience size within the number's current messaging tier (Meta). Tier 1.
import type { Rule } from '@preflight/core';
import { META_WA } from '../citations.js';
import { PACK_ID, cannot } from '../helpers.js';

const TIER_LIMIT: Record<string, number> = {
  TIER_250: 250, TIER_1K: 1000, TIER_10K: 10_000, TIER_100K: 100_000, TIER_UNLIMITED: Number.POSITIVE_INFINITY,
};

export const rule: Rule = {
  id: 'A-WA-004',
  pack: PACK_ID,
  layer: 'A',
  tier: 1,
  category: 'audience',
  title: 'Audience size within the current WhatsApp messaging tier',
  severity: 'warn',
  citation: META_WA,
  requires: ['platform.messagingLimit'],
  appliesTo: (ctx) => ctx.campaign.channel === 'whatsapp',
  evaluate(ctx) {
    const tier = ctx.platform?.messagingLimitTier;
    if (!tier) return cannot(['platform.messagingLimit']);
    const limit = TIER_LIMIT[tier];
    if (limit === undefined) return cannot(['platform.messagingLimit'], `unknown tier ${tier}`);
    const size = ctx.audience.rows - ctx.audience.duplicates.length;
    if (size <= limit) return { status: 'pass', detail: { tier, limit, size } };
    return { status: 'fail', affected: [], what: { kind: 'rows' }, detail: { tier, limit, size, excess: size - limit } };
  },
  explain(_ctx, result) {
    const d = result.detail ?? {};
    return `The audience of ${String(d.size)} exceeds the number's 24-hour messaging limit of ${String(d.limit)} (${String(d.tier)}); about ${String(d.excess)} messages would fail.`;
  },
};
