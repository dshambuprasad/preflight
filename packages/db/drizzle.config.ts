import { defineConfig } from 'drizzle-kit';

// Points at the compiled schema so NodeNext `.js` imports resolve; run `pnpm build` before `pnpm generate`.
export default defineConfig({
  dialect: 'postgresql',
  schema: './dist/src/schema/index.js',
  out: './migrations',
  strict: true,
  verbose: true,
});
