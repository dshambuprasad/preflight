import { useEffect, useMemo, useState } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import * as Tabs from '@radix-ui/react-tabs';
import { campaignQuery, evaluationQuery, evaluationsQuery, meQuery, rulesQuery, useEvaluate, versionQuery, type EvaluationDetailData, type VersionDetailData } from '../hooks/queries';
import { StateChip } from '../components/StateChip';
import { FindingCard } from '../components/FindingCard';
import { Scorecard, deriveScorecard } from '../components/Scorecard';
import { DisabledButton } from '../components/DisabledButton';
import { ErrorState, Skeleton } from '../components/ErrorState';
import { formatIST, fromISTParts, toISTParts } from '../time';
import { M } from '../messages';

/** S-20 header + summary + coverage persist above the tabs (D21); S-21 findings tab. */
export const Route = createFileRoute('/_app/versions/$id')({ component: VersionScreen });

const PRESETS = [
  { key: 'rbc', label: M.version.presets.rbc, iso: '2027-01-01T10:00:00+05:30' },
  { key: 'dpdp', label: M.version.presets.dpdp, iso: '2027-05-13T10:00:00+05:30' },
];

function VersionScreen() {
  const { id } = Route.useParams();
  const v = useQuery({ ...versionQuery(id), refetchInterval: (q) => (q.state.data?.state === 'resolving' ? 1500 : false) });
  if (v.isPending) return <Skeleton rows={6} />;
  if (v.isError) return <ErrorState error={v.error} onRetry={() => void v.refetch()} />;
  return <VersionBody version={v.data} />;
}

