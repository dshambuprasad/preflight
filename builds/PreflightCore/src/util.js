// Pure helpers. No DOM, no I/O, no Date.now() — determinism is a hard requirement.

export const IST_OFFSET_MIN = 330; // India is a single timezone, UTC+05:30, everywhere.

/**
 * Convert an ISO-8601 instant to IST wall-clock parts.
 * Accepts any offset ("...Z", "+05:30", "-04:00"); the instant is what matters.
 * Returns null for anything unparseable — callers must treat null as "cannot evaluate",
 * never as a pass.
 */
export function toIST(iso) {
  if (typeof iso !== 'string' || iso.trim() === '') return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms + IST_OFFSET_MIN * 60_000);
  return {
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(), // 0 = Sunday
    hhmm: `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`,
  };
}

/** Minutes since IST midnight, or null. */
export function istMinutes(iso) {
  const t = toIST(iso);
  return t ? t.hour * 60 + t.minute : null;
}

/** "08:00" -> 480. Throws on malformed input: window bounds are authored, not user data. */
export function hhmmToMinutes(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`bad time literal: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Stable, dependency-free CSV parse. Handles quoted fields and embedded commas/newlines. */
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(v => v.trim() !== ''))
    .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

/** Deterministic sample of affected ids for the report — sorted, capped. */
export function sample(ids, n = 5) {
  return [...ids].sort().slice(0, n);
}

/** True when a value is genuinely absent. Empty string counts as absent. */
export function missing(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}
