import { describe, expect, it } from 'vitest';
import { decodeSession, encodeSession } from '../../src/auth/session.js';
import { generateApiKey, splitApiKey } from '../../src/auth/hash.js';

describe('session cookie', () => {
  const secret = 's'.repeat(32);
  it('round-trips and rejects tampering and expiry', () => {
    const c = encodeSession(secret, { uid: 'u', tid: 't', exp: 2000 });
    expect(decodeSession(secret, c, 1000)).toEqual({ uid: 'u', tid: 't', exp: 2000 });
    expect(decodeSession(secret, c, 2000)).toBeNull();
    expect(decodeSession('x'.repeat(32), c, 1000)).toBeNull();
    expect(decodeSession(secret, c.slice(0, -2) + 'zz', 1000)).toBeNull();
    expect(decodeSession(secret, undefined, 1000)).toBeNull();
    expect(decodeSession(secret, 'garbage', 1000)).toBeNull();
  });
  it('api keys split into prefix + secret', () => {
    const k = generateApiKey();
    expect(splitApiKey(k.plaintext)).toEqual({ keyPrefix: k.keyPrefix, secret: k.secret });
    expect(splitApiKey('nope')).toBeNull();
  });
});
