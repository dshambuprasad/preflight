import { eq } from 'drizzle-orm';
import type { Tx } from '../client.js';
import { tenants } from '../schema/index.js';
import { newId } from '../ids.js';
import type { TenantConfig } from '../json/index.js';

export type TenantRow = typeof tenants.$inferSelect;

/** The only repo namespace without a tenantId parameter — it IS the tenant (16 §2.4). */
export const tenantsRepo = {
  async get(tx: Tx, id: string): Promise<TenantRow | null> {
    const [row] = await tx.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return row ?? null;
  },
  async getBySlug(tx: Tx, slug: string): Promise<TenantRow | null> {
    const [row] = await tx.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
    return row ?? null;
  },
  async create(
    tx: Tx,
    input: { slug: string; name: string; config: TenantConfig; identityHmacKeyEnc?: Buffer; identityHmacKeyIv?: Buffer; id?: string },
  ): Promise<TenantRow> {
    const [row] = await tx
      .insert(tenants)
      .values({
        id: input.id ?? newId(),
        slug: input.slug,
        name: input.name,
        config: input.config,
        identityHmacKeyEnc: input.identityHmacKeyEnc ?? null,
        identityHmacKeyIv: input.identityHmacKeyIv ?? null,
      })
      .returning();
    return row!;
  },
  /** Audit row is written by the caller (F12) with before/after. */
  async updateConfig(tx: Tx, id: string, config: TenantConfig): Promise<TenantRow> {
    const [row] = await tx.update(tenants).set({ config }).where(eq(tenants.id, id)).returning();
    return row!;
  },
  async freezeSealing(tx: Tx, id: string, reason: string | null): Promise<void> {
    await tx.update(tenants).set({ sealingFrozen: reason !== null, frozenReason: reason }).where(eq(tenants.id, id));
  },
  async setIdentityHmacKey(tx: Tx, id: string, enc: Buffer, iv: Buffer): Promise<void> {
    await tx.update(tenants).set({ identityHmacKeyEnc: enc, identityHmacKeyIv: iv }).where(eq(tenants.id, id));
  },
};
