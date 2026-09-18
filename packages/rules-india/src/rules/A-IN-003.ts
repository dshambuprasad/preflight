// A-IN-003 — Message correctly classified promotional vs service (the gate). Tier 0; per variant.
import type { Rule } from '@preflight/core';
import { classify, missing } from '@preflight/core';
import { RBI_RBC_2026_DERIVED } from '../citations.js';
import { PACK_ID } from '../helpers.js';

export const rule: Rule = {
  id: 'A-IN-003',
  pack: PACK_ID,
  layer: 'A',
  tier: 0,
  category: 'content',
  title: 'Message purpose is unambiguous (promotional vs service)',
  severity: 'info',
  citation: RBI_RBC_2026_DERIVED,
  requires: ['campaign.message'],
  perVariant: true,
  note: 'A gate, not an obligation: it decides whether the consent, DND and opt-out rules apply. Low confidence is evaluated under the stricter (promotional) reading and reported here.',
  appliesTo: () => true,
  evaluate(ctx) {
    if (!missing(ctx.campaign.purpose)) return { status: 'pass', detail: { declared: ctx.campaign.purpose } };
    const c = classify(ctx.campaign.message, ctx.config.classificationMarkers ?? {});
    if (c.confidence === 'high') return { status: 'pass', detail: { classification: c.classification } };
    return {
      status: 'fail',
      affected: [],
      what: { kind: 'message_text', excerpt: String(ctx.campaign.message ?? '') },
      detail: { classification: c.classification, promotionalMarkers: c.promotionalMarkers, serviceMarkers: c.serviceMarkers },
    };
  },
  explain(_ctx, result) {
    const d = result.detail ?? {};
    return `Purpose not stated and the message reads as ${String(d.classification).toUpperCase()} (low confidence). It was evaluated under the stricter promotional reading — set Purpose to be precise.`;
  },
};
