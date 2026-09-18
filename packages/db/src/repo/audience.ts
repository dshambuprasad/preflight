import { and, asc, eq, gt, inArray, notInArray, sql } from 'drizzle-orm';
import type { Tx } from '../client.js';
import { audienceRows, audienceSets, uploads } from '../schema/index.js';
import { newId } from '../ids.js';

export type UploadRow = typeof uploads.$inferSelect;
export type AudienceSetRow = typeof audienceSets.$inferSelect;
export type AudienceRow = typeof audienceRows.$inferSelect;
export type AudienceRowInsert = Omit<typeof audienceRows.$inferInsert, 'tenantId' | 'setId' | 'id'> & { id?: string };

export const uploadsRepo = {
  async create(
    tx: Tx,
    tenantId: string,
    input: { filename: string; mime: string; bytes: number; storageRef: string | null; rowCount: number; sha256: string | null; createdBy: string; id?: string },
  ): Promise<UploadRow> {
    const [row] = await tx.insert(uploads).values({ ...input, id: input.id ?? newId(), tenantId }).returning();
    return row!;
  },
  async get(tx: Tx, tenantId: string, id: string): Promise<UploadRow | null> {
    const [row] = await tx.select().from(uploads).where(and(eq(uploads.tenantId, tenantId), eq(uploads.id, id))).limit(1);
    return row ?? null;
  },
  async setMapping(tx: Tx, tenantId: string, id: string, columnMapping: Record<string, unknown>): Promise<void> {
    await tx.update(uploads).set({ columnMapping }).where(and(eq(uploads.tenantId, tenantId), eq(uploads.id, id)));
  },
  /** Raw is purged by the storage layer; the row and its sha256 are kept (06 §3, 18 §4). */
  async markDeleted(tx: Tx, tenantId: string, id: string, at: Date): Promise<void> {
    await tx.update(uploads).set({ deletedAt: at, storageRef: null }).where(and(eq(uploads.tenantId, tenantId), eq(uploads.id, id)));
  },
};

export const audienceSetsRepo = {
  async create(
    tx: Tx,
    tenantId: string,
    input: { source: AudienceSetRow['source']; uploadId: string | null; rowCount: number; setHash: string; createdBy: string; id?: string },
  ): Promise<AudienceSetRow> {
    const [row] = await tx.insert(audienceSets).values({ ...input, id: input.id ?? newId(), tenantId }).returning();
    return row!;
  },
  async get(tx: Tx, tenantId: string, id: string): Promise<AudienceSetRow | null> {
    const [row] = await tx.select().from(audienceSets).where(and(eq(audienceSets.tenantId, tenantId), eq(audienceSets.id, id))).limit(1);
    return row ?? null;
  },
};

export interface AudienceListOpts {
  /** row_no values excluded by the version (D27) */
  excluding?: number[];
  afterRowNo?: number;
  limit?: number;
  includeDuplicates?: boolean;
}

export const audienceRepo = {
  async insertBatch(tx: Tx, tenantId: string, setId: string, rows: AudienceRowInsert[]): Promise<number> {
    if (!rows.length) return 0;
    const CHUNK = 1000;
    let n = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK).map((r) => ({ ...r, id: r.id ?? newId(), tenantId, setId }));
      await tx.insert(audienceRows).values(chunk);
      n += chunk.length;
    }
    return n;
  },
  /** Effective audience page in upload order: set − exclusions, optionally without duplicates. */
  async list(tx: Tx, tenantId: string, setId: string, opts: AudienceListOpts = {}): Promise<AudienceRow[]> {
    const conds = [eq(audienceRows.tenantId, tenantId), eq(audienceRows.setId, setId)];
    if (opts.excluding?.length) conds.push(notInArray(audienceRows.rowNo, opts.excluding));
    if (opts.afterRowNo !== undefined) conds.push(gt(audienceRows.rowNo, opts.afterRowNo));
    if (opts.includeDuplicates === false) conds.push(sql`${audienceRows.duplicateOfRowId} is null`);
    const q = tx.select().from(audienceRows).where(and(...conds)).orderBy(asc(audienceRows.rowNo));
    return opts.limit ? q.limit(opts.limit) : q;
  },
  /** Streams the effective audience in pages of `pageSize` (constant memory, 18 §2.1). */
  async *stream(tx: Tx, tenantId: string, setId: string, opts: AudienceListOpts & { pageSize?: number } = {}): AsyncIterable<AudienceRow> {
    const pageSize = opts.pageSize ?? 1000;
    let after = opts.afterRowNo ?? -1;
    for (;;) {
      const page = await audienceRepo.list(tx, tenantId, setId, { ...opts, afterRowNo: after, limit: pageSize });
      for (const r of page) yield r;
      if (page.length < pageSize) return;
      after = page[page.length - 1]!.rowNo;
    }
  },
  async getMany(tx: Tx, tenantId: string, ids: string[]): Promise<AudienceRow[]> {
    if (!ids.length) return [];
    return tx.select().from(audienceRows).where(and(eq(audienceRows.tenantId, tenantId), inArray(audienceRows.id, ids)));
  },
  /**
   * 18 §2.2 — one SQL pass: rows sharing an identity_key within the set (excluding `row:` keys)
   * point at the lowest row_no. Returns the number of duplicates marked.
   */
  async markDuplicates(tx: Tx, tenantId: string, setId: string): Promise<number> {
    const res = await tx.execute(sql`
      update audience_rows a set duplicate_of_row_id = f.id
      from (
        select distinct on (identity_key) id, identity_key
        from audience_rows
        where tenant_id = ${tenantId} and set_id = ${setId} and identity_key not like 'row:%'
        order by identity_key, row_no
      ) f
      where a.tenant_id = ${tenantId} and a.set_id = ${setId}
        and a.identity_key = f.identity_key and a.id <> f.id and a.identity_key not like 'row:%'
    `);
    return Number((res as { rowCount?: number }).rowCount ?? 0);
  },
  /** RESOLVE writes (05 §3): the only columns the immutability trigger lets through. */
  async setResolved(
    tx: Tx,
    tenantId: string,
    updates: {
      id: string;
      phoneE164?: string | null;
      emailNorm?: string | null;
      identityKey?: string;
      identityHmac?: string;
      preferredLanguage?: string | null;
      consentPromotional?: AudienceRow['consentPromotional'];
      consentSource?: string | null;
    }[],
  ): Promise<void> {
    for (const u of updates) {
      const { id, ...rest } = u;
      await tx.update(audienceRows).set(rest).where(and(eq(audienceRows.tenantId, tenantId), eq(audienceRows.id, id)));
    }
  },
  async stats(tx: Tx, tenantId: string, setId: string, excluding: number[] = []): Promise<{ rows: number; duplicates: number; unresolvable: number }> {
    const conds = [eq(audienceRows.tenantId, tenantId), eq(audienceRows.setId, setId)];
    if (excluding.length) conds.push(notInArray(audienceRows.rowNo, excluding));
    const [row] = await tx
      .select({
        rows: sql<number>`count(*)`,
        duplicates: sql<number>`count(*) filter (where ${audienceRows.duplicateOfRowId} is not null)`,
        unresolvable: sql<number>`count(*) filter (where ${audienceRows.identityKey} like 'row:%')`,
      })
      .from(audienceRows)
      .where(and(...conds));
    return { rows: Number(row?.rows ?? 0), duplicates: Number(row?.duplicates ?? 0), unresolvable: Number(row?.unresolvable ?? 0) };
  },
};
