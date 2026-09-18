#!/usr/bin/env node
// 03 §11 — no destructive migrations on evidence_records or audit_events, ever. Additive only.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'packages/db/migrations');
const PROTECTED = ['evidence_records', 'audit_events'];
const problems = [];

for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(join(dir, file), 'utf8');
  // strip comments so prose mentioning DROP does not trip the check
  const code = sql.replace(/--.*$/gm, '');
  for (const table of PROTECTED) {
    const t = `"?${table}"?`;
    const patterns = [
      new RegExp(`DROP\\s+TABLE\\s+(IF\\s+EXISTS\\s+)?("public"\\.)?${t}`, 'i'),
      new RegExp(`ALTER\\s+TABLE\\s+("public"\\.)?${t}[^;]*\\bDROP\\b`, 'i'),
      new RegExp(`TRUNCATE\\s+(TABLE\\s+)?("public"\\.)?${t}`, 'i'),
      new RegExp(`DELETE\\s+FROM\\s+("public"\\.)?${t}`, 'i'),
    ];
    for (const re of patterns) {
      if (re.test(code)) problems.push(`${file}: destructive statement on ${table} (${re.source})`);
    }
  }
}

if (problems.length) {
  console.error('check-migrations FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('check-migrations ok');
