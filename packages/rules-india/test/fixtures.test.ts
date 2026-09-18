// Per-rule ground-truth fixtures (11 §2): ≥1 pass / fail / cannot_evaluate / not_applicable where the rule can
// produce it, with expected status, missing[], affected[] and date-switched severity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { evaluate } from '@preflight/core';
import type { ConsentAccess, ContactEvent, HistoryAccess, PlatformState, RulePack } from '@preflight/core';
import { packs } from '../src/index.js';

const dir = new URL('../../fixtures/', import.meta.url);
const allRules = Object.values(packs).flatMap((p) => p.rules);

interface Tier1 {
  history?: Record<string, ContactEvent[]>;
  consent?: { productScoped?: boolean; records: Record<string, 'granted' | 'denied'>; dnd?: string[] };
  platform?: Partial<PlatformState>;
}
interface Case {
  name: string;
  campaign: Record<string, unknown>;
  contacts: Record<string, unknown>[];
  config: Record<string, unknown>;
  audience?: { rows: number; duplicates: { rowId: string; duplicateOf: string }[]; unresolvable: string[] };
  asOf: string;
  tier1?: Tier1;
  expect: { status: string; severity?: string; affected?: string[]; missing?: string[] };
}

function history(h: Record<string, ContactEvent[]>): HistoryAccess {
  return {
    events: (key, from, to) => (h[key] ?? []).filter((e) => e.occurredAt >= new Date(Date.parse(from)).toISOString() && Date.parse(e.occurredAt) < Date.parse(to)),
    hasAnyHistory: (key) => (h[key] ?? []).length > 0,
    earliestKnown: null,
  };
}
function consent(c: NonNullable<Tier1['consent']>): ConsentAccess {
  const access: ConsentAccess = {
    current: (key, purpose, channel) => {
      const state = c.records[`${key}|${purpose}|${channel ?? ''}`] ?? c.records[`${key}|${purpose}`];
      return state ? { purpose, channel, state, source: 'test', recordedAt: '2026-01-01T00:00:00Z' } : null;
    },
    productScoped: c.productScoped ?? false,
  };
  if (c.dnd) access.dnd = (key) => c.dnd!.includes(key);
  return access;
}
function platform(p: Partial<PlatformState>): PlatformState {
  return { qualityRating: null, messagingLimitTier: null, templates: null, fetchedAt: '2026-09-12T00:00:00Z', ...p };
}

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const { ruleId, cases } = JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as { ruleId: string; cases: Case[] };
  const rule = allRules.find((r) => r.id === ruleId);
  test(`${ruleId} — fixture covers pass/fail/cannot/not_applicable`, () => {
    assert.ok(rule, `${ruleId} not in any pack`);
    const statuses = new Set(cases.map((c) => c.expect.status));
    assert.ok(statuses.has('fail'), 'needs a fail case');
    assert.ok(statuses.has('pass'), 'needs a pass case');
  });
  for (const c of cases) {
    test(`${ruleId} — ${c.name}`, () => {
      const single: RulePack = { id: rule!.pack, version: 'fixture', rules: [rule!], sourceHash: 'fixture' };
      const r = evaluate({
        campaign: c.campaign as never,
        contacts: c.contacts as never,
        config: c.config,
        asOf: c.asOf,
        packs: [single],
        audience: c.audience,
        history: c.tier1?.history ? history(c.tier1.history) : undefined,
        consent: c.tier1?.consent ? consent(c.tier1.consent) : undefined,
        platform: c.tier1?.platform ? platform(c.tier1.platform) : undefined,
      });
      const finding = r.findings[0];
      const cannot = r.coverage.cannotEvaluate[0];
      const na = r.coverage.notApplicable[0];
      switch (c.expect.status) {
        case 'fail':
          assert.ok(finding, `expected a finding; got ${JSON.stringify(r.coverage)}`);
          if (c.expect.severity) assert.equal(finding.severity, c.expect.severity);
          if (c.expect.affected) assert.deepEqual([...finding.affectedRowIds].sort(), [...c.expect.affected].sort());
          assert.ok(finding.explanation.length > 0);
          assert.ok(finding.what.kind);
          break;
        case 'pass':
          assert.equal(r.findings.length, 0, JSON.stringify(r.findings));
          assert.equal(r.coverage.evaluated, 1, JSON.stringify(r.coverage));
          break;
        case 'cannot_evaluate':
          assert.ok(cannot, `expected cannot_evaluate; got ${JSON.stringify({ f: r.findings, c: r.coverage })}`);
          if (c.expect.missing) assert.deepEqual(cannot.missing, c.expect.missing);
          assert.equal(r.findings.length, 0, 'never a pass, never a finding');
          break;
        case 'not_applicable':
          assert.ok(na, `expected not_applicable; got ${JSON.stringify({ f: r.findings, c: r.coverage })}`);
          break;
      }
    });
  }
}
