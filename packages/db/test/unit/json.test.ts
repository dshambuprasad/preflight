import { describe, expect, it } from 'vitest';
import { TenantConfigSchema, ColumnMappingSchema, CertificatePayloadSchema, CERTIFICATE_DISCLAIMER } from '../../src/json/index.js';

describe('TenantConfigSchema (15 §3 + 22 §E)', () => {
  it('applies every default from a minimal config', () => {
    const c = TenantConfigSchema.parse({ lenderName: 'Example Finance' });
    expect(c.timezone).toBe('Asia/Kolkata');
    expect(c.identityPrecedence).toEqual(['externalId', 'phone', 'email']);
    expect(c.sendWindowMaxHours).toBe(6);
    expect(c.rulePacks).toEqual(['india-layer-a', 'preflight-hygiene']);
    expect(c.blastRadiusThreshold).toBe(10_000);
    expect(c.exceptionMaxDays).toBe(90);
    expect(c.scheduleMinLeadMinutes).toBe(5);
    expect(c.entityType).toBe('bank');
    expect(c.advisory).toEqual({ llmClassification: false, audienceQuality: false });
    expect(c.retention.contactEventsMonths).toBe(24);
    expect(c.frequencyCapPerWeek).toBeNull();
  });
  it('rejects out-of-range values', () => {
    expect(() => TenantConfigSchema.parse({ lenderName: 'X' })).toThrow();
    expect(() => TenantConfigSchema.parse({ lenderName: 'Example', blastRadiusThreshold: 50 })).toThrow();
    expect(() => TenantConfigSchema.parse({ lenderName: 'Example', exceptionMaxDays: 120 })).toThrow();
    expect(() => TenantConfigSchema.parse({ lenderName: 'Example', webhookUrl: 'http://insecure' })).toThrow();
    expect(() => TenantConfigSchema.parse({ lenderName: 'Example', reasonCodes: ['Not Kebab'] })).toThrow();
    expect(() => TenantConfigSchema.parse({ lenderName: 'Example', quietHours: { start: '25:00', end: '08:00' } })).toThrow();
  });
});

describe('ColumnMappingSchema (15 §6)', () => {
  it('accepts a valid mapping and rejects a doubly-mapped target', () => {
    expect(ColumnMappingSchema.parse({ version: 1, columns: { id: 'externalId', phone: 'phone', state: 'attribute:state', x: 'ignore', promo_pl: 'consentPromotional:PL' } }).columns.phone).toBe('phone');
    expect(() => ColumnMappingSchema.parse({ version: 1, columns: { a: 'phone', b: 'phone' } })).toThrow(/already mapped/);
    expect(() => ColumnMappingSchema.parse({ version: 1, columns: { a: 'shoeSize' } })).toThrow();
  });
});

describe('CertificatePayloadSchema (03 §8)', () => {
  it('requires verdict null and the verbatim disclaimer', () => {
    const user = { id: 'u', displayName: 'R. Mehta', roles: ['reviewer'] };
    const base = {
      schema: 'preflight.evidence/1', tenant: { id: 't', slug: 's', name: 'n' }, campaign: { id: 'c', name: 'n', mode: 'live' },
      version: { id: 'v', no: 1, contentHash: 'h', audienceHash: 'h', scheduledAt: 'x', channel: 'whatsapp', purpose: null, segment: null, message: 'm', configSnapshot: {} },
      audience: { size: 1, identityKeysHash: 'h' },
      evaluation: { id: 'e', asOf: 'x', rulebookHash: 'h', rulePackIds: [], engineVersion: '0', classification: {}, coverage: {}, summary: { blockers: 0, warnings: 0, info: 0, cannotEvaluate: 0, audienceSize: 1, verdict: null } },
      findings: [], decisions: [], review: { reviewer: user, sections: {}, outcome: 'approved', notes: null, at: 'x' },
      sealedAt: 'x', sealedBy: user, disclaimer: CERTIFICATE_DISCLAIMER,
    };
    expect(CertificatePayloadSchema.parse(base).disclaimer).toBe(CERTIFICATE_DISCLAIMER);
    expect(() => CertificatePayloadSchema.parse({ ...base, evaluation: { ...base.evaluation, summary: { ...base.evaluation.summary, verdict: 'compliant' } } })).toThrow();
    expect(() => CertificatePayloadSchema.parse({ ...base, disclaimer: 'other' })).toThrow();
  });
});
