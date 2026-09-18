// A-RBI-011 — Lender or agent identity disclosed in the message. Ported (D42); per variant.
import type { Rule } from '@preflight/core';
import { missing } from '@preflight/core';
import { RBI_DLD_2025 } from '../citations.js';
import { PACK_ID } from '../helpers.js';

export const rule: Rule = {
  id: 'A-RBI-011',
  pack: PACK_ID,
  layer: 'A',
  tier: 0,
  category: 'identity',
  title: 'Lender or agent identity disclosed in the message',
  severity: 'warn',
  citation: RBI_DLD_2025,
  requires: ['campaign.message', 'config.lenderName'],
  perVariant: true,
  appliesTo: () => true,
  evaluate(ctx) {
    const name = ctx.config.lenderName;
    if (missing(name)) return { status: 'cannot_evaluate', missing: ['config.lenderName'] };
    const present = String(ctx.campaign.message ?? '').toLowerCase().includes(String(name).toLowerCase());
    return present
      ? { status: 'pass' }
      : { status: 'fail', affected: [], what: { kind: 'message_text', excerpt: String(ctx.campaign.message ?? '') }, detail: { expected: name } };
  },
  explain(_ctx, result) {
    return `The message does not name the lender ("${String(result.detail?.expected)}"). Borrowers must be able to tell who is contacting them.`;
  },
  suggestFix: (ctx) => ({
    kind: 'add_disclosure',
    label: `Prefix "${String(ctx.config.lenderName)}: "`,
    payload: { prefix: `${String(ctx.config.lenderName)}: ` },
  }),
};
