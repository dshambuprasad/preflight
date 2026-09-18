import { and, asc, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Tx } from '../client.js';
import {
  connectors, cosignRequests, handoffPushes, idempotencyKeys, platformState, platformTemplates, rulebookVersions,
} from '../schema/index.js';
import { newId } from '../ids.js';

export type CosignRow = typeof cosignRequests.$inferSelect;
export type ConnectorRow = typeof connectors.$inferSelect;
export type HandoffPushRow = typeof handoffPushes.$inferSelect;
export type PlatformTemplateRow = typeof platformTemplates.$inferSelect;
export type PlatformStateRow = typeof platformState.$inferSelect;
export type RulebookVersionRow = typeof rulebookVersions.$inferSelect;
export type IdempotencyRow = typeof idempotencyKeys.$inferSelect;

export const cosignRepo = {
  async create(tx: Tx, tenantId: string, input: { versionId: string; code: string; requestedBy: string; expiresAt: Date }): Promise<CosignRow> {
    const [row] = await tx.insert(cosignRequests).values({ ...input, id: newId(), tenantId }).returning();
    return row!;
  },
  async findByCode(tx: Tx, tenantId: string, code: string, now: Date): Promise<CosignRow | null> {
    const [row] = await tx
      .select()
      .from(cosignRequests)
      .where(and(eq(cosignRequests.tenantId, tenantId), eq(cosignRequests.code, code), gt(cosignRequests.expiresAt, now), isNull(cosignRequests.consumedAt)))
      .orderBy(desc(cosignRequests.createdAt))
      .limit(1);
    return row ?? null;
  },
  async approve(tx: Tx, tenantId: string, id: string, approvedBy: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await tx.update(cosignRequests).set({ approvedBy, tokenHash, expiresAt }).where(and(eq(cosignRequests.tenantId, tenantId), eq(cosignRequests.id, id)));
  },
  async consumeToken(tx: Tx, tenantId: string, id: string, at: Date): Promise<boolean> {
    const rows = await tx
      .update(cosignRequests)
      .set({ consumedAt: at })
      .where(and(eq(cosignRequests.tenantId, tenantId), eq(cosignRequests.id, id), isNull(cosignRequests.consumedAt)))
      .returning({ id: cosignRequests.id });
    return rows.length > 0;
  },
  async bumpAttempts(tx: Tx, tenantId: string, id: string): Promise<number> {
    const [row] = await tx
      .update(cosignRequests)
      .set({ attempts: sql`${cosignRequests.attempts} + 1` })
      .where(and(eq(cosignRequests.tenantId, tenantId), eq(cosignRequests.id, id)))
      .returning({ attempts: cosignRequests.attempts });
    return row?.attempts ?? 0;
  },
};

export const connectorsRepo = {
  async list(tx: Tx, tenantId: string): Promise<ConnectorRow[]> {
    return tx.select().from(connectors).where(eq(connectors.tenantId, tenantId)).orderBy(asc(connectors.createdAt));
  },
  async get(tx: Tx, tenantId: string, id: string): Promise<ConnectorRow | null> {
    const [row] = await tx.select().from(connectors).where(and(eq(connectors.tenantId, tenantId), eq(connectors.id, id))).limit(1);
    return row ?? null;
  },
  async create(
    tx: Tx,
    tenantId: string,
    input: { kind: ConnectorRow['kind']; label: string; capabilities: ConnectorRow['capabilities']; credentialsEnc: Buffer | null; credentialsIv: Buffer | null; config?: ConnectorRow['config'] },
  ): Promise<ConnectorRow> {
    const [row] = await tx.insert(connectors).values({ ...input, id: newId(), tenantId, config: input.config ?? {} }).returning();
    return row!;
  },
  async update(tx: Tx, tenantId: string, id: string, patch: Partial<Pick<ConnectorRow, 'label' | 'config' | 'capabilities' | 'credentialsEnc' | 'credentialsIv'>>): Promise<void> {
    await tx.update(connectors).set(patch).where(and(eq(connectors.tenantId, tenantId), eq(connectors.id, id)));
  },
  async setStatus(tx: Tx, tenantId: string, id: string, status: ConnectorRow['status'], lastError: string | null): Promise<void> {
    await tx.update(connectors).set({ status, lastError }).where(and(eq(connectors.tenantId, tenantId), eq(connectors.id, id)));
  },
  async setCursor(tx: Tx, tenantId: string, id: string, cursor: Record<string, unknown> | null, lastSyncAt: Date): Promise<void> {
    await tx.update(connectors).set({ cursor, lastSyncAt }).where(and(eq(connectors.tenantId, tenantId), eq(connectors.id, id)));
  },
  async delete(tx: Tx, tenantId: string, id: string): Promise<void> {
    await tx.delete(connectors).where(and(eq(connectors.tenantId, tenantId), eq(connectors.id, id)));
  },
};

