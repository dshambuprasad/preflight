import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const nodeBuiltins = [
  'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns', 'events', 'fs', 'http', 'http2',
  'https', 'net', 'os', 'path', 'perf_hooks', 'process', 'querystring', 'readline', 'stream', 'timers', 'tls',
  'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib',
];
const nodeImportPatterns = ['node:*', ...nodeBuiltins];

// packages/core and rules-* MUST NOT import Node, DB, HTTP, or any other workspace package.
// (02 §10, 11 §3.6, 16 §1). This is the ESLint half of the `core-is-pure` invariant.
const purePackageRules = {
  'no-restricted-imports': ['error', {
    patterns: [
      { group: nodeImportPatterns, message: 'packages/core and rules-* are pure: no Node built-ins (02 §10).' },
      { group: ['@preflight/db', '@preflight/rulegraph', '@preflight/api-types', 'drizzle-orm', 'pg', 'fastify', 'pg-boss', 'undici', 'axios', 'node-fetch'],
        message: 'core/rules must not import db, http or workspace packages other than core (16 §1).' },
    ],
  }],
  'no-restricted-globals': ['error',
    { name: 'process', message: 'core is browser-safe; no process.' },
    { name: 'fetch', message: 'no I/O in core.' },
    { name: 'setTimeout', message: 'no timers in core.' },
  ],
  'no-restricted-syntax': ['error',
    { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: 'core never reads the clock (asOf is injected).' },
    { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'core never reads the clock (asOf is injected).' },
    { selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']", message: 'core is deterministic.' },
  ],
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'builds/**', 'docs/**', 'spec/**', '**/*.gen.ts', 'apps/web/src/routeTree.gen.ts', '**/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser, ...globals.es2022 } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['packages/core/src/**/*.ts', 'packages/rules-*/src/**/*.ts'],
    rules: purePackageRules,
  },
  {
    // core tests may use node:test / node:assert but still never the clock.
    files: ['packages/core/test/**/*.ts', 'packages/rules-*/test/**/*.ts'],
    rules: { 'no-restricted-syntax': purePackageRules['no-restricted-syntax'] },
  },
  {
    files: ['packages/db/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['@preflight/rules-*', '@preflight/rulegraph', '@preflight/api-types', 'fastify'], message: 'db knows only the schema (16 §1).' },
      ] }],
    },
  },
  {
    files: ['packages/rulegraph/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['@preflight/db', '@preflight/api-types', 'fastify', 'pg', 'drizzle-orm'], message: 'rulegraph knows rule shapes only (16 §1).' },
        { group: ['@preflight/core', '@preflight/rules-*'], allowTypeImports: true, message: 'rulegraph may import core/rules types only (16 §1).' },
      ] }],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['@preflight/db', '@preflight/rulegraph', '@preflight/rules-*', '@preflight/api', ...nodeImportPatterns], message: 'web imports only core (browser) and api-types (16 §1).' },
      ] }],
    },
  },
);
