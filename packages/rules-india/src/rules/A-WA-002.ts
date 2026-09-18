// A-WA-002 — Template is APPROVED and in the correct category (Meta). Tier 1; per variant.
import type { Rule } from '@preflight/core';
import { missing } from '@preflight/core';
import { META_WA } from '../citations.js';
import { PACK_ID, cannot } from '../helpers.js';

export const rule: Rule = {
  id: 'A-WA-002',
  pack: PACK_ID,
  layer: 'A',
  tier: 1,
  category: 'delivery',
  title: 'WhatsApp template is approved and correctly categorised',
  severity: 'block',
  citation: META_WA,
  requires: ['campaign.template.externalId', 'platform.templates'],
  perVariant: true,
  appliesTo: (ctx) => ctx.campaign.channel === 'whatsapp',
  evaluate(ctx) {
    const tpl = ctx.campaign.template;
    if (!tpl || missing(tpl.body)) return { status: 'not_applicable', reason: 'no template on this version' };
    const need: string[] = [];
    if (missing(tpl.externalId)) need.push('campaign.template.externalId');
    if (!ctx.platform || ctx.platform.templates == null) need.push('platform.templates');
    if (need.length) return cannot(need);
    const match = ctx.platform!.templates!.find((t) => t.externalId === tpl.externalId || t.name === tpl.externalId);
    if (!match) return { status: 'fail', affected: [], what: { kind: 'template', field: 'template.externalId', excerpt: String(tpl.externalId) }, detail: { reason: 'template not found on the platform' } };
    if (match.status !== 'APPROVED') return { status: 'fail', affected: [], what: { kind: 'template', field: 'template.externalId', excerpt: String(tpl.externalId) }, detail: { reason: `template status is ${match.status}` } };
    const expectedCategory = ctx.effectivePurpose === 'promotional' ? 'MARKETING' : 'UTILITY';
    if (match.category && match.category !== expectedCategory) {
      return { status: 'fail', affected: [], what: { kind: 'template', field: 'template.category', excerpt: String(match.category) }, detail: { reason: `template category ${match.category} does not match content evaluated as ${expectedCategory}` } };
    }
    return { status: 'pass', detail: { status: match.status, category: match.category } };
  },
  explain(_ctx, result) {
    return `The WhatsApp template cannot be used as-is: ${String(result.detail?.reason)}. Meta rejects or pauses mismatched templates.`;
  },
};
