// D36 / 06 §1 — generic Idempotency-Key middleware backed by `idempotency_keys`. Routes opt in with
// `config: { idempotent: true }`. Same key + same body → the stored response (200, not 201);
// same key + different body → 409 idempotency-conflict.
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createHash } from 'node:crypto';
import { repo } from '@preflight/db';
import { canonicalJSON } from '@preflight/core';
import { AppError } from './errors.js';
import type { AppDeps } from './deps.js';

export function requestHash(method: string, url: string, body: unknown): string {
  let canonical: string;
  try {
    canonical = canonicalJSON(body ?? null);
  } catch {
    canonical = JSON.stringify(body ?? null);
  }
  return createHash('sha256').update(`${method} ${url}\n${canonical}`).digest('hex');
}

export const idempotencyPlugin = fp(async function idempotencyPlugin(app: FastifyInstance, deps: AppDeps) {
  app.addHook('preHandler', async (req, reply) => {
    if (!req.routeOptions.config.idempotent) return;
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length === 0) return;
    if (key.length > 128) throw new AppError('validation', 'Idempotency-Key must be ≤ 128 chars', { issues: [{ path: 'Idempotency-Key', message: '≤ 128 chars' }] });
    const hash = requestHash(req.method, req.routeOptions.url ?? req.url, req.body);
    const existing = await repo.idempotency.get(deps.db, req.ctx.tenantId, key);
    if (!existing) return;
    if (existing.requestHash !== hash) throw new AppError('idempotency-conflict');
    reply.header('idempotent-replayed', 'true');
    return reply.code(200).send(existing.response);
  });

  app.addHook('onSend', async (req, reply, payload) => {
    if (!req.routeOptions.config.idempotent) return payload;
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length === 0 || key.length > 128) return payload;
    if (reply.getHeader('idempotent-replayed')) return payload;
    if (reply.statusCode >= 300) return payload;
    let response: unknown;
    try {
      response = typeof payload === 'string' ? JSON.parse(payload) : payload;
    } catch {
      return payload;
    }
    await repo.idempotency.put(deps.db, req.ctx.tenantId, {
      key,
      requestHash: requestHash(req.method, req.routeOptions.url ?? req.url, req.body),
      statusCode: reply.statusCode,
      response,
    });
    return payload;
  });
});
