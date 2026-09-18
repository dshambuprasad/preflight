import { boolean, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { TenantConfig } from '@preflight/core';
import { roleEnum } from './enums.js';
import { bytea, citext, id, ts, tsNow } from './columns.js';

export const tenants = pgTable('tenants', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  config: jsonb('config').$type<TenantConfig>().notNull(),
  sealingFrozen: boolean('sealing_frozen').notNull().default(false),
  frozenReason: text('frozen_reason'),
  /** D31/D50 — per-tenant HMAC key for identity hashes, sealed under PREFLIGHT_KMS_KEY (AES-256-GCM). */
  identityHmacKeyEnc: bytea('identity_hmac_key_enc'),
  identityHmacKeyIv: bytea('identity_hmac_key_iv'),
  createdAt: tsNow('created_at'),
});

export const users = pgTable(
  'users',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    email: citext('email').notNull(),
    displayName: text('display_name').notNull(),
    roles: roleEnum('roles').array().notNull(),
    /** argon2id; hashing lives in apps/api auth/hash.ts (17). */
    passwordHash: text('password_hash'),
    createdAt: tsNow('created_at'),
  },
  (t) => [uniqueIndex('users_tenant_email_uq').on(t.tenantId, t.email)],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    /** the key acts *as* this user */
    userId: uuid('user_id').notNull().references(() => users.id),
    /** first 12 chars of the plaintext, for lookup; the secret half is argon2id-hashed in key_hash */
    keyPrefix: text('key_prefix').notNull(),
    keyHash: text('key_hash').notNull(),
    label: text('label').notNull(),
    createdAt: tsNow('created_at'),
    revokedAt: ts('revoked_at'),
  },
  (t) => [uniqueIndex('api_keys_prefix_uq').on(t.keyPrefix), index('api_keys_tenant_idx').on(t.tenantId)],
);
