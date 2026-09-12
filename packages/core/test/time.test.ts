import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localTime, toIST, localMinutes, hhmmToMinutes, outsideWindow, severityAt, minutesBetween } from '../src/index.js';

test('local time in Asia/Kolkata regardless of the offset supplied', () => {
  assert.equal(toIST('2026-09-10T16:00:00Z')?.hhmm, '21:30');
  assert.equal(localTime('2026-09-10T21:30:00+05:30')?.hhmm, '21:30');
  assert.equal(localTime('2026-09-10T12:00:00-04:00', 'Asia/Kolkata')?.hhmm, '21:30');
  assert.deepEqual(localTime('2026-09-13T08:00:00+05:30'), { hhmm: '08:00', hour: 8, minute: 0, weekday: 0 }); // Sunday
  assert.equal(localTime('garbage'), null);
  assert.equal(localTime(''), null);
  assert.equal(localTime(undefined), null);
  assert.equal(localMinutes('2026-09-10T21:30:00+05:30'), 21 * 60 + 30);
});

test('D32 — other zones via Intl, including DST (no zone hard-coded in core)', () => {
  assert.equal(localTime('2026-07-01T12:00:00Z', 'Europe/London')?.hhmm, '13:00');
  assert.equal(localTime('2026-01-01T12:00:00Z', 'Europe/London')?.hhmm, '12:00');
  assert.equal(localTime('2026-01-01T12:00:00Z', 'Asia/Tokyo')?.hhmm, '21:00');
  assert.equal(localTime('2026-01-01T12:00:00Z', 'Not/AZone'), null);
});

test('hhmmToMinutes is strict on authored literals', () => {
  assert.equal(hhmmToMinutes('08:00'), 480);
  assert.throws(() => hhmmToMinutes('8:00'));
});

test('D29 — outsideWindow over an interval, half-open [open, close)', () => {
  const open = hhmmToMinutes('08:00');
  const close = hhmmToMinutes('19:00');
  assert.equal(outsideWindow(hhmmToMinutes('07:59'), 0, open, close), true);
  assert.equal(outsideWindow(hhmmToMinutes('08:00'), 0, open, close), false);
  assert.equal(outsideWindow(hhmmToMinutes('18:59'), 0, open, close), false);
  assert.equal(outsideWindow(hhmmToMinutes('19:00'), 0, open, close), true);
  assert.equal(outsideWindow(hhmmToMinutes('18:30'), 29, open, close), false, 'send ends 18:59');
  assert.equal(outsideWindow(hhmmToMinutes('18:30'), 30, open, close), true, 'send runs to 19:00');
  assert.equal(outsideWindow(hhmmToMinutes('18:30'), 180, open, close), true, 'send runs to 21:30');
  assert.equal(outsideWindow(hhmmToMinutes('10:00'), -1, open, close), true, 'negative duration is invalid');
  assert.equal(minutesBetween('2026-09-10T18:30:00+05:30', '2026-09-10T21:30:00+05:30'), 180);
  assert.equal(minutesBetween('2026-09-10T18:30:00+05:30', '2026-09-10T18:00:00+05:30'), null);
});

test('severityAt switches on effectiveFrom (04 §4)', () => {
  const r = { severity: 'block' as const, severityBefore: 'warn' as const, effectiveFrom: '2027-01-01' };
  assert.equal(severityAt(r, '2026-12-31T23:59:59Z'), 'warn');
  assert.equal(severityAt(r, '2027-01-01T00:00:00Z'), 'block');
  assert.equal(severityAt(r, 'garbage'), 'warn');
  assert.equal(severityAt({ severity: 'info' }, '2030-01-01T00:00:00Z'), 'info');
  assert.equal(severityAt({ severity: 'block', effectiveFrom: '2027-01-01' }, '2026-01-01T00:00:00Z'), 'block', 'no severityBefore → severity');
});
