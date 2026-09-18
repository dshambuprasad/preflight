import { describe, expect, it } from 'vitest';
import { parseCsv } from '../src/csv';
import { deriveScorecard } from '../src/components/Scorecard';
import { formatIST, fromISTParts, toISTParts } from '../src/time';
import { FINDING } from './helpers';

describe('CSV paste parser', () => {
  it('handles quoted fields, embedded commas and CRLF', () => {
    const p = parseCsv('id,name,phone\r\nB-1,"Rao, A",+919812340001\r\n"B-2","Say ""hi""",\r\n\r\n');
    expect(p.headers).toEqual(['id', 'name', 'phone']);
    expect(p.rows).toEqual([{ id: 'B-1', name: 'Rao, A', phone: '+919812340001' }, { id: 'B-2', name: 'Say "hi"', phone: '' }]);
  });
  it('empty input → no rows', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
  });
});

describe('scorecard derivation (S-21)', () => {
  const rules = [
    { id: 'A-RBI-001', pack: 'india-layer-a', category: 'timing', sendTimeCheck: true },
    { id: 'A-RBI-006', pack: 'india-layer-a', category: 'consent', sendTimeCheck: true },
    { id: 'A-PF-001', pack: 'preflight-hygiene', category: 'audience', sendTimeCheck: true },
    { id: 'A-RBI-003', pack: 'india-layer-a', category: 'content', sendTimeCheck: true },
    { id: 'A-RBI-004', pack: 'india-layer-a', category: 'identity', sendTimeCheck: true },
    { id: 'A-RBI-009', pack: 'india-layer-a', category: 'delivery', sendTimeCheck: false },
  ] as never;
  const coverage = { rulesInBook: 5, applicable: 4, evaluated: 3, cannotEvaluate: [{ ruleId: 'A-RBI-004', title: '', reason: '', missing: ['history.contactEvents'] }], notApplicable: [{ ruleId: 'A-RBI-006', title: '' }], statement: '' };
  it('findings → count; evaluated & clean → pass; nothing evaluated → not checked', () => {
    const card = deriveScorecard([FINDING], coverage, rules, ['india-layer-a@1.3.0', 'preflight-hygiene@0.1.0']);
    expect(card.timing).toEqual({ kind: 'findings', count: 1, worst: 'block' });
    expect(card.audience).toEqual({ kind: 'pass' });
    expect(card.content).toEqual({ kind: 'pass' });
    expect(card.consent).toEqual({ kind: 'not_checked' });
    expect(card.identity).toEqual({ kind: 'not_checked' });
    expect(card.delivery).toEqual({ kind: 'not_checked' });
  });
});

describe('IST helpers', () => {
  it('formats and round-trips in IST', () => {
    expect(formatIST('2026-09-14T14:45:00Z')).toBe('14 Sep 2026 20:15 IST');
    expect(toISTParts('2026-09-14T14:45:00Z')).toEqual({ date: '2026-09-14', time: '20:15' });
    expect(fromISTParts('2026-09-14', '20:15')).toBe('2026-09-14T20:15:00+05:30');
  });
});
