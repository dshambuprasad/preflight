// Preflight — deterministic evaluation core.
//
// DOM-free and side-effect-free by design (Atlas Build Guidelines: pure core, UI on top).
// `now` is injected, never read from the clock, so the same input always yields the
// same report — the fixed-seed determinism requirement.
//
// The single most important invariant:
//   A rule that could not be evaluated is NEVER reported as a pass.
// It appears in `coverage.cannotEvaluate` and is counted separately. A checker that
// silently passes what it didn't check is worse than no checker.

import { RULES, severityAt } from './rules.js';
import { classify } from './classify.js';
import { toIST, sample, missing } from './util.js';

const SEVERITY_ORDER = { block: 0, warn: 1, info: 2 };

/**
 * @param {object} input
 * @param {object} input.campaign  { message, channel, scheduledAt, purpose?, borrowerSegment?, template? }
 * @param {Array}  input.contacts  [{ id, phone?, email?, preferredLanguage?, consentPromotional? }]
 * @param {object} [input.config]  { lenderName?, frequencyCapPerWeek? }
 * @param {string} input.now       ISO instant — injected for determinism
 */
export function evaluate({ campaign, contacts = [], config = {}, now }) {
  if (!campaign || typeof campaign !== 'object') throw new Error('campaign is required');
  if (missing(now)) throw new Error('now (ISO instant) is required — the core never reads the clock');

  const normalised = contacts.map((c, i) => ({ ...c, id: c.id ?? `row-${i + 1}` }));
  const classification = classify(campaign.message);

  // An explicitly declared purpose always wins over inference.
  const effectivePurpose = missing(campaign.purpose)
    ? classification.evaluateAs
    : campaign.purpose;

  const ctx = {
    campaign,
    contacts: normalised,
    config,
    now,
    classification,
    effectivePurpose,
    ist: toIST(campaign.scheduledAt) ?? { hhmm: 'unknown' },
  };

  const findings = [];
  const cannotEvaluate = [];
  const notApplicable = [];
  let evaluated = 0;

  for (const rule of RULES) {
    const applicability = rule.appliesTo(ctx);

    if (applicability === 'unknown') {
      cannotEvaluate.push({
        ruleId: rule.id, title: rule.title,
        reason: 'cannot tell whether this rule applies',
        // Only report dependencies that are ACTUALLY absent. Listing present fields
        // as missing would send someone hunting for data they already supplied.
        missing: rule.requires.filter(p => p.startsWith('campaign.') && missing(resolve(ctx, p))),
      });
      continue;
    }
    if (applicability === false) {
      notApplicable.push({ ruleId: rule.id, title: rule.title });
      continue;
    }

    const result = rule.evaluate(ctx);

    if (result.status === 'cannot_evaluate') {
      cannotEvaluate.push({
        ruleId: rule.id, title: rule.title,
        reason: 'required data not present', missing: result.missing,
      });
      continue;
    }
    if (result.status === 'not_applicable') {
      notApplicable.push({ ruleId: rule.id, title: rule.title, reason: result.reason });
      continue;
    }

    evaluated++;
    if (result.status === 'fail') {
      const affected = result.affected ?? [];
      findings.push({
        ruleId: rule.id,
        severity: severityAt(rule, now),
        title: rule.title,
        citation: rule.citation,
        note: rule.note,
        affectedCount: affected.length,
        affectedSample: sample(affected),
        detail: result.detail ?? {},
        explanation: explain(rule, ctx, affected, result.detail ?? {}),
      });
    }
  }

  findings.sort((a, b) =>
    (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) ||
    a.ruleId.localeCompare(b.ruleId));

  const applicable = evaluated + cannotEvaluate.length;

  return {
    findings,
    classification,
    effectivePurpose,
    coverage: {
      rulesInBook: RULES.length,
      applicable,
      evaluated,
      cannotEvaluate,
      notApplicable,
      statement: applicable === 0
        ? 'No rules were applicable to this campaign.'
        : `Checked ${evaluated} of ${applicable} applicable rules.` +
          (cannotEvaluate.length
            ? ` ${cannotEvaluate.length} could not be evaluated — ${
                [...new Set(cannotEvaluate.flatMap(c => c.missing ?? []))].join(', ') || 'insufficient data'}.`
            : ''),
    },
    summary: {
      blockers: findings.filter(f => f.severity === 'block').length,
      warnings: findings.filter(f => f.severity === 'warn').length,
      info: findings.filter(f => f.severity === 'info').length,
      cannotEvaluate: cannotEvaluate.length,
      audienceSize: normalised.length,
      // Deliberately NOT a "compliant / not compliant" verdict. The product finds
      // gaps for human review; it does not certify. See 03_Open_Questions.md.
      verdict: null,
    },
  };
}

/** Read a dotted path ("campaign.template.body") off the context. */
function resolve(ctx, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
}

function explain(rule, ctx, affected, detail) {
  const n = affected.length;
  switch (rule.id) {
    case 'A-RBI-001':
    case 'A-RBI-002':
      return `Scheduled for ${detail.sendTimeIST} IST — outside the permitted ${detail.window} recovery window. ` +
             `All ${ctx.contacts.length} recipients affected. The restriction covers messages, not just calls.`;
    case 'A-RBI-012':
      return `Scheduled for ${detail.sendTimeIST} IST — outside the ${detail.window} window for sales and promotional contact. ` +
             `All ${ctx.contacts.length} recipients affected. Note this is a NARROWER window than the 08:00–19:00 recovery one; ` +
             `the two are easy to confuse.`;
    case 'A-RBI-003':
      return `${n} recipient${n === 1 ? '' : 's'} have a stated language preference the message does not appear to match ` +
             `(message script: ${detail.messageScript}). Romanised text can be a false positive — review, don't auto-drop.` +
             (detail.note ? ` ${detail.note}.` : '');
    case 'A-RBI-005':
      return 'No contact-frequency cap is configured. RBI requires that borrowers not be persistently contacted but sets no number — ' +
             'the threshold is yours to set, and right now there isn\'t one.';
    case 'A-RBI-006':
      return `${n} of ${ctx.contacts.length} recipients have no recorded consent for promotional communication.` +
             (detail.unknownCount ? ` (${detail.unknownCount} have no consent field at all — absence of a record is not consent.)` : '');
    case 'A-RBI-008':
      return 'This is a promotional message with no opt-out instruction in the body.';
    case 'A-RBI-011':
      return `The message does not name the lender ("${detail.expected}"). Borrowers must be able to tell who is contacting them.`;
    case 'A-WA-003':
      return `Template mismatch: body contains placeholders ${JSON.stringify(detail.placeholdersInBody)} ` +
             `but ${detail.variablesSupplied} variable(s) were supplied` +
             (detail.contiguousFromOne ? '' : ', and placeholders are not numbered contiguously from {{1}}') +
             '. WhatsApp will reject this send.';
    default:
      return rule.title;
  }
}

export { RULES };
