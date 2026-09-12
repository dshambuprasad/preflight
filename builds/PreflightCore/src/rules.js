// Layer-A rulebook, Tier 0 — the rules evaluable with NO integration:
// an audience file, the message, the channel, a scheduled send time, a little config.
//
// Full rulebook with citations and machine-checkability grades:
//   ../../docs/06_Layer_A_Rulebook_India.md
//
// Every rule returns exactly one of:
//   { status: 'pass' }
//   { status: 'fail', affected: [...ids], detail: {...} }
//   { status: 'cannot_evaluate', missing: [...] }   <- NEVER treated as a pass
//   { status: 'not_applicable', reason }
//
// Severity may switch on a date (three obligations commence 2027-01-01), so every
// rule is evaluated against an injected `now`. Nothing here reads the clock itself.

import { istMinutes, hhmmToMinutes, missing, sample } from './util.js';
import { matchesPreference } from './lang.js';

const RBI_RECOVERY_2022 = {
  instrument: 'RBI/2022-23/108, DOR.ORG.REC.65/21.04.158/2022-23 (12 Aug 2022)',
  title: 'Outsourcing of Financial Services – Responsibilities of REs employing Recovery Agents',
  confidence: 'SECONDARY',
};
const RBI_RBC_2026 = {
  instrument: 'RBI/2026-27/115, DOR.MCS.REC.No.94/01-01-032/2026-27 (15 Jun 2026)',
  title: 'RBI (Commercial Banks – Responsible Business Conduct) Second Amendment Directions, 2026 — effective 1 Jan 2027',
  confidence: 'PRIMARY — clause text read 2026-09-11. Scope: Commercial Banks (excl. SFBs, PBs, RRBs, LABs). NBFC sibling direction NOT yet verified.',
};
const RBI_FPC = {
  instrument: 'RBI (NBFC – Responsible Business Conduct) Directions, 2025',
  title: 'Fair Practices Code',
  confidence: 'DERIVED — from the Hero FinCorp enforcement action',
};
const RBI_DLD_2025 = {
  instrument: 'RBI Digital Lending Directions, 2025',
  title: 'Digital Lending Directions',
  confidence: 'SECONDARY',
};
const META_WA = {
  instrument: 'WhatsApp Business Platform policy (Meta)',
  title: 'Message template specification',
  confidence: 'PLATFORM — not law',
};

/** Contacts whose scheduled contact time falls outside [open, close) IST. */
function outsideWindow(ctx, openHHMM, closeHHMM) {
  const mins = istMinutes(ctx.campaign.scheduledAt);
  if (mins === null) return { missing: ['campaign.scheduledAt'] };
  const open = hhmmToMinutes(openHHMM), close = hhmmToMinutes(closeHHMM);
  const breach = mins < open || mins >= close;
  return { breach, mins };
}

