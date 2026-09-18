import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { campaignQuery } from '../hooks/queries';
import { StateChip } from '../components/StateChip';
import { ErrorState, Skeleton } from '../components/ErrorState';
import { formatIST } from '../time';
import { M } from '../messages';

/** S-11 */
export const Route = createFileRoute('/_app/campaigns/$id/')({ component: CampaignDetail });

function CampaignDetail() {
  const { id } = Route.useParams();
  const q = useQuery(campaignQuery(id));
  if (q.isPending) return <Skeleton rows={4} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const c = q.data;
  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl">
          <Link to="/campaigns" className="text-ink-muted">‹</Link> {c.name} <span className="chip border-line text-ink-muted">{c.mode}</span>
        </h1>
        <Link to="/campaigns/$id/versions/new" params={{ id }} className="btn">{M.campaign.newVersion}</Link>
      </header>
      <h2 className="mb-2 text-sm uppercase tracking-wide text-ink-muted">{M.campaign.versions}</h2>
      <ul className="divide-y divide-line border border-line bg-white text-sm">
        {c.versions.map((v) => (
          <li key={v.id}>
            <Link to="/versions/$id" params={{ id: v.id }} className="flex items-center gap-4 p-2 hover:bg-paper-2">
              <span className="w-10 font-semibold">v{v.versionNo}</span>
              <StateChip state={v.state} />
              <span className="text-ink-muted">{formatIST(v.scheduledAt)}</span>
              <span>{v.latestEvaluation ? `✖ ${v.latestEvaluation.summary.blockers} · ⚠ ${v.latestEvaluation.summary.warnings} · ℹ ${v.latestEvaluation.summary.info}` : '—'}</span>
              {v.supersededBy.length > 0 && <span className="text-ink-muted">{M.version.superseded}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
