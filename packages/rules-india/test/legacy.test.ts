// The 14 PreflightCore tests, ported (builds/PreflightCore/test/engine.test.js). Run against the 9-rule
// Tier-0 selection (`legacyPack()`), with `asOf` in place of `now` and typed consent (D42).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, evaluate, normaliseConsent, toIST } from '@preflight/core';
import type { Contact, EvaluateInput } from '@preflight/core';
import { legacyPack } from '../src/index.js';

const NOW_2026 = '2026-09-05T00:00:00+05:30';
const NOW_2027 = '2027-02-01T00:00:00+05:30';
const RULES = legacyPack().rules;

type LegacyContact = { id: string; preferredLanguage?: string; consentPromotional?: string };
function contacts(rows: LegacyContact[]): Contact[] {
  return rows.map((r) => ({
    id: r.id,
    preferredLanguage: r.preferredLanguage,
    consentPromotional: r.consentPromotional === undefined ? undefined : normaliseConsent(r.consentPromotional),
  }));
}
function run(input: Omit<EvaluateInput, 'packs' | 'contacts'> & { contacts: LegacyContact[] }) {
  return evaluate({ ...input, contacts: contacts(input.contacts), packs: [legacyPack()] });
}

/** Hand-computed fixture. Do not "fix" the expectations to match the code. */
const GROUND_TRUTH = {
  campaign: {
    message: 'Your EMI of Rs 5,000 is overdue. Please pay immediately.',
    channel: 'whatsapp' as const,
    scheduledAt: '2026-09-10T21:30:00+05:30', // 21:30 IST — outside every window
    purpose: 'collections' as const,
    borrowerSegment: 'retail',
  },
  contacts: [{ id: 'c1', preferredLanguage: 'english' }, { id: 'c2', preferredLanguage: 'tamil' }, { id: 'c3' }],
  config: {},
  asOf: NOW_2026,
};

test('GROUND TRUTH — the full report for a hand-computed fixture', () => {
  const r = run(GROUND_TRUTH);
  assert.equal(RULES.length, 9, 'Tier-0 rulebook is 9 rules');
  assert.equal(r.classification.classification, 'service');
  assert.equal(r.effectivePurpose, 'collections', 'declared purpose overrides inference');
  assert.deepEqual(r.findings.map((f) => f.ruleId), ['A-RBI-001', 'A-RBI-003', 'A-RBI-005']);
  assert.deepEqual(r.findings.map((f) => f.severity), ['block', 'warn', 'info']);
  const window = r.findings[0]!;
  assert.equal(window.affectedCount, 3);
  assert.equal(window.detail.sendTimeIST, '21:30');
  assert.equal(window.detail.window, '08:00–19:00');
  const lang = r.findings[1]!;
  assert.deepEqual(lang.affectedSample, ['c2']);
  assert.match(String(lang.detail.note), /1 of 3 contacts have no stated language/);
  assert.equal(r.findings[2]!.affectedCount, 0);
  assert.deepEqual(r.coverage.cannotEvaluate.map((c) => c.ruleId).sort(), ['A-RBI-011', 'A-WA-003']);
  assert.deepEqual(r.coverage.notApplicable.map((c) => c.ruleId).sort(), ['A-RBI-002', 'A-RBI-006', 'A-RBI-008', 'A-RBI-012']);
  assert.equal(r.coverage.evaluated, 3);
  assert.equal(r.coverage.applicable, 5);
  assert.equal(r.findings.length + r.coverage.cannotEvaluate.length + r.coverage.notApplicable.length, RULES.length);
  assert.equal(r.coverage.statement, 'Checked 3 of 5 applicable rules. 2 could not be evaluated — config.lenderName, campaign.template.body.');
  assert.deepEqual(r.summary, { blockers: 1, warnings: 1, info: 1, cannotEvaluate: 2, audienceSize: 3, verdict: null });
});

test('determinism — identical input yields byte-identical output', () => {
  assert.equal(JSON.stringify(run(GROUND_TRUTH)), JSON.stringify(run(GROUND_TRUTH)));
});

test('the core never reads the clock', () => {
  assert.throws(() => run({ ...GROUND_TRUTH, asOf: undefined as unknown as string }), /asOf \(ISO instant\) is required/);
});

test('a rule that cannot be evaluated is never a pass', () => {
  const r = run(GROUND_TRUTH);
  for (const id of r.coverage.cannotEvaluate.map((c) => c.ruleId)) {
    assert.ok(!r.findings.some((f) => f.ruleId === id), `${id} must not appear as a finding`);
  }
  assert.ok(r.coverage.evaluated < r.coverage.applicable);
  assert.match(r.coverage.statement, /could not be evaluated/);
});

test('recovery window boundaries are half-open [08:00, 19:00)', () => {
  const at = (hhmm: string) =>
    run({ ...GROUND_TRUTH, campaign: { ...GROUND_TRUTH.campaign, scheduledAt: `2026-09-10T${hhmm}:00+05:30` } }).findings.some(
      (f) => f.ruleId === 'A-RBI-001',
    );
  assert.equal(at('07:59'), true, '07:59 breaches');
  assert.equal(at('08:00'), false, '08:00 is permitted');
  assert.equal(at('18:59'), false, '18:59 is permitted');
  assert.equal(at('19:00'), true, '19:00 breaches');
});

