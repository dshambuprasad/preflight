import { describe, expect, it } from 'vitest';
import { mkdtemp, cp, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Rule, RulePack } from '@preflight/core';
import { loadRuleGraph, ruleMetadata, rulebookHash, RulebookValidationError, type RuleMeta } from '../src/index.js';

const RULEBOOK_DIR = fileURLToPath(new URL('../../../rulebook/', import.meta.url));

function fakeRule(m: RuleMeta): Rule {
  return {
    id: m.id,
    pack: m.pack,
    layer: m.layer,
    tier: (m.tier ?? 0) as Rule['tier'],
    category: m.category ?? 'timing',
    title: m.title,
    severity: m.severity,
    ...(m.effectiveFrom ? { effectiveFrom: m.effectiveFrom } : {}),
    ...(m.severityBefore ? { severityBefore: m.severityBefore } : {}),
    citation: m.citation,
    requires: m.requires.length ? m.requires : ['campaign.message'],
    appliesTo: () => true,
    evaluate: () => ({ status: 'pass' }),
    explain: () => 'x',
  };
}

function packsFrom(metas: RuleMeta[]): RulePack[] {
  const byPack = new Map<string, Rule[]>();
  for (const m of metas.filter((m) => m.sendTimeCheck)) {
    if (!byPack.has(m.pack)) byPack.set(m.pack, []);
    byPack.get(m.pack)!.push(fakeRule(m));
  }
  return [...byPack.entries()].map(([id, rules]) => ({ id, version: '0.0.0', rules, sourceHash: 'fake-' + id }));
}

