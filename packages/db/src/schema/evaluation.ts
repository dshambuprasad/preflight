import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { Citation, Classification, Coverage, Summary, SuggestedFix, What } from '@preflight/core';
import { coverageStatusEnum, findingCategoryEnum, purposeEnum, severityEnum } from './enums.js';
import { id, ts, tsNow } from './columns.js';
import { tenants } from './tenancy.js';
import { campaignVersions } from './campaigns.js';

export const evaluations = pgTable(
  'evaluations',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    versionId: uuid('version_id').notNull().references(() => campaignVersions.id),
    /** the instant rules were evaluated *for* */
    asOf: ts('as_of').notNull(),
    rulebookHash: text('rulebook_hash').notNull(),
    rulePackIds: text('rule_pack_ids').array().notNull(),
    classification: jsonb('classification').$type<Classification>().notNull(),
    effectivePurpose: purposeEnum('effective_purpose').notNull(),
    coverage: jsonb('coverage').$type<Coverage>().notNull(),
    /** { blockers, warnings, info, cannotEvaluate, audienceSize, verdict: null } — no verdict, ever */
    summary: jsonb('summary').$type<Summary>().notNull(),
    engineVersion: text('engine_version').notNull(),
    durationMs: integer('duration_ms').notNull(),
    /** sha256 of active exception ids at evaluation time (G2) */
    exceptionsHash: text('exceptions_hash').notNull(),
    /** set by SEAL when the rulebook moved between evaluate and seal (14 §3) */
    rulebookHashAtSeal: text('rulebook_hash_at_seal'),
    /** re-evaluation of an approved/sealed version: stored, never sealed (F4) */
    advisory: boolean('advisory').notNull().default(false),
    createdAt: tsNow('created_at'),
  },
  (t) => [
    uniqueIndex('evaluations_idempotent_uq').on(t.versionId, t.asOf, t.rulebookHash, t.exceptionsHash),
    index('evaluations_tenant_version_idx').on(t.tenantId, t.versionId, t.createdAt.desc()),
  ],
);

export const findings = pgTable(
  'findings',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    evaluationId: uuid('evaluation_id').notNull().references(() => evaluations.id),
    ruleId: text('rule_id').notNull(),
    severity: severityEnum('severity').notNull(),
    category: findingCategoryEnum('category').notNull(),
    title: text('title').notNull(),
    explanation: text('explanation').notNull(),
    what: jsonb('what').$type<What>().notNull(),
    suggestedFix: jsonb('suggested_fix').$type<SuggestedFix>(),
    affectedCount: integer('affected_count').notNull(),
    /** capped at 50,000 (18 §2.3); beyond that affected_rows_truncated=true and rows are paged by query */
    affectedRowIds: uuid('affected_row_ids').array().notNull(),
    affectedSample: text('affected_sample').array().notNull(),
    affectedRowsTruncated: boolean('affected_rows_truncated').notNull().default(false),
    citation: jsonb('citation').$type<Citation>().notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    variantKey: text('variant_key').notNull().default('default'),
    suppressedBy: uuid('suppressed_by'),
    createdAt: tsNow('created_at'),
  },
  (t) => [index('findings_screen_idx').on(t.tenantId, t.evaluationId, t.severity, t.ruleId)],
);

/** Normalised from evaluations.coverage for the radar (03 §4). */
export const coverageItems = pgTable(
  'coverage_items',
  {
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    evaluationId: uuid('evaluation_id').notNull().references(() => evaluations.id),
    ruleId: text('rule_id').notNull(),
    status: coverageStatusEnum('status').notNull(),
    missing: text('missing').array().notNull().default([]),
    reason: text('reason'),
  },
  (t) => [primaryKey({ columns: [t.evaluationId, t.ruleId] }), index('coverage_items_tenant_idx').on(t.tenantId, t.evaluationId)],
);
