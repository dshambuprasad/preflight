import { describe, expect, it } from 'vitest';
import { VERSION_STATES, TERMINAL_STATES, isAllowedTransition, isTerminal, allTransitions, allowedTargets } from '../../src/transitions.js';

// The 05 §2 transition table, transcribed independently of the implementation.
const SPEC: [string, string][] = [
  ['draft', 'resolving'],
  ['resolving', 'evaluated'],
  ['resolving', 'draft'],
  ['evaluated', 'evaluated'],
  ['evaluated', 'in_review'],
  ['in_review', 'approved'],
  ['in_review', 'rejected'],
  ['in_review', 'evaluated'], // review invalidated (05 §6)
  ['approved', 'sealed'],
  ['sealed', 'handed_off'],
  ['in_review', 'expired'],
  ['approved', 'expired'],
  ...['draft', 'resolving', 'evaluated', 'in_review', 'approved', 'rejected'].map((s): [string, string] => [s, 'abandoned']),
];

describe('05 §2 state machine', () => {
  it('every spec transition is allowed', () => {
    for (const [from, to] of SPEC) expect(isAllowedTransition(from as never, to as never), `${from} → ${to}`).toBe(true);
  });
  it('no transition outside the spec table is allowed (exhaustive)', () => {
    const allowed = new Set(SPEC.map(([f, t]) => `${f}>${t}`));
    for (const from of VERSION_STATES) for (const to of VERSION_STATES) {
      expect(isAllowedTransition(from, to), `${from} → ${to}`).toBe(allowed.has(`${from}>${to}`));
    }
    expect(allTransitions().length).toBe(SPEC.length);
  });
  it('terminal states never leave', () => {
    for (const s of TERMINAL_STATES) {
      expect(isTerminal(s)).toBe(true);
      expect(allowedTargets(s).filter((t) => t !== 'handed_off' || s !== 'sealed')).toEqual([]);
    }
    expect(allowedTargets('handed_off')).toEqual([]);
    expect(allowedTargets('abandoned')).toEqual([]);
    expect(allowedTargets('expired')).toEqual([]);
  });
  it('samples of forbidden pairs', () => {
    for (const [f, t] of [['draft', 'approved'], ['evaluated', 'sealed'], ['sealed', 'draft'], ['rejected', 'in_review'], ['abandoned', 'draft'], ['approved', 'in_review']]) {
      expect(isAllowedTransition(f as never, t as never)).toBe(false);
    }
  });
});
