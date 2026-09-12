import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { pureSha256Hex, pureHmacSha256Hex, sha256Hex, hmacSha256Hex, setCrypto } from '../src/index.js';

const enc = (s: string) => new TextEncoder().encode(s);

test('vendored SHA-256 matches FIPS 180-4 vectors and node:crypto', () => {
  assert.equal(pureSha256Hex(enc('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(pureSha256Hex(enc('')), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(
    pureSha256Hex(enc('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  );
  for (const s of ['x'.repeat(55), 'x'.repeat(56), 'x'.repeat(63), 'x'.repeat(64), 'x'.repeat(65), 'नमस्ते 😀', 'y'.repeat(1000)]) {
    assert.equal(pureSha256Hex(enc(s)), createHash('sha256').update(s, 'utf8').digest('hex'));
  }
});

test('vendored HMAC-SHA256 matches RFC 4231 and node:crypto', () => {
  // RFC 4231 test case 2
  assert.equal(
    pureHmacSha256Hex(enc('Jefe'), enc('what do ya want for nothing?')),
    '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
  );
  const key = 'k'.repeat(100); // > block size → hashed key path
  assert.equal(pureHmacSha256Hex(enc(key), enc('msg')), createHmac('sha256', key).update('msg').digest('hex'));
});

test('setCrypto injects the implementation; default is the vendored one', () => {
  setCrypto(null);
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  setCrypto({ sha256Hex: () => 'injected', hmacSha256Hex: () => 'injected-hmac' });
  assert.equal(sha256Hex('abc'), 'injected');
  assert.equal(hmacSha256Hex('k', 'abc'), 'injected-hmac');
  setCrypto(null);
});
