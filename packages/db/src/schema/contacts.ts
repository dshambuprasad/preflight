import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { channelEnum, consentStateEnum, eventKindEnum, identifierKindEnum, purposeEnum } from './enums.js';
import { citext, id, ts, tsNow } from './columns.js';
import { tenants } from './tenancy.js';

/** The tenant's resolved people (03 §3). */
export const contacts = pgTable(
  'contacts',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    identityKey: text('identity_key').notNull(),
    phoneE164: text('phone_e164'),
    emailNorm: citext('email_norm'),
    preferredLanguage: text('preferred_language'),
    attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
    firstSeenAt: tsNow('first_seen_at'),
    lastSeenAt: tsNow('last_seen_at'),
  },
  (t) => [uniqueIndex('contacts_tenant_identity_uq').on(t.tenantId, t.identityKey)],
);

/** D26 — many identifiers per contact (recycled/shared mobiles); erasure tombstones the value (D31). */
export const contactIdentifiers = pgTable(
  'contact_identifiers',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    contactId: uuid('contact_id').notNull().references(() => contacts.id),
    kind: identifierKindEnum('kind').notNull(),
    value: text('value'),
    observedAt: tsNow('observed_at'),
    erasedAt: ts('erased_at'),
  },
  (t) => [
    uniqueIndex('contact_identifiers_tenant_kind_value_uq').on(t.tenantId, t.kind, t.value),
    index('contact_identifiers_tenant_contact_idx').on(t.tenantId, t.contactId),
  ],
);

/** Purpose-scoped, append-only (withdrawal is a new row). No UPDATE/DELETE (trigger). */
export const consentRecords = pgTable(
  'consent_records',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    contactId: uuid('contact_id').notNull().references(() => contacts.id),
    /** promotional · service · collections · promotional:<product> */
    purpose: text('purpose').notNull(),
    channel: channelEnum('channel'),
    state: consentStateEnum('state').notNull(),
    source: text('source').notNull(),
    recordedAt: ts('recorded_at').notNull(),
    receivedAt: tsNow('received_at'),
    evidence: jsonb('evidence').$type<Record<string, unknown>>(),
    /** 22 A10 */
    expiresAt: ts('expires_at'),
    contractEndedAt: ts('contract_ended_at'),
  },
  (t) => [index('consent_records_current_idx').on(t.tenantId, t.contactId, t.purpose, t.recordedAt.desc())],
);

/** Every known touch (03 §3). Partition-ready by (tenant_id, month) from M6. */
export const contactEvents = pgTable(
  'contact_events',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    contactId: uuid('contact_id').notNull().references(() => contacts.id),
    kind: eventKindEnum('kind').notNull(),
    channel: channelEnum('channel').notNull(),
    purpose: purposeEnum('purpose'),
    occurredAt: ts('occurred_at').notNull(),
    /** handoff · connector:wati · shadow_import · callback */
    source: text('source').notNull(),
    campaignVersionId: uuid('campaign_version_id'),
    externalRef: text('external_ref'),
  },
  (t) => [
    index('contact_events_window_idx').on(t.tenantId, t.contactId, t.occurredAt.desc()),
    uniqueIndex('contact_events_source_ref_uq').on(t.source, t.externalRef),
  ],
);
