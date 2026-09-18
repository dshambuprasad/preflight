// @preflight/rules-india — pack `india-layer-a` (22 send-time rules, 12 §H D40) + `preflight-hygiene` (2).
// Logic only. Meaning and provenance live in rulebook/*.ttl (D10).
import type { Rule, RulePack } from '@preflight/core';
import { sourceHash } from './sourceHash.js';
import { HYGIENE_PACK_ID, PACK_ID } from './helpers.js';
import { rule as A_RBI_001 } from './rules/A-RBI-001.js';
import { rule as A_RBI_002 } from './rules/A-RBI-002.js';
import { rule as A_RBI_003 } from './rules/A-RBI-003.js';
import { rule as A_RBI_004 } from './rules/A-RBI-004.js';
import { rule as A_RBI_005 } from './rules/A-RBI-005.js';
import { rule as A_RBI_006 } from './rules/A-RBI-006.js';
import { rule as A_RBI_007 } from './rules/A-RBI-007.js';
import { rule as A_RBI_008 } from './rules/A-RBI-008.js';
import { rule as A_RBI_011 } from './rules/A-RBI-011.js';
import { rule as A_RBI_012 } from './rules/A-RBI-012.js';
import { rule as A_RBI_013 } from './rules/A-RBI-013.js';
import { rule as A_RBI_014 } from './rules/A-RBI-014.js';
import { rule as A_IN_001 } from './rules/A-IN-001.js';
import { rule as A_IN_002 } from './rules/A-IN-002.js';
import { rule as A_IN_003 } from './rules/A-IN-003.js';
import { rule as A_IN_004 } from './rules/A-IN-004.js';
import { rule as A_IN_005 } from './rules/A-IN-005.js';
import { rule as A_WA_001 } from './rules/A-WA-001.js';
import { rule as A_WA_002 } from './rules/A-WA-002.js';
import { rule as A_WA_003 } from './rules/A-WA-003.js';
import { rule as A_WA_004 } from './rules/A-WA-004.js';
import { rule as A_WA_005 } from './rules/A-WA-005.js';
import { rule as A_PF_001 } from './hygiene/A-PF-001.js';
import { rule as A_PF_002 } from './hygiene/A-PF-002.js';

export const INDIA_RULES: Rule[] = [
  A_RBI_001, A_RBI_002, A_RBI_003, A_RBI_004, A_RBI_005, A_RBI_006, A_RBI_007, A_RBI_008, A_RBI_011, A_RBI_012,
  A_RBI_013, A_RBI_014, A_IN_001, A_IN_002, A_IN_003, A_IN_004, A_IN_005, A_WA_001, A_WA_002, A_WA_003, A_WA_004,
  A_WA_005,
];

export const pack: RulePack = {
  id: PACK_ID,
  version: '1.3.0',
  rules: INDIA_RULES,
  sourceHash: sourceHash[PACK_ID] ?? 'dev',
};

export const hygienePack: RulePack = {
  id: HYGIENE_PACK_ID,
  version: '0.1.0',
  rules: [A_PF_001, A_PF_002],
  sourceHash: sourceHash[HYGIENE_PACK_ID] ?? 'dev',
};

export const packs: Record<string, RulePack> = { [PACK_ID]: pack, [HYGIENE_PACK_ID]: hygienePack };

/** The 9 Tier-0 rules of builds/PreflightCore — the byte-identity baseline (D19, D42). */
export const legacyRuleIds = ['A-RBI-001', 'A-RBI-002', 'A-RBI-003', 'A-RBI-005', 'A-RBI-006', 'A-RBI-008', 'A-RBI-011', 'A-RBI-012', 'A-WA-003'] as const;

export function legacyPack(): RulePack {
  return { ...pack, rules: pack.rules.filter((r) => (legacyRuleIds as readonly string[]).includes(r.id)) };
}

/** How `sourceHash` is computed (scripts/hash-sources.mjs) so apps/api can recompute it at boot. */
export const SOURCE_HASH_INPUT = {
  [PACK_ID]: 'dist/src/rules/*.js',
  [HYGIENE_PACK_ID]: 'dist/src/hygiene/*.js',
} as const;

export { PACK_ID, HYGIENE_PACK_ID } from './helpers.js';
export { OPT_OUT_DISCLOSURE } from './rules/A-RBI-008.js';
