import { M } from '../messages';

export type VersionState = keyof typeof M.states;

const STYLE: Record<VersionState, string> = {
  draft: 'border-line text-ink-muted bg-white',
  resolving: 'border-info text-info bg-info-bg',
  evaluated: 'border-ink text-ink bg-white',
  in_review: 'border-warn text-warn bg-warn-bg',
  approved: 'border-ok text-ok bg-ok-bg',
  rejected: 'border-block text-block bg-block-bg',
  sealed: 'border-ok text-ok bg-ok-bg',
  handed_off: 'border-ok text-ok bg-ok-bg',
  abandoned: 'border-line text-ink-muted bg-paper-2',
  expired: 'border-block text-block bg-block-bg',
};

/** 07 §3.4 — every version_state (15 §1) has a chip; colour always paired with text. */
export function StateChip({ state }: { state: VersionState }) {
  return (
    <span className={`chip ${STYLE[state]}`} data-state={state}>
      {state === 'resolving' && <span className="inline-block h-2 w-2 animate-spin rounded-full border border-info border-t-transparent" aria-hidden />}
      {state === 'sealed' && <span aria-hidden>🔒</span>}
      {M.states[state]}
    </span>
  );
}
