import { describe, expect, it } from 'vitest';
import { normaliseRow, suggestMapping } from '../../src/pipeline/mapping.js';

describe('08 §2 basic header mapping', () => {
  it('maps the sample headers and common aliases', () => {
    expect(suggestMapping(['id', 'phone', 'preferredLanguage', 'consentPromotional'])).toEqual({ id: 'externalId', phone: 'phone', preferredLanguage: 'preferredLanguage', consentPromotional: 'consentPromotional' });
    expect(suggestMapping(['Customer ID', 'Mobile', 'Email ID', 'Pref Lang', 'Opt In', 'State', 'Score'])).toEqual({ 'Customer ID': 'externalId', Mobile: 'phone', 'Email ID': 'email', 'Pref Lang': 'preferredLanguage', 'Opt In': 'consentPromotional', State: 'attribute:state' });
  });
  it('at most one column per target (15 §6)', () => {
    expect(suggestMapping(['phone', 'mobile'])).toEqual({ phone: 'phone' });
  });
  it('normalises a row; blank consent is absent, not unknown', () => {
    const m = suggestMapping(['id', 'phone', 'preferredLanguage', 'consentPromotional', 'state']);
    expect(normaliseRow({ id: 'B-1', phone: '98123 40001', preferredLanguage: 'HI', consentPromotional: '', state: 'KA' }, m)).toEqual({
      externalId: 'B-1', phoneE164: '+919812340001', emailNorm: null, preferredLanguage: 'hindi', consentPromotional: null, attributes: { state: 'KA' },
    });
    expect(normaliseRow({ consentPromotional: 'maybe' }, m).consentPromotional).toBe('unknown');
  });
});
