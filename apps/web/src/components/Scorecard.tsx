import type { EvaluationDetail, Finding, RuleListItem } from '@preflight/api-types';
import { M } from '../messages';

export const CATEGORIES = ['timing', 'consent', 'audience', 'content', 'identity', 'delivery'] as const;
export type Category = (typeof CATEGORIES)[number];
export type CategoryStatus = { kind: 'pass' } | { kind: 'findings'; count: number; worst: 'block' | 'warn' | 'info' } | { kind: 'not_checked' };

const SEV: Record<string, number> = { block: 0, warn: 1, info: 2 };

/** S-21 scorecard (R5 Litmus): findings by category; no findings → pass only if ≥1 rule of that category was evaluated. */
export function deriveScorecard(findings: Finding[], coverage: EvaluationDetail['coverage'], rules: RuleListItem[], packIds: string[]): Record<Category, CategoryStatus> {
  const out = {} as Record<Category, CategoryStatus>;
  const notEvaluated = new Set([...coverage.cannotEvaluate.map((c) => c.ruleId), ...coverage.notApplicable.map((c) => c.ruleId)]);
  const packs = new Set(packIds.map((p) => p.split('@')[0]));
  for (const cat of CATEGORIES) {
    const fs = findings.filter((f) => f.category === cat);
    if (fs.length) {
      const worst = fs.map((f) => f.severity).sort((a, b) => SEV[a]! - SEV[b]!)[0]!;
      out[cat] = { kind: 'findings', count: fs.length, worst };
      continue;
    }
    const evaluated = rules.some((r) => r.category === cat && r.sendTimeCheck && packs.has(r.pack) && !notEvaluated.has(r.id));
    out[cat] = evaluated ? { kind: 'pass' } : { kind: 'not_checked' };
  }
  return out;
}

const ICON = { block: '✖', warn: '⚠', info: 'ℹ' };
const TONE = { block: 'text-block', warn: 'text-warn', info: 'text-info' };

export function Scorecard({ card }: { card: Record<Category, CategoryStatus> }) {
  return (
    <dl className="grid grid-cols-3 gap-x-6 gap-y-2 border-b border-line pb-3 text-sm" data-testid="scorecard">
      {CATEGORIES.map((cat) => {
        const s = card[cat];
        return (
          <div key={cat} className="flex items-baseline justify-between gap-2">
            <dt className="uppercase tracking-wide text-ink-muted">{M.scorecard.categories[cat]}</dt>
            <dd className={s.kind === 'findings' ? `font-semibold ${TONE[s.worst]}` : 'text-ink-muted'}>
              {s.kind === 'pass' && `✓ ${M.scorecard.pass}`}
              {s.kind === 'not_checked' && `— ${M.scorecard.notChecked}`}
              {s.kind === 'findings' && `${ICON[s.worst]} ${M.scorecard.findings(s.count)}`}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
