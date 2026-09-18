import { bigint, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { evidenceKindEnum, roleEnum } from './enums.js';
import { id, tsNow } from './columns.js';
import { tenants, users } from './tenancy.js';
import { campaignVersions } from './campaigns.js';
import { evaluations } from './evaluation.js';

/** Append-only, hash-chained per tenant. Trigger forbids UPDATE and DELETE (03 §6). */
export const evidenceRecords = pgTable(
  'evidence_records',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    /** monotonic per tenant */
    seq: bigint('seq', { mode: 'number' }).notNull(),
    kind: evidenceKindEnum('kind').notNull().default('seal'),
    /** exactly one record per sealed version; null for chain_attestation rows */
    versionId: uuid('version_id').references(() => campaignVersions.id),
    evaluationId: uuid('evaluation_id').references(() => evaluations.id),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    /** RFC 8785 canonical JSON of payload */
    payloadCanonical: text('payload_canonical').notNull(),
    prevHash: text('prev_hash').notNull(),
    /** sha256(prev_hash + '\n' + payload_canonical) (05 §7) */
    hash: text('hash').notNull(),
    sealedBy: uuid('sealed_by').notNull().references(() => users.id),
    sealedAt: tsNow('sealed_at'),
  },
  (t) => [
    uniqueIndex('evidence_records_tenant_seq_uq').on(t.tenantId, t.seq),
    uniqueIndex('evidence_records_version_uq').on(t.versionId),
  ],
);

/** Running history of everything. Append-only (trigger). */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    /** null for system */
    actorId: uuid('actor_id'),
    actorRoles: roleEnum('actor_roles').array().notNull().default([]),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    /** string catalogue in 15 §5 */
    action: text('action').notNull(),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    requestId: text('request_id').notNull(),
    createdAt: tsNow('created_at'),
  },
  (t) => [
    index('audit_events_entity_idx').on(t.tenantId, t.entityType, t.entityId, t.createdAt.desc()),
    index('audit_events_tenant_created_idx').on(t.tenantId, t.createdAt.desc()),
  ],
);

