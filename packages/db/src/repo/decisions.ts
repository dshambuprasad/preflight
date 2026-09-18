import { and, asc, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import type { Tx } from '../client.js';
import { decisions, exceptions, reviews, ruleProposals } from '../schema/index.js';
import { newId } from '../ids.js';

export type DecisionRow = typeof decisions.$inferSelect;
export type DecisionInsert = Omit<typeof decisions.$inferInsert, 'tenantId' | 'id'> & { id?: string };
export type ExceptionRow = typeof exceptions.$inferSelect;
export type ReviewRow = typeof reviews.$inferSelect;
export type ReviewInsert = Omit<typeof reviews.$inferInsert, 'tenantId' | 'id'> & { id?: string };
export type RuleProposalRow = typeof ruleProposals.$inferSelect;

export const decisionsRepo = {
  async insert(tx: Tx, tenantId: string, input: DecisionInsert): Promise<DecisionRow> {
    const [row] = await tx.insert(decisions).values({ ...input, id: input.id ?? newId(), tenantId }).returning();
    return row!;
  },
  async get(tx: Tx, tenantId: string, id: string): Promise<DecisionRow | null> {
    const [row] = await tx.select().from(decisions).where(and(eq(decisions.tenantId, tenantId), eq(decisions.id, id))).limit(1);
    return row ?? null;
  },
  async listByVersion(tx: Tx, tenantId: string, versionId: string): Promise<DecisionRow[]> {
    return tx.select().from(decisions).where(and(eq(decisions.tenantId, tenantId), eq(decisions.versionId, versionId))).orderBy(asc(decisions.createdAt));
  },
  /** batched — no N+1 on the pre-flight screen (18 §2.5) */
  async listByFinding(tx: Tx, tenantId: string, findingIds: string[]): Promise<DecisionRow[]> {
    if (!findingIds.length) return [];
    return tx
      .select()
      .from(decisions)
      .where(and(eq(decisions.tenantId, tenantId), inArray(decisions.findingId, findingIds)))
      .orderBy(asc(decisions.createdAt));
  },
  /** `fix` decisions get resulting_version_id after the new version exists (F5 step 5). Append-only otherwise. */
  async setResultingVersion(tx: Tx, tenantId: string, id: string, resultingVersionId: string): Promise<void> {
    await tx.update(decisions).set({ resultingVersionId }).where(and(eq(decisions.tenantId, tenantId), eq(decisions.id, id)));
  },
};

export const exceptionsRepo = {
  /** Active = expires_at > asOf, scoped to the tenant (rule-wide) or to this campaign (D13). */
  async active(tx: Tx, tenantId: string, campaignId: string | null, asOf: Date): Promise<ExceptionRow[]> {
    const scope = campaignId ? or(isNull(exceptions.campaignId), eq(exceptions.campaignId, campaignId))! : isNull(exceptions.campaignId);
    return tx
      .select()
      .from(exceptions)
      .where(and(eq(exceptions.tenantId, tenantId), gt(exceptions.expiresAt, asOf), scope))
      .orderBy(asc(exceptions.createdAt), asc(exceptions.id));
  },
  async insert(
    tx: Tx,
    tenantId: string,
    input: { ruleId: string; scope: ExceptionRow['scope']; campaignId: string | null; decisionId: string; expiresAt: Date; id?: string },
  ): Promise<ExceptionRow> {
    const [row] = await tx.insert(exceptions).values({ ...input, id: input.id ?? newId(), tenantId }).returning();
    return row!;
  },
  /** F16-style sweep reporting: expired rows are simply ignored by `active`; nothing is deleted. */
  async expiredSince(tx: Tx, tenantId: string, since: Date, now: Date): Promise<ExceptionRow[]> {
    return tx
      .select()
      .from(exceptions)
      .where(and(eq(exceptions.tenantId, tenantId), gt(exceptions.expiresAt, since), eq(exceptions.tenantId, tenantId)))
      .then((rows) => rows.filter((r) => r.expiresAt <= now));
  },
};

export const reviewsRepo = {
  /** The trigger raises when reviewer_id = version.created_by (03 §5); the API checks first (09 §2). */
  async insert(tx: Tx, tenantId: string, input: ReviewInsert): Promise<ReviewRow> {
    const [row] = await tx.insert(reviews).values({ ...input, id: input.id ?? newId(), tenantId }).returning();
    return row!;
  },
  async getByVersion(tx: Tx, tenantId: string, versionId: string): Promise<ReviewRow | null> {
    const [row] = await tx
      .select()
      .from(reviews)
      .where(and(eq(reviews.tenantId, tenantId), eq(reviews.versionId, versionId)))
      .orderBy(desc(reviews.createdAt))
      .limit(1);
    return row ?? null;
  },
};

export const ruleProposalsRepo = {
  async upsertOpen(tx: Tx, tenantId: string, ruleId: string, decisionId: string, proposal: Record<string, unknown>): Promise<RuleProposalRow> {
    const [existing] = await tx
      .select()
      .from(ruleProposals)
      .where(and(eq(ruleProposals.tenantId, tenantId), eq(ruleProposals.ruleId, ruleId), eq(ruleProposals.status, 'open')))
      .limit(1);
    if (existing) {
      const [row] = await tx
        .update(ruleProposals)
        .set({ decisionIds: [...existing.decisionIds, decisionId], proposal })
        .where(and(eq(ruleProposals.tenantId, tenantId), eq(ruleProposals.id, existing.id)))
        .returning();
      return row!;
    }
    const [row] = await tx.insert(ruleProposals).values({ id: newId(), tenantId, ruleId, decisionIds: [decisionId], proposal }).returning();
    return row!;
  },
  async list(tx: Tx, tenantId: string): Promise<RuleProposalRow[]> {
    return tx.select().from(ruleProposals).where(eq(ruleProposals.tenantId, tenantId)).orderBy(desc(ruleProposals.createdAt));
  },
};
