#!/usr/bin/env node
// 02 §6 / 09 §2 — every exported query helper in packages/db takes tenantId as its FIRST argument after tx.
// Static check over packages/db/src/repo/*.ts: each `async name(tx: Tx, <second>...)` method of an exported
// repo object must name its second parameter `tenantId`, except the allowlist below.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'packages/db/src/repo');
const ALLOW = new Set([
  'tenantsRepo.*',
  'rulebookVersionsRepo.*',
  'apiKeysRepo.findByPrefix',
  'usersRepo.findByEmailAnyTenant',
]);
const problems = [];
let checked = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'util.ts')) {
  const text = readFileSync(join(dir, file), 'utf8');
  const objRe = /export const (\w+Repo)\s*=\s*\{/g;
  let m;
  while ((m = objRe.exec(text))) {
    const name = m[1];
    // find the matching closing brace of the object literal
    let depth = 0, i = m.index + m[0].length - 1, end = -1;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    const body = text.slice(m.index, end);
    const methodRe = /^\s{2}(?:async\s+)?\*?\s*(\w+)\s*\(\s*tx:\s*Tx\s*,\s*(\w+)\s*[:,)]/gm;
    let mm;
    while ((mm = methodRe.exec(body))) {
      const [, method, second] = mm;
      checked++;
      if (ALLOW.has(`${name}.*`) || ALLOW.has(`${name}.${method}`)) continue;
      if (second !== 'tenantId') problems.push(`${file}: ${name}.${method}() second parameter is '${second}', not 'tenantId'`);
    }
    // a method whose first param is not tx is also a violation
    const badFirst = /^\s{2}(?:async\s+)?\*?\s*(\w+)\s*\(\s*(?!tx:)(\w+)\s*:/gm;
    let mb;
    while ((mb = badFirst.exec(body))) problems.push(`${file}: ${name}.${mb[1]}() first parameter must be tx: Tx`);
  }
}

if (checked === 0) {
  console.error('check-tenancy FAILED: no repo methods found');
  process.exit(1);
}
if (problems.length) {
  console.error('check-tenancy FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`check-tenancy ok (${checked} repo methods)`);
