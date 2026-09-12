// Engine invariants (11 §3) with a synthetic pack. Rule-logic tests live in packages/rules-india.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, validatePacks, isAbsent, PackValidationError } from '../src/index.js';
import type { Context, Exception } from '../src/index.js';
import { ASOF, CAMPAIGN, CONTACTS, pack, rule } from './helpers.js';

const failing = rule({
  id: 'T-FAIL-001',
  severity: 'block',
  requires: ['campaign.scheduledAt'],
  evaluate: (ctx) => ({ status: 'fail', affected: ctx.contacts.map((c) => c.id), what: { kind: 'schedule', field: 'scheduledAt' } }),
  explain: (ctx) => `All ${ctx.contacts.length} recipients affected.`,
  suggestFix: () => ({ kind: 'reschedule', label: 'Reschedule', payload: { scheduledAt: '2026-09-11T10:00:00+05:30' } }),
});
const needsHistory = rule({
  id: 'T-HIST-001',
  tier: 1,
  requires: ['history.contactEvents', 'campaign.message'],
  evaluate: (ctx) => (ctx.history ? { status: 'pass' } : { status: 'cannot_evaluate', missing: ['history.contactEvents', 'campaign.message'] }),
});
const notApplicable = rule({ id: 'T-NA-001', appliesTo: (ctx) => ctx.effectivePurpose === 'promotional' });
const unknownApplies = rule({
  id: 'T-UNK-001',
  requires: ['campaign.borrowerSegment', 'campaign.message'],
  appliesTo: (ctx) => (ctx.campaign.borrowerSegment ? true : 'unknown'),
});
const throwing = rule({ id: 'T-ERR-001', evaluate: () => { throw new Error('boom'); } });

const PACK = pack([failing, needsHistory, notApplicable, unknownApplies]);
const base = { campaign: CAMPAIGN, contacts: CONTACTS, config: {}, asOf: ASOF, packs: [PACK] };

test('never-silent-pass — cannot_evaluate is counted separately and never appears as pass', () => {
  const r = evaluate(base);
  const ids = r.coverage.cannotEvaluate.map((c) => c.ruleId);
  assert.deepEqual(ids, ['T-HIST-001', 'T-UNK-001']);
  for (const id of ids) assert.ok(!r.findings.some((f) => f.ruleId === id));
  assert.ok(r.coverage.evaluated < r.coverage.applicable);
  assert.match(r.coverage.statement, /2 could not be evaluated — history\.contactEvents, campaign\.borrowerSegment\./);
  assert.equal(r.summary.cannotEvaluate, 2);
});

test('missing-is-actually-missing — present paths are filtered out of missing[]', () => {
  const r = evaluate(base);
  const hist = r.coverage.cannotEvaluate.find((c) => c.ruleId === 'T-HIST-001')!;
  assert.deepEqual(hist.missing, ['history.contactEvents'], 'campaign.message is present and must not be listed');
  const unk = r.coverage.cannotEvaluate.find((c) => c.ruleId === 'T-UNK-001')!;
  assert.deepEqual(unk.missing, ['campaign.borrowerSegment']);
  assert.equal(unk.reason, 'cannot tell whether this rule applies');
});

test('verdict-is-null — always', () => {
  const r = evaluate(base);
  assert.equal(r.summary.verdict, null);
  assert.ok('verdict' in r.summary);
});

test('deterministic — identical input twice → identical JSON; pack order does not matter', () => {
  const a = JSON.stringify(evaluate(base));
  const b = JSON.stringify(evaluate(base));
  assert.equal(a, b);
  const shuffled = pack([unknownApplies, notApplicable, needsHistory, failing]);
  const c = JSON.stringify(evaluate({ ...base, packs: [shuffled] }));
  assert.equal(a, c, 'rules are sorted by id; output is order-independent');
});

test('no-clock-in-core — evaluate throws without asOf', () => {
  assert.throws(() => evaluate({ ...base, asOf: undefined as unknown as string }), /asOf \(ISO instant\) is required/);
});

