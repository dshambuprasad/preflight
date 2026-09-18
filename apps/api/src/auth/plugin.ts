// F18 — resolves the request context from an API key (Bearer) or the session cookie; role guards.
// Roles are enforced here at the route AND again in the pipeline (02 §7, 09 §2 defence in depth).
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';
import { repo, type Role } from '@preflight/db';
import { AppError } from '../errors.js';
import { splitApiKey, verifySecret } from './hash.js';
import { SESSION_COOKIE, decodeSession, encodeSession } from './session.js';
import type { Ctx } from '../tenancy/ctx.js';
import type { AppDeps } from '../deps.js';

declare module 'fastify' {
  interface FastifyRequest {
    ctx: Ctx;
  }
  interface FastifyContextConfig {
    public?: boolean;
    roles?: Role[];
    idempotent?: boolean;
  }
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const authPlugin = fp(async function authPlugin(app: FastifyInstance, deps: AppDeps) {
  const ttlSec = deps.env.PREFLIGHT_SESSION_TTL_HOURS * 3600;

  app.decorateRequest('ctx', null as unknown as Ctx);

  app.addHook('onRequest', async (req, reply) => {
    if (req.routeOptions.config.public) return;
    const now = deps.clock.now();
    const nowSec = Math.floor(now.getTime() / 1000);
    const auth = req.headers.authorization;

    if (auth?.startsWith('Bearer ')) {
      const parts = splitApiKey(auth.slice(7));
      if (!parts) throw new AppError('unauthenticated', 'malformed API key');
      const key = await repo.apiKeys.findByPrefix(deps.db, parts.keyPrefix);
      if (!key || !(await verifySecret(key.keyHash, parts.secret))) throw new AppError('unauthenticated', 'unknown or revoked API key');
      req.ctx = { tenantId: key.tenantId, userId: key.userId, roles: key.roles, requestId: req.id, clock: deps.clock, via: 'api_key' };
      return;
    }

    const session = decodeSession(deps.env.PREFLIGHT_SESSION_SECRET, req.cookies[SESSION_COOKIE], nowSec);
    if (!session) throw new AppError('unauthenticated', 'sign in to continue');
    const user = await repo.users.get(deps.db, session.tid, session.uid);
    if (!user) throw new AppError('unauthenticated', 'session user no longer exists');
    // SPEC-GAP (09 §2 CSRF token): cookie-authenticated mutations require the X-Requested-With header the
    // web client always sends (SameSite=Lax is the second layer). A per-session CSRF token is M1.
    if (MUTATING.has(req.method) && req.headers['x-requested-with'] !== 'preflight') {
      throw new AppError('forbidden-role', 'missing X-Requested-With header on a cookie-authenticated mutation');
    }
    req.ctx = { tenantId: user.tenantId, userId: user.id, roles: user.roles, requestId: req.id, clock: deps.clock, via: 'session' };
    // sliding idle TTL
    reply.setCookie(SESSION_COOKIE, encodeSession(deps.env.PREFLIGHT_SESSION_SECRET, { uid: user.id, tid: user.tenantId, exp: nowSec + ttlSec }), cookieOptions(deps));
  });

  app.addHook('preHandler', async (req) => {
    const roles = req.routeOptions.config.roles;
    if (!roles || roles.length === 0) return;
    if (!roles.some((r) => req.ctx.roles.includes(r))) {
      throw new AppError('forbidden-role', `requires one of: ${roles.join(', ')}`);
    }
  });
});

export function cookieOptions(deps: AppDeps) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: deps.env.NODE_ENV === 'production',
    maxAge: deps.env.PREFLIGHT_SESSION_TTL_HOURS * 3600,
  };
}

/** preHandler for use inside route definitions when a finer check than `config.roles` is needed. */
export function requireRoles(...roles: Role[]): preHandlerHookHandler {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!roles.some((r) => req.ctx.roles.includes(r))) throw new AppError('forbidden-role', `requires one of: ${roles.join(', ')}`);
  };
}
