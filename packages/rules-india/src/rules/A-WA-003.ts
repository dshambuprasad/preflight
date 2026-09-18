// A-WA-003 — WhatsApp template variables match the approved template. Ported verbatim (D42); per variant.
import type { Rule } from '@preflight/core';
import { missing } from '@preflight/core';
import { META_WA } from '../citations.js';
import { PACK_ID } from '../helpers.js';

export const rule: Rule = {
  id: 'A-WA-003',
  pack: PACK_ID,
  layer: 'A',
  tier: 0,
  category: 'delivery',
  title: 'WhatsApp template variables match the approved template',
  severity: 'block',
  citation: META_WA,
  requires: ['campaign.template.body', 'campaign.template.variables'],
  perVariant: true,
  note: 'Purely deterministic string comparison. The most boring rule here and among the most immediately useful — a mismatch means the send simply fails.',
  appliesTo: (ctx) => ctx.campaign.channel === 'whatsapp',
  evaluate(ctx) {
    const tpl = ctx.campaign.template;
    if (!tpl || missing(tpl.body)) {
      return { status: 'cannot_evaluate', missing: ['campaign.template.body'] };
    }
    const declared = Array.isArray(tpl.variables) ? tpl.variables.length : null;
    if (declared === null) {
      return { status: 'cannot_evaluate', missing: ['campaign.template.variables'] };
    }
    const placeholders = [...String(tpl.body).matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]));
    const uniq = [...new Set(placeholders)].sort((a, b) => a - b);
    const expected = Array.from({ length: uniq.length }, (_, i) => i + 1);
    const contiguous = uniq.length === expected.length && uniq.every((v, i) => v === expected[i]);

    if (uniq.length !== declared || !contiguous) {
      return {
        status: 'fail',
        affected: [],
        what: { kind: 'template', excerpt: uniq.map((n) => `{{${n}}}`).join(' '), field: 'template.variables' },
        detail: { placeholdersInBody: uniq, variablesSupplied: declared, contiguousFromOne: contiguous },
      };
    }
    return { status: 'pass', detail: { variables: declared } };
  },
  explain(_ctx, result) {
    const d = result.detail ?? {};
    return (
      `Template mismatch: body contains placeholders ${JSON.stringify(d.placeholdersInBody)} ` +
      `but ${String(d.variablesSupplied)} variable(s) were supplied` +
      (d.contiguousFromOne ? '' : ', and placeholders are not numbered contiguously from {{1}}') +
      '. WhatsApp will reject this send.'
    );
  },
  // SPEC-GAP: 04 §9 says "null payload"; SuggestedFix.payload is an object, so an empty object stands in.
  suggestFix: () => ({ kind: 'edit_message', label: 'Fix template variables', payload: {} }),
};
