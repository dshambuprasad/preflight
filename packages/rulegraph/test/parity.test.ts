// graph-code-parity (11 §3.16) against the real packs. Skipped until @preflight/rules-india is built.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import type { RulePack } from '@preflight/core';
import { loadRuleGraph } from '../src/index.js';

const RULEBOOK_DIR = fileURLToPath(new URL('../../../rulebook/', import.meta.url));

let rulesIndia: { pack: RulePack; hygienePack: RulePack } | null = null;
try {
  rulesIndia = (await import('@preflight/rules-india')) as typeof rulesIndia;
} catch {
  rulesIndia = null;
}

describe.skipIf(!rulesIndia)('graph-code-parity (real packs)', () => {
  it('every rule id in packs ↔ graph; effectiveFrom/severity/tier/category equal', async () => {
    const g = await loadRuleGraph(RULEBOOK_DIR);
    expect(g.validateAgainst([rulesIndia!.pack, rulesIndia!.hygienePack])).toEqual({ ok: true, problems: [] });
  });
});
