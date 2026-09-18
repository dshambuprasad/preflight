import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { CreateVersionBody } from '@preflight/api-types';
import { campaignsQuery, useCreateCampaign, useCreateVersion } from '../hooks/queries';
import { ClassificationBadge } from './ClassificationBadge';
import { ErrorState } from './ErrorState';
import { parseCsv } from '../csv';
import { fromISTParts } from '../time';
import { isApiError } from '../api';
import { SAMPLE_COLLECTIONS, SAMPLE_CONTACTS_CSV, sampleDate } from '../sample';
import { M } from '../messages';

type Purpose = '' | 'collections' | 'promotional' | 'service';
type Channel = 'whatsapp' | 'sms' | 'email';

const PLACEHOLDER = /\{\{\s*(\d+)\s*\}\}/g;

/** S-12 — the pre-flight screen. Two columns: message (left), audience (right). */
export function NewCheck({ campaignId }: { campaignId?: string }) {
  const navigate = useNavigate();
  const campaigns = useQuery(campaignsQuery());
  const createCampaign = useCreateCampaign();
  const createVersion = useCreateVersion();

  const [selected, setSelected] = useState<string>(campaignId ?? 'new');
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState<'live' | 'shadow'>('live');
  const [isTemplate, setIsTemplate] = useState(false);
  const [message, setMessage] = useState('');
  const [variables, setVariables] = useState<string[]>([]);
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [purpose, setPurpose] = useState<Purpose>('');
  const [segment, setSegment] = useState('retail');
  const [segmentOther, setSegmentOther] = useState('');
  const [product, setProduct] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [windowEnd, setWindowEnd] = useState('');
  const [csv, setCsv] = useState('');
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);

  const parsed = useMemo(() => parseCsv(csv), [csv]);
  const placeholders = useMemo(() => new Set([...message.matchAll(PLACEHOLDER)].map((m) => m[1])).size, [message]);

  function loadSample() {
    setIsTemplate(true);
    setMessage(SAMPLE_COLLECTIONS.template.body);
    setVariables(SAMPLE_COLLECTIONS.template.variables);
    setChannel(SAMPLE_COLLECTIONS.channel);
    setPurpose(SAMPLE_COLLECTIONS.purpose);
    setSegment(SAMPLE_COLLECTIONS.borrowerSegment);
    setDate(sampleDate());
    setTime(SAMPLE_COLLECTIONS.time);
    setCsv(SAMPLE_CONTACTS_CSV);
    if (selected === 'new' && !newName) setNewName('Sept EMI reminder');
  }

  /** the rendered message is the template body with variables substituted (M0: default variant only) */
  const renderedMessage = isTemplate ? message.replace(PLACEHOLDER, (_m, n: string) => variables[Number(n) - 1] ?? `{{${n}}}`) : message;

  async function run() {
    setIssues({});
    setSubmitError(null);
    const local: Record<string, string> = {};
    if (!message.trim()) local.message = 'Message is required.';
    if (!date) local.scheduledAt = 'Pick a date.';
    if (!parsed.rows.length) local.audience = M.newCheck.noRows;
    if (parsed.rows.length > 5000) local.audience = 'At most 5,000 pasted rows; upload a CSV (M2).';
    if (selected === 'new' && !newName.trim()) local.campaign = 'Name the campaign.';
    if (Object.keys(local).length) { setIssues(local); return; }
    try {
      let cid = selected;
      if (cid === 'new') cid = (await createCampaign.mutateAsync({ name: newName.trim(), mode: newMode })).id;
      const seg = segment === 'other' ? segmentOther.trim() : segment;
      const body: CreateVersionBody = {
        message: renderedMessage,
        channel,
        scheduledAt: fromISTParts(date, time),
        ...(windowEnd ? { sendWindowEnd: fromISTParts(date, windowEnd) } : {}),
        ...(purpose ? { purpose } : {}),
        ...(seg ? { borrowerSegment: seg } : {}),
        ...(product.trim() ? { product: product.trim() } : {}),
        ...(isTemplate ? { template: { body: message, variables } } : {}),
        audience: { rows: parsed.rows },
      };
      const r = await createVersion.mutateAsync({ campaignId: cid, body });
      void navigate({ to: '/versions/$id', params: { id: r.version.id } });
    } catch (e) {
      if (isApiError(e) && e.problem.issues?.length) {
        setIssues(Object.fromEntries(e.problem.issues.map((i) => [i.path.split('.')[0] || 'form', i.message])));
      } else setSubmitError(e);
    }
  }

  const busy = createCampaign.isPending || createVersion.isPending;
  const issueList = Object.entries(issues);

  return (
    <section>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl">{M.newCheck.title}</h1>
        <div className="flex items-center gap-2 text-sm">
          <label>{M.newCheck.campaign}:</label>
          <select className="field w-56" value={selected} onChange={(e) => setSelected(e.target.value)} aria-label={M.newCheck.campaign}>
            <option value="new">{M.newCheck.newCampaign}</option>
            {campaigns.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {selected === 'new' && (
            <>
              <input className="field w-48" placeholder={M.newCheck.campaignName} value={newName} onChange={(e) => setNewName(e.target.value)} aria-label={M.newCheck.campaignName} />
              <select className="field w-24" value={newMode} onChange={(e) => setNewMode(e.target.value as 'live' | 'shadow')} aria-label={M.newCheck.mode}>
                <option value="live">live</option>
                <option value="shadow">shadow</option>
              </select>
            </>
          )}
          <button type="button" className="btn" onClick={loadSample}>{M.newCheck.loadSample}</button>
        </div>
      </header>
      {issueList.length > 0 && (
        <div role="alert" className="mb-3 border border-block bg-block-bg p-2 text-sm text-block">
          {M.newCheck.fixThese} {issueList.map(([k, v]) => <span key={k} className="ml-2"><b>{k}</b>: {v}</span>)}
        </div>
      )}
      {submitError != null && <div className="mb-3"><ErrorState error={submitError} /></div>}
      <div className="grid grid-cols-2 gap-4">
        <fieldset className="border border-line bg-white p-3 text-sm">
          <legend className="px-1 text-xs tracking-widest text-ink-muted">{M.newCheck.message}</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} /> {M.newCheck.templateToggle}
          </label>
          <label className="mt-2 block">
            {isTemplate ? M.newCheck.body : M.newCheck.message_}
            <textarea className="field mt-1 h-28 font-mono text-xs" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4096} aria-invalid={!!issues.message} />
          </label>
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>{issues.message && <span className="text-block">{issues.message}</span>}</span>
            <span>{message.length} / {isTemplate ? 1024 : 4096}</span>
          </div>
          {isTemplate && (
            <div className="mt-2">
              <div className="flex flex-wrap items-center gap-1">
                <span>{M.newCheck.variables}</span>
                {variables.map((v, i) => (
                  <span key={i} className="chip border-line normal-case tracking-normal">
                    <input className="w-16 bg-transparent" value={v} onChange={(e) => setVariables(variables.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`variable ${i + 1}`} />
                    <button type="button" aria-label="remove" onClick={() => setVariables(variables.filter((_, j) => j !== i))}>×</button>
                  </span>
                ))}
                <button type="button" className="btn py-0.5 text-xs" onClick={() => setVariables([...variables, ''])}>{M.newCheck.addVariable}</button>
                <span className={`ml-auto ${variables.length !== placeholders ? 'text-warn' : 'text-ink-muted'}`}>
                  {M.newCheck.placeholders(placeholders, variables.length)} {variables.length !== placeholders && '⚠'}
                </span>
              </div>
            </div>
          )}
          <div className="mt-3"><ClassificationBadge message={renderedMessage} purposeStated={purpose !== ''} /></div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label>{M.newCheck.channel}
              <select className="field mt-1" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                {(Object.keys(M.newCheck.channels) as Channel[]).map((c) => <option key={c} value={c}>{M.newCheck.channels[c]}</option>)}
              </select>
            </label>
            <label>{M.newCheck.purpose}
              <select className="field mt-1" value={purpose} onChange={(e) => setPurpose(e.target.value as Purpose)}>
                <option value="">{M.newCheck.notStated}</option>
                {(['collections', 'promotional', 'service'] as const).map((p) => <option key={p} value={p}>{M.newCheck.purposes[p]}</option>)}
              </select>
            </label>
            <label>{M.newCheck.segment}
              <select className="field mt-1" value={segment} onChange={(e) => setSegment(e.target.value)}>
                <option value="retail">{M.newCheck.segments.retail}</option>
                <option value="microfinance">{M.newCheck.segments.microfinance}</option>
                <option value="other">{M.newCheck.segments.other}</option>
              </select>
              {segment === 'other' && <input className="field mt-1" value={segmentOther} onChange={(e) => setSegmentOther(e.target.value)} aria-label="segment name" />}
            </label>
            <label>{M.newCheck.product}<input className="field mt-1" value={product} onChange={(e) => setProduct(e.target.value)} /></label>
            <label>{M.newCheck.scheduled} <span className="text-ink-muted">({M.newCheck.ist})</span>
              <div className="mt-1 flex gap-1">
                <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="scheduled date" aria-invalid={!!issues.scheduledAt} />
                <input className="field w-28" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="scheduled time" />
              </div>
              {issues.scheduledAt && <span className="text-block">{issues.scheduledAt}</span>}
            </label>
            <label>{M.newCheck.sendWindowEnd} <span className="text-ink-muted">({M.newCheck.ist})</span>
              <input className="field mt-1 w-28" type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} aria-label="send window end" />
              {issues.sendWindowEnd && <span className="block text-block">{issues.sendWindowEnd}</span>}
            </label>
          </div>
        </fieldset>
        <fieldset className="border border-line bg-white p-3 text-sm">
          <legend className="px-1 text-xs tracking-widest text-ink-muted">{M.newCheck.audience}</legend>
          <div className="border border-dashed border-line p-3 text-center text-ink-muted">{M.newCheck.dropZone}</div>
          <label className="mt-2 block">{M.newCheck.pasteRows}
            <textarea className="field mt-1 h-40 font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={M.newCheck.pasteLabel} aria-invalid={!!issues.audience} />
          </label>
          {issues.audience && <p className="text-block">{issues.audience}</p>}
          {parsed.rows.length > 0 && (
            <div className="mt-2">
              <p className="font-semibold">{M.newCheck.rowsSummary(parsed.rows.length, parsed.headers.length)}</p>
              <p className="text-ink-muted">{parsed.headers.join(' · ')}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-ink-muted">{M.newCheck.sample}</p>
              <table className="mt-1 w-full text-xs">
                <thead><tr>{parsed.headers.map((h) => <th key={h} className="border-b border-line p-1 text-left">{h}</th>)}</tr></thead>
                <tbody>{parsed.rows.slice(0, 5).map((r, i) => <tr key={i}>{parsed.headers.map((h) => <td key={h} className="p-1">{r[h]}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </fieldset>
      </div>
      <footer className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn" disabled title="Drafts arrive in M1">{M.newCheck.saveDraft}</button>
        <button type="button" className="btn-primary" onClick={() => void run()} disabled={busy}>{busy ? M.newCheck.running : M.newCheck.run}</button>
      </footer>
    </section>
  );
}
