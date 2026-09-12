// Run: node --test
//
// Test 1 is the ground-truth fixture — a campaign whose complete expected report was
// worked out by hand before any code ran, asserted exactly. Atlas Engineering Learnings:
// "reproduce the benchmark's ground truth as your FIRST test." Here that means pinning
// the whole report shape, not spot-checking a field, so a convention change anywhere
// (windows, classification, coverage arithmetic) fails loudly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, RULES } from '../src/engine.js';
import { classify } from '../src/classify.js';
import { toIST } from '../src/util.js';

const NOW_2026 = '2026-09-05T00:00:00+05:30';
const NOW_2027 = '2027-02-01T00:00:00+05:30';

/** Hand-computed fixture. Do not "fix" the expectations to match the code. */
const GROUND_TRUTH = {
  campaign: {
    message: 'Your EMI of Rs 5,000 is overdue. Please pay immediately.',
    channel: 'whatsapp',
    scheduledAt: '2026-09-10T21:30:00+05:30', // 21:30 IST — outside every window
    purpose: 'collections',
    borrowerSegment: 'retail',
  },
  contacts: [
    { id: 'c1', preferredLanguage: 'english' },
    { id: 'c2', preferredLanguage: 'tamil' },
    { id: 'c3' }, // no stated language
  ],
  config: {}, // no lender name, no frequency cap
  now: NOW_2026,
};

test('GROUND TRUTH — the full report for a hand-computed fixture', () => {
  const r = evaluate(GROUND_TRUTH);

  assert.equal(RULES.length, 9, 'Tier-0 rulebook is 9 rules');

  // Classification: service markers only ("emi", "due"/"overdue"), no promotional markers.
  assert.equal(r.classification.classification, 'service');
  assert.equal(r.effectivePurpose, 'collections', 'declared purpose overrides inference');

  // Exactly three findings, in severity then id order.
  assert.deepEqual(r.findings.map(f => f.ruleId), ['A-RBI-001', 'A-RBI-003', 'A-RBI-005']);
  assert.deepEqual(r.findings.map(f => f.severity), ['block', 'warn', 'info']);

  // A-RBI-001: 21:30 is outside 08:00–19:00; all three recipients affected.
  const window = r.findings[0];
  assert.equal(window.affectedCount, 3);
  assert.equal(window.detail.sendTimeIST, '21:30');
  assert.equal(window.detail.window, '08:00–19:00');

  // A-RBI-003: only c2 (tamil) mismatches; c3 has no preference and is not assessed.
  const lang = r.findings[1];
  assert.deepEqual(lang.affectedSample, ['c2']);
  assert.match(lang.detail.note, /1 of 3 contacts have no stated language/);

  // A-RBI-005: no cap configured.
  assert.equal(r.findings[2].affectedCount, 0);

  // Two rules could not be evaluated — and neither is reported as a pass.
  assert.deepEqual(r.coverage.cannotEvaluate.map(c => c.ruleId).sort(),
    ['A-RBI-011', 'A-WA-003']);

  // Four rules do not apply to a collections campaign to retail borrowers.
  assert.deepEqual(r.coverage.notApplicable.map(c => c.ruleId).sort(),
    ['A-RBI-002', 'A-RBI-006', 'A-RBI-008', 'A-RBI-012']);

  // Coverage arithmetic must account for every rule in the book.
  assert.equal(r.coverage.evaluated, 3);
  assert.equal(r.coverage.applicable, 5);
  assert.equal(
    r.findings.length + r.coverage.cannotEvaluate.length + r.coverage.notApplicable.length,
    RULES.length, 'every rule is accounted for exactly once');

  assert.equal(r.coverage.statement,
    'Checked 3 of 5 applicable rules. 2 could not be evaluated — config.lenderName, campaign.template.body.');

  assert.deepEqual(r.summary, {
    blockers: 1, warnings: 1, info: 1, cannotEvaluate: 2, audienceSize: 3, verdict: null,
  });
});

