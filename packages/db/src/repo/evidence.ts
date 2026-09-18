import { and, asc, desc, eq, gte, lt, or } from 'drizzle-orm';
import type { Tx } from '../client.js';
import { auditEvents, evidenceRecords } from '../schema/index.js';
import { newId } from '../ids.js';
import { clampLimit, decodeCursor, encodeCursor, type Page } from './util.js';

export type EvidenceRow = typeof evidenceRecords.$inferSelect;
export type AuditRow = typeof auditEvents.$inferSelect;
export type AuditInsert = Omit<typeof auditEvents.$inferInsert, 'tenantId' | 'id'> & { id?: string };

export const evidenceRepo = {
  /** Head of the tenant's chain, locked for the duration of the seal transaction. */
  async last(tx: Tx, tenantId: string): Promise<{ seq: number; hash: string } | null> {
    const [row] = await tx
      .select({ seq: evidenceRecords.seq, hash: evidenceRecords.hash })
      .from(evidenceRecords)
      .where(eq(evidenceRecords.tenantId, tenantId))
      .orderBy(desc(evidenceRecords.seq))
      .limit(1)
      .for('update');
    return row ? { seq: Number(row.seq), hash: row.hash } : null;
  },
  /**
   * seq = last + 1 in the SAME transaction as the caller's state change (F9 step 4). The caller computes
   * prev_hash/hash with core.canonicalJSON + sha256 (16 §4). unique(tenant_id, seq) catches any race.
   */
  async insert(
    tx: Tx,
    tenantId: string,
    record: {
      kind?: EvidenceRow['kind'];
      versionId: string | null;
      evaluationId: string | null;
      payload: Record<string, unknown>;
      payloadCanonical: string;
      prevHash: string;
      hash: string;
      sealedBy: string;
      id?: string;
    },
  ): Promise<EvidenceRow> {
    const head = await evidenceRepo.last(tx, tenantId);
    const seq = (head?.seq ?? 0) + 1;
    const [row] = await tx
      .insert(evidenceRecords)
      .values({ ...record, id: record.id ?? newId(), tenantId, seq, kind: record.kind ?? 'seal' })
      .returning();
    return row!;
  },
  async get(tx: Tx, tenantId: string, id: string): Promise<EvidenceRow | null> {
    const [row] = await tx.select().from(evidenceRecords).where(and(eq(evidenceRecords.tenantId, tenantId), eq(evidenceRecords.id, id))).limit(1);
    return row ?? null;
  },
  async getByVersion(tx: Tx, tenantId: string, versionId: string): Promise<EvidenceRow | null> {
    const [row] = await tx.select().from(evidenceRecords).where(and(eq(evidenceRecords.tenantId, tenantId), eq(evidenceRecords.versionId, versionId))).limit(1);
    return row ?? null;
  },
  async list(tx: Tx, tenantId: string, opts: { cursor?: string | null; limit?: number } = {}): Promise<Page<EvidenceRow>> {
    const limit = clampLimit(opts.limit);
    const cur = decodeCursor(opts.cursor);
    const conds = [eq(evidenceRecords.tenantId, tenantId)];
    if (cur) conds.push(lt(evidenceRecords.seq, Number(cur.id)));
    const rows = await tx.select().from(evidenceRecords).where(and(...conds)).orderBy(desc(evidenceRecords.seq)).limit(limit + 1);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return { items, nextCursor: rows.length > limit && last ? encodeCursor(last.sealedAt, String(last.seq)) : null };
  },
  /** seq ascending, paged — the chain walk for verification (05 §7). */
  async *walk(tx: Tx, tenantId: string, pageSize = 500): AsyncIterable<EvidenceRow> {
    let after = 0;
    for (;;) {
      const rows = await tx
        .select()
        .from(evidenceRecords)
        .where(and(eq(evidenceRecords.tenantId, tenantId), gte(evidenceRecords.seq, after + 1)))
        .orderBy(asc(evidenceRecords.seq))
        .limit(pageSize);
      for (const r of rows) yield r;
      if (rows.length < pageSize) return;
      after = Number(rows[rows.length - 1]!.seq);
    }
  },
};

export const auditRepo = {
  async insert(tx: Tx, tenantId: string, event: AuditInsert): Promise<AuditRow> {
    const [row] = await tx.insert(auditEvents).values({ ...event, id: event.id ?? newId(), tenantId }).returning();
    return row!;
  },
  async list(
    tx: Tx,
    tenantId: string,
    opts: { entityType?: string; entityId?: string; action?: string; from?: Date; to?: Date; cursor?: string | null; limit?: number } = {},
  ): Promise<Page<AuditRow>> {
    const limit = clampLimit(opts.limit);
    const cur = decodeCursor(opts.cursor);
    const conds = [eq(auditEvents.tenantId, tenantId)];
    if (opts.entityType) conds.push(eq(auditEvents.entityType, opts.entityType));
    if (opts.entityId) conds.push(eq(auditEvents.entityId, opts.entityId));
    if (opts.action) conds.push(eq(auditEvents.action, opts.action));
    if (opts.from) conds.push(gte(auditEvents.createdAt, opts.from));
    if (opts.to) conds.push(lt(auditEvents.createdAt, opts.to));
    if (cur) conds.push(or(lt(auditEvents.createdAt, cur.at), and(eq(auditEvents.createdAt, cur.at), lt(auditEvents.id, cur.id)))!);
    const rows = await tx
      .select()
      .from(auditEvents)
      .where(and(...conds))
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return { items, nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null };
  },
  async latestForEntity(tx: Tx, tenantId: string, entityType: string, entityId: string): Promise<AuditRow | null> {
    const [row] = await tx
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.tenantId, tenantId), eq(auditEvents.entityType, entityType), eq(auditEvents.entityId, entityId)))
      .orderBy(desc(auditEvents.createdAt))
      .limit(1);
    return row ?? null;
  },
};

