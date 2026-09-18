import type { Finding } from '@preflight/api-types';
import { ConfidenceChip } from './ConfidenceChip';
import { DisabledButton } from './DisabledButton';
import { M } from '../messages';

const TAG: Record<Finding['severity'], string> = {
  block: 'border-block text-block bg-block-bg',
  warn: 'border-warn text-warn bg-warn-bg',
  info: 'border-info text-info bg-info-bg',
};
const RAIL: Record<Finding['severity'], string> = { block: 'border-l-block', warn: 'border-l-warn', info: 'border-l-info' };
const ICON: Record<Finding['severity'], string> = { block: '✖', warn: '⚠', info: 'ℹ' };

function whatText(f: Finding): string {
  const w = f.what;
  if (w.kind === 'rows') return `${M.finding.recipients(f.affectedCount)}${f.affectedSample.length ? ': ' + f.affectedSample.join(', ') : ''}`;
  if (w.kind === 'schedule') return `${M.finding.scheduled} ${w.excerpt ?? w.field ?? ''}`;
  if (w.kind === 'config') return `${w.field ?? ''}${w.excerpt ? ` = ${w.excerpt}` : ''}`;
  if (w.kind === 'template') return `${w.excerpt ?? ''}${w.field ? ` (${w.field})` : ''}`;
  return w.excerpt ?? '';
}

/** S-21 — the four-part anatomy (R5): WHAT · WHY · RULE · FIX, then DECISIONS. Decisions arrive in M1. */
export function FindingCard({ finding: f, roles }: { finding: Finding; roles: string[] }) {
  const operatorOnly = roles.includes('operator') && !roles.includes('reviewer') && !roles.includes('admin');
  const acceptReason = f.severity === 'block' && operatorOnly ? M.finding.blockerReviewerOnly : M.finding.acceptM1;
  return (
    <article className={`border border-line border-l-4 ${RAIL[f.severity]} bg-white p-3 text-sm`} data-testid={`finding-${f.ruleId}`} data-severity={f.severity}>
      <header className="flex items-baseline gap-3">
        <span className={`chip ${TAG[f.severity]}`}>{ICON[f.severity]} {M.finding.severity[f.severity]}</span>
        <span className="font-mono text-xs text-ink-muted">{f.ruleId}</span>
        <h3 className="flex-1 text-base font-semibold">{f.title}</h3>
        {f.variantKey !== 'default' && <span className="chip border-line text-ink-muted">{M.finding.variant} {f.variantKey}</span>}
        <DisabledButton label={M.finding.explain} reason={M.finding.explainM3} />
      </header>
      <dl className="mt-2 grid grid-cols-[6rem_1fr] gap-y-1.5">
        <dt className="text-xs font-semibold tracking-wide text-ink-muted">{M.finding.what}</dt>
        <dd><mark className="bg-warn-bg px-1">{whatText(f)}</mark></dd>
        <dt className="text-xs font-semibold tracking-wide text-ink-muted">{M.finding.why}</dt>
        <dd>“{f.explanation}”</dd>
        <dt className="text-xs font-semibold tracking-wide text-ink-muted">{M.finding.rule}</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <span>{f.citation.instrument}</span>
          <span className="text-ink-muted">·</span>
          <ConfidenceChip confidence={f.citation.confidence} />
        </dd>
        <dt className="text-xs font-semibold tracking-wide text-ink-muted">{M.finding.fix}</dt>
        <dd className="flex flex-wrap items-center gap-2">
          {f.suggestedFix ? <DisabledButton label={f.suggestedFix.label} reason={M.finding.fixM1} /> : <span className="text-ink-muted">—</span>}
          <span className="flex-1" />
          <DisabledButton label={M.finding.accept} reason={acceptReason} />
        </dd>
        <dt className="text-xs font-semibold tracking-wide text-ink-muted">{M.finding.decisions}</dt>
        <dd className="text-ink-muted">
          {f.suppressedBy ? <span className="chip border-line text-ink-muted">{M.finding.suppressed}</span> : M.finding.none}
        </dd>
      </dl>
    </article>
  );
}