describe('rulebook graph', () => {
  it('loads 27 rule nodes (25 India + 2 hygiene), 3 graph-only', async () => {
    const g = await loadRuleGraph(RULEBOOK_DIR);
    expect(g.files).toEqual(['india-layer-a.ttl', 'preflight-hygiene.ttl']);
    expect(g.ruleIds()).toHaveLength(27);
    const metas = ruleMetadata(g);
    expect(metas.filter((m) => !m.sendTimeCheck).map((m) => m.id)).toEqual(['A-IN-006', 'A-RBI-009', 'A-RBI-010']);
    expect(metas.filter((m) => m.pack === 'india-layer-a' && m.sendTimeCheck)).toHaveLength(22);
    expect(metas.filter((m) => m.pack === 'preflight-hygiene')).toHaveLength(2);
    expect(g.nodes.filter((n) => n.type === 'enforcement')).toHaveLength(3);
    expect(g.nodes.filter((n) => n.type === 'regulator').map((n) => n.id).sort()).toEqual(['reg:FACE', 'reg:MeitY', 'reg:Meta', 'reg:Preflight', 'reg:RBI', 'reg:TRAI']);
  });

  it('every rule has severityBasis (22 D1) and the 9 PreflightCore titles are verbatim', async () => {
    const g = await loadRuleGraph(RULEBOOK_DIR);
    for (const m of ruleMetadata(g)) expect(m.severityBasis, m.id).toBeTruthy();
    const t = (id: string) => g.explain(id).rule.title;
    expect(t('A-RBI-001')).toBe('Recovery contact only between 08:00 and 19:00 IST');
    expect(t('A-RBI-003')).toBe("Communication in the borrower's understood language");
    expect(t('A-WA-003')).toBe('WhatsApp template variables match the approved template');
    expect(t('A-RBI-012')).toBe('Sales calls/visits only between 09:00 and 19:00 IST');
  });

  it('hash is stable across loads and changes when a triple is added', async () => {
    const a = await loadRuleGraph(RULEBOOK_DIR);
    const b = await loadRuleGraph(RULEBOOK_DIR);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    const dir = await mkdtemp(join(tmpdir(), 'rulebook-'));
    await cp(RULEBOOK_DIR, dir, { recursive: true });
    await appendFile(join(dir, 'preflight-hygiene.ttl'), '\n<https://preflight.dev/rule/A-PF-001> <https://preflight.dev/ns/pf#note> "changed" .\n');
    const c = await loadRuleGraph(dir);
    expect(c.hash).not.toBe(a.hash);
    // rulebookHash folds in pack source hashes, sorted by id
    const packs = packsFrom(ruleMetadata(a));
    expect(rulebookHash(a, packs)).toBe(rulebookHash(a, [...packs].reverse()));
    expect(rulebookHash(a, packs)).not.toBe(rulebookHash(c, packs));
  });

  it('explain(A-RBI-001) walks rule → clause → instrument → RBI with the HDFC action', async () => {
    const g = await loadRuleGraph(RULEBOOK_DIR);
    const e = g.explain('A-RBI-001');
    expect(e.path.clauses.map((c) => c.id)).toEqual(['clause:RBI-2022-23-108/recovery-hours']);
    expect(e.path.instruments[0]?.id).toBe('inst:RBI-2022-23-108');
    expect(e.path.instruments[0]?.confidence).toBe('SECONDARY');
    expect(e.path.regulator?.id).toBe('reg:RBI');
    expect(e.enforcement).toHaveLength(1);
    expect(e.enforcement[0]).toMatchObject({ entity: 'HDFC Bank Limited', date: '2024-09-10', amount: 10000000 });
    expect(e.rule.citation).toMatchObject({ instrument: 'RBI/2022-23/108, DOR.ORG.REC.65/21.04.158/2022-23 (12 Aug 2022)', graphNodeId: 'inst:RBI-2022-23-108' });
    const l = g.explain('A-RBI-006');
    expect(l.path.clauses[0]?.text).toContain('explicit consent');
    expect(l.related).toEqual([{ ruleId: 'A-IN-004', jurisdiction: 'IN', relation: 'closeMatch' }]);
    expect(() => g.explain('A-XX-999')).toThrow(/not in graph/);
  });

  it('graph JSON has the 06 §7 shape and every edge points at a node', async () => {
    const g = await loadRuleGraph(RULEBOOK_DIR);
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.source), e.source).toBe(true);
      expect(ids.has(e.target), e.target).toBe(true);
      expect(['derivedFrom', 'quotedFrom', 'attributedTo', 'evidences', 'supersedes', 'closeMatch']).toContain(e.type);
    }
    expect(g.edges.filter((e) => e.type === 'evidences')).toHaveLength(3);
  });

  it('validateAgainst passes for a code pack mirroring the graph', async () => {
    const g = await loadRuleGraph(RULEBOOK_DIR);
    expect(g.validateAgainst(packsFrom(ruleMetadata(g)))).toEqual({ ok: true, problems: [] });
  });

  it('validateAgainst fails on one-sided rules, effectiveFrom mismatch, missing derivedFrom', async () => {
    const g = await loadRuleGraph(RULEBOOK_DIR);
    const metas = ruleMetadata(g);
    const good = packsFrom(metas);

    // (b) code rule absent from the graph
    const extra = fakeRule({ ...metas.find((m) => m.id === 'A-RBI-001')!, id: 'A-RBI-099' });
    const withExtra = good.map((p) => (p.id === 'india-layer-a' ? { ...p, rules: [...p.rules, extra] } : p));
    expect(() => g.validateAgainst(withExtra)).toThrow(/A-RBI-099: in code but no pf:Rule node/);

    // (a) graph rule with no code
    const missingOne = good.map((p) => ({ ...p, rules: p.rules.filter((r) => r.id !== 'A-WA-003') }));
    expect(() => g.validateAgainst(missingOne)).toThrow(/A-WA-003: in graph but no code rule/);

    // (c) effectiveFrom mismatch — and the error lists ALL problems
    const drifted = good.map((p) => ({
      ...p,
      rules: p.rules.map((r) => (r.id === 'A-RBI-006' ? { ...r, effectiveFrom: '2027-02-01' } : r.id === 'A-RBI-001' ? { ...r, severity: 'warn' as const } : r)),
    }));
    try {
      g.validateAgainst(drifted);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(RulebookValidationError);
      const problems = (err as RulebookValidationError).problems;
      expect(problems).toContain("A-RBI-006: effectiveFrom '2027-02-01' in code, '2027-01-01' in graph");
      expect(problems).toContain("A-RBI-001: severity 'warn' in code, 'block' in graph");
    }

    // (d) missing derivedFrom in the graph
    const dir = await mkdtemp(join(tmpdir(), 'rulebook-bad-'));
    await cp(RULEBOOK_DIR, dir, { recursive: true });
    await appendFile(join(dir, 'preflight-hygiene.ttl'), '\n<https://preflight.dev/rule/A-PF-003> a <https://preflight.dev/ns/pf#Rule> ; <https://preflight.dev/ns/pf#id> "A-PF-003" ; <https://preflight.dev/ns/pf#pack> "preflight-hygiene" ; <https://preflight.dev/ns/pf#severity> "warn" .\n');
    const bad = await loadRuleGraph(dir);
    expect(() => bad.validateAgainst(good)).toThrow(/A-PF-003: graph rule has no pf:derivedFrom clause/);

    // sendTimeCheck=false node implemented in code is a D20 violation
    const ctx = fakeRule({ ...metas.find((m) => m.id === 'A-RBI-009')!, tier: 0, category: 'consent' });
    const withCtx = good.map((p) => (p.id === 'india-layer-a' ? { ...p, rules: [...p.rules, ctx] } : p));
    expect(() => g.validateAgainst(withCtx)).toThrow(/A-RBI-009: marked pf:sendTimeCheck false/);
  });

  it('refuses a malformed Turtle file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rulebook-broken-'));
    await cp(RULEBOOK_DIR, dir, { recursive: true });
    await appendFile(join(dir, 'india-layer-a.ttl'), '\nthis is not turtle ;;; .\n');
    await expect(loadRuleGraph(dir)).rejects.toBeInstanceOf(RulebookValidationError);
  });
});
