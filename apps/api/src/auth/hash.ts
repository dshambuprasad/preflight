// 09 §2 / 17 — argon2id for passwords and API-key secrets.
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

export const hashSecret = (plain: string): Promise<string> => argon2.hash(plain, { type: argon2.argon2id });
export const verifySecret = (hash: string, plain: string): Promise<boolean> => argon2.verify(hash, plain).catch(() => false);

/** API key plaintext `pf_<prefix12>_<secret>`; the prefix indexes the lookup, the secret is argon2id-hashed. */
export function generateApiKey(): { plaintext: string; keyPrefix: string; secret: string } {
  const keyPrefix = randomBytes(9).toString('base64url').slice(0, 12);
  const secret = randomBytes(32).toString('base64url');
  return { plaintext: `pf_${keyPrefix}_${secret}`, keyPrefix, secret };
}

export function splitApiKey(plaintext: string): { keyPrefix: string; secret: string } | null {
  const m = /^pf_([A-Za-z0-9_-]{12})_([A-Za-z0-9_-]{20,})$/.exec(plaintext.trim());
  return m ? { keyPrefix: m[1]!, secret: m[2]! } : null;
}
