import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDb, repo, runMigrations, withTransaction, type DbHandle } from '@preflight/db';
import { buildApp, type App } from '../../src/app.js';
import { EnvSchema } from '../../src/env.js';
import { createLogger } from '../../src/observability/logger.js';
import { loadRulebook } from '../../src/rulebook/index.js';
import { InProcessJobQueue } from '../../src/pipeline/jobs.js';
import { createSecretBox, newIdentityHmacKey } from '../../src/secretbox.js';
import { installNodeCrypto } from '../../src/main.js';
import { hashSecret } from '../../src/auth/hash.js';
import { DEMO_CONFIG } from '../../src/seed.js';
import type { Clock } from '../../src/tenancy/ctx.js';

export const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
export const PASSWORD = 'test-pass-1234';

export interface TestWorld {
  app: App;
  handle: DbHandle;
  queue: InProcessJobQueue;
  clock: { now(): Date; set(d: Date): void };
  tenant(slug: string): Promise<{ id: string; users: Record<string, { id: string; email: string }> }>;
  login(email: string): Promise<Record<string, string>>;
  close(): Promise<void>;
}

export async function world(): Promise<TestWorld> {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required for integration tests (11 §1)');
  installNodeCrypto();
  const env = EnvSchema.parse({ NODE_ENV: 'test', DATABASE_URL, PREFLIGHT_KMS_KEY: Buffer.alloc(32, 3).toString('base64'), PREFLIGHT_SESSION_SECRET: 't'.repeat(32), PREFLIGHT_PUBLIC_URL: 'http://localhost:3000', PREFLIGHT_RULEBOOK_DIR: join(ROOT, 'rulebook'), LOG_LEVEL: 'silent' });
  const handle = createDb(DATABASE_URL);
  await runMigrations(handle.db);
  const rulebook = await loadRulebook(env.PREFLIGHT_RULEBOOK_DIR);
  const queue = new InProcessJobQueue({ retryDelays: [0, 0, 0] });
  let now = new Date('2026-09-12T10:00:00+05:30');
  const clock: TestWorld['clock'] & Clock = { now: () => now, set: (d) => { now = d; } };
  const secretBox = createSecretBox(env.PREFLIGHT_KMS_KEY);
  const app = await buildApp({ env, db: handle.db, repo, rulebook, queue, clock, logger: createLogger('silent'), secretBox, version: 'test' });
  app.pipeline.startWorkers();
  const run = Date.now().toString(36);
  return {
    app, handle, queue, clock,
    async tenant(slug) {
      const s = `${slug}-${run}`;
      return withTransaction(handle.db, async (tx) => {
        const { enc, iv } = secretBox.seal(newIdentityHmacKey());
        const t = await repo.tenants.create(tx, { slug: s, name: s, config: DEMO_CONFIG, identityHmacKeyEnc: enc, identityHmacKeyIv: iv });
        const hash = await hashSecret(PASSWORD);
        const users: Record<string, { id: string; email: string }> = {};
        for (const role of ['admin', 'operator', 'reviewer', 'approver'] as const) {
          const email = `${role}@${s}.test`;
          const u = await repo.users.create(tx, t.id, { email, displayName: role, roles: [role], passwordHash: hash });
          users[role] = { id: u.id, email };
        }
        return { id: t.id, users };
      });
    },
    async login(email) {
      const r = await app.fastify.inject({ method: 'POST', url: '/v1/auth/session', payload: { email, password: PASSWORD } });
      if (r.statusCode !== 204) throw new Error(`login failed: ${r.body}`);
      return { cookie: String(r.headers['set-cookie']).split(';')[0]!, 'x-requested-with': 'preflight' };
    },
    async close() {
      await queue.drain();
      await app.fastify.close();
      await handle.close();
    },
  };
}

export function sampleRows(): Record<string, string>[] {
  const csv = readFileSync(join(ROOT, 'builds/PreflightCore/sample/contacts.csv'), 'utf8').trim().split('\n');
  const hdr = csv[0]!.split(',');
  return csv.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [hdr[i]!, v])));
}
export function sampleCampaign(name: 'collections_campaign' | 'promotional_campaign'): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, `builds/PreflightCore/sample/${name}.json`), 'utf8')).campaign;
}
