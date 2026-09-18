// The two PreflightCore samples through BOTH packs — the M0 demo numbers (01 §5 step 2; 12 §H D41).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluate, identityKey, normaliseConsent, normaliseLanguage, normalisePhone } from '@preflight/core';
import type { Contact } from '@preflight/core';
import { hygienePack, pack } from '../src/index.js';

const root = new URL('../../../../builds/PreflightCore/sample/', import.meta.url);
const { parseCSV } = (await import('../../../../builds/PreflightCore/src/util.js' as string)) as { parseCSV: (t: string) => Record<string, string>[] };
const rows = parseCSV(readFileSync(new URL('contacts.csv', root), 'utf8'));
const contacts: Contact[] = rows.map((r, i) => {
  const phoneE164 = normalisePhone(r.phone);
  return {
    id: `row-${i + 1}`,
    externalId: r.id,
    phoneE164,
    identityKey: identityKey({ externalId: r.id, phoneE164 }, `row-${i + 1}`),
    preferredLanguage: normaliseLanguage(r.preferredLanguage),
    consentPromotional: normaliseConsent(r.consentPromotional),
  };
});
const load = (name: string) => JSON.parse(readFileSync(new URL(name, root), 'utf8')) as { campaign: never; config: Record<string, unknown> };

test('collections sample — 2 blockers, 2 warnings, 1 info (demo step 2)', () => {
  const s = load('collections_campaign.json');
  const r = evaluate({ campaign: s.campaign, contacts, config: s.config, asOf: '2026-09-12T10:00:00+05:30', packs: [pack, hygienePack] });
  const by = (id: string) => r.findings.find((f) => f.ruleId === id);
  assert.equal(r.summary.blockers, 2);
  assert.equal(r.summary.warnings, 2);
  assert.equal(r.summary.info, 1);
  assert.ok(by('A-RBI-001')?.severity === 'block');
  assert.ok(by('A-WA-003')?.severity === 'block');
  assert.equal(by('A-RBI-003')?.affectedCount, 6);
  assert.ok(by('A-RBI-011'));
  assert.ok(by('A-RBI-005')?.severity === 'info');
  assert.equal(r.summary.verdict, null);
  // D41 — the computed statement (Tier-1 rules present from M0, never silently passing)
  assert.deepEqual(r.coverage.cannotEvaluate.map((c) => c.ruleId), ['A-RBI-004', 'A-WA-002', 'A-WA-004']);
  assert.equal(
    r.coverage.statement,
    'Checked 9 of 12 applicable rules. 3 could not be evaluated — history.contactEvents, campaign.template.externalId, platform.templates, platform.messagingLimit.',
  );
  console.log('collections coverage:', r.coverage.statement);
});

test('promotional sample — 2027-01-01 turns two warnings into blockers (demo step 5)', () => {
  const s = load('promotional_campaign.json');
  const run = (asOf: string) => evaluate({ campaign: s.campaign, contacts, config: s.config, asOf, packs: [pack, hygienePack] });
  const before = run('2026-09-12T10:00:00+05:30');
  const after = run('2027-02-01T10:00:00+05:30');
  const sev = (r: ReturnType<typeof run>, id: string) => r.findings.find((f) => f.ruleId === id)?.severity;
  assert.equal(before.effectivePurpose, 'promotional');
  assert.equal(before.classification.classification, 'mixed');
  assert.equal(sev(before, 'A-RBI-006'), 'warn');
  assert.equal(sev(before, 'A-RBI-008'), 'warn');
  assert.equal(before.summary.blockers, 0);
  assert.equal(sev(after, 'A-RBI-006'), 'block');
  assert.equal(sev(after, 'A-RBI-008'), 'block');
  assert.equal(after.summary.blockers, 2);
  assert.equal(sev(after, 'A-IN-004'), 'warn', 'DPDP switch is 13 May 2027');
  assert.equal(sev(run('2027-06-01T10:00:00+05:30'), 'A-IN-004'), 'block');
  assert.equal(sev(before, 'A-RBI-014'), 'warn', '"our lowest rate" is not a disclosure');
  assert.equal(sev(before, 'A-IN-003'), 'info', 'purpose not stated, mixed');
  console.log('promotional coverage:', before.coverage.statement, '| before:', JSON.stringify(before.summary), '| after:', JSON.stringify(after.summary));
});
