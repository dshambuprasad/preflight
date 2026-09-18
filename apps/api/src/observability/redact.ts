// 09 §2/§3 — PII never reaches logs. Paths for pino `redact`; tested in test/unit/redact.test.ts (11 §3.17).
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.plaintext',
  '*.credentials',
  '*.phone',
  '*.phoneE164',
  '*.phone_e164',
  '*.email',
  '*.emailNorm',
  '*.email_norm',
  '*.raw',
  '*.rows',
  '*.contacts',
  '*.audience.rows',
  'phone',
  'email',
  'phoneE164',
  'emailNorm',
  'raw',
  'rows',
  'contacts',
  'password',
  'plaintext',
  'credentials',
];

/** Defensive: scrub anything phone/email-shaped that slipped into a free-text log line. */
export function scrubText(s: string): string {
  return s
    .replace(/\+?\d[\d\s-]{8,}\d/g, '[redacted-phone]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]');
}
