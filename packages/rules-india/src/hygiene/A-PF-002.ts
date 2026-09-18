// A-PF-002 — Conflicting consent (preflight-hygiene; 14 §2). Tier 0.
import type { Rule } from '@preflight/core';
import { PREFLIGHT_HYGIENE } from '../citations.js';
import { HYGIENE_PACK_ID } from '../helpers.js';

const CONFLICT_SOURCES = new Set(['upload:conflict', 'records:later-withdrawal']);

export const rule: Rule = {
  id: 'A-PF-002',
  pack: HYGIENE_PACK_ID,
  layer: 'C',
  tier: 0,
  category: 'consent',
  title: 'Conflicting consent',
  severity: 'warn',
  citation: PREFLIGHT_HYGIENE,
  requires: ['contact.consentSource'],
  note: 'Two variants: conflicting values within one upload (stricter kept), and an upload value overridden by a later withdrawal on record (D37: deny wins).',
  appliesTo: () => true,
  evaluate(ctx) {
    const affected = ctx.contacts.filter((c) => c.consentSource && CONFLICT_SOURCES.has(c.consentSource)).map((c) => c.id);
    if (affected.length === 0) return { status: 'pass' };
    const later = ctx.contacts.filter((c) => c.consentSource === 'records:later-withdrawal').length;
    return { status: 'fail', affected, what: { kind: 'rows' }, detail: { uploadConflicts: affected.length - later, laterWithdrawals: later } };
  },
  explain(_ctx, result) {
    const n = result.affected.length;
    const d = result.detail ?? {};
    return `${n} recipient${n === 1 ? '' : 's'} had conflicting consent — ${String(d.uploadConflicts)} within the upload, ${String(d.laterWithdrawals)} overridden by a later withdrawal on record. The stricter value was kept.`;
  },
};