test('every rule is accounted for exactly once', () => {
  const r = evaluate(base);
  assert.equal(r.findings.length + r.coverage.cannotEvaluate.length + r.coverage.notApplicable.length, r.coverage.rulesInBook);
  assert.deepEqual(r.coverage.notApplicable.map((n) => n.ruleId), ['T-NA-001']);
  assert.equal(r.coverage.applicable, 3);
  assert.equal(r.coverage.evaluated, 1);
});

test('finding carries the four-part anatomy and suggested fix', () => {
  const f = evaluate(base).findings[0]!;
  assert.equal(f.ruleId, 'T-FAIL-001');
  assert.equal(f.severity, 'block');
  assert.deepEqual(f.what, { kind: 'schedule', field: 'scheduledAt' });
  assert.equal(f.explanation, 'All 3 recipients affected.');
  assert.equal(f.suggestedFix?.kind, 'reschedule');
  assert.equal(f.affectedCount, 3);
  assert.deepEqual(f.affectedSample, ['c1', 'c2', 'c3']);
  assert.deepEqual(f.affectedRowIds, ['c1', 'c2', 'c3']);
  assert.equal(f.variantKey, 'default');
  assert.equal(f.suppressedBy, null);
});

test('exception-expiry — active exception downgrades to info and never removes; expired has no effect', () => {
  const active: Exception = { id: 'ex-1', ruleId: 'T-FAIL-001', scope: 'this-campaign', expiresAt: '2026-10-01T00:00:00Z' };
  const expired: Exception = { id: 'ex-0', ruleId: 'T-FAIL-001', scope: 'this-campaign', expiresAt: '2026-01-01T00:00:00Z' };
  const withActive = evaluate({ ...base, exceptions: [active] });
  const f = withActive.findings.find((x) => x.ruleId === 'T-FAIL-001')!;
  assert.equal(f.severity, 'info');
  assert.equal(f.suppressedBy, 'ex-1');
  assert.equal(withActive.summary.blockers, 0);
  assert.equal(withActive.summary.info, 1);
  const withExpired = evaluate({ ...base, exceptions: [expired] });
  assert.equal(withExpired.findings.find((x) => x.ruleId === 'T-FAIL-001')!.severity, 'block');
  assert.equal(withExpired.findings[0]!.suppressedBy, null);
});

test('a throwing rule becomes cannot_evaluate (rule-error) and the others continue', () => {
  const r = evaluate({ ...base, packs: [pack([failing, throwing])] });
  const ce = r.coverage.cannotEvaluate.find((c) => c.ruleId === 'T-ERR-001')!;
  assert.equal(ce.reason, 'rule-error');
  assert.deepEqual(r.ruleErrors, [{ ruleId: 'T-ERR-001', error: 'boom' }]);
  assert.ok(r.findings.some((f) => f.ruleId === 'T-FAIL-001'));
});

test('validatePacks rejects unknown requires paths, duplicate ids and missing explain', () => {
  assert.throws(() => validatePacks([pack([rule({ id: 'X-1', requires: ['contact.shoeSize'] })])]), PackValidationError);
  assert.throws(() => validatePacks([pack([rule({ id: 'X-1' }), rule({ id: 'X-1' })])]), /duplicate rule id/);
  assert.throws(
    () => validatePacks([pack([{ ...rule({ id: 'X-2' }), explain: undefined as unknown as Context['classification'] as never }])]),
    /explain\(\) is required/,
  );
});