test('determinism — identical input yields byte-identical output', () => {
  const a = JSON.stringify(evaluate(GROUND_TRUTH));
  const b = JSON.stringify(evaluate(GROUND_TRUTH));
  assert.equal(a, b);
});

test('the core never reads the clock', () => {
  assert.throws(() => evaluate({ ...GROUND_TRUTH, now: undefined }), /now \(ISO instant\) is required/);
});

test('a rule that cannot be evaluated is never a pass', () => {
  const r = evaluate(GROUND_TRUTH);
  const unevaluated = r.coverage.cannotEvaluate.map(c => c.ruleId);
  for (const id of unevaluated) {
    assert.ok(!r.findings.some(f => f.ruleId === id), `${id} must not appear as a finding`);
  }
  // ...and it must not be silently absorbed into the "checked" count either.
  assert.ok(r.coverage.evaluated < r.coverage.applicable);
  assert.match(r.coverage.statement, /could not be evaluated/);
});

test('recovery window boundaries are half-open [08:00, 19:00)', () => {
  const at = (hhmm) => evaluate({
    ...GROUND_TRUTH,
    campaign: { ...GROUND_TRUTH.campaign, scheduledAt: `2026-09-10T${hhmm}:00+05:30` },
  }).findings.some(f => f.ruleId === 'A-RBI-001');

  assert.equal(at('07:59'), true,  '07:59 breaches');
  assert.equal(at('08:00'), false, '08:00 is permitted');
  assert.equal(at('18:59'), false, '18:59 is permitted');
  assert.equal(at('19:00'), true,  '19:00 breaches');
});

test('times are evaluated in IST regardless of the offset supplied', () => {
  // 16:00 UTC is 21:30 IST — inside the window in UTC, outside it in India.
  const r = evaluate({
    ...GROUND_TRUTH,
    campaign: { ...GROUND_TRUTH.campaign, scheduledAt: '2026-09-10T16:00:00Z' },
  });
  const f = r.findings.find(x => x.ruleId === 'A-RBI-001');
  assert.ok(f, 'must breach when converted to IST');
  assert.equal(f.detail.sendTimeIST, '21:30');
  assert.equal(toIST('2026-09-10T16:00:00Z').hhmm, '21:30');
});

test('microfinance gets the narrower 09:00–18:00 window', () => {
  const mf = {
    ...GROUND_TRUTH,
    campaign: {
      ...GROUND_TRUTH.campaign,
      borrowerSegment: 'microfinance',
      scheduledAt: '2026-09-10T18:30:00+05:30', // legal for retail, not for microfinance
    },
  };
  const ids = evaluate(mf).findings.map(f => f.ruleId);
  assert.ok(ids.includes('A-RBI-002'), 'microfinance window breached at 18:30');
  assert.ok(!ids.includes('A-RBI-001'), 'the general 08:00–19:00 window is satisfied');
});

test('an unknown purpose makes the window rule unevaluable, not passing', () => {
  const { purpose, ...rest } = GROUND_TRUTH.campaign;
  const r = evaluate({ ...GROUND_TRUTH, campaign: rest });
  const ce = r.coverage.cannotEvaluate.find(c => c.ruleId === 'A-RBI-001');
  assert.ok(ce, 'A-RBI-001 must be reported as unevaluable');
  assert.deepEqual(ce.missing, ['campaign.purpose']);
});

