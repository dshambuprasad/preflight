// Process entry: env → logger → db (+migrations) → rulebook (refuses on validation failure) → app → workers → listen.
import { createHash, createHmac } from 'node:crypto';
import { setCrypto } from '@preflight/core';
import { createDb, repo, runMigrations } from '@preflight/db';
import { loadEnv } from './env.js';
import { createLogger } from './observability/logger.js';
import { loadRulebook } from './rulebook/index.js';
import { InProcessJobQueue } from './pipeline/jobs.js';
import { createSecretBox } from './secretbox.js';
import { systemClock } from './tenancy/ctx.js';
import { buildApp } from './app.js';
import type { AppDeps } from './deps.js';

export const API_VERSION = '0.1.0';

export function installNodeCrypto(): void {
  setCrypto({
    sha256Hex: (s) => createHash('sha256').update(s, 'utf8').digest('hex'),
    hmacSha256Hex: (k, s) => createHmac('sha256', Buffer.from(k, 'utf8')).update(s, 'utf8').digest('hex'),
  });
}

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === 'development');
  installNodeCrypto();
  const handle = createDb(env.DATABASE_URL, { poolMax: env.DATABASE_POOL_MAX });
  await runMigrations(handle.db);
  const rulebook = await loadRulebook(env.PREFLIGHT_RULEBOOK_DIR, { gitRef: process.env.GIT_SHA ?? null });
  logger.info({ rulebookHash: rulebook.hash, packs: Object.keys(rulebook.packs) }, 'rulebook loaded and validated');
  const queue = new InProcessJobQueue({ onError: (err, e) => logger.error({ err, ...e }, 'job failed') });
  const deps: AppDeps = { env, db: handle.db, repo, rulebook, queue, clock: systemClock, logger, secretBox: createSecretBox(env.PREFLIGHT_KMS_KEY), version: API_VERSION };
  const webOrigin = process.env.PREFLIGHT_WEB_ORIGIN ?? new URL(env.PREFLIGHT_PUBLIC_URL).origin;
  const app = await buildApp(deps, { webOrigin });
  if (env.PREFLIGHT_ROLE !== 'api') app.pipeline.startWorkers();
  if (env.PREFLIGHT_ROLE !== 'worker') await app.fastify.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ role: env.PREFLIGHT_ROLE, port: env.PORT }, 'preflight api up');
  const shutdown = async () => {
    await queue.drain();
    await app.fastify.close();
    await handle.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
