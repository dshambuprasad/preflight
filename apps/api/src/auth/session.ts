// Stateless signed session cookie (F18): HMAC-SHA256 over base64url(json) with PREFLIGHT_SESSION_SECRET.
// HttpOnly; Secure in production; SameSite=Lax (09 §2). Idle TTL enforced by `exp` and refreshed on use.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'pf_session';

export interface SessionPayload {
  uid: string;
  tid: string;
  /** epoch seconds */
  exp: number;
}

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function encodeSession(secret: string, p: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString('base64url');
  return `${body}.${sign(secret, body)}`;
}

export function decodeSession(secret: string, cookie: string | undefined, nowSec: number): SessionPayload | null {
  if (!cookie) return null;
  const dot = cookie.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = cookie.slice(0, dot);
  const mac = cookie.slice(dot + 1);
  const expected = sign(secret, body);
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof p.uid !== 'string' || typeof p.tid !== 'string' || typeof p.exp !== 'number') return null;
    if (p.exp <= nowSec) return null;
    return p;
  } catch {
    return null;
  }
}
