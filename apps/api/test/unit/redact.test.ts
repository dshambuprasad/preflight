// no-pii-in-logs (11 §3.17): the pino redaction paths scrub phone/email/raw rows wherever they appear.
import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { pino } from 'pino';
import { REDACT_PATHS, scrubText } from '../../src/observability/redact.js';

function capture(): { logger: ReturnType<typeof pino>; lines: string[] } {
  const lines: string[] = [];
  const stream = new Writable({ write(chunk, _enc, cb) { lines.push(chunk.toString()); cb(); } });
  return { logger: pino({ redact: { paths: REDACT_PATHS, censor: '[redacted]' } }, stream), lines };
}

describe('PII redaction', () => {
  it('redacts phone, email and raw rows at any depth', () => {
    const { logger, lines } = capture();
    logger.info({ contact: { phone: '+919812340001', email: 'a@b.in', phoneE164: '+919812340001' }, row: { raw: { phone: '9812340001' } }, req: { headers: { authorization: 'Bearer pf_x', cookie: 'pf_session=abc' } }, password: 'hunter2' }, 'hello');
    const out = lines.join('');
    expect(out).not.toContain('9812340001');
    expect(out).not.toContain('a@b.in');
    expect(out).not.toContain('pf_x');
    expect(out).not.toContain('pf_session=abc');
    expect(out).not.toContain('hunter2');
    expect(out).toContain('[redacted]');
  });
  it('scrubText catches free-text leaks', () => {
    expect(scrubText('call +91 98123 40001 or mail ravi@example.com')).toBe('call [redacted-phone] or mail [redacted-email]');
  });
});