export const platformRepo = {
  async getState(tx: Tx, tenantId: string, connectorId: string): Promise<PlatformStateRow | null> {
    const [row] = await tx.select().from(platformState).where(and(eq(platformState.tenantId, tenantId), eq(platformState.connectorId, connectorId))).limit(1);
    return row ?? null;
  },
  /** freshest state across the tenant's connectors — CHECK consults this (08 §4) */
  async freshest(tx: Tx, tenantId: string): Promise<PlatformStateRow | null> {
    const [row] = await tx.select().from(platformState).where(eq(platformState.tenantId, tenantId)).orderBy(desc(platformState.fetchedAt)).limit(1);
    return row ?? null;
  },
  async upsertState(
    tx: Tx,
    tenantId: string,
    connectorId: string,
    state: { qualityRating: string | null; messagingLimitTier: string | null; nameStatus: string | null; raw: Record<string, unknown>; fetchedAt: Date },
  ): Promise<void> {
    await tx
      .insert(platformState)
      .values({ connectorId, tenantId, ...state })
      .onConflictDoUpdate({ target: platformState.connectorId, set: { ...state } });
  },
  async upsertTemplates(
    tx: Tx,
    tenantId: string,
    connectorId: string,
    templates: { externalId: string; name: string; status: string; category: string | null; body: string; variableCount: number; rejectionReason: string | null }[],
    fetchedAt: Date,
  ): Promise<void> {
    if (!templates.length) return;
    await tx
      .insert(platformTemplates)
      .values(templates.map((t) => ({ ...t, id: newId(), tenantId, connectorId, fetchedAt })))
      .onConflictDoUpdate({
        target: [platformTemplates.connectorId, platformTemplates.externalId],
        set: {
          name: sql`excluded.name`, status: sql`excluded.status`, category: sql`excluded.category`, body: sql`excluded.body`,
          variableCount: sql`excluded.variable_count`, rejectionReason: sql`excluded.rejection_reason`, fetchedAt,
        },
      });
  },
  async listTemplates(tx: Tx, tenantId: string, connectorId?: string): Promise<PlatformTemplateRow[]> {
    const conds = [eq(platformTemplates.tenantId, tenantId)];
    if (connectorId) conds.push(eq(platformTemplates.connectorId, connectorId));
    return tx.select().from(platformTemplates).where(and(...conds)).orderBy(asc(platformTemplates.name));
  },
};

export const pushesRepo = {
  async insertBatch(tx: Tx, tenantId: string, versionId: string, connectorId: string, target: HandoffPushRow['target'], identityKeys: string[]): Promise<number> {
    if (!identityKeys.length) return 0;
    const rows = await tx
      .insert(handoffPushes)
      .values(identityKeys.map((identityKey) => ({ id: newId(), tenantId, versionId, connectorId, target, identityKey })))
      .onConflictDoNothing()
      .returning({ id: handoffPushes.id });
    return rows.length;
  },
  async listByVersion(tx: Tx, tenantId: string, versionId: string): Promise<HandoffPushRow[]> {
    return tx.select().from(handoffPushes).where(and(eq(handoffPushes.tenantId, tenantId), eq(handoffPushes.versionId, versionId))).orderBy(asc(handoffPushes.identityKey));
  },
  async markStatus(tx: Tx, tenantId: string, id: string, status: HandoffPushRow['status'], providerRef: string | null, error: string | null): Promise<void> {
    await tx.update(handoffPushes).set({ status, providerRef, error, pushedAt: sql`now()` }).where(and(eq(handoffPushes.tenantId, tenantId), eq(handoffPushes.id, id)));
  },
};

/** Global (not tenant-scoped): what rulebook hashes this deployment has loaded (03 §9). */
export const rulebookVersionsRepo = {
  async record(tx: Tx, hash: string, packIds: string[], meta: { gitRef: string | null; nodeCount: number; ruleCount: number }): Promise<RulebookVersionRow> {
    const [row] = await tx
      .insert(rulebookVersions)
      .values({ hash, packIds, gitRef: meta.gitRef, nodeCount: meta.nodeCount, ruleCount: meta.ruleCount })
      .onConflictDoUpdate({ target: rulebookVersions.hash, set: { loadedAt: sql`now()` } })
      .returning();
    return row!;
  },
  async get(tx: Tx, hash: string): Promise<RulebookVersionRow | null> {
    const [row] = await tx.select().from(rulebookVersions).where(eq(rulebookVersions.hash, hash)).limit(1);
    return row ?? null;
  },
};

/** D36 — generic idempotency store used by the api middleware (05 §9). */
export const idempotencyRepo = {
  async get(tx: Tx, tenantId: string, key: string): Promise<IdempotencyRow | null> {
    const [row] = await tx.select().from(idempotencyKeys).where(and(eq(idempotencyKeys.tenantId, tenantId), eq(idempotencyKeys.key, key))).limit(1);
    return row ?? null;
  },
  async put(tx: Tx, tenantId: string, entry: { key: string; requestHash: string; statusCode: number; response: unknown }): Promise<IdempotencyRow> {
    const [row] = await tx.insert(idempotencyKeys).values({ ...entry, tenantId }).onConflictDoNothing().returning();
    return row ?? (await idempotencyRepo.get(tx, tenantId, entry.key))!;
  },
};
