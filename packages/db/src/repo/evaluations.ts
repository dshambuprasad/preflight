import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Tx } from '../client.js';
import { coverageItems, evaluations, findings } from '../schema/index.js';
import { newId } from '../ids.js';

export type EvaluationRow = typeof evaluations.$inferSelect;
export type EvaluationInsert = Omit<typeof evaluations.$inferInsert, 'tenantId' | 'id'> & { id?: string };
export type FindingRow = typeof findings.$inferSelect;
export type FindingInsert = Omit<typeof findings.$inferInsert, 'tenantId' | 'id' | 'evaluationId'> & { id?: string };
export type CoverageItemRow = typeof coverageItems.$inferSelect;
export type CoverageItemInsert = Omit<typeof coverageItems.$inferInsert, 'tenantId' | 'evaluationId'>;

export const evaluationsRepo = {
  /** Idempotent CHECK: the 4-tuple unique key (03 §4, G2). */
  async findExisting(tx: Tx, tenantId: string, versionId: string, asOf: Date, rulebookHash: string, exceptionsHash: string): Promise<EvaluationRow | null> {
    const [row] = await tx
      .select()
      .from(evaluations)
      .where(
        and(
          eq(evaluations.tenantId, tenantId),
          eq(evaluations.versionId, versionId),
          eq(evaluations.asOf, asOf),
          eq(evaluations.rulebookHash, rulebookHash),
          eq(evaluations.exceptionsHash, exceptionsHash),
        ),
      )
      .limit(1);
    return row ?? null;
  },
  /** Evaluation + findings + coverage in one statement group; the caller wraps in a transaction (F3 f). */
  async insertWithFindings(
    tx: Tx,
    tenantId: string,
    evaluation: EvaluationInsert,
    findingRows: FindingInsert[],
    coverage: CoverageItemInsert[],
  ): Promise<{ evaluation: EvaluationRow; findings: FindingRow[] }> {
    const [ev] = await tx.insert(evaluations).values({ ...evaluation, id: evaluation.id ?? newId(), tenantId }).returning();
    const inserted: FindingRow[] = [];
    for (let i = 0; i < findingRows.length; i += 500) {
      const chunk = findingRows.slice(i, i + 500);
      if (!chunk.length) continue;
      const rows = await tx.insert(findings).values(chunk.map((f) => ({ ...f, id: f.id ?? newId(), tenantId, evaluationId: ev!.id }))).returning();
      inserted.push(...rows);
    }
    if (coverage.length) {
      await tx.insert(coverageItems).values(coverage.map((c) => ({ ...c, tenantId, evaluationId: ev!.id })));
    }
    return { evaluation: ev!, findings: inserted };
  },
  async get(tx: Tx, tenantId: string, id: string): Promise<EvaluationRow | null> {
    const [row] = await tx.select().from(evaluations).where(and(eq(evaluations.tenantId, tenantId), eq(evaluations.id, id))).limit(1);
    return row ?? null;
  },
  async listByVersion(tx: Tx, tenantId: string, versionId: string): Promise<EvaluationRow[]> {
    return tx
      .select()
      .from(evaluations)
      .where(and(eq(evaluations.tenantId, tenantId), eq(evaluations.versionId, versionId)))
      .orderBy(desc(evaluations.createdAt));
  },
  /** latest non-advisory evaluation for a version */
  async latestForVersion(tx: Tx, tenantId: string, versionId: string): Promise<EvaluationRow | null> {
    const [row] = await tx
      .select()
      .from(evaluations)
      .where(and(eq(evaluations.tenantId, tenantId), eq(evaluations.versionId, versionId), eq(evaluations.advisory, false)))
      .orderBy(desc(evaluations.createdAt))
      .limit(1);
    return row ?? null;
  },
  async setRulebookHashAtSeal(tx: Tx, tenantId: string, id: string, hash: string): Promise<void> {
    await tx.update(evaluations).set({ rulebookHashAtSeal: hash }).where(and(eq(evaluations.tenantId, tenantId), eq(evaluations.id, id)));
  },
};

export const findingsRepo = {
  async get(tx: Tx, tenantId: string, id: string): Promise<FindingRow | null> {
    const [row] = await tx.select().from(findings).where(and(eq(findings.tenantId, tenantId), eq(findings.id, id))).limit(1);
    return row ?? null;
  },
  /** ordered (severity, rule_id, variant_key) via the screen index (18 §3) */
  async listByEvaluation(tx: Tx, tenantId: string, evaluationId: string): Promise<FindingRow[]> {
    return tx
      .select()
      .from(findings)
      .where(and(eq(findings.tenantId, tenantId), eq(findings.evaluationId, evaluationId)))
      .orderBy(asc(findings.severity), asc(findings.ruleId), asc(findings.variantKey));
  },
  async getMany(tx: Tx, tenantId: string, ids: string[]): Promise<FindingRow[]> {
    if (!ids.length) return [];
    return tx.select().from(findings).where(and(eq(findings.tenantId, tenantId), inArray(findings.id, ids)));
  },
};

export const coverageItemsRepo = {
  async listByEvaluation(tx: Tx, tenantId: string, evaluationId: string): Promise<CoverageItemRow[]> {
    return tx
      .select()
      .from(coverageItems)
      .where(and(eq(coverageItems.tenantId, tenantId), eq(coverageItems.evaluationId, evaluationId)))
      .orderBy(asc(coverageItems.ruleId));
  },
};
