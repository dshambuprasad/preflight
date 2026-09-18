// A-PF-001 — Duplicate recipients (preflight-hygiene; 05 §3). Tier 0.
import type { Rule } from '@preflight/core';
import { PREFLIGHT_HYGIENE } from '../citations.js';
import { HYGIENE_PACK_ID, dropRowsFix } from '../helpers.js';

export const rule: Rule = {
  id: 'A-PF-001',
  pack: HYGIENE_PACK_ID,
  layer: 'C',
  tier: 0,
  category: 'audience',
  title: 'Duplicate recipients',
  severity: 'warn',
  citation: PREFLIGHT_HYGIENE,
  requires: ['audience.duplicates'],
  note: 'Rows sharing an identity key within a version. The first audience-quality rule; needs no history.',
  appliesTo: () => true,
  evaluate(ctx) {
    const dupes = ctx.audience.duplicates;
    if (dupes.length === 0) return { status: 'pass' };
    return { status: 'fail', affected: dupes.map((d) => d.rowId), what: { kind: 'rows' }, detail: { rows: ctx.audience.rows } };
  },
  explain(_ctx, result) {
    const n = result.affected.length;
    return `${n} row${n === 1 ? ' is a duplicate' : 's are duplicates'} of another recipient in this audience (same identity) and would be messaged twice.`;
  },
  suggestFix: (_ctx, result) => dropRowsFix(result.affected, `Drop ${result.affected.length} duplicate row${result.affected.length === 1 ? '' : 's'}`),
};
