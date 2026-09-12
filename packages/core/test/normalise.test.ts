import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalisePhone, normaliseEmail, normaliseConsent, strictestConsent, normaliseLanguage, identityKey } from '../src/index.js';

test('India phone table (17): mobiles in every common export format → E.164', () => {
  const want = '+919812340001';
  for (const raw of ['9812340001', '09812340001', '+919812340001', '919812340001', '+91 98123 40001', '0091 98123 40001', '(0) 98123-40001', ' 98123 40001 ']) {
    assert.equal(normalisePhone(raw), want, raw);
  }
});

test('India phone table: invalid, short codes and emergency numbers → null (raw kept by caller)', () => {
  for (const raw of ['', '   ', '12345', '100', '1909', '98123', '98123400010', 'abc', null, undefined, {}]) {
    assert.equal(normalisePhone(raw), null, String(raw));
  }
});

test('India phone table: landlines are valid numbers', () => {
  assert.equal(normalisePhone('011 2345 6789'), '+911123456789');
});

test('email: trim + lowercase; stable key, not a validity oracle', () => {
  assert.equal(normaliseEmail('  Ravi.K@Example.COM '), 'ravi.k@example.com');
  assert.equal(normaliseEmail('a@b'), 'a@b');
  for (const bad of ['', 'no-at', '@x.com', 'x@', 'a b@c.com', 'a@@b.com', 42, null]) assert.equal(normaliseEmail(bad), null, String(bad));
});

test('consent: blank → null (absent) ≠ unknown (present, unclear); deny wins', () => {
  assert.equal(normaliseConsent(''), null);
  assert.equal(normaliseConsent(null), null);
  assert.equal(normaliseConsent(undefined), null);
  for (const g of ['y', 'Yes', 'TRUE', '1', 'granted', 'opted in', 'opt-in', 'optin']) assert.equal(normaliseConsent(g), 'granted', g);
  for (const d of ['n', 'No', 'false', '0', 'denied', 'opted out', 'opt-out']) assert.equal(normaliseConsent(d), 'denied', d);
  assert.equal(normaliseConsent('maybe'), 'unknown');
  assert.equal(normaliseConsent('Haan', { granted: ['haan'], denied: ['nahi'] }), 'granted');
  assert.equal(normaliseConsent(true), 'granted');
  assert.equal(strictestConsent('granted', 'denied'), 'denied');
  assert.equal(strictestConsent('granted', 'unknown'), 'unknown');
  assert.equal(strictestConsent('granted', null), 'granted');
  assert.equal(strictestConsent(null, null), null);
});

test('language: lowercase + alias table; blank → null', () => {
  assert.equal(normaliseLanguage(' HI '), 'hindi');
  assert.equal(normaliseLanguage('Tamil'), 'tamil');
  assert.equal(normaliseLanguage('oriya'), 'odia');
  assert.equal(normaliseLanguage(''), null);
  assert.equal(normaliseLanguage('klingon'), 'klingon');
  assert.equal(normaliseLanguage('hin', { hin: 'HINDUSTANI' }), 'hindustani');
});

test('identity key (D26/D48): externalId → phone → email → row; precedence configurable', () => {
  assert.equal(identityKey({ externalId: 'B-1', phoneE164: '+919812340001', emailNorm: 'a@b' }, 'r1'), 'ext:B-1');
  assert.equal(identityKey({ phoneE164: '+919812340001', emailNorm: 'a@b' }, 'r1'), 'phone:+919812340001');
  assert.equal(identityKey({ emailNorm: 'a@b' }, 'r1'), 'email:a@b');
  assert.equal(identityKey({}, 'r1'), 'row:r1');
  assert.equal(identityKey({ externalId: ' ', phoneE164: null }, 'r1'), 'row:r1');
  assert.equal(identityKey({ externalId: 'B-1', phoneE164: '+919812340001' }, 'r1', ['phone', 'externalId']), 'phone:+919812340001');
});
