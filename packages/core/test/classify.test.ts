import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, detectScript, matchesPreference } from '../src/index.js';

test('a mixed service/promotional message is evaluated under the stricter reading', () => {
  const c = classify('Your EMI is due on 5th. You are also pre-approved for a top-up loan!');
  assert.equal(c.classification, 'mixed');
  assert.equal(c.evaluateAs, 'promotional');
  assert.equal(c.confidence, 'low');
  assert.ok(c.promotionalMarkers.length && c.serviceMarkers.length);
});

test('service / promotional / unknown', () => {
  assert.equal(classify('Your EMI of Rs 5,000 is overdue.').classification, 'service');
  assert.equal(classify('Exclusive offer! Apply now.').classification, 'promotional');
  const u = classify('Hello there.');
  assert.equal(u.classification, 'unknown');
  assert.equal(u.evaluateAs, 'promotional');
});

test('22 B8 — tenant-extensible markers (Hinglish)', () => {
  const c = classify('Aapka EMI due hai, saath hi ek dhamaka deal bhi hai', { promotional: ['dhamaka deal'] });
  assert.equal(c.classification, 'mixed');
  assert.ok(c.promotionalMarkers.includes('dhamaka deal'));
});

test('script detection reports script, not language', () => {
  assert.deepEqual(detectScript('आपका EMI'), { script: 'devanagari', languages: ['hindi', 'marathi', 'nepali', 'konkani', 'sanskrit'] });
  assert.equal(detectScript('வணக்கம்').script, 'tamil');
  assert.equal(detectScript('Hello').script, 'latin');
  assert.equal(matchesPreference('आपका EMI', 'marathi').ok, true, 'Devanagari cannot rule out Marathi');
  assert.equal(matchesPreference('Hello', 'hindi').ok, false);
  assert.equal(matchesPreference('Hello', 'hindi', ['hindi']).ok, true, 'romanised acceptable (Layer C)');
  assert.equal(matchesPreference('Hello', 'english').ok, true);
  assert.equal(matchesPreference('Hello', '').ok, true);
});