test('times are evaluated in IST regardless of the offset supplied', () => {
  const r = run({ ...GROUND_TRUTH, campaign: { ...GROUND_TRUTH.campaign, scheduledAt: '2026-09-10T16:00:00Z' } });
  const f = r.findings.find((x) => x.ruleId === 'A-RBI-001');
  assert.ok(f, 'must breach when converted to IST');
  assert.equal(f.detail.sendTimeIST, '21:30');
  assert.equal(toIST('2026-09-10T16:00:00Z')!.hhmm, '21:30');
});

test('microfinance gets the narrower 09:00–18:00 window', () => {
  const ids = run({
    ...GROUND_TRUTH,
    campaign: { ...GROUND_TRUTH.campaign, borrowerSegment: 'microfinance', scheduledAt: '2026-09-10T18:30:00+05:30' },
  }).findings.map((f) => f.ruleId);
  assert.ok(ids.includes('A-RBI-002'), 'microfinance window breached at 18:30');
  assert.ok(!ids.includes('A-RBI-001'), 'the general 08:00–19:00 window is satisfied');
});

test('an unknown purpose makes the window rule unevaluable, not passing', () => {
  const { purpose: _p, ...rest } = GROUND_TRUTH.campaign;
  const r = run({ ...GROUND_TRUTH, campaign: rest });
  const ce = r.coverage.cannotEvaluate.find((c) => c.ruleId === 'A-RBI-001');
  assert.ok(ce, 'A-RBI-001 must be reported as unevaluable');
  assert.deepEqual(ce.missing, ['campaign.purpose']);
});

test('severity switches on 2027-01-01 for the RBC obligations', () => {
  const promo = {
    campaign: { message: 'Exclusive offer! You are pre-approved for a top-up loan. Apply now.', channel: 'sms' as const, scheduledAt: '2026-09-10T11:00:00+05:30' },
    contacts: [{ id: 'c1', consentPromotional: 'no' }],
    config: {},
  };
  const before = run({ ...promo, asOf: NOW_2026 });
  const after = run({ ...promo, asOf: NOW_2027 });
  const sev = (r: ReturnType<typeof run>, id: string) => r.findings.find((f) => f.ruleId === id)?.severity;
  assert.equal(sev(before, 'A-RBI-006'), 'warn');
  assert.equal(sev(after, 'A-RBI-006'), 'block');
  assert.equal(sev(before, 'A-RBI-008'), 'warn', 'no opt-out in the message');
  assert.equal(sev(after, 'A-RBI-008'), 'block');
});

test('a mixed service/promotional message is evaluated under the stricter reading', () => {
  const c = classify('Your EMI is due on 5th. You are also pre-approved for a top-up loan!');
  assert.equal(c.classification, 'mixed');
  assert.equal(c.evaluateAs, 'promotional');
  assert.equal(c.confidence, 'low');
  assert.ok(c.promotionalMarkers.length && c.serviceMarkers.length);
  const r = run({
    campaign: { message: 'Your EMI is due on 5th. You are also pre-approved for a top-up loan!', channel: 'sms', scheduledAt: '2026-09-10T11:00:00+05:30' },
    contacts: [{ id: 'c1', consentPromotional: 'no' }],
    config: {},
    asOf: NOW_2026,
  });
  assert.ok(r.findings.some((f) => f.ruleId === 'A-RBI-006'), 'consent rule must engage for a mixed message');
});

test('an unrecorded consent field is treated as absence of consent', () => {
  const base = { campaign: { message: 'Special offer, apply now.', channel: 'sms' as const, scheduledAt: '2026-09-10T11:00:00+05:30' }, config: {}, asOf: NOW_2026 };
  const none = run({ ...base, contacts: [{ id: 'a' }, { id: 'b' }] });
  assert.ok(none.coverage.cannotEvaluate.some((c) => c.ruleId === 'A-RBI-006'));
  const partial = run({ ...base, contacts: [{ id: 'a', consentPromotional: 'yes' }, { id: 'b' }, { id: 'c', consentPromotional: 'no' }] });
  const f = partial.findings.find((x) => x.ruleId === 'A-RBI-006')!;
  assert.equal(f.affectedCount, 2);
  assert.deepEqual(f.affectedSample, ['b', 'c']);
});

test('WhatsApp template variable mismatch is caught deterministically', () => {
  const go = (body: string, variables: string[]) =>
    run({
      campaign: { message: 'x', channel: 'whatsapp', purpose: 'service', scheduledAt: '2026-09-10T11:00:00+05:30', template: { body, variables } },
      contacts: [{ id: 'c1' }],
      config: {},
      asOf: NOW_2026,
    }).findings.find((f) => f.ruleId === 'A-WA-003');
  assert.equal(go('Hi {{1}}, your EMI of {{2}} is due.', ['Ravi', '5000']), undefined, 'matching shape passes');
  assert.ok(go('Hi {{1}}, your EMI of {{2}} is due.', ['Ravi']), 'too few variables fails');
  assert.ok(go('Hi {{1}}, due {{3}}.', ['a', 'b']), 'non-contiguous numbering fails');
});

test('no compliance verdict is ever emitted', () => {
  assert.equal(run(GROUND_TRUTH).summary.verdict, null);
});

test('every rule carries a citation and declared data dependencies', () => {
  for (const rule of RULES) {
    assert.ok(rule.citation?.instrument, `${rule.id} needs a citation`);
    assert.ok(rule.citation?.confidence, `${rule.id} needs a source-confidence mark`);
    assert.ok(Array.isArray(rule.requires) && rule.requires.length, `${rule.id} must declare data deps`);
    assert.ok(['block', 'warn', 'info'].includes(rule.severity), `${rule.id} severity`);
  }
});
