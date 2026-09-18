// 16 §2.5 SecretBox — AES-256-GCM under PREFLIGHT_KMS_KEY (08 §1). Used for connector creds, webhook
// secrets and the per-tenant identity HMAC key (D31 / 12 §H D50).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface SecretBox {
  seal(plain: string): { enc: Buffer; iv: Buffer };
  open(enc: Buffer, iv: Buffer): string;
}

export function createSecretBox(keyBase64: string): SecretBox {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) throw new Error('PREFLIGHT_KMS_KEY must be 32 bytes base64');
  return {
    seal(plain) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final(), cipher.getAuthTag()]);
      return { enc, iv };
    },
    open(enc, iv) {
      const tag = enc.subarray(enc.length - 16);
      const data = enc.subarray(0, enc.length - 16);
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    },
  };
}

export const newIdentityHmacKey = (): string => randomBytes(32).toString('base64');
