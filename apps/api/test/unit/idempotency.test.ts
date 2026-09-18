import { describe, expect, it } from 'vitest';
import { requestHash } from '../../src/idempotency.js';

describe('D36 request hash', () => {
  it('is canonical (key order does not matter) and method/url-scoped', () => {
    expect(requestHash('POST', '/v1/campaigns', { a: 1, b: 2 })).toBe(requestHash('POST', '/v1/campaigns', { b: 2, a: 1 }));
    expect(requestHash('POST', '/v1/campaigns', { a: 1 })).not.toBe(requestHash('POST', '/v1/campaigns', { a: 2 }));
    expect(requestHash('POST', '/v1/campaigns', { a: 1 })).not.toBe(requestHash('POST', '/v1/other', { a: 1 }));
  });
});
