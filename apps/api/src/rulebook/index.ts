// 02 §3 rulebook/ — loads rule packs + the Turtle graph once per process (18 §6), validates parity
// (04 §7; boot refuses on failure, 14 §3), computes rulebookHash, checks each pack's sourceHash.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import type { RulePack } from '@preflight/core';
import { validatePacks } from '@preflight/core';
import { packs as indiaPacks, SOURCE_HASH_INPUT } from '@preflight/rules-india';
import { loadRuleGraph, rulebookHash, ruleMetadata, type RuleGraph, type RuleMeta } from '@preflight/rulegraph';

export interface Rulebook {
  graph: RuleGraph;
  packs: Record<string, RulePack>;
  /** sha256(graph.hash ‖ every pack's sourceHash) — 04 §7 */
  hash: string;
  graphHash: string;
  loadedAt: Date;
  gitRef: string | null;
  metadata: RuleMeta[];
  /** packs named by a tenant's config snapshot (15 §3 rulePacks); unknown ids throw */
  packsFor(ids: readonly string[]): RulePack[];
  hashFor(ids: readonly string[]): string;
}

export class RulebookBootError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RulebookBootError';
  }
}

/** Same algorithm as packages/rules-india/scripts/hash-sources.mjs — recomputed at boot (16 §2.2). */
function hashDir(dir: string): string {
  const files = readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  const h = createHash('sha256');
  for (const f of files) {
    h.update(`--- ${f}\n`);
    h.update(readFileSync(join(dir, f)));
  }
  return h.digest('hex');
}

function rulesIndiaRoot(): string {
  const require = createRequire(import.meta.url);
  const pkgJson = require.resolve('@preflight/rules-india/package.json');
  return dirname(pkgJson);
}

export function verifySourceHashes(packs: Record<string, RulePack>): string[] {
  const problems: string[] = [];
  const root = rulesIndiaRoot();
  for (const [id, glob] of Object.entries(SOURCE_HASH_INPUT)) {
    const dir = join(root, dirname(glob));
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
      problems.push(`${id}: compiled rule directory missing (${dir})`);
      continue;
    }
    const actual = hashDir(dir);
    const declared = packs[id]?.sourceHash;
    if (declared !== actual) problems.push(`${id}: sourceHash ${declared} ≠ compiled sources ${actual}`);
  }
  return problems;
}

export async function loadRulebook(rulebookDir: string, opts: { gitRef?: string | null; verifySources?: boolean } = {}): Promise<Rulebook> {
  const packs = { ...indiaPacks };
  const packList = Object.values(packs).sort((a, b) => a.id.localeCompare(b.id));
  validatePacks(packList);
  if (opts.verifySources ?? true) {
    const problems = verifySourceHashes(packs);
    if (problems.length) throw new RulebookBootError(`rule pack source hashes do not match:\n  ${problems.join('\n  ')}`);
  }
  const graph = await loadRuleGraph(rulebookDir);
  graph.validateAgainst(packList); // throws RulebookValidationError → boot refuses (14 §3)
  const hash = rulebookHash(graph, packList);
  const metadata = ruleMetadata(graph);
  const hashCache = new Map<string, string>();
  const packsFor = (ids: readonly string[]): RulePack[] =>
    [...ids].sort().map((id) => {
      const p = packs[id];
      if (!p) throw new RulebookBootError(`unknown rule pack '${id}'`);
      return p;
    });
  return {
    graph,
    packs,
    hash,
    graphHash: graph.hash,
    loadedAt: new Date(),
    gitRef: opts.gitRef ?? null,
    metadata,
    packsFor,
    hashFor(ids) {
      const key = [...ids].sort().join(',');
      let h = hashCache.get(key);
      if (!h) {
        h = rulebookHash(graph, packsFor(ids));
        hashCache.set(key, h);
      }
      return h;
    },
  };
}
