import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Tx } from '../client.js';
import { apiKeys, users } from '../schema/index.js';
import { newId } from '../ids.js';

export type UserRow = typeof users.$inferSelect;
export type Role = UserRow['roles'][number];
export type ApiKeyRow = typeof apiKeys.$inferSelect;

export const usersRepo = {
  async list(tx: Tx, tenantId: string): Promise<UserRow[]> {
    return tx.select().from(users).where(eq(users.tenantId, tenantId)).orderBy(asc(users.createdAt));
  },
  async get(tx: Tx, tenantId: string, id: string): Promise<UserRow | null> {
    const [row] = await tx.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.id, id))).limit(1);
    return row ?? null;
  },
  async getByEmail(tx: Tx, tenantId: string, email: string): Promise<UserRow | null> {
    const [row] = await tx
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.email, email.trim())))
      .limit(1);
    return row ?? null;
  },
  /**
   * Credential-scoped like apiKeys.findByPrefix: login resolves the tenant FROM the email (F18). Returns null
   * when the email exists in more than one tenant — SPEC-GAP: multi-tenant login needs a tenant picker (M6).
   */
  async findByEmailAnyTenant(tx: Tx, email: string): Promise<UserRow | null> {
    const rows = await tx.select().from(users).where(eq(users.email, email.trim())).limit(2);
    return rows.length === 1 ? rows[0]! : null;
  },
  async create(
    tx: Tx,
    tenantId: string,
    input: { email: string; displayName: string; roles: Role[]; passwordHash: string | null; id?: string },
  ): Promise<UserRow> {
    const [row] = await tx
      .insert(users)
      .values({ id: input.id ?? newId(), tenantId, email: input.email.trim(), displayName: input.displayName, roles: input.roles, passwordHash: input.passwordHash })
      .returning();
    return row!;
  },
  async setRoles(tx: Tx, tenantId: string, id: string, roles: Role[]): Promise<UserRow | null> {
    const [row] = await tx.update(users).set({ roles }).where(and(eq(users.tenantId, tenantId), eq(users.id, id))).returning();
    return row ?? null;
  },
  async setDisplayName(tx: Tx, tenantId: string, id: string, displayName: string): Promise<void> {
    await tx.update(users).set({ displayName }).where(and(eq(users.tenantId, tenantId), eq(users.id, id)));
  },
};

export const apiKeysRepo = {
  /** Hashing (argon2id) is done by apps/api; the repo stores prefix + hash. */
  async create(tx: Tx, tenantId: string, userId: string, label: string, keyPrefix: string, keyHash: string): Promise<ApiKeyRow> {
    const [row] = await tx.insert(apiKeys).values({ id: newId(), tenantId, userId, label, keyPrefix, keyHash }).returning();
    return row!;
  },
  /**
   * Credential-scoped, NOT tenant-scoped: the tenant is what this lookup *yields* (06 §1 — tenant derives
   * from the credential, never from body/URL). Returns null when revoked or unknown.
   */
  async findByPrefix(tx: Tx, keyPrefix: string): Promise<(ApiKeyRow & { roles: Role[] }) | null> {
    const [row] = await tx
      .select({ key: apiKeys, roles: users.roles })
      .from(apiKeys)
      .innerJoin(users, eq(users.id, apiKeys.userId))
      .where(and(eq(apiKeys.keyPrefix, keyPrefix), isNull(apiKeys.revokedAt)))
      .limit(1);
    return row ? { ...row.key, roles: row.roles } : null;
  },
  async list(tx: Tx, tenantId: string): Promise<ApiKeyRow[]> {
    return tx.select().from(apiKeys).where(eq(apiKeys.tenantId, tenantId)).orderBy(asc(apiKeys.createdAt));
  },
  async revoke(tx: Tx, tenantId: string, id: string, at: Date): Promise<boolean> {
    const rows = await tx
      .update(apiKeys)
      .set({ revokedAt: at })
      .where(and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });
    return rows.length > 0;
  },
};