export const RULES = [
  // ---------------------------------------------------------------- windows
  {
    id: 'A-RBI-001',
    layer: 'A',
    tier: 0,
    title: 'Recovery contact only between 08:00 and 19:00 IST',
    severity: 'block',
    citation: RBI_RECOVERY_2022,
    requires: ['campaign.purpose', 'campaign.scheduledAt'],
    note: 'Covers every form of contact — calls, WhatsApp, SMS and email — not calls alone. HDFC Bank has been penalised under this.',
    appliesTo: ctx =>
      missing(ctx.campaign.purpose) ? 'unknown' : ctx.campaign.purpose === 'collections',
    evaluate(ctx) {
      const r = outsideWindow(ctx, '08:00', '19:00');
      if (r.missing) return { status: 'cannot_evaluate', missing: r.missing };
      if (!r.breach) return { status: 'pass' };
      return {
        status: 'fail',
        affected: ctx.contacts.map(c => c.id),
        detail: { sendTimeIST: ctx.ist.hhmm, window: '08:00–19:00' },
      };
    },
  },
  {
    id: 'A-RBI-002',
    layer: 'A',
    tier: 0,
    title: 'Microfinance recovery contact only between 09:00 and 18:00 IST',
    severity: 'block',
    citation: RBI_RECOVERY_2022,
    requires: ['campaign.purpose', 'campaign.borrowerSegment', 'campaign.scheduledAt'],
    appliesTo: ctx => {
      if (missing(ctx.campaign.borrowerSegment)) return 'unknown';
      return ctx.campaign.purpose === 'collections' &&
             ctx.campaign.borrowerSegment === 'microfinance';
    },
    evaluate(ctx) {
      const r = outsideWindow(ctx, '09:00', '18:00');
      if (r.missing) return { status: 'cannot_evaluate', missing: r.missing };
      if (!r.breach) return { status: 'pass' };
      return {
        status: 'fail',
        affected: ctx.contacts.map(c => c.id),
        detail: { sendTimeIST: ctx.ist.hhmm, window: '09:00–18:00' },
      };
    },
  },
  {
    id: 'A-RBI-012',
    layer: 'A',
    tier: 0,
    title: 'Sales calls/visits only between 09:00 and 19:00 IST',
    severity: 'block',
    severityBefore: 'warn',
    effectiveFrom: '2027-01-01',
    citation: RBI_RBC_2026,
    requires: ['campaign.scheduledAt', 'campaign.channel'],
    note: 'Para 85N(4): "telephonic contacts and / or visits to customers normally between 09:00 hours and 19:00 hours". PRIMARY text covers CALLS AND VISITS, not messages — secondary reporting overstated this as a messaging window. Inert for whatsapp/sms/email; retained for a future voice channel.',
    appliesTo: ctx => ['voice', 'visit'].includes(ctx.campaign.channel) && ctx.effectivePurpose === 'promotional',
    evaluate(ctx) {
      const r = outsideWindow(ctx, '09:00', '19:00');
      if (r.missing) return { status: 'cannot_evaluate', missing: r.missing };
      if (!r.breach) return { status: 'pass' };
      return {
        status: 'fail',
        affected: ctx.contacts.map(c => c.id),
        detail: { sendTimeIST: ctx.ist.hhmm, window: '09:00–19:00' },
      };
    },
  },

  // ---------------------------------------------------------------- language
  {
    id: 'A-RBI-003',
    layer: 'A',
    tier: 0,
    title: "Communication in the borrower's understood language",
    severity: 'warn',
    citation: RBI_FPC,
    requires: ['contact.preferredLanguage'],
    appliesTo: () => true,
    evaluate(ctx) {
      const known = ctx.contacts.filter(c => !missing(c.preferredLanguage));
      if (known.length === 0) {
        return { status: 'cannot_evaluate', missing: ['contact.preferredLanguage'] };
      }
      const bad = known.filter(c => !matchesPreference(ctx.campaign.message, c.preferredLanguage).ok);
      const partial = known.length < ctx.contacts.length
        ? { note: `${ctx.contacts.length - known.length} of ${ctx.contacts.length} contacts have no stated language and were not assessed` }
        : {};
      if (bad.length === 0) return { status: 'pass', detail: partial };
      return {
        status: 'fail',
        affected: bad.map(c => c.id),
        detail: {
          messageScript: matchesPreference(ctx.campaign.message, 'english').script,
          ...partial,
        },
      };
    },
  },

  // ---------------------------------------------------------------- frequency cap existence
  {
    id: 'A-RBI-005',
    layer: 'A→C',
    tier: 0,
    title: 'A contact-frequency cap must exist',
    severity: 'info',
    citation: RBI_FPC,
    requires: ['config.frequencyCapPerWeek'],
    note: 'RBI forbids "persistently bothering the borrowers" but sets NO number. The duty is statutory; the threshold is the business\'s. This is the Layer-A to Layer-C handoff, mandated rather than invented.',
    appliesTo: () => true,
    evaluate(ctx) {
      const cap = ctx.config.frequencyCapPerWeek;
      if (missing(cap)) {
        return { status: 'fail', affected: [], detail: { reason: 'no cap configured' } };
      }
      return { status: 'pass', detail: { cap, note: 'Enforcing this cap needs send history — Tier 1.' } };
    },
  },

  // ---------------------------------------------------------------- consent
  {
    id: 'A-RBI-006',
    layer: 'A',
    tier: 0,
    title: 'Explicit consent before promotional communication',
    severity: 'block',
    severityBefore: 'warn',
    effectiveFrom: '2027-01-01',
    citation: RBI_RBC_2026,
    requires: ['contact.consentPromotional'],
    appliesTo: ctx => ctx.effectivePurpose === 'promotional',
    evaluate(ctx) {
      const stated = ctx.contacts.filter(c => !missing(c.consentPromotional));
      if (stated.length === 0) {
        return { status: 'cannot_evaluate', missing: ['contact.consentPromotional'] };
      }
      const noConsent = ctx.contacts.filter(c => {
        if (missing(c.consentPromotional)) return true; // unknown is NOT consent
        return !/^(y|yes|true|1|granted)$/i.test(String(c.consentPromotional).trim());
      });
      if (noConsent.length === 0) return { status: 'pass' };
      return {
        status: 'fail',
        affected: noConsent.map(c => c.id),
        detail: {
          unknownCount: ctx.contacts.length - stated.length,
          note: 'Contacts with no recorded consent are counted as not consented. Absence of a record is not consent.',
        },
      };
    },
  },

  // ---------------------------------------------------------------- opt-out
  {
    id: 'A-RBI-008',
    layer: 'A',
    tier: 0,
    title: 'Promotional message carries an opt-out',
    severity: 'block',
    severityBefore: 'warn',
    effectiveFrom: '2027-01-01',
    citation: RBI_RBC_2026,
    requires: ['campaign.message'],
    note: 'Only the PRESENCE half is a send-time check. "As easy as subscribing" and the dedicated preference link are product obligations inside the lender\'s own app — out of scope, and said so.',
    appliesTo: ctx => ctx.effectivePurpose === 'promotional',
    evaluate(ctx) {
      const t = String(ctx.campaign.message ?? '').toLowerCase();
      const found = ['unsubscribe', 'opt out', 'opt-out', 'stop', 'reply stop', 'to stop']
        .filter(k => t.includes(k));
      if (found.length) return { status: 'pass', detail: { found } };
      return { status: 'fail', affected: [], detail: { reason: 'no opt-out instruction found in the message body' } };
    },
  },

  // ---------------------------------------------------------------- sender identity
  {
    id: 'A-RBI-011',
    layer: 'A',
    tier: 0,
    title: 'Lender or agent identity disclosed in the message',
    severity: 'warn',
    citation: RBI_DLD_2025,
    requires: ['campaign.message', 'config.lenderName'],
    appliesTo: () => true,
    evaluate(ctx) {
      const name = ctx.config.lenderName;
      if (missing(name)) return { status: 'cannot_evaluate', missing: ['config.lenderName'] };
      const present = String(ctx.campaign.message ?? '')
        .toLowerCase()
        .includes(String(name).toLowerCase());
      return present
        ? { status: 'pass' }
        : { status: 'fail', affected: [], detail: { expected: name } };
    },
  },

  // ---------------------------------------------------------------- template shape
  {
    id: 'A-WA-003',
    layer: 'A (platform)',
    tier: 0,
    title: 'WhatsApp template variables match the approved template',
    severity: 'block',
    citation: META_WA,
    requires: ['campaign.template.body', 'campaign.template.variables'],
    note: 'Purely deterministic string comparison. The most boring rule here and among the most immediately useful — a mismatch means the send simply fails.',
    appliesTo: ctx => ctx.campaign.channel === 'whatsapp',
    evaluate(ctx) {
      const tpl = ctx.campaign.template;
      if (!tpl || missing(tpl.body)) {
        return { status: 'cannot_evaluate', missing: ['campaign.template.body'] };
      }
      const declared = Array.isArray(tpl.variables) ? tpl.variables.length : null;
      if (declared === null) {
        return { status: 'cannot_evaluate', missing: ['campaign.template.variables'] };
      }
      const placeholders = [...String(tpl.body).matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map(m => Number(m[1]));
      const uniq = [...new Set(placeholders)].sort((a, b) => a - b);
      const expected = Array.from({ length: uniq.length }, (_, i) => i + 1);
      const contiguous = uniq.length === expected.length && uniq.every((v, i) => v === expected[i]);

      if (uniq.length !== declared || !contiguous) {
        return {
          status: 'fail',
          affected: [],
          detail: {
            placeholdersInBody: uniq,
            variablesSupplied: declared,
            contiguousFromOne: contiguous,
          },
        };
      }
      return { status: 'pass', detail: { variables: declared } };
    },
  },
];

/** Severity for a rule at a given instant — three obligations commence 2027-01-01. */
export function severityAt(rule, nowISO) {
  if (!rule.effectiveFrom) return rule.severity;
  const now = Date.parse(nowISO), from = Date.parse(rule.effectiveFrom);
  if (Number.isNaN(now)) return rule.severityBefore ?? rule.severity;
  return now >= from ? rule.severity : (rule.severityBefore ?? rule.severity);
}

export { sample };
