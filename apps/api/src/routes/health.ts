import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { register } from 'prom-client';
import { Health } from '../schemas/index.js';
import type { AppDeps } from '../deps.js';

export const healthRoutes: FastifyPluginAsyncZod<AppDeps> = async (app, deps) => {
  app.get('/health', {
    schema: { response: { 200: Health, 503: Health } },
    config: { public: true },
    handler: async (_req, reply) => {
      let db: 'ok' | 'down' = 'ok';
      try {
        await deps.db.execute(sql`select 1`);
      } catch {
        db = 'down';
      }
      const queue: 'ok' | 'down' = 'ok';
      const ok = db === 'ok';
      return reply.code(ok ? 200 : 503).send({ ok, db, queue, rulebookHash: deps.rulebook.hash, version: deps.version });
    },
  });
  app.get('/metrics', {
    schema: { response: { 200: z.string() } },
    config: { public: true },
    handler: async (_req, reply) => {
      reply.header('content-type', register.contentType);
      return register.metrics();
    },
  });
};
