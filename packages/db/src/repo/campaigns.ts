import { and, desc, eq, ilike, lt, or, sql } from 'drizzle-orm';
import type { Tx } from '../client.js';
import { campaignVersions, campaigns, messageVariants } from '../schema/index.js';
import { newId } from '../ids.js';
import { InvalidTransition } from '../errors.js';
import { isAllowedTransition, type VersionState } from '../transitions.js';
import { clampLimit, decodeCursor, encodeCursor, type Page } from './util.js';

export type CampaignRow = typeof campaigns.$inferSelect;
export type VersionRow = typeof campaignVersions.$inferSelect;
export type VersionInsert = typeof campaignVersions.$inferInsert;
export type MessageVariantRow = typeof messageVariants.$inferSelect;

export const campaignsRepo = {
  async create(
    tx: Tx,
    tenantId: string,
    input: { name: string; mode: CampaignRow['mode']; kind?: CampaignRow['kind']; createdBy: string; id?: string },
  ): Promise<CampaignRow> {
    const [row] = await tx
      .insert(campaigns)
      .values({ id: input.id ?? newId(), tenantId, name: input.name, mode: input.mode, kind: input.kind ?? 'batch', createdBy: input.createdBy })
      .returning();
    return row!;
  },
  async get(tx: Tx, tenantId: string, id: string): Promise<CampaignRow | null> {
    const [row] = await tx.select().from(campaigns).where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, id))).limit(1);
    return row ?? null;
  },
  /** cursor over (created_at desc, id) — 18 §2.5 */
  async list(
    tx: Tx,
    tenantId: string,
    opts: { cursor?: string | null; limit?: number; state?: VersionState; mode?: CampaignRow['mode']; q?: string } = {},
  ): Promise<Page<CampaignRow>> {
    const limit = clampLimit(opts.limit);
    const cur = decodeCursor(opts.cursor);
    const conds = [eq(campaigns.tenantId, tenantId)];
    if (opts.state) conds.push(eq(campaigns.latestVersionState, opts.state));
    if (opts.mode) conds.push(eq(campaigns.mode, opts.mode));
    if (opts.q) conds.push(ilike(campaigns.name, `%${opts.q.replace(/[%_]/g, (m) => '\\' + m)}%`));
    if (cur) conds.push(or(lt(campaigns.createdAt, cur.at), and(eq(campaigns.createdAt, cur.at), lt(campaigns.id, cur.id)))!);
    const rows = await tx
      .select()
      .from(campaigns)
      .where(and(...conds))
      .orderBy(desc(campaigns.createdAt), desc(campaigns.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return { items, nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null };
  },
  async setLatestVersionState(tx: Tx, tenantId: string, id: string, state: VersionState | null): Promise<void> {
    await tx.update(campaigns).set({ latestVersionState: state }).where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, id)));
  },
};

