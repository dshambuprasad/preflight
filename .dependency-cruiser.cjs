/** 16 §1 allowed-imports matrix, enforced (`pnpm dep-check`). */
const nodeBuiltins = '^(node:)?(assert|buffer|child_process|cluster|crypto|dgram|dns|events|fs|http|http2|https|net|os|path|perf_hooks|process|querystring|readline|stream|timers|tls|url|util|v8|vm|worker_threads|zlib)(/|$)';
module.exports = {
  forbidden: [
    { name: 'core-imports-nothing', severity: 'error', from: { path: '^packages/core/src' },
      to: { path: '^(packages/(rules-|rulegraph|db|api-types)|apps/)' } },
    { name: 'core-no-node', severity: 'error', from: { path: '^packages/core/src' }, to: { path: nodeBuiltins } },
    { name: 'rules-only-core', severity: 'error', from: { path: '^packages/rules-' },
      to: { path: '^(packages/(rulegraph|db|api-types)|apps/)' } },
    { name: 'rules-no-node', severity: 'error', from: { path: '^packages/rules-[^/]+/src' }, to: { path: nodeBuiltins } },
    { name: 'rulegraph-no-db-api', severity: 'error', from: { path: '^packages/rulegraph/src' },
      to: { path: '^(packages/(db|api-types)|apps/)' } },
    { name: 'db-only-core-types', severity: 'error', from: { path: '^packages/db/src' },
      to: { path: '^(packages/(rules-|rulegraph|api-types)|apps/)' } },
    { name: 'api-types-imports-nothing', severity: 'error', from: { path: '^packages/api-types/src' },
      to: { path: '^(packages/(rules-|rulegraph|db)|apps/)' } },
    { name: 'web-only-core-and-api-types', severity: 'error', from: { path: '^apps/web/src' },
      to: { path: '^(packages/(rules-|rulegraph|db)|apps/(api|worker))' } },
    { name: 'api-not-web', severity: 'error', from: { path: '^apps/api/src' }, to: { path: '^apps/web' } },
    { name: 'stages-do-not-import-each-other', severity: 'error',
      from: { path: '^apps/api/src/pipeline/stages/' }, to: { path: '^apps/api/src/pipeline/stages/' } },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'default', 'types'] },
    exclude: { path: '(^|/)(dist|node_modules|builds)/' },
  },
};
