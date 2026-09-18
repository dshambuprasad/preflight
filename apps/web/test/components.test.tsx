import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { StateChip } from '../src/components/StateChip';
import { FindingCard } from '../src/components/FindingCard';
import { ClassificationBadge } from '../src/components/ClassificationBadge';
import { M } from '../src/messages';
import { FINDING, renderUi } from './helpers';

describe('StateChip (07 §3.4)', () => {
  it('renders every version_state with its text label', () => {
    const states = Object.keys(M.states) as (keyof typeof M.states)[];
    renderUi(<>{states.map((s) => <StateChip key={s} state={s} />)}</>);
    for (const s of states) expect(screen.getByText(M.states[s])).toBeInTheDocument();
    expect(states).toHaveLength(10);
  });
});

describe('FindingCard (S-21 four-part anatomy)', () => {
  it('renders WHAT / WHY / RULE / FIX and the operator-blocker tooltip text', () => {
    renderUi(<FindingCard finding={FINDING} roles={['operator']} />);
    expect(screen.getByText('A-RBI-001')).toBeInTheDocument();
    expect(screen.getByText('BLOCK', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Scheduled 20:15 IST')).toBeInTheDocument();
    expect(screen.getByText(/All 12 recipients affected/)).toBeInTheDocument();
    expect(screen.getByText(/RBI\/2022-23\/108/)).toBeInTheDocument();
    expect(screen.getByText('SECONDARY', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Reschedule to 09:00 IST tomorrow')).toBeDisabled();
    const accept = screen.getByRole('button', { name: M.finding.accept });
    expect(accept).toBeDisabled();
    expect(accept).toHaveAttribute('title', M.finding.blockerReviewerOnly);
    expect(screen.getByText(M.finding.none)).toBeInTheDocument();
  });
  it('a reviewer sees the M1 reason instead', () => {
    renderUi(<FindingCard finding={FINDING} roles={['reviewer']} />);
    expect(screen.getByRole('button', { name: M.finding.accept })).toHaveAttribute('title', M.finding.acceptM1);
  });
  it('never says compliant', () => {
    const { container } = renderUi(<FindingCard finding={{ ...FINDING, severity: 'info' }} roles={['operator']} />);
    expect(container.textContent?.toLowerCase()).not.toContain('compliant');
  });
});

describe('ClassificationBadge (S-12 preview)', () => {
  it('flags a mixed message when purpose is not stated', () => {
    renderUi(<ClassificationBadge message="Your EMI is due on 5th. You are pre-approved for a top-up loan!" purposeStated={false} />);
    expect(screen.getByText('mixed')).toBeInTheDocument();
    expect(screen.getByText(/set Purpose to be precise/)).toBeInTheDocument();
  });
  it('is quiet when purpose is stated or confidence is high', () => {
    renderUi(<ClassificationBadge message="Your EMI is overdue." purposeStated={false} />);
    expect(screen.getByText('service')).toBeInTheDocument();
    expect(screen.queryByText(/set Purpose/)).toBeNull();
  });
});
