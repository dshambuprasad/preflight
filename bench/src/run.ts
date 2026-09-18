// `pnpm bench` — 18 §7 benches that exist at M0: check-t0-1e4 (< 300 ms), check-t0-1e5 (< 2 s).
// Fails on 2× regression vs baseline.json; 1.2× prints a warning (18 §8). `--update` rewrites the baseline.
import { Bench } from 'tinybench';
import { readFileSync, writeFileSync } from 'node:fs';
import { evaluate } from '@preflight/core';
import { hygienePack, pack } from '@preflight/rules-india';
import { genContacts } from './gen-audience.js';

const BUDGET_MS: Record<string, number> = { 'check-t0-1e4': 300, 'check-t0-1e5': 2000 };
const baselinePath = new URL('../baseline.json', import.meta.url);
const update = process.argv.includes('--update');

const campaign = {
  message: 'Dear customer, your EMI of Rs 8,450 is overdue since 28 Aug. Please pay immediately. Pay now: pay.example-nbfc.in/x7f2',
  channel: 'whatsapp' as const,
  scheduledAt: '2026-09-14T20:15:00+05:30',
  purpose: 'collections' as const,
  borrowerSegment: 'retail',
  template: { body: 'Dear customer, your EMI of Rs {{1}} is overdue since {{2}}. Pay now: {{3}}', variables: ['8,450', '28 Aug'] },
};
const config = { lenderName: 'Example Finance', frequencyCapPerWeek: null };
const c1e4 = genContacts(10_000, 1);
const c1e5 = genContacts(100_000, 2);
const packs = [pack, hygienePack];
const run = (contacts: typeof c1e4) => evaluate({ campaign, contacts, config, asOf: '2026-09-12T10:00:00+05:30', packs });

const bench = new Bench({ time: 0, iterations: 5, warmupIterations: 2 });
bench.add('check-t0-1e4', () => { run(c1e4); });
bench.add('check-t0-1e5', () => { run(c1e5); });
await bench.run();

const baseline: Record<string, number> = (() => {
  try { return JSON.parse(readFileSync(baselinePath, 'utf8')).meanMs ?? {}; } catch { return {}; }
})();
const meanMs: Record<string, number> = {};
let failed = false;
for (const task of bench.tasks) {
  const mean = task.result!.mean;
  meanMs[task.name] = Number(mean.toFixed(2));
  const budget = BUDGET_MS[task.name]!;
  const base = baseline[task.name];
  const ratio = base ? mean / base : 1;
  const status = mean > budget ? 'OVER BUDGET' : ratio > 2 ? 'REGRESSION ×' + ratio.toFixed(2) : ratio > 1.2 ? 'warn ×' + ratio.toFixed(2) : 'ok';
  console.log(`${task.name.padEnd(16)} mean ${mean.toFixed(1).padStart(8)} ms  budget ${budget} ms  baseline ${base ?? '—'}  ${status}`);
  if (mean > budget || ratio > 2) failed = true;
}
if (update || Object.keys(baseline).length === 0) {
  writeFileSync(baselinePath, JSON.stringify({ _comment: 'pnpm bench compares against these means (ms); pnpm bench:update rewrites. 18 §7.', meanMs }, null, 2) + '\n');
  console.log('baseline written');
}
process.exit(failed ? 1 : 0);
