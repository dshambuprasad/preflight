// core-is-pure / no-clock-in-core (11 §3.5, §3.6): grep + a browser bundle with no Node built-ins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const pkgRoot = fileURLToPath(new URL('../../', import.meta.url));
const srcDir = join(pkgRoot, 'src');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

test('no-clock-in-core — no Date.now() / new Date() without args / Math.random in core/src', () => {
  for (const file of walk(srcDir)) {
    const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(text, /Date\.now\s*\(/, file);
    assert.doesNotMatch(text, /new Date\(\s*\)/, file);
    assert.doesNotMatch(text, /Math\.random/, file);
  }
});

test('core-is-pure — no Node built-in or I/O imports in core/src', () => {
  const banned = /^\s*import\s[^'"]*['"](node:|fs|path|crypto|http|https|net|os|child_process|stream|url|util|worker_threads)/m;
  for (const file of walk(srcDir)) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), banned, file);
  }
});

test('core-is-pure — bundles for the browser with no Node built-ins', async () => {
  const result = await esbuild.build({
    entryPoints: [join(pkgRoot, 'dist/src/index.js')],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  const inputs = Object.keys(result.metafile.inputs);
  const nodeish = inputs.filter((i) => /^(node:|fs$|path$|crypto$)/.test(i) || i.includes('node_modules/node-'));
  assert.deepEqual(nodeish, []);
  const out = result.outputFiles[0]!.text;
  assert.doesNotMatch(out, /require\(["']node:/);
  assert.doesNotMatch(out, /process\.env/);
  assert.ok(out.length > 1000);
});
