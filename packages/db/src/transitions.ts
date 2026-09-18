// The CampaignVersion state machine (05 §2), as data. `versions.setState` is the ONLY writer of
// `campaign_versions.state` (16 §2.4) and consults this table; the pipeline never writes state directly.

export const VERSION_STATES = [
  'draft', 'resolving', 'evaluated', 'in_review', 'approved', 'rejected', 'sealed', 'handed_off', 'abandoned', 'expired',
] as const;
export type VersionState = (typeof VERSION_STATES)[number];

export const TERMINAL_STATES: readonly VersionState[] = ['sealed', 'handed_off', 'abandoned', 'expired'];

/** from → allowed targets. Self-transitions listed explicitly (evaluated → evaluated: re-evaluate). */
const ALLOWED: Record<VersionState, readonly VersionState[]> = {
  draft: ['resolving', 'abandoned'],
  resolving: ['evaluated', 'draft', 'abandoned'],
  evaluated: ['evaluated', 'in_review', 'abandoned'],
  // in_review → evaluated: review invalidated by re-evaluation or a new decision (05 §6, F4, F6)
  in_review: ['approved', 'rejected', 'evaluated', 'expired', 'abandoned'],
  approved: ['sealed', 'expired', 'abandoned'],
  rejected: ['abandoned'],
  sealed: ['handed_off'],
  handed_off: [],
  abandoned: [],
  expired: [],
};

export function isTerminal(state: VersionState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function isAllowedTransition(from: VersionState, to: VersionState): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

export function allowedTargets(from: VersionState): readonly VersionState[] {
  return ALLOWED[from] ?? [];
}

/** Every allowed (from, to) pair — for exhaustive tests and documentation. */
export function allTransitions(): { from: VersionState; to: VersionState }[] {
  return VERSION_STATES.flatMap((from) => ALLOWED[from].map((to) => ({ from, to })));
}
