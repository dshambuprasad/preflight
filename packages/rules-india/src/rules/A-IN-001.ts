// A-IN-001 — Promotional SMS on a registered DLT header + registered template (TCCCPR 2018). Tier 1.
import type { Rule } from '@preflight/core';
import { TRAI_TCCCPR_2018 } from '../citations.js';
import { PACK_ID, cannot, isPromotional } from '../helpers.js';

export const rule: Rule = {
  id: 'A-IN-001',
  pack: PACK_ID,
  layer: 'A',
  tier: 1,
  category: 'delivery',
  title: 'Promotional SMS uses a registered DLT header and template',
  severity: 'block',
  citation: TRAI_TCCCPR_2018,
  requires: ['campaign.channel', 'platform.templates'],
  note: 'DLT and DND do not apply to WhatsApp (TRAI declined to regulate OTT twice). The BSP usually enforces this at send time; included so coverage is honest.',
  appliesTo: (ctx) => ctx.campaign.channel === 'sms' && isPromotional(ctx),
  evaluate(ctx) {
    if (!ctx.platform || ctx.platform.templates == null) return cannot(['platform.templates']);
    const id = ctx.campaign.template?.externalId;
    if (!id) return { status: 'fail', affected: [], what: { kind: 'template', field: 'template.externalId' }, detail: { reason: 'no registered template id on the version' } };
    const match = ctx.platform.templates.find((t) => t.externalId === id);
    if (!match) return { status: 'fail', affected: [], what: { kind: 'template', field: 'template.externalId', excerpt: id }, detail: { reason: 'template id not in the registered list' } };
    return { status: 'pass', detail: { templateId: id } };
  },
  explain(_ctx, result) {
    return `No registered DLT template matches this SMS (${String(result.detail?.reason)}). Unregistered promotional SMS do not deliver.`;
  },
};
