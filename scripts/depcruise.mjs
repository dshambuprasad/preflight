// `pnpm dep-check` — runs dependency-cruiser (16 §1 matrix). dependency-cruiser refuses odd-numbered Node
// releases, so on Node 23/25 it re-executes itself under a pinned Node 22 binary from npm.
import { execFileSync } from 'node:child_process';
const major = Number(process.versions.node.split('.')[0]);
const args = ['packages', 'apps', '--config', '.dependency-cruiser.cjs'];
const bin = 'node_modules/dependency-cruiser/bin/dependency-cruise.mjs';
try {
  if (major % 2 === 0) execFileSync('node', [bin, ...args], { stdio: 'inherit' });
  else execFileSync('npx', ['-y', '-p', 'node@22.23.2', '--', 'node', bin, ...args], { stdio: 'inherit' });
} catch {
  process.exit(1);
}
