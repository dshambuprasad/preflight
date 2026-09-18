// A-RBI-005 — A contact-frequency cap must exist. Ported verbatim (D42). Existence only (12 §H D49).
import type { Rule } from '@preflight/core';
import { missing } from '@preflight/core';
import { RBI_FPC } from '../citations.js';
import { PACK_ID } from '../helpers.js';

export const rule: Rule = {
  id: 'A-RBI-005',
  pack: PACK_ID,
  layer: 'A→C',
  tier: 0,
  category: 'timing',
  title: 'A contact-frequency cap must exist',
  severity: 'info',
  citation: RBI_FPC,
  requires: ['config.frequencyCapPerWeek'],
  note: 'RBI forbids "persistently bothering the borrowers" but sets NO number. The duty is statutory; the threshold is the business\'s. This is the Layer-A to Layer-C handoff, mandated rather than invented.',
  appliesTo: () => true,
  evaluate(ctx) {
    const cap = ctx.config.frequencyCapPerWeek;
    if (missing(cap)) {
      return { status: 'fail', affected: [], what: { kind: 'config', field: 'frequencyCapPerWeek' }, detail: { reason: 'no cap configured' } };
    }
    // SPEC-GAP (D49): enforcing a configured cap needs send history (Tier 1) and a severity of its own;
    // it is not evaluated under this id. Candidate C-FREQ-001 in M1.
    return { status: 'pass', detail: { cap, note: 'Enforcing this cap needs send history — Tier 1.' } };
  },
  explain() {
    return (
      'No contact-frequency cap is configured. RBI requires that borrowers not be persistently contacted but sets no number — ' +
      "the threshold is yours to set, and right now there isn't one."
    );
  },
  suggestFix: () => ({
    kind: 'set_config',
    label: 'Set a frequency cap of 2 per week (default — set your own)',
    payload: { key: 'frequencyCapPerWeek', value: 2, isDefault: true },
  }),
};
