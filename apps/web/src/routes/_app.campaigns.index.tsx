import { useState } from 'react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { campaignsQuery } from '../hooks/queries';
import { StateChip } from '../components/StateChip';
import { ErrorState, Skeleton } from '../components/ErrorState';
import { formatIST } from '../time';
import { M } from '../messages';

/** S-10 */
export const Route = createFileRoute('/_app/campaigns/')({ component: Campaigns });

const STATES = Object.keys(M.states);

function Campaigns() {
  const [state, setState] = useState('');
  const [mode, setMode] = useState('');
  const q = useQuery(campaignsQuery({ state: state || undefined, mode: mode || undefined }));
  const navigate = useNavigate();
  const filtered = !!(state || mode);
  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl">{M.campaigns.title}</h1>
        <Link to="/campaigns/new" className="btn-primary">{M.campaigns.newCheck}</Link>
      </header>
      <div className="mb-3 flex gap-2 text-sm">
        <select className="field w-40" value={state} onChange={(e) => setState(e.target.value)} aria-label="state">
          <option value="">{M.campaigns.allStates}</option>
          {STATES.map((s) => <option key={s} value={s}>{M.states[s as keyof typeof M.states]}</option>)}
        </select>
        <select className="field w-32" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="mode">
          <option value="">{M.campaigns.allModes}</option>
          <option value="live">live</option>
          <option value="shadow">shadow</option>
        </select>
      </div>
      {q.isPending && <Skeleton rows={4} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      {q.data && q.data.items.length === 0 && (
        <div className="mx-auto mt-10 max-w-md border border-line bg-white p-6 text-center">
          <p className="font-semibold">{filtered ? M.campaigns.filteredEmpty : M.campaigns.empty}</p>
          {!filtered && (
            <>
              <p className="text-ink-muted">“{M.campaigns.emptyCta}”</p>
              <Link to="/campaigns/new" className="btn-primary mt-3">{M.campaigns.newCheck}</Link>
            </>
          )}
        </div>
      )}
      {q.data && q.data.items.length > 0 && (
        <table className="w-full border border-line bg-white text-sm">
          <thead className="bg-paper-2 text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="p-2">{M.campaigns.cols.name}</th><th className="p-2">{M.campaigns.cols.mode}</th><th className="p-2">{M.campaigns.cols.ver}</th>
              <th className="p-2">{M.campaigns.cols.state}</th><th className="p-2">{M.campaigns.cols.counts}</th><th className="p-2">{M.campaigns.cols.scheduled}</th><th className="p-2">{M.campaigns.cols.actor}</th>
            </tr>
          </thead>
          <tbody>
            {q.data.items.map((c) => {
              const v = c.latestVersion;
              const s = v?.latestEvaluation?.summary;
              return (
                <tr key={c.id} className="cursor-pointer border-t border-line hover:bg-paper-2" onClick={() => void navigate({ to: '/campaigns/$id', params: { id: c.id } })} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') void navigate({ to: '/campaigns/$id', params: { id: c.id } }); }}>
                  <td className="p-2 font-semibold">{c.name}</td>
                  <td className="p-2">{c.mode}</td>
                  <td className="p-2">{v ? `v${v.versionNo}` : '—'}</td>
                  <td className="p-2">{v ? <StateChip state={v.state} /> : '—'}</td>
                  <td className="p-2">{s ? `${s.blockers} / ${s.warnings}` : '—'}</td>
                  <td className="p-2">{v ? (c.mode === 'shadow' ? `sent ${formatIST(v.sentAt)}` : formatIST(v.scheduledAt)) : '—'}</td>
                  <td className="p-2">{v ? `${v.createdBy.displayName} (${v.createdBy.roles[0] ?? ''})` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