export const versionsRepo = {
  /** Insert in state `draft`. Everything else about the row is immutable afterwards (trigger). */
  async create(tx: Tx, tenantId: string, input: Omit<VersionInsert, 'tenantId' | 'id' | 'state'> & { id?: string }): Promise<VersionRow> {
    const [row] = await tx
      .insert(campaignVersions)
      .values({ ...input, id: input.id ?? newId(), tenantId, state: 'draft' })
      .returning();
    await campaignsRepo.setLatestVersionState(tx, tenantId, row!.campaignId, 'draft');
    return row!;
  },
  async get(tx: Tx, tenantId: string, id: string): Promise<VersionRow | null> {
    const [row] = await tx
      .select()
      .from(campaignVersions)
      .where(and(eq(campaignVersions.tenantId, tenantId), eq(campaignVersions.id, id)))
      .limit(1);
    return row ?? null;
  },
  async getByIdempotencyKey(tx: Tx, tenantId: string, key: string): Promise<VersionRow | null> {
    const [row] = await tx
      .select()
      .from(campaignVersions)
      .where(and(eq(campaignVersions.tenantId, tenantId), eq(campaignVersions.idempotencyKey, key)))
      .limit(1);
    return row ?? null;
  },
  async listByCampaign(tx: Tx, tenantId: string, campaignId: string): Promise<VersionRow[]> {
    return tx
      .select()
      .from(campaignVersions)
      .where(and(eq(campaignVersions.tenantId, tenantId), eq(campaignVersions.campaignId, campaignId)))
      .orderBy(desc(campaignVersions.versionNo));
  },
  /** versions whose parent_version_id = id (derived "superseded by", 05 §2) */
  async children(tx: Tx, tenantId: string, id: string): Promise<VersionRow[]> {
    return tx
      .select()
      .from(campaignVersions)
      .where(and(eq(campaignVersions.tenantId, tenantId), eq(campaignVersions.parentVersionId, id)))
      .orderBy(desc(campaignVersions.versionNo));
  },
  /**
   * The ONLY way state changes (16 §2.4). Compare-and-set under a row lock: throws InvalidTransition
   * when the current state ≠ `from` or when (from → to) is not in the 05 §2 table.
   * Also maintains campaigns.latest_version_state (18 §2.5). Call inside a transaction.
   */
  async setState(tx: Tx, tenantId: string, id: string, from: VersionState, to: VersionState): Promise<VersionRow> {
    const [locked] = await tx
      .select({ id: campaignVersions.id, state: campaignVersions.state, campaignId: campaignVersions.campaignId, versionNo: campaignVersions.versionNo })
      .from(campaignVersions)
      .where(and(eq(campaignVersions.tenantId, tenantId), eq(campaignVersions.id, id)))
      .for('update');
    if (!locked) throw new InvalidTransition(id, from, to, 'missing');
    if (locked.state !== from) throw new InvalidTransition(id, from, to, locked.state);
    if (!isAllowedTransition(from, to)) throw new InvalidTransition(id, from, to);
    const [row] = await tx
      .update(campaignVersions)
      .set({ state: to, stateChangedAt: sql`now()` })
      .where(and(eq(campaignVersions.tenantId, tenantId), eq(campaignVersions.id, id)))
      .returning();
    // denormalise only when this is the campaign's latest version
    const [latest] = await tx
      .select({ versionNo: sql<number>`max(${campaignVersions.versionNo})` })
      .from(campaignVersions)
      .where(and(eq(campaignVersions.tenantId, tenantId), eq(campaignVersions.campaignId, locked.campaignId)));
    if (latest && Number(latest.versionNo) === locked.versionNo) {
      await campaignsRepo.setLatestVersionState(tx, tenantId, locked.campaignId, to);
    }
    return row!;
  },
  async setReviewEvaluation(tx: Tx, tenantId: string, id: string, evaluationId: string | null): Promise<void> {
    await tx
      .update(campaignVersions)
      .set({ reviewEvaluationId: evaluationId })
      .where(and(eq(campaignVersions.tenantId, tenantId), eq(campaignVersions.id, id)));
  },
  async setProgress(tx: Tx, tenantId: string, id: string, progressPct: number | null): Promise<void> {
    await tx
      .update(campaignVersions)
      .set({ progressPct })
      .where(and(eq(campaignVersions.tenantId, tenantId), eq(campaignVersions.id, id)));
  },
  async setNoChange(tx: Tx, tenantId: string, id: string, noChange: boolean): Promise<void> {
    await tx.update(campaignVersions).set({ noChange }).where(and(eq(campaignVersions.tenantId, tenantId), eq(campaignVersions.id, id)));
  },
  /** Per-campaign advisory lock (13 concurrency rules). MUST be called inside a transaction. */
  async nextVersionNo(tx: Tx, tenantId: string, campaignId: string): Promise<number> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${campaignId}))`);
    const [row] = await tx
      .select({ max: sql<number | null>`max(${campaignVersions.versionNo})` })
      .from(campaignVersions)
      .where(and(eq(campaignVersions.tenantId, tenantId), eq(campaignVersions.campaignId, campaignId)));
    return (row?.max ? Number(row.max) : 0) + 1;
  },
  /** F16 — in_review/approved versions whose schedule has passed (Postgres clock, 14 §10). */
  async listExpirable(tx: Tx, tenantId: string): Promise<VersionRow[]> {
    return tx
      .select()
      .from(campaignVersions)
      .where(
        and(
          eq(campaignVersions.tenantId, tenantId),
          sql`${campaignVersions.state} in ('in_review','approved')`,
          sql`${campaignVersions.scheduledAt} < now()`,
        ),
      );
  },
};

export const messageVariantsRepo = {
  async insertBatch(
    tx: Tx,
    tenantId: string,
    versionId: string,
    variants: { key: string; selector: Record<string, unknown>; message: string; template?: MessageVariantRow['template']; contentHash: string }[],
  ): Promise<MessageVariantRow[]> {
    if (!variants.length) return [];
    return tx
      .insert(messageVariants)
      .values(variants.map((v) => ({ id: newId(), tenantId, versionId, key: v.key, selector: v.selector, message: v.message, template: v.template ?? null, contentHash: v.contentHash })))
      .returning();
  },
  async listByVersion(tx: Tx, tenantId: string, versionId: string): Promise<MessageVariantRow[]> {
    return tx
      .select()
      .from(messageVariants)
      .where(and(eq(messageVariants.tenantId, tenantId), eq(messageVariants.versionId, versionId)))
      .orderBy(messageVariants.key);
  },
};
