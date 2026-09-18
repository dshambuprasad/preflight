// `pnpm gen:openapi` — writes packages/api-types/src/openapi.json from the Zod route schemas (06, 16 §2.6).
// Builds the app with inert deps: no DB connection is made while generating.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pino } from 'pino';
import { repo } from '@preflight/db';
import { buildApp } from './app.js';
import type { AppDeps } from './deps.js';
import { EnvSchema } from './env.js';
import { InProcessJobQueue } from './pipeline/jobs.js';
import { systemClock } from './tenancy/ctx.js';

const env = EnvSchema.parse({ NODE_ENV: 'test', DATABASE_URL: 'postgres://x', PREFLIGHT_KMS_KEY: Buffer.alloc(32).toString('base64'), PREFLIGHT_SESSION_SECRET: 'x'.repeat(32), PREFLIGHT_PUBLIC_URL: 'http://localhost' });
const inert = new Proxy({}, { get: () => () => { throw new Error('gen-openapi: no I/O'); } });
const deps: AppDeps = {
  env, db: inert as never, repo, queue: new InProcessJobQueue(), clock: systemClock, logger: pino({ level: 'silent' }), version: '0.1.0',
  secretBox: inert as never,
  rulebook: { hash: '', graphHash: '', packs: {}, loadedAt: new Date(0), gitRef: null, metadata: [], graph: inert as never, packsFor: () => [], hashFor: () => '' },
};
const app = await buildApp(deps);
await app.fastify.ready();
const doc = app.fastify.swagger();
const out = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'packages', 'api-types', 'src', 'openapi.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
await app.fastify.close();
console.log('wrote', out, Object.keys((doc as { paths: Record<string, unknown> }).paths).length, 'paths');
