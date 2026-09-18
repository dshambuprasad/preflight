import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv } from '../../src/env.js';

const base = { NODE_ENV: 'test', DATABASE_URL: 'postgres://x', PREFLIGHT_KMS_KEY: Buffer.alloc(32).toString('base64'), PREFLIGHT_SESSION_SECRET: 'x'.repeat(32), PREFLIGHT_PUBLIC_URL: 'http://localhost:3000' };

describe('15 §4 env validation', () => {
  it('applies defaults', () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.PREFLIGHT_ROLE).toBe('all');
    expect(env.PREFLIGHT_INLINE_ROWS_MAX).toBe(5000);
    expect(env.PREFLIGHT_DEMO_MOCK_CONNECTORS).toBe(false);
  });
  it('refuses to start listing every problem', () => {
    expect(() => loadEnv({ NODE_ENV: 'production', PREFLIGHT_DEMO_MOCK_CONNECTORS: 'true', PREFLIGHT_STORAGE: 's3' })).toThrow(EnvError);
    try {
      loadEnv({ NODE_ENV: 'production', PREFLIGHT_DEMO_MOCK_CONNECTORS: 'true', PREFLIGHT_STORAGE: 's3', DATABASE_URL: 'x', PREFLIGHT_KMS_KEY: 'short', PREFLIGHT_SESSION_SECRET: 'x', PREFLIGHT_PUBLIC_URL: 'nope' });
    } catch (e) {
      const problems = (e as EnvError).problems.join('\n');
      expect(problems).toMatch(/PREFLIGHT_DEMO_MOCK_CONNECTORS: refused when NODE_ENV=production/);
      expect(problems).toMatch(/S3_BUCKET/);
      expect(problems).toMatch(/PREFLIGHT_KMS_KEY/);
      expect(problems).toMatch(/PREFLIGHT_SESSION_SECRET/);
    }
  });
});
