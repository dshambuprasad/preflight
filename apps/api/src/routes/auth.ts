import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { repo } from '@preflight/db';
import { AppError } from '../errors.js';
import { verifySecret } from '../auth/hash.js';
import { SESSION_COOKIE, encodeSession } from '../auth/session.js';
import { cookieOptions } from '../auth/plugin.js';
import { LoginBody, Me, Problem } from '../schemas/index.js';
import { userRef } from './present.js';
import type { AppDeps } from '../deps.js';

export const authRoutes: FastifyPluginAsyncZod<AppDeps> = async (app, deps) => {
  // F18 step 1 — the tenant comes from the user record found by email (emails are unique per tenant; the demo
  // seed uses one tenant). SPEC-GAP: cross-tenant email collisions need a tenant picker (multi-tenant login) — M6.
  app.post('/auth/session', {
    schema: { body: LoginBody, response: { 204: z.null(), 401: Problem } },
    config: { public: true, rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const user = await repo.users.findByEmailAnyTenant(deps.db, req.body.email);
      if (!user || !user.passwordHash || !(await verifySecret(user.passwordHash, req.body.password))) {
        throw new AppError('unauthenticated', 'email or password is incorrect');
      }
      const exp = Math.floor(deps.clock.now().getTime() / 1000) + deps.env.PREFLIGHT_SESSION_TTL_HOURS * 3600;
      reply.setCookie(SESSION_COOKIE, encodeSession(deps.env.PREFLIGHT_SESSION_SECRET, { uid: user.id, tid: user.tenantId, exp }), cookieOptions(deps));
      await repo.audit.insert(deps.db, user.tenantId, { actorId: user.id, actorRoles: user.roles, entityType: 'user', entityId: user.id, action: 'auth.login', requestId: req.id });
      return reply.code(204).send(null);
    },
  });

  app.delete('/auth/session', {
    schema: { response: { 204: z.null() } },
    handler: async (req, reply) => {
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      if (req.ctx.userId) await repo.audit.insert(deps.db, req.ctx.tenantId, { actorId: req.ctx.userId, actorRoles: req.ctx.roles, entityType: 'user', entityId: req.ctx.userId, action: 'auth.logout', requestId: req.id });
      return reply.code(204).send(null);
    },
  });

  app.get('/me', {
    schema: { response: { 200: Me } },
    handler: async (req) => {
      const tenant = await repo.tenants.get(deps.db, req.ctx.tenantId);
      const user = req.ctx.userId ? await repo.users.get(deps.db, req.ctx.tenantId, req.ctx.userId) : null;
      if (!tenant || !user) throw new AppError('unauthenticated');
      return {
        user: userRef(user),
        tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, entityType: String((tenant.config as { entityType?: string }).entityType ?? 'bank') },
        sealingFrozen: tenant.sealingFrozen,
        mockConnectors: deps.env.PREFLIGHT_DEMO_MOCK_CONNECTORS,
      };
    },
  });
};
