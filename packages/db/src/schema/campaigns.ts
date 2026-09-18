import { sql } from 'drizzle-orm';
import {
  boolean, index, integer, jsonb, pgTable, smallint, text, uniqueIndex, uuid, type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import type { TenantConfig, Template } from '@preflight/core';
import { campaignKindEnum, campaignModeEnum, channelEnum, purposeEnum, versionStateEnum } from './enums.js';
import { id, ts, tsNow } from './columns.js';
import { tenants, users } from './tenancy.js';
import { audienceSets } from './audience.js';

export const campaigns = pgTable(
  'campaigns',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    name: text('name').notNull(),
    mode: campaignModeEnum('mode').notNull(),
    kind: campaignKindEnum('kind').notNull().default('batch'),
    /** denormalised by versions.setState (18 §2.5) */
    latestVersionState: versionStateEnum('latest_version_state'),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: tsNow('created_at'),
  },
  (t) => [index('campaigns_tenant_created_idx').on(t.tenantId, t.createdAt.desc(), t.id)],
);

/**
 * Immutable after insert except state, state_changed_at, review_evaluation_id, progress_pct, no_change
 * (03 §2, 15 §2, G1) — enforced by trigger in migrations/0001_triggers.sql.
 */
export const campaignVersions = pgTable(
  'campaign_versions',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    campaignId: uuid('campaign_id').notNull().references(() => campaigns.id),
    versionNo: integer('version_no').notNull(),
    parentVersionId: uuid('parent_version_id').references((): AnyPgColumn => campaignVersions.id),
    state: versionStateEnum('state').notNull().default('draft'),
    stateChangedAt: tsNow('state_changed_at'),
    /** mirrors the `default` message variant (D28/D50) */
    message: text('message').notNull(),
    channel: channelEnum('channel').notNull(),
    scheduledAt: ts('scheduled_at').notNull(),
    /** D29 — end of the send window; null = single instant */
    sendWindowEnd: ts('send_window_end'),
    /** shadow mode only */
    sentAt: ts('sent_at'),
    purpose: purposeEnum('purpose'),
    borrowerSegment: text('borrower_segment'),
    product: text('product'),
    template: jsonb('template').$type<Template>(),
    /** the tenant config at version creation — evaluations must be reproducible */
    configSnapshot: jsonb('config_snapshot').$type<TenantConfig>().notNull(),
    /** D27 — copy-on-write audience: set − exclusions (row_no) */
    audienceSetId: uuid('audience_set_id').notNull().references(() => audienceSets.id),
    audienceExclusions: integer('audience_exclusions').array().notNull().default(sql`'{}'::integer[]`),
    /** sha256(set_hash ‖ canonical(exclusions)) — over HMAC'd identities, never PII (D31) */
    audienceHash: text('audience_hash').notNull(),
    /** sha256 of canonical (variants, channel, scheduled_at, send_window_end, purpose, segment, product, template) */
    contentHash: text('content_hash').notNull(),
    /** mutable per G1; FK to evaluations added in migrations (circular) */
    reviewEvaluationId: uuid('review_evaluation_id'),
    progressPct: smallint('progress_pct'),
    noChange: boolean('no_change').notNull().default(false),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: tsNow('created_at'),
    idempotencyKey: text('idempotency_key'),
  },
  (t) => [
    uniqueIndex('campaign_versions_tenant_campaign_no_uq').on(t.tenantId, t.campaignId, t.versionNo),
    uniqueIndex('campaign_versions_tenant_idem_uq').on(t.tenantId, t.idempotencyKey),
    index('campaign_versions_expiry_idx')
      .on(t.tenantId, t.state, t.scheduledAt)
      .where(sql`state IN ('in_review', 'approved')`),
    index('campaign_versions_tenant_campaign_idx').on(t.tenantId, t.campaignId),
  ],
);

/** 21 §2 / D28 — message variants; `default` is the only key until M5. Immutable. */
export const messageVariants = pgTable(
  'message_variants',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    versionId: uuid('version_id').notNull().references(() => campaignVersions.id),
    key: text('key').notNull(),
    selector: jsonb('selector').$type<Record<string, unknown>>().notNull(),
    message: text('message').notNull(),
    template: jsonb('template').$type<Template>(),
    contentHash: text('content_hash').notNull(),
  },
  (t) => [uniqueIndex('message_variants_version_key_uq').on(t.versionId, t.key), index('message_variants_tenant_idx').on(t.tenantId, t.versionId)],
);
