// A-WA-005 — Quality-rating gate before a large marketing send (Meta). Tier 1.
import type { Rule } from '@preflight/core';
import { META_WA } from '../citations.js';
import { PACK_ID, cannot, isPromotional } from '../helpers.js';

export const rule: Rule = {
  id: 'A-WA-005',
  pack: PACK_ID,
  layer: 'A',
  tier: 1,
  category: 'delivery',
  title: 'WhatsApp quality rating is healthy before a marketing send',
  severity: 'warn',
  citation: META_WA,
  requires: ['platform.qualityRating'],
  note: 'No provider exposes a block/report event; the rating is the only, lagging, signal. Never imply the product can see complaints.',
  appliesTo: (ctx) => ctx.campaign.channel === 'whatsapp' && isPromotional(ctx),
  evaluate(ctx) {
    const rating = ctx.platform?.qualityRating;
    if (!rating) return cannot(['platform.qualityRating']);
    if (rating === 'GREEN') return { status: 'pass', detail: { rating } };
    if (rating === 'UNKNOWN') return cannot(['platform.qualityRating'], 'platform reports the rating as UNKNOWN');
    return { status: 'fail', affected: [], what: { kind: 'config', field: 'platform.qualityRating', excerpt: rating }, detail: { rating } };
  },
  explain(_ctx, result) {
    return `The sending number's quality rating is ${String(result.detail?.rating)}. A marketing blast into a degraded rating accelerates throttling and can flip the rating within 24 hours.`;
  },
};