function VersionBody({ version: vd }: { version: VersionDetailData }) {
  const me = useQuery(meQuery);
  const evaluate = useEvaluate();
  const [asOf, setAsOf] = useState<string | null>(null); // null = the version's own evaluation
  const evals = useQuery({ ...evaluationsQuery(vd.id), enabled: asOf !== null, refetchInterval: (q) => (asOf && !q.state.data?.items.some((e) => sameInstant(e.asOf, asOf)) ? 1500 : false) });
  const wanted = asOf ? evals.data?.items.find((e) => sameInstant(e.asOf, asOf)) : null;
  const evaluationId = asOf ? (wanted?.id ?? null) : (vd.latestEvaluation?.id ?? null);
  const ev = useQuery({ ...evaluationQuery(evaluationId ?? ''), enabled: !!evaluationId });
  const rules = useQuery(rulesQuery);
  const campaign = useQuery(campaignQuery(vd.campaignId));
  const roles = me.data?.user.roles ?? [];
  const parts = toISTParts(asOf ?? vd.scheduledAt);

  useEffect(() => {
    if (asOf && !wanted && !evaluate.isPending && !evals.isPending) evaluate.mutate({ versionId: vd.id, asOf });
    // deps deliberately exclude the mutation object: re-run only when the target instant or its evaluation changes
  }, [asOf, wanted?.id, evals.isPending]);

  const card = useMemo(() => (ev.data && rules.data ? deriveScorecard(ev.data.findings, ev.data.coverage, rules.data.items, ev.data.rulePackIds) : null), [ev.data, rules.data]);
  const shadow = vd.campaignMode === 'shadow';
  const advisory = asOf !== null && !sameInstant(asOf, vd.scheduledAt);

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center gap-3">
        <Link to="/campaigns/$id" params={{ id: vd.campaignId }} className="text-ink-muted">{M.version.back}</Link>
        <h1 className="text-xl">{vd.campaignName}</h1>
        <span className="font-semibold">v{vd.versionNo}</span>
        <StateChip state={vd.state} />
        {shadow && <span className="chip border-line text-ink-muted">shadow</span>}
        {vd.supersededBy.length > 0 && <span className="text-sm text-ink-muted">{M.version.superseded}</span>}
      </header>
      <p className="text-sm text-ink-muted">
        {M.newCheck.channels[vd.channel as keyof typeof M.newCheck.channels] ?? vd.channel} · {vd.purpose ? M.newCheck.purposes[vd.purpose] : M.newCheck.notStated}
        {ev.data && <span className="ml-1 chip border-line text-ink-muted">{ev.data.classification.classification}{ev.data.classification.confidence === 'low' ? ' — low confidence' : ''}</span>}
        {vd.borrowerSegment && <> · {vd.borrowerSegment}</>} · {M.version.recipients(vd.audienceSize)} · {shadow ? `sent ${formatIST(vd.sentAt)}` : `${M.newCheck.scheduled} ${formatIST(vd.scheduledAt)}`}
        {vd.sendWindowEnd && <> – {formatIST(vd.sendWindowEnd)}</>} · {M.version.by} {vd.createdBy.displayName}
      </p>

      {vd.state === 'resolving' && (
        <div className="border border-line bg-white p-3 text-sm" data-testid="progress">
          <span>● {M.version.progress.ingested}</span> ─── <span className="text-info">◐ {M.version.progress.resolved}</span> ─── <span className="text-ink-muted">○ {M.version.progress.checked}</span>
          <p className="mt-1 text-ink-muted">{M.version.progress.waiting}</p>
        </div>
      )}
      {vd.state === 'draft' && vd.lastError && (
        <div className="border border-block bg-block-bg p-3 text-sm">
          <p className="text-block">{vd.lastError}</p>
          <button type="button" className="btn mt-2" onClick={() => evaluate.mutate({ versionId: vd.id })}>{M.version.failed}</button>
        </div>
      )}

      {vd.state !== 'resolving' && vd.state !== 'draft' && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label>{M.version.asOf}:</label>
            <input type="date" className="field w-40" value={parts.date} disabled={shadow} onChange={(e) => setAsOf(fromISTParts(e.target.value, parts.time))} aria-label="as-of date" />
            <input type="time" className="field w-28" value={parts.time} disabled={shadow} onChange={(e) => setAsOf(fromISTParts(parts.date, e.target.value))} aria-label="as-of time" />
            <button type="button" className={`btn text-xs ${asOf === null ? 'bg-paper-2' : ''}`} onClick={() => setAsOf(null)}>{M.version.presets.today}</button>
            {PRESETS.map((p) => (
              <button key={p.key} type="button" className={`btn text-xs ${asOf === p.iso ? 'bg-paper-2' : ''}`} disabled={shadow} onClick={() => setAsOf(p.iso)}>{p.label}</button>
            ))}
            <span className="text-ink-muted">ℹ {M.version.sealingNote}</span>
          </div>
          {shadow && <p className="text-sm text-warn">{M.version.shadow(formatIST(vd.sentAt))}</p>}
          {advisory && <p className="text-sm text-warn">⚠ {M.version.advisory}</p>}
          {ev.data && <p className="text-sm text-ink-muted">{M.version.evaluatedAsOf(formatIST(ev.data.asOf))}</p>}

          {asOf && !wanted && <Skeleton rows={2} />}
          {ev.isError && <ErrorState error={ev.error} />}
          {ev.data && <SummaryAndCoverage ev={ev.data} />}

          <Tabs.Root defaultValue="findings">
            <Tabs.List className="flex gap-1 border-b border-line text-sm">
              {(['findings', 'audience', 'history'] as const).map((t) => (
                <Tabs.Trigger key={t} value={t} className="border border-b-0 border-line px-3 py-1 data-[state=active]:bg-white data-[state=inactive]:bg-paper-2">{M.version.tabs[t]}</Tabs.Trigger>
              ))}
            </Tabs.List>
            <Tabs.Content value="findings" className="space-y-3 pt-3">
              {card && <Scorecard card={card} />}
              {ev.data && ev.data.findings.length === 0 && (
                <p className="border border-line bg-white p-3 text-sm" data-testid="no-findings">{M.version.noFindings} {ev.data.coverage.statement}</p>
              )}
              {ev.data?.findings.map((f) => <FindingCard key={f.id} finding={f} roles={roles} />)}
            </Tabs.Content>
            <Tabs.Content value="audience" className="pt-3">
              <dl className="grid max-w-md grid-cols-2 gap-2 border border-line bg-white p-3 text-sm">
                <dt className="text-ink-muted">{M.version.audience.size}</dt><dd className="font-semibold">{vd.audience.size}</dd>
                <dt className="text-ink-muted">{M.version.audience.duplicates}</dt><dd>{vd.audience.duplicates}</dd>
                <dt className="text-ink-muted">{M.version.audience.unresolvable}</dt><dd>{vd.audience.unresolvable}</dd>
                <dt className="text-ink-muted">{M.version.audience.consent}</dt>
                <dd>{vd.audience.consent.granted} {M.version.audience.granted} · {vd.audience.consent.denied} {M.version.audience.denied} · {vd.audience.consent.unknown} {M.version.audience.unknown} · {vd.audience.consent.absent} {M.version.audience.absent}</dd>
              </dl>
            </Tabs.Content>
            <Tabs.Content value="history" className="pt-3">
              {campaign.data && (
                <ul className="divide-y divide-line border border-line bg-white text-sm">
                  {campaign.data.versions.map((x) => (
                    <li key={x.id} className="flex items-center gap-3 p-2">
                      <Link to="/versions/$id" params={{ id: x.id }} className={x.id === vd.id ? 'font-semibold' : 'underline'}>v{x.versionNo}</Link>
                      <StateChip state={x.state} />
                      <span className="text-ink-muted">{formatIST(x.scheduledAt)}</span>
                      <span>{x.latestEvaluation ? `✖ ${x.latestEvaluation.summary.blockers} · ⚠ ${x.latestEvaluation.summary.warnings} · ℹ ${x.latestEvaluation.summary.info}` : '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Tabs.Content>
          </Tabs.Root>
        </>
      )}
    </section>
  );
}

function SummaryAndCoverage({ ev }: { ev: EvaluationDetailData }) {
  const s = ev.summary;
  return (
    <div className="border-y border-line bg-white px-3 py-2 text-sm" data-testid="summary">
      <div className="flex flex-wrap items-center gap-4">
        <span className={s.blockers ? 'font-semibold text-block' : 'text-ink-muted'}>✖ {M.version.blockers(s.blockers)}</span>
        <span className={s.warnings ? 'font-semibold text-warn' : 'text-ink-muted'}>⚠ {M.version.warnings(s.warnings)}</span>
        <span className={s.info ? 'font-semibold text-info' : 'text-ink-muted'}>ℹ {M.version.info(s.info)}</span>
        <span className="ml-auto text-xs uppercase tracking-wide text-ink-muted">{M.version.coverage}</span>
        <span data-testid="coverage">“{ev.coverage.statement}”</span>
      </div>
      {ev.coverage.cannotEvaluate.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-ink-muted">
          {ev.coverage.cannotEvaluate.map((c) => (
            <li key={c.ruleId} className="flex items-center gap-2">
              · <span className="font-mono text-xs">{c.ruleId}</span> {M.version.needs} {c.missing.join(', ') || c.reason}
              <DisabledButton label={M.version.provide} reason={M.version.provideM2} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function sameInstant(a: string, b: string): boolean {
  return Date.parse(a) === Date.parse(b);
}
