// Row → API shape (06 §1). Never computes severity; displays what CHECK stored (16 §5).
import { repo, type Db, type EvaluationRow, type FindingRow, type UserRow, type VersionRow } from '@preflight/db';
import type { z } from 'zod';
import type { Finding, UserRef, VersionSummary } from '../schemas/index.js';

export const userRef = (u: Pick<UserRow, 'id' | 'displayName' | 'roles'>): z.infer<typeof UserRef> => ({ id: u.id, displayName: u.displayName, roles: u.roles });

export async function versionSummary(db: Db, tenantId: string, v: VersionRow, opts: { creator?: UserRow | null; latest?: EvaluationRow | null; children?: VersionRow[]; audienceSize?: number; configDrift?: boolean } = {}): Promise<z.infer<typeof VersionSummary>> {
  const creator = opts.creator ?? (await repo.users.get(db, tenantId, v.createdBy));
  const latest = opts.latest === undefined ? await repo.evaluations.latestForVersion(db, tenantId, v.id) : opts.latest;
  const children = opts.children ?? (await repo.versions.children(db, tenantId, v.id));
  const audienceSize = opts.audienceSize ?? (await repo.audience.stats(db, tenantId, v.audienceSetId, v.audienceExclusions)).rows;
  return {
    id: v.id,
    campaignId: v.campaignId,
    versionNo: v.versionNo,
    parentVersionId: v.parentVersionId,
    state: v.state,
    stateChangedAt: v.stateChangedAt.toISOString(),
    channel: v.channel,
    scheduledAt: v.scheduledAt.toISOString(),
    sendWindowEnd: v.sendWindowEnd?.toISOString() ?? null,
    sentAt: v.sentAt?.toISOString() ?? null,
    purpose: v.purpose,
    borrowerSegment: v.borrowerSegment,
    product: v.product,
    audienceSize,
    latestEvaluation: latest ? { id: latest.id, asOf: latest.asOf.toISOString(), rulebookHash: latest.rulebookHash, summary: latest.summary } : null,
    supersededBy: children.map((c) => c.id),
    progressPct: v.progressPct,
    queuePosition: null,
    configDrift: opts.configDrift ?? false,
    noChange: v.noChange,
    createdBy: creator ? userRef(creator) : { id: v.createdBy, displayName: '(deleted)', roles: [] },
    createdAt: v.createdAt.toISOString(),
  };
}

export function finding(f: FindingRow, decisions: z.infer<typeof Finding>['decisions'] = []): z.infer<typeof Finding> {
  return {
    id: f.id,
    evaluationId: f.evaluationId,
    ruleId: f.ruleId,
    severity: f.severity,
    category: f.category,
    title: f.title,
    explanation: f.explanation,
    what: f.what,
    suggestedFix: f.suggestedFix ?? null,
    affectedCount: f.affectedCount,
    affectedSample: f.affectedSample,
    affectedRowsTruncated: f.affectedRowsTruncated,
    citation: f.citation,
    suppressedBy: f.suppressedBy,
    variantKey: f.variantKey,
    decisions,
  };
}
