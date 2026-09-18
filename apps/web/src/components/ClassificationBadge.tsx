import { classify } from '@preflight/core';
import { M } from '../messages';

/** S-12 — client-side preview of the A-IN-003 gate (16 §1: the one place web imports core). */
export function ClassificationBadge({ message, purposeStated }: { message: string; purposeStated: boolean }) {
  const c = classify(message);
  const tone = c.confidence === 'high' ? 'border-ink text-ink bg-white' : 'border-warn text-warn bg-warn-bg';
  return (
    <div className="flex flex-col gap-1 text-sm" data-testid="classification">
      <div>
        {M.newCheck.readsAs}: <span className={`chip ${tone}`}>{c.classification}</span> <span className="text-ink-muted">({M.newCheck.confidence[c.confidence]})</span>
      </div>
      {!purposeStated && c.confidence === 'low' && <p className="text-warn">⚠ {M.newCheck.purposeWarn(c.classification)}</p>}
    </div>
  );
}
