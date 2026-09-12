// Local wall-clock conversion (D32/D46): the tenant's IANA timezone is a parameter of the context;
// nothing in core assumes IST. India (Asia/Kolkata) is a fixed +05:30 zone and takes the fast path,
// which also keeps the demo independent of the host's ICU data.

import type { LocalTime } from './types.js';

/** Fixed-offset zones (minutes east of UTC) that have had no DST in the relevant era. */
const FIXED_OFFSETS: Record<string, number> = {
  'Asia/Kolkata': 330,
  'Asia/Calcutta': 330,
  'Asia/Colombo': 330,
  'Asia/Kathmandu': 345,
  'Asia/Dhaka': 360,
  'Asia/Karachi': 300,
  'Asia/Dubai': 240,
  'Asia/Singapore': 480,
  'Asia/Kuala_Lumpur': 480,
  'Asia/Tokyo': 540,
  'Asia/Seoul': 540,
  'Asia/Shanghai': 480,
  'Asia/Hong_Kong': 480,
  UTC: 0,
  'Etc/UTC': 0,
};

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Convert an ISO-8601 instant to wall-clock parts in `timezone`.
 * Accepts any offset ("...Z", "+05:30", "-04:00"); the instant is what matters.
 * Returns null for anything unparseable — callers MUST treat null as "cannot evaluate", never as a pass.
 */
export function localTime(iso: unknown, timezone: string = DEFAULT_TIMEZONE): LocalTime | null {
  if (typeof iso !== 'string' || iso.trim() === '') return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const fixed = FIXED_OFFSETS[timezone];
  if (fixed !== undefined) {
    const d = new Date(ms + fixed * 60_000);
    const hour = d.getUTCHours();
    const minute = d.getUTCMinutes();
    return { hhmm: `${pad(hour)}:${pad(minute)}`, hour, minute, weekday: d.getUTCDay() };
  }
  // Non-fixed zone: Intl (available in Node ≥ 13 full-icu and all evergreen browsers).
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    });
  } catch {
    return null; // unknown zone id → cannot evaluate
  }
  const parts = fmt.formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const weekday = WEEKDAYS[get('weekday') ?? ''] ?? 0;
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return { hhmm: `${pad(hour)}:${pad(minute)}`, hour, minute, weekday };
}

/** Kept for the India pack's readability; identical to localTime(iso, 'Asia/Kolkata'). */
export function toIST(iso: unknown): LocalTime | null {
  return localTime(iso, 'Asia/Kolkata');
}

/** Minutes since local midnight, or null. */
export function localMinutes(iso: unknown, timezone: string = DEFAULT_TIMEZONE): number | null {
  const t = localTime(iso, timezone);
  return t ? t.hour * 60 + t.minute : null;
}

/** "08:00" -> 480. Throws on malformed input: window bounds are authored, not user data. */
export function hhmmToMinutes(hhmm: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`bad time literal: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Whole minutes between two instants, or null if either is unparseable or end < start. */
export function minutesBetween(startIso: unknown, endIso: unknown): number | null {
  if (typeof startIso !== 'string' || typeof endIso !== 'string') return null;
  const a = Date.parse(startIso);
  const b = Date.parse(endIso);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.floor((b - a) / 60_000);
}

/**
 * D29 — does a send that starts at `startMinutes` (local) and lasts `durationMinutes` fall anywhere
 * outside the half-open permitted window [open, close)? A single instant has duration 0.
 */
export function outsideWindow(startMinutes: number, durationMinutes: number, open: number, close: number): boolean {
  if (durationMinutes < 0) return true;
  if (startMinutes < open || startMinutes >= close) return true;
  // the last message of the send must still be inside the window
  return startMinutes + durationMinutes >= close;
}

/** Severity for a rule at a given instant (04 §4). */
export function severityAt(
  rule: { severity: 'block' | 'warn' | 'info'; effectiveFrom?: string; severityBefore?: 'block' | 'warn' | 'info' },
  asOf: string,
): 'block' | 'warn' | 'info' {
  if (!rule.effectiveFrom) return rule.severity;
  const now = Date.parse(asOf);
  const from = Date.parse(rule.effectiveFrom);
  if (Number.isNaN(now)) return rule.severityBefore ?? rule.severity;
  return now >= from ? rule.severity : (rule.severityBefore ?? rule.severity);
}
