// A-RBI-003 — Communication in the borrower's understood language. Ported verbatim (D42); per variant (D28).
import type { Rule } from '@preflight/core';
import { matchesPreference, missing } from '@preflight/core';
import { RBI_FPC } from '../citations.js';
import { PACK_ID, dropRowsFix } from '../helpers.js';

export const rule: Rule = {
  id: 'A-RBI-003',
  pack: PACK_ID,
  layer: 'A',
  tier: 0,
  category: 'content',
  title: "Communication in the borrower's understood language",
  severity: 'warn',
  citation: RBI_FPC,
  requires: ['contact.preferredLanguage', 'campaign.message'],
  perVariant: true,
  appliesTo: () => true,
  evaluate(ctx) {
    const romanised = ctx.config.romanisedAcceptableLanguages ?? [];
    const known = ctx.contacts.filter((c) => !missing(c.preferredLanguage));
    if (known.length === 0) {
      return { status: 'cannot_evaluate', missing: ['contact.preferredLanguage'] };
    }
    const bad = known.filter((c) => !matchesPreference(ctx.campaign.message, c.preferredLanguage, romanised).ok);
    const partial =
      known.length < ctx.contacts.length
        ? { note: `${ctx.contacts.length - known.length} of ${ctx.contacts.length} contacts have no stated language and were not assessed` }
        : {};
    if (bad.length === 0) return { status: 'pass', detail: partial };
    return {
      status: 'fail',
      affected: bad.map((c) => c.id),
      what: { kind: 'rows' },
      detail: {
        messageScript: matchesPreference(ctx.campaign.message, 'english').script,
        ...partial,
      },
    };
  },
  explain(_ctx, result) {
    const n = result.affected.length;
    const d = result.detail ?? {};
    return (
      `${n} recipient${n === 1 ? '' : 's'} have a stated language preference the message does not appear to match ` +
      `(message script: ${String(d.messageScript)}). Romanised text can be a false positive — review, don't auto-drop.` +
      (d.note ? ` ${String(d.note)}.` : '')
    );
  },
  suggestFix(ctx, result) {
    const languages = [
      ...new Set(
        ctx.contacts
          .filter((c) => result.affected.includes(c.id))
          .map((c) => String(c.preferredLanguage ?? '').toLowerCase())
          .filter(Boolean),
      ),
    ].sort();
    const fix = dropRowsFix(result.affected, `Drop ${result.affected.length} row${result.affected.length === 1 ? '' : 's'}`);
    // SPEC-GAP: 04 §9 offers A-RBI-003 two fixes (drop_rows OR set_config); SuggestedFix is single-valued,
    // so the second is carried as payload.alternative for the UI to render as a second button.
    fix.payload.alternative = { kind: 'set_config', key: 'romanisedAcceptableLanguages', add: languages, label: 'Mark romanised acceptable (admin)' };
    return fix;
  },
};
