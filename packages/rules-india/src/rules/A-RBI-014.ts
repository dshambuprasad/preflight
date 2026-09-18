// A-RBI-014 — Promotional credit message lacks rate/fee disclosure (85K). Tier 0; per variant. (22 G8)
import type { Rule } from '@preflight/core';
import { missing } from '@preflight/core';
import { RBI_RBC_2026 } from '../citations.js';
import { PACK_ID, isPromotional } from '../helpers.js';

const CREDIT_PRODUCT = /\b(loan|credit|emi|top[- ]?up|overdraft|card|limit|finance|borrow)/i;
const DISCLOSURE = [
  /\d+(\.\d+)?\s*%/,
  /\bp\.?a\.?\b/i,
  /(interest|processing fee|charges?)\s*(of|:|@)?\s*(rs\.?|₹|inr)?\s*\d/i,
];

export const rule: Rule = {
  id: 'A-RBI-014',
  pack: PACK_ID,
  layer: 'A',
  tier: 0,
  category: 'content',
  title: 'Promotional credit message discloses interest rate and fees',
  severity: 'warn',
  citation: RBI_RBC_2026,
  requires: ['campaign.message'],
  perVariant: true,
  note: '85K: promotional materials "shall disclose the interest rate and other fees / charges". Deterministic pattern check; a rate named without a number ("our lowest rate") is not a disclosure.',
  appliesTo: (ctx) => {
    if (!isPromotional(ctx)) return false;
    const product = missing(ctx.campaign.product) ? '' : String(ctx.campaign.product);
    return CREDIT_PRODUCT.test(product) || CREDIT_PRODUCT.test(String(ctx.campaign.message ?? ''));
  },
  evaluate(ctx) {
    const text = String(ctx.campaign.message ?? '');
    if (DISCLOSURE.some((re) => re.test(text))) return { status: 'pass' };
    return { status: 'fail', affected: [], what: { kind: 'message_text', excerpt: text }, detail: { reason: 'no numeric rate or fee found' } };
  },
  explain() {
    return 'This promotional credit message names no interest rate or fee figure. RBI 85K requires promotional materials to disclose the rate and other charges.';
  },
  suggestFix: () => ({ kind: 'edit_message', label: 'Add the interest rate and fees', payload: {} }),
};
