import { isApiError } from '../api';
import { M } from '../messages';

/** 07 §6 — errors show the problem title and the requestId. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const title = isApiError(error) ? error.problem.title : error instanceof Error ? error.message : String(error);
  const requestId = isApiError(error) ? error.problem.requestId : null;
  const forbidden = isApiError(error) && error.errorType === 'forbidden-role';
  return (
    <div role="alert" className="border border-block bg-block-bg p-3 text-sm">
      <p className="font-semibold text-block">{forbidden ? M.errors.forbidden : title}</p>
      {requestId && <p className="text-ink-muted">{M.errors.requestId}: <code>{requestId}</code></p>}
      {onRetry && <button type="button" className="btn mt-2" onClick={onRetry}>{M.errors.retry}</button>}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2" aria-label={M.errors.loading}>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-5 rounded-sm bg-paper-2" />)}
    </div>
  );
}
