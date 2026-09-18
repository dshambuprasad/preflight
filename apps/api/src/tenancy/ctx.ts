// 16 §2.5 — request context. Tenant derives from the credential, never from body/URL (06 §1, D5).
import type { Role } from '@preflight/db';

/** Used ONLY for TTLs/expiry/audit timestamps in api; never passed into core (16 §2.5). */
export interface Clock {
  now(): Date;
}
export const systemClock: Clock = { now: () => new Date() };

export interface Ctx {
  tenantId: string;
  userId: string | null;
  roles: Role[];
  requestId: string;
  clock: Clock;
  /** 'session' (cookie) | 'api_key' | 'system' */
  via: 'session' | 'api_key' | 'system';
}

export function hasRole(ctx: Pick<Ctx, 'roles'>, ...roles: Role[]): boolean {
  return roles.some((r) => ctx.roles.includes(r));
}