test('severity switches on 2027-01-01 for the RBC obligations', () => {
  const promo = {
    campaign: {
      message: 'Exclusive offer! You are pre-approved for a top-up loan. Apply now.',
      channel: 'sms',
      scheduledAt: '2026-09-10T11:00:00+05:30',
    },
    contacts: [{ id: 'c1', consentPromotional: 'no' }],
    config: {},
  };
  const before = evaluate({ ...promo, now: NOW_2026 });
  const after = evaluate({ ...promo, now: NOW_2027 });

  const sev = (r, id) => r.findings.find(f => f.ruleId === id)?.severity;
  assert.equal(sev(before, 'A-RBI-006'), 'warn');
  assert.equal(sev(after,  'A-RBI-006'), 'block');
  assert.equal(sev(before, 'A-RBI-008'), 'warn', 'no opt-out in the message');
  assert.equal(sev(after,  'A-RBI-008'), 'block');
});

test('a mixed service/promotional message is evaluated under the stricter reading', () => {
  const c = classify('Your EMI is due on 5th. You are also pre-approved for a top-up loan!');
  assert.equal(c.classification, 'mixed');
  assert.equal(c.evaluateAs, 'promotional');
  assert.equal(c.confidence, 'low');
  assert.ok(c.promotionalMarkers.length && c.serviceMarkers.length);

  const r = evaluate({
    campaign: { message: 'Your EMI is due on 5th. You are also pre-approved for a top-up loan!',
                channel: 'sms', scheduledAt: '2026-09-10T11:00:00+05:30' },
    contacts: [{ id: 'c1', consentPromotional: 'no' }],
    config: {}, now: NOW_2026,
  });
  assert.ok(r.findings.some(f => f.ruleId === 'A-RBI-006'),
    'consent rule must engage for a mixed message');
});

test('an unrecorded consent field is treated as absence of consent', () => {
  const base = {
    campaign: { message: 'Special offer, apply now.', channel: 'sms',
                scheduledAt: '2026-09-10T11:00:00+05:30' },
    config: {}, now: NOW_2026,
  };

  // No contact states consent at all -> unevaluable, not a pass.
  const none = evaluate({ ...base, contacts: [{ id: 'a' }, { id: 'b' }] });
  assert.ok(none.coverage.cannotEvaluate.some(c => c.ruleId === 'A-RBI-006'));

  // Some state it -> the blanks count as NOT consented.
  const partial = evaluate({
    ...base,
    contacts: [{ id: 'a', consentPromotional: 'yes' }, { id: 'b' }, { id: 'c', consentPromotional: 'no' }],
  });
  const f = partial.findings.find(x => x.ruleId === 'A-RBI-006');
  assert.equal(f.affectedCount, 2);
  assert.deepEqual(f.affectedSample, ['b', 'c']);
});

test('WhatsApp template variable mismatch is caught deterministically', () => {
  const run = (body, variables) => evaluate({
    campaign: { message: 'x', channel: 'whatsapp', purpose: 'service',
                scheduledAt: '2026-09-10T11:00:00+05:30', template: { body, variables } },
    contacts: [{ id: 'c1' }], config: {}, now: NOW_2026,
  }).findings.find(f => f.ruleId === 'A-WA-003');

  assert.equal(run('Hi {{1}}, your EMI of {{2}} is due.', ['Ravi', '5000']), undefined, 'matching shape passes');
  assert.ok(run('Hi {{1}}, your EMI of {{2}} is due.', ['Ravi']), 'too few variables fails');
  assert.ok(run('Hi {{1}}, due {{3}}.', ['a', 'b']), 'non-contiguous numbering fails');
});

test('no compliance verdict is ever emitted', () => {
  const r = evaluate(GROUND_TRUTH);
  assert.equal(r.summary.verdict, null,
    'the product finds gaps for human review; it must not certify compliance');
});

test('every rule carries a citation and declared data dependencies', () => {
  for (const rule of RULES) {
    assert.ok(rule.citation?.instrument, `${rule.id} needs a citation`);
    assert.ok(rule.citation?.confidence, `${rule.id} needs a source-confidence mark`);
    assert.ok(Array.isArray(rule.requires) && rule.requires.length, `${rule.id} must declare data deps`);
    assert.ok(['block', 'warn', 'info'].includes(rule.severity), `${rule.id} severity`);
  }
});
