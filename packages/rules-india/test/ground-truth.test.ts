// D19 / D42 — byte-identity with builds/PreflightCore on the projection of the ported report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluate, normaliseConsent } from '@preflight/core';
import type { Contact, EvaluationResult } from '@preflight/core';
import { legacyPack } from '../src/index.js';

// dist/test → ../../../core/test/fixtures ; builds is four levels up
const fixture = JSON.parse(readFileSync(new URL('../../../core/test/fixtures/ground-truth.json', import.meta.url), 'utf8')) as {
  legacyRuleIds: string[];
  input: { campaign: Record<string, unknown>; contacts: Record<string, string>[]; config: Record<string, unknown>; now: string };
  expected: Record<string, unknown>;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const original: { evaluate: (i: unknown) => any } = await import('../../../../builds/PreflightCore/src/engine.js' as string);

type Legacy = Record<string, unknown>;

/** PreflightCore's output shape: its keys, in its key order. citation.confidence is the typed enum now (excluded). */
function project(r: EvaluationResult | Legacy): Legacy {
  const byId = (a: { ruleId: string }, b: { ruleId: string }) => a.ruleId.localeCompare(b.ruleId);
  const findings = (r.findings as Legacy[]).map((f) => {
    const out: Legacy = {
      ruleId: f.ruleId,
      severity: f.severity,
      title: f.title,
      citation: { instrument: (f.citation as Legacy).instrument, title: (f.citation as Legacy).title },
    };
    if (f.note !== undefined) out.note = f.note;
    out.affectedCount = f.affectedCount;
    out.affectedSample = f.affectedSample;
    out.detail = f.detail;
    out.explanation = f.explanation;
    return out;
  });
  const cov = r.coverage as Legacy;
  return {
    findings,
    classification: r.classification,
    effectivePurpose: r.effectivePurpose,
    coverage: {
      rulesInBook: cov.rulesInBook,
      applicable: cov.applicable,
      evaluated: cov.evaluated,
      cannotEvaluate: [...(cov.cannotEvaluate as { ruleId: string }[])].sort(byId),
      notApplicable: [...(cov.notApplicable as { ruleId: string }[])].sort(byId),
      statement: cov.statement,
    },
    summary: r.summary,
  };
}

test('byte-identical to builds/PreflightCore on the ground-truth fixture (projection, D42)', () => {
  const { input } = fixture;
  const contacts: Contact[] = input.contacts.map((c) => ({
    id: c.id!,
    preferredLanguage: c.preferredLanguage,
    consentPromotional: c.consentPromotional === undefined ? undefined : normaliseConsent(c.consentPromotional),
  }));
  const ported = evaluate({
    campaign: input.campaign as never,
    contacts,
    config: input.config,
    asOf: input.now,
    packs: [legacyPack()],
  });
  const live = original.evaluate(input);
  const a = JSON.stringify(project(ported));
  const b = JSON.stringify(project(live));
  const c = JSON.stringify(project(fixture.expected));
  assert.equal(a, b, 'port ≠ live PreflightCore output');
  assert.equal(b, c, 'live PreflightCore ≠ frozen fixture (the baseline moved!)');
  assert.deepEqual(legacyPack().rules.map((r) => r.id).sort(), [...fixture.legacyRuleIds].sort());
});

test('byte-identical on the two sample campaigns as well', async () => {
  const { parseCSV } = (await import('../../../../builds/PreflightCore/src/util.js' as string)) as { parseCSV: (t: string) => Record<string, string>[] };
  const root = new URL('../../../../builds/PreflightCore/sample/', import.meta.url);
  const csv = parseCSV(readFileSync(new URL('contacts.csv', root), 'utf8'));
  for (const name of ['collections_campaign.json', 'promotional_campaign.json']) {
    const sample = JSON.parse(readFileSync(new URL(name, root), 'utf8')) as { campaign: Record<string, unknown>; config: Record<string, unknown> };
    for (const now of ['2026-09-12T10:00:00+05:30', '2027-02-01T10:00:00+05:30']) {
      const live = original.evaluate({ campaign: sample.campaign, contacts: csv, config: sample.config, now });
      const ported = evaluate({
        campaign: sample.campaign as never,
        contacts: csv.map((c) => ({ id: c.id!, preferredLanguage: c.preferredLanguage, consentPromotional: normaliseConsent(c.consentPromotional) })),
        config: sample.config,
        asOf: now,
        packs: [legacyPack()],
      });
      assert.equal(JSON.stringify(project(ported)), JSON.stringify(project(live)), `${name} @ ${now}`);
    }
  }
});
