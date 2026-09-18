import { describe, expect, it } from 'vitest';
import { AppError, ERROR_TYPES } from '../../src/errors.js';

describe('06 §1 problem details', () => {
  it('every error type has a status and renders RFC 9457', () => {
    for (const [type, status] of Object.entries(ERROR_TYPES)) {
      const p = new AppError(type as keyof typeof ERROR_TYPES, 'detail').toProblem('/v1/x', 'req-1');
      expect(p.status).toBe(status);
      expect(p.type).toBe(`https://preflight.dev/errors/${type}`);
      expect(p.instance).toBe('/v1/x');
      expect(p.requestId).toBe('req-1');
      expect(p.title.length).toBeGreaterThan(0);
    }
  });
  it('carries issues and data', () => {
    const p = new AppError('blockers-outstanding', undefined, { data: { ruleIds: ['A-RBI-001'] } }).toProblem('/v1/y', 'r');
    expect(p.data).toEqual({ ruleIds: ['A-RBI-001'] });
    expect(new AppError('validation', 'bad', { issues: [{ path: 'a', message: 'b' }] }).toProblem('/', 'r').issues).toHaveLength(1);
  });
});
