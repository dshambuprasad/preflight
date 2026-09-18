// Pack-level invariants: D7/D45 explanation lint, explanation-not-shared (11 §3.15), citations, counts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { evaluate, isKnownPath, validatePacks } from '@preflight/core';
import type { Context, FailResult, RulePack } from '@preflight/core';
import { hygienePack, legacyPack, legacyRuleIds, pack, packs } from '../src/index.js';

const all = [pack, hygienePack];
const rules = all.flatMap((p) => p.rules);

test('pack shape: 22 India + 2 hygiene rules, unique ids, validatePacks passes, legacy selection is 9', () => {
  assert.equal(pack.rules.length, 22);
  assert.equal(hygienePack.rules.length, 2);
  assert.equal(new Set(rules.map((r) => r.id)).size, 24);
  assert.deepEqual(Object.keys(packs).sort(), ['india-layer-a', 'preflight-hygiene']);
  validatePacks(all);
  assert.equal(legacyPack().rules.length, 9);
  assert.equal(legacyRuleIds.length, 9);
  assert.equal(typeof pack.sourceHash, 'string');
  assert.notEqual(pack.sourceHash, 'dev', 'build must stamp sourceHash');
});

test('every rule: citation with graphNodeId, non-empty known requires, explain()', () => {
  for (const r of rules) {
    assert.ok(r.citation.instrument && r.citation.title && r.citation.confidence, r.id);
    assert.match(r.citation.graphNodeId, /^inst:/, r.id);
    assert.ok(r.requires.length > 0, r.id);
    for (const p of r.requires) assert.ok(isKnownPath(p), `${r.id}: ${p}`);
    assert.equal(typeof r.explain, 'function', r.id);
    assert.ok(['A', 'B', 'C', 'A→C'].includes(r.layer), r.id);
  }
});

test('not-a-send-check ids are not in any pack (D20)', () => {
  for (const id of ['A-RBI-009', 'A-RBI-010', 'A-IN-006']) assert.ok(!rules.some((r) => r.id === id), id);
});

/** Every fail explanation produced by the fixtures: ≤ 240 chars, names the count when affectedCount > 0, never "compliant". */
test('explanation lint (22 D7 / 12 §H D45) over every fixture fail case', () => {
  const dir = new URL('../../fixtures/', import.meta.url);
  let checked = 0;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const { ruleId, cases } = JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as { ruleId: string; cases: { campaign: never; contacts: never; config: never; asOf: string; audience?: never; expect: { status: string } }[] };
    const rule = rules.find((r) => r.id === ruleId)!;
    for (const c of cases.filter((x) => x.expect.status === 'fail')) {
      const single: RulePack = { id: rule.pack, version: 'x', rules: [rule], sourceHash: 'x' };
      const r = evaluate({ campaign: c.campaign, contacts: c.contacts, config: c.config, asOf: c.asOf, packs: [single], audience: c.audience });
      for (const f of r.findings) {
        checked++;
        assert.ok(f.explanation.length <= 240, `${ruleId}: ${f.explanation.length} chars: ${f.explanation}`);
        assert.doesNotMatch(f.explanation.toLowerCase(), /compliant/, ruleId);
        if (f.affectedCount > 0) assert.ok(f.explanation.includes(String(f.affectedCount)), `${ruleId} must name ${f.affectedCount}: ${f.explanation}`);
      }
    }
  }
  assert.ok(checked >= 24, `checked ${checked}`);
});

test('explanation-not-shared — no two rules produce the same explanation for the same fail context', () => {
  const ctx = {
    campaign: { message: 'x', channel: 'whatsapp', scheduledAt: '2026-09-14T20:15:00+05:30', purpose: 'collections' },
    contacts: [{ id: 'c1' }, { id: 'c2' }],
    config: { lenderName: 'L' },
    asOf: '2026-09-12T10:00:00+05:30',
    classification: { classification: 'unknown', evaluateAs: 'promotional', confidence: 'low', promotionalMarkers: [], serviceMarkers: [], reason: '' },
    effectivePurpose: 'collections',
    timezone: 'Asia/Kolkata',
    local: { hhmm: '20:15', hour: 20, minute: 15, weekday: 1 },
    localEnd: null,
    sendWindowMinutes: 0,
    variant: { key: 'default', message: 'x' },
    audience: { rows: 2, duplicates: [], unresolvable: [] },
    exceptions: [],
  } as unknown as Context;
  const result: FailResult = { status: 'fail', affected: ['c1', 'c2'], detail: { sendTimeIST: '20:15', window: '08:00–19:00', reason: 'r', expected: 'L', placeholdersInBody: [1], variablesSupplied: 0, contiguousFromOne: true, messageScript: 'latin', classification: 'mixed', product: 'PL', tier: 'TIER_250', limit: 250, size: 300, excess: 50, rating: 'RED', uploadConflicts: 1, laterWithdrawals: 1 } };
  const seen = new Map<string, string>();
  for (const r of rules) {
    const text = r.explain(ctx, result);
    assert.ok(!seen.has(text), `${r.id} shares an explanation with ${seen.get(text)}: "${text}"`);
    seen.set(text, r.id);
  }
});
