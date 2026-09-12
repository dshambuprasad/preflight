// jcs-conformant (11 §3.19) — RFC 8785 vectors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalJSON } from '../src/index.js';

const { vectors } = JSON.parse(readFileSync(new URL('../../test/fixtures/jcs-vectors.json', import.meta.url), 'utf8')) as {
  vectors: { name: string; input: string; expected: string }[];
};

for (const v of vectors) {
  test(`jcs-conformant — ${v.name}`, () => {
    assert.equal(canonicalJSON(JSON.parse(v.input)), v.expected);
  });
}

test('jcs — output is valid JSON that round-trips', () => {
  for (const v of vectors) {
    const parsed = JSON.parse(v.input);
    assert.deepEqual(JSON.parse(canonicalJSON(parsed)), JSON.parse(JSON.stringify(parsed))); // -0 → 0 is by design
  }
});

test('jcs — rejects values that must never reach the evidence chain', () => {
  assert.throws(() => canonicalJSON({ a: undefined }), /undefined/);
  assert.throws(() => canonicalJSON({ a: NaN }), /non-finite/);
  assert.throws(() => canonicalJSON({ a: Infinity }), /non-finite/);
  assert.throws(() => canonicalJSON({ a: () => 1 }), /function/);
  assert.throws(() => canonicalJSON({ a: 10n }), /bigint/);
  assert.throws(() => canonicalJSON({ a: new Date(0) }), /non-plain/);
  assert.throws(() => canonicalJSON([1, undefined]), /undefined/);
});

test('jcs — key order is UTF-16 code unit order, not locale order', () => {
  assert.equal(canonicalJSON({ b: 1, a: 2, B: 3, A: 4, '10': 5, '2': 6 }), '{"10":5,"2":6,"A":4,"B":3,"a":2,"b":1}');
});
