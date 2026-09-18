import { index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { capabilityEnum, connectorKindEnum, connectorStatusEnum, handoffTargetEnum, pushStatusEnum } from './enums.js';
import { bytea, id, ts, tsNow } from './columns.js';
import { tenants, users } from './tenancy.js';
import { campaignVersions } from './campaigns.js';

/** F8a — blast-radius co-sign codes (15 §2). */
export const cosignRequests = pgTable(
  'cosign_requests',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    versionId: uuid('version_id').notNull().references(() => campaignVersions.id),
    /** 6 digits; unique among unexpired per tenant (enforced in code) */
    code: text('code').notNull(),
    requestedBy: uuid('requested_by').notNull().references(() => users.id),
    approvedBy: uuid('approved_by').references(() => users.id),
    /** single-use; argon2id */
    tokenHash: text('token_hash'),
    /** code TTL 30 min; token TTL 10 min from approval */
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
    /** C1 — max 5 attempts per code (M1) */
    attempts: integer('attempts').notNull().default(0),
    createdAt: tsNow('created_at'),
  },
  (t) => [index('cosign_requests_tenant_code_idx').on(t.tenantId, t.code, t.expiresAt)],
);

export const connectors = pgTable(
  'connectors',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    kind: connectorKindEnum('kind').notNull(),
    label: text('label').notNull(),
    status: connectorStatusEnum('status').notNull().default('active'),
    capabilities: capabilityEnum('capabilities').array().notNull().default([]),
    /** AES-256-GCM under PREFLIGHT_KMS_KEY; never logged, never returned */
    credentialsEnc: bytea('credentials_enc'),
    credentialsIv: bytea('credentials_iv'),
    config: jsonb('config').$type<{ suppressOptIn?: boolean; historyLookbackDays?: number }>().notNull().default({}),
    cursor: jsonb('cursor').$type<Record<string, unknown>>(),
    lastSyncAt: ts('last_sync_at'),
    lastError: text('last_error'),
    createdAt: tsNow('created_at'),
  },
  (t) => [index('connectors_tenant_idx').on(t.tenantId)],
);

export const handoffPushes = pgTable(
  'handoff_pushes',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    versionId: uuid('version_id').notNull().references(() => campaignVersions.id),
    connectorId: uuid('connector_id').notNull().references(() => connectors.id),
    target: handoffTargetEnum('target').notNull(),
    /** one row per key pushed — reversible: we record exactly what went */
    identityKey: text('identity_key').notNull(),
    status: pushStatusEnum('status').notNull().default('pending'),
    providerRef: text('provider_ref'),
    error: text('error'),
    pushedAt: tsNow('pushed_at'),
  },
  (t) => [
    uniqueIndex('handoff_pushes_version_connector_key_uq').on(t.versionId, t.connectorId, t.identityKey),
    index('handoff_pushes_tenant_version_idx').on(t.tenantId, t.versionId),
  ],
);

export const platformTemplates = pgTable(
  'platform_templates',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    connectorId: uuid('connector_id').notNull().references(() => connectors.id),
    externalId: text('external_id').notNull(),
    name: text('name').notNull(),
    /** provider vocab stored raw: APPROVED PENDING REJECTED PAUSED DISABLED */
    status: text('status').notNull(),
    category: text('category'),
    body: text('body').notNull(),
    variableCount: integer('variable_count').notNull().default(0),
    rejectionReason: text('rejection_reason'),
    fetchedAt: tsNow('fetched_at'),
  },
  (t) => [
    uniqueIndex('platform_templates_connector_external_uq').on(t.connectorId, t.externalId),
    index('platform_templates_tenant_idx').on(t.tenantId, t.connectorId),
  ],
);

/** one row per connector (15 §2) */
export const platformState = pgTable(
  'platform_state',
  {
    connectorId: uuid('connector_id').primaryKey().references(() => connectors.id),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    qualityRating: text('quality_rating'),
    messagingLimitTier: text('messaging_limit_tier'),
    nameStatus: text('name_status'),
    raw: jsonb('raw').$type<Record<string, unknown>>().notNull().default({}),
    fetchedAt: tsNow('fetched_at'),
  },
  (t) => [index('platform_state_tenant_idx').on(t.tenantId)],
);

/** Global, read-only at runtime: what rulebook hashes this deployment has seen (03 §9). */
export const rulebookVersions = pgTable('rulebook_versions', {
  hash: text('hash').primaryKey(),
  packIds: text('pack_ids').array().notNull(),
  loadedAt: tsNow('loaded_at'),
  gitRef: text('git_ref'),
  nodeCount: integer('node_count').notNull(),
  ruleCount: integer('rule_count').notNull(),
  attestation: text('attestation'),
});

/** D36 / C3 — generic idempotency middleware store; response replayed on key reuse (05 §9). */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    key: text('key').notNull(),
    /** sha256 of method + path + canonical body; a different body for the same key → 409 */
    requestHash: text('request_hash').notNull(),
    statusCode: integer('status_code').notNull(),
    response: jsonb('response').$type<unknown>().notNull(),
    createdAt: tsNow('created_at'),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.key] })],
);
