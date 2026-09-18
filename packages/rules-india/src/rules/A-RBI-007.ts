// A-RBI-007 — Per-product consent, not bundled (85G, 85Q; 1 Jan 2027). Tier 1.
import type { Rule } from '@preflight/core';
import { missing } from '@preflight/core';
import { RBI_RBC_2026 } from '../citations.js';
import { PACK_ID, cannot, isPromotional } from '../helpers.js';

export const rule: Rule = {
  id: 'A-RBI-007',
  pack: PACK_ID,
  layer: 'A',
  tier: 1,
  category: 'consent',
  title: 'Per-product consent — promotional consent not bundled',
  severity: 'block',
  severityBefore: 'warn',
  effectiveFrom: '2027-01-01',
  citation: RBI_RBC_2026,
  requires: ['campaign.product', 'consent.productScoped'],
  note: 'Requires the consent store to be product-scoped. Many will not be — which is itself the finding worth surfacing.',
  appliesTo: (ctx) => isPromotional(ctx),
  evaluate(ctx) {
    const missingPaths: string[] = [];
    if (missing(ctx.campaign.product)) missingPaths.push('campaign.product');
    if (!ctx.consent?.productScoped) missingPaths.push('consent.productScoped');
    if (missingPaths.length) return cannot(missingPaths);
    const purpose = `promotional:${String(ctx.campaign.product)}`;
    const affected = ctx.contacts
      .filter((c) => c.identityKey && !c.identityKey.startsWith('row:'))
      .filter((c) => ctx.consent!.current(c.identityKey!, purpose, ctx.campaign.channel)?.state !== 'granted')
      .map((c) => c.id);
    if (affected.length === 0) return { status: 'pass' };
    return { status: 'fail', affected, what: { kind: 'rows' }, detail: { product: ctx.campaign.product } };
  },
  explain(ctx, result) {
    const n = result.affected.length;
    return `${n} of ${ctx.contacts.length} recipients have no consent recorded for the product "${String(ctx.campaign.product)}". Consent for another product does not carry over.`;
  },
};
