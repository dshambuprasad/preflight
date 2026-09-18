import { boolean, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { decisionScopeEnum, decisionTypeEnum, proposalStatusEnum, reviewOutcomeEnum, roleEnum } from './enums.js';
import { id, ts, tsNow } from './columns.js';
import { tenants, users } from './tenancy.js';
import { campaigns, campaignVersions } from './campaigns.js';
import { findings } from './evaluation.js';

/** One per human action on a finding. Append-only. */
export const decisions = pgTable(
  'decisions',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    findingId: uuid('finding_id').notNull().references(() => findings.id),
    versionId: uuid('version_id').notNull().references(() => campaignVersions.id),
    type: decisionTypeEnum('type').notNull(),
    reasonCode: text('reason_code').notNull(),
    reasonText: text('reason_text').notNull(),
    scope: decisionScopeEnum('scope').notNull(),
    expiresAt: ts('expires_at'),
    actorId: uuid('actor_id').notNull().references(() => users.id),
    /** snapshot at decision time */
    actorRoles: roleEnum('actor_roles').array().notNull(),
    resultingVersionId: uuid('resulting_version_id'),
    /** decision recorded on a finding from an older evaluation (14 §4) */
    staleEvaluation: boolean('stale_evaluation').notNull().default(false),
    createdAt: tsNow('created_at'),
  },
  (t) => [
    index('decisions_finding_idx').on(t.tenantId, t.findingId, t.createdAt),
    index('decisions_version_idx').on(t.tenantId, t.versionId),
  ],
);

export interface ReviewSections {
  audience: { outcome: 'approved' | 'rejected'; note?: string };
  message: { outcome: 'approved' | 'rejected'; note?: string };
  rules: { outcome: 'approved' | 'rejected'; note?: string };
  delivery: { outcome: 'approved' | 'rejected'; note?: string };
}

/** reviewer_id MUST ≠ version.created_by — enforced in code and by trigger (03 §5). */
export const reviews = pgTable(
  'reviews',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    versionId: uuid('version_id').notNull().references(() => campaignVersions.id),
    reviewerId: uuid('reviewer_id').notNull().references(() => users.id),
    sections: jsonb('sections').$type<ReviewSections>().notNull(),
    outcome: reviewOutcomeEnum('outcome').notNull(),
    notes: text('notes'),
    blastRadiusApproverId: uuid('blast_radius_approver_id').references(() => users.id),
    createdAt: tsNow('created_at'),
  },
  (t) => [index('reviews_version_idx').on(t.tenantId, t.versionId)],
);

/** Standing, scoped exceptions from decisions with scope ≠ this-finding (03 §5). */
export const exceptions = pgTable(
  'exceptions',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    ruleId: text('rule_id').notNull(),
    scope: decisionScopeEnum('scope').notNull(),
    campaignId: uuid('campaign_id').references(() => campaigns.id),
    decisionId: uuid('decision_id').notNull().references(() => decisions.id),
    expiresAt: ts('expires_at').notNull(),
    createdAt: tsNow('created_at'),
  },
  // SPEC-GAP: 18 §3 asks for a partial index `WHERE expires_at > now()`; Postgres rejects non-immutable
  // predicates, so this is a plain composite index — the query filters on expires_at > $asOf.
  (t) => [index('exceptions_active_idx').on(t.tenantId, t.campaignId, t.expiresAt)],
);

/** Layer D. Only reason_code = 'rule-is-wrong' decisions feed this. */
export const ruleProposals = pgTable(
  'rule_proposals',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    ruleId: text('rule_id').notNull(),
    decisionIds: uuid('decision_ids').array().notNull(),
    proposal: jsonb('proposal').$type<Record<string, unknown>>().notNull(),
    status: proposalStatusEnum('status').notNull().default('open'),
    createdAt: tsNow('created_at'),
  },
  (t) => [index('rule_proposals_tenant_rule_idx').on(t.tenantId, t.ruleId)],
);
