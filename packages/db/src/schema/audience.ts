import { bigint, index, integer, jsonb, pgTable, text, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { audienceSetSourceEnum, consentStateEnum } from './enums.js';
import { citext, id, ts, tsNow } from './columns.js';
import { tenants, users } from './tenancy.js';

export const uploads = pgTable(
  'uploads',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    bytes: bigint('bytes', { mode: 'number' }).notNull(),
    /** v1: Postgres bytea ref / prod: object-store key */
    storageRef: text('storage_ref'),
    columnMapping: jsonb('column_mapping').$type<Record<string, unknown>>(),
    rowCount: integer('row_count').notNull().default(0),
    /** retained after raw deletion (18 §4) */
    sha256: text('sha256'),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: tsNow('created_at'),
    deletedAt: ts('deleted_at'),
  },
  (t) => [index('uploads_tenant_idx').on(t.tenantId, t.createdAt.desc())],
);

/** D27 — immutable row store; versions reference a set plus exclusions. Rows are never copied by a fix. */
export const audienceSets = pgTable(
  'audience_sets',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    uploadId: uuid('upload_id').references(() => uploads.id),
    source: audienceSetSourceEnum('source').notNull(),
    rowCount: integer('row_count').notNull(),
    /** sha256 over HMAC(tenant_key, identity_key) per row in row order (D31/D50) */
    setHash: text('set_hash').notNull(),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: tsNow('created_at'),
  },
  (t) => [index('audience_sets_tenant_idx').on(t.tenantId, t.createdAt.desc())],
);

/** One per uploaded row per set. Immutable except the RESOLVE columns and erasure tombstones (D31). */
export const audienceRows = pgTable(
  'audience_rows',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    setId: uuid('set_id').notNull().references(() => audienceSets.id),
    rowNo: integer('row_no').notNull(),
    externalId: text('external_id'),
    /** every column as uploaded; nulled on erasure */
    raw: jsonb('raw').$type<Record<string, string>>(),
    phoneE164: text('phone_e164'),
    emailNorm: citext('email_norm'),
    /** ext:<id> | phone:<e164> | email:<norm> | row:<id> (05 §3, D26) */
    identityKey: text('identity_key').notNull(),
    /** HMAC-SHA256(tenant key, identity_key) — what hashes and certificates use (D31) */
    identityHmac: text('identity_hmac').notNull(),
    preferredLanguage: text('preferred_language'),
    consentPromotional: consentStateEnum('consent_promotional'),
    /** upload · consent_records · upload:conflict · records:later-withdrawal (15 §2) */
    consentSource: text('consent_source'),
    duplicateOfRowId: uuid('duplicate_of_row_id').references((): AnyPgColumn => audienceRows.id),
    erasedAt: ts('erased_at'),
  },
  (t) => [
    uniqueIndex('audience_rows_tenant_set_rowno_uq').on(t.tenantId, t.setId, t.rowNo),
    index('audience_rows_tenant_set_identity_idx').on(t.tenantId, t.setId, t.identityKey),
    index('audience_rows_tenant_identity_idx').on(t.tenantId, t.identityKey),
  ],
);
