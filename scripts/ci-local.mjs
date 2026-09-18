// `pnpm ci:local` — the CI job (.github/workflows/ci.yml) on this machine, same order, same gates.
// Needs Docker (Postgres via infra/compose.yaml). Stops at the first failure and reports it.
import { execSync } from 'node:child_process';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://preflight:preflight@localhost:5432/preflight';
const steps = [
  ['postgres up', 'docker compose -f infra/compose.yaml up -d db --wait'],
  ['build', 'pnpm build'],
  ['lint', 'pnpm lint'],
  ['licences', 'pnpm check:licences'],
  ['unit', 'pnpm test'],
  ['integration', 'pnpm test:integration'],
  ['bench', 'pnpm bench'],
];
if (process.argv.includes('--with-images')) steps.push(['docker images', 'docker compose -f infra/compose.yaml build']);

for (const [name, cmd] of steps) {
  const t0 = Date.now();
  process.stdout.write(`\n=== ${name}: ${cmd}\n`);
  try {
    execSync(cmd, { stdio: 'inherit', env: { ...process.env, DATABASE_URL, CI: 'true' } });
  } catch {
    console.error(`\n✖ ${name} failed`);
    process.exit(1);
  }
  console.log(`✔ ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
console.log('\nall CI steps passed');