test('isAbsent resolves every path family', () => {
  const r = evaluate(base); // to get a well-formed ctx we reuse the input shape via a probe rule
  void r;
  const probe = rule({
    id: 'T-PROBE',
    requires: ['campaign.message'],
    evaluate: (ctx) => {
      assert.equal(isAbsent(ctx, 'campaign.purpose'), false);
      assert.equal(isAbsent(ctx, 'campaign.template.body'), true);
      assert.equal(isAbsent(ctx, 'contact.preferredLanguage'), false);
      assert.equal(isAbsent(ctx, 'contact.consentPromotional'), true);
      assert.equal(isAbsent(ctx, 'config.lenderName'), true);
      assert.equal(isAbsent(ctx, 'history.contactEvents'), true);
      assert.equal(isAbsent(ctx, 'consent.current'), true);
      assert.equal(isAbsent(ctx, 'platform.templates'), true);
      assert.equal(isAbsent(ctx, 'audience.duplicates'), false);
      return { status: 'pass' };
    },
  });
  evaluate({ ...base, packs: [pack([probe])] });
});

test('D28 — content rules evaluate per variant; recipient-level rules once', () => {
  const content = rule({
    id: 'T-CONTENT-001',
    category: 'content',
    requires: ['campaign.message', 'contact.preferredLanguage'],
    evaluate: (ctx) =>
      ctx.campaign.message.includes('STOP') ? { status: 'pass' } : { status: 'fail', affected: ctx.contacts.map((c) => c.id) },
    explain: (ctx, r) => `${r.affected.length} of ${ctx.contacts.length} in variant ${ctx.variant.key}`,
  });
  const r = evaluate({
    ...base,
    campaign: {
      ...CAMPAIGN,
      variants: [
        { key: 'default', message: 'Hello. Reply STOP to opt out.' },
        { key: 'lang:tamil', message: 'வணக்கம்' },
      ],
    },
    contacts: [
      { id: 'c1', variantKey: 'default' },
      { id: 'c2', variantKey: 'lang:tamil' },
      { id: 'c3' }, // no key → default
    ],
    packs: [pack([content, failing])],
  });
  assert.deepEqual(r.variants, [
    { key: 'default', recipientCount: 2 },
    { key: 'lang:tamil', recipientCount: 1 },
  ]);
  const contentFindings = r.findings.filter((f) => f.ruleId === 'T-CONTENT-001');
  assert.equal(contentFindings.length, 1, 'only the tamil variant fails');
  assert.equal(contentFindings[0]!.variantKey, 'lang:tamil');
  assert.equal(contentFindings[0]!.explanation, '1 of 1 in variant lang:tamil');
  const whole = r.findings.find((f) => f.ruleId === 'T-FAIL-001')!;
  assert.equal(whole.affectedCount, 3, 'recipient-level rule sees the whole audience once');
  assert.equal(r.coverage.evaluated, 2);
});

test('D29 — send window: ctx carries local end and duration', () => {
  const probe = rule({
    id: 'T-WIN',
    requires: ['campaign.scheduledAt', 'campaign.sendWindowEnd'],
    evaluate: (ctx) => {
      assert.equal(ctx.local?.hhmm, '11:00');
      assert.equal(ctx.localEnd?.hhmm, '13:30');
      assert.equal(ctx.sendWindowMinutes, 150);
      assert.equal(ctx.timezone, 'Asia/Kolkata');
      return { status: 'pass' };
    },
  });
  evaluate({ ...base, campaign: { ...CAMPAIGN, sendWindowEnd: '2026-09-10T13:30:00+05:30' }, packs: [pack([probe])] });
});

test('D47 — unresolvable recipients are stated in the coverage statement', () => {
  const r = evaluate({ ...base, audience: { rows: 4, duplicates: [{ rowId: 'c4', duplicateOf: 'c1' }], unresolvable: ['c3'] } });
  assert.match(r.coverage.statement, /1 recipient had no phone or email and could not be matched to history or consent\.$/);
  assert.equal(r.summary.audienceSize, 3, 'audienceSize counts unique contacts');
});

test('classification gate — declared purpose wins; mixed evaluates as promotional', () => {
  const r = evaluate({ ...base, campaign: { ...CAMPAIGN, purpose: null, message: 'EMI due. Also a pre-approved offer!' } });
  assert.equal(r.classification.classification, 'mixed');
  assert.equal(r.effectivePurpose, 'promotional');
  const s = evaluate(base);
  assert.equal(s.effectivePurpose, 'collections');
});
