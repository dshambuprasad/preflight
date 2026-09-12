import type { Context, FailResult, Rule, RulePack } from '../src/index.js';

export const ASOF = '2026-09-05T00:00:00+05:30';

export const CITATION = { instrument: 'TEST/1', title: 'Test instrument', confidence: 'PRIMARY' as const, graphNodeId: 'test:1' };

export function rule(partial: Partial<Rule> & Pick<Rule, 'id'>): Rule {
  return {
    pack: 'test-pack',
    layer: 'A',
    tier: 0,
    category: 'timing',
    title: `Rule ${partial.id}`,
    severity: 'warn',
    citation: CITATION,
    requires: ['campaign.message'],
    appliesTo: () => true,
    evaluate: () => ({ status: 'pass' }),
    explain: (_ctx: Context, r: FailResult) => `${r.affected.length} affected`,
    ...partial,
  };
}

export function pack(rules: Rule[], id = 'test-pack'): RulePack {
  return { id, version: '0.0.0', rules: rules.map((r) => ({ ...r, pack: id })), sourceHash: 'test' };
}

export const CAMPAIGN = {
  message: 'Your EMI of Rs 5,000 is overdue. Please pay immediately.',
  channel: 'whatsapp' as const,
  scheduledAt: '2026-09-10T11:00:00+05:30',
  purpose: 'collections' as const,
};

export const CONTACTS = [
  { id: 'c1', preferredLanguage: 'english' },
  { id: 'c2', preferredLanguage: 'tamil' },
  { id: 'c3' },
];
