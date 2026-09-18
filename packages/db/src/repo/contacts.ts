import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { Tx } from '../client.js';
import { consentRecords, contactEvents, contactIdentifiers, contacts } from '../schema/index.js';
import { newId } from '../ids.js';

export type ContactRow = typeof contacts.$inferSelect;
export type ContactIdentifierRow = typeof contactIdentifiers.$inferSelect;
export type ConsentRow = typeof consentRecords.$inferSelect;
export type ContactEventRow = typeof contactEvents.$inferSelect;

export const contactsRepo = {
  /** Ordered by identity_key to avoid deadlocks between concurrent versions (18 §2.2). */
  async upsertBatch(
    tx: Tx,
    tenantId: string,
    items: { identityKey: string; phoneE164?: string | null; emailNorm?: string | null; preferredLanguage?: string | null; attributes?: Record<string, unknown> }[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (!items.length) return out;
    const byKey = new Map<string, (typeof items)[number]>();
    for (const it of items) byKey.set(it.identityKey, { ...byKey.get(it.identityKey), ...it });
    const sorted = [...byKey.values()].sort((a, b) => (a.identityKey < b.identityKey ? -1 : a.identityKey > b.identityKey ? 1 : 0));
    const CHUNK = 1000;
    for (let i = 0; i < sorted.length; i += CHUNK) {
      const chunk = sorted.slice(i, i + CHUNK);
      const rows = await tx
        .insert(contacts)
        .values(
          chunk.map((c) => ({
            id: newId(),
            tenantId,
            identityKey: c.identityKey,
            phoneE164: c.phoneE164 ?? null,
            emailNorm: c.emailNorm ?? null,
            preferredLanguage: c.preferredLanguage ?? null,
            attributes: c.attributes ?? {},
          })),
        )
        .onConflictDoUpdate({
          target: [contacts.tenantId, contacts.identityKey],
          set: {
            lastSeenAt: sql`now()`,
            phoneE164: sql`coalesce(excluded.phone_e164, ${contacts.phoneE164})`,
            emailNorm: sql`coalesce(excluded.email_norm, ${contacts.emailNorm})`,
            preferredLanguage: sql`coalesce(excluded.preferred_language, ${contacts.preferredLanguage})`,
            attributes: sql`${contacts.attributes} || excluded.attributes`,
          },
        })
        .returning({ id: contacts.id, identityKey: contacts.identityKey });
      for (const r of rows) out.set(r.identityKey, r.id);
    }
    return out;
  },
  async getByIdentityKeys(tx: Tx, tenantId: string, keys: string[]): Promise<ContactRow[]> {
    if (!keys.length) return [];
    return tx.select().from(contacts).where(and(eq(contacts.tenantId, tenantId), inArray(contacts.identityKey, keys)));
  },
  async get(tx: Tx, tenantId: string, id: string): Promise<ContactRow | null> {
    const [row] = await tx.select().from(contacts).where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, id))).limit(1);
    return row ?? null;
  },
  async countAny(tx: Tx, tenantId: string): Promise<number> {
    const [row] = await tx.select({ n: sql<number>`count(*)` }).from(contacts).where(eq(contacts.tenantId, tenantId));
    return Number(row?.n ?? 0);
  },
};

export const contactIdentifiersRepo = {
  /** D26 — many-to-one; observed_at refreshed on conflict. */
  async upsertBatch(
    tx: Tx,
    tenantId: string,
    items: { contactId: string; kind: ContactIdentifierRow['kind']; value: string }[],
  ): Promise<void> {
    if (!items.length) return;
    const uniq = new Map<string, (typeof items)[number]>();
    for (const it of items) uniq.set(`${it.kind}:${it.value}`, it);
    const sorted = [...uniq.values()].sort((a, b) => `${a.kind}:${a.value}`.localeCompare(`${b.kind}:${b.value}`));
    for (let i = 0; i < sorted.length; i += 1000) {
      await tx
        .insert(contactIdentifiers)
        .values(sorted.slice(i, i + 1000).map((it) => ({ id: newId(), tenantId, contactId: it.contactId, kind: it.kind, value: it.value })))
        .onConflictDoUpdate({
          target: [contactIdentifiers.tenantId, contactIdentifiers.kind, contactIdentifiers.value],
          set: { observedAt: sql`now()`, contactId: sql`excluded.contact_id` },
        });
    }
  },
  async listByContact(tx: Tx, tenantId: string, contactId: string): Promise<ContactIdentifierRow[]> {
    return tx.select().from(contactIdentifiers).where(and(eq(contactIdentifiers.tenantId, tenantId), eq(contactIdentifiers.contactId, contactId)));
  },
};

export const consentRepo = {
  /** Current consent = latest by recorded_at for (contact, purpose, channel-or-null) (03 §3). */
  async current(tx: Tx, tenantId: string, contactId: string, purpose: string, channel: ConsentRow['channel']): Promise<ConsentRow | null> {
    const conds = [eq(consentRecords.tenantId, tenantId), eq(consentRecords.contactId, contactId), eq(consentRecords.purpose, purpose)];
    conds.push(channel ? sql`(${consentRecords.channel} = ${channel} or ${consentRecords.channel} is null)` : sql`${consentRecords.channel} is null`);
    const [row] = await tx.select().from(consentRecords).where(and(...conds)).orderBy(desc(consentRecords.recordedAt)).limit(1);
    return row ?? null;
  },
  /** One query per 5,000 contacts using DISTINCT ON (18 §2.2). */
  async bulkCurrent(tx: Tx, tenantId: string, contactIds: string[], purpose: string, channel: ConsentRow['channel']): Promise<Map<string, ConsentRow>> {
    const out = new Map<string, ConsentRow>();
    for (let i = 0; i < contactIds.length; i += 5000) {
      const ids = contactIds.slice(i, i + 5000);
      if (!ids.length) continue;
      const rows = await tx.execute(sql`
        select distinct on (contact_id) * from consent_records
        where tenant_id = ${tenantId} and contact_id in (${sql.join(ids.map((x) => sql`${x}`), sql`, `)})
          and purpose = ${purpose}
          and (${channel ? sql`channel = ${channel} or channel is null` : sql`channel is null`})
        order by contact_id, recorded_at desc
      `);
      for (const r of rows.rows as Record<string, unknown>[]) {
        out.set(String(r.contact_id), {
          id: String(r.id),
          tenantId: String(r.tenant_id),
          contactId: String(r.contact_id),
          purpose: String(r.purpose),
          channel: (r.channel as ConsentRow['channel']) ?? null,
          state: r.state as ConsentRow['state'],
          source: String(r.source),
          recordedAt: new Date(r.recorded_at as string),
          receivedAt: new Date(r.received_at as string),
          evidence: (r.evidence as ConsentRow['evidence']) ?? null,
          expiresAt: r.expires_at ? new Date(r.expires_at as string) : null,
          contractEndedAt: r.contract_ended_at ? new Date(r.contract_ended_at as string) : null,
        });
      }
    }
    return out;
  },
  async insert(
    tx: Tx,
    tenantId: string,
    input: { contactId: string; purpose: string; channel: ConsentRow['channel']; state: ConsentRow['state']; source: string; recordedAt: Date; evidence?: Record<string, unknown> | null; expiresAt?: Date | null; contractEndedAt?: Date | null },
  ): Promise<ConsentRow> {
    const [row] = await tx.insert(consentRecords).values({ ...input, id: newId(), tenantId, evidence: input.evidence ?? null }).returning();
    return row!;
  },
  async countAny(tx: Tx, tenantId: string): Promise<number> {
    const [row] = await tx.select({ n: sql<number>`count(*)` }).from(consentRecords).where(eq(consentRecords.tenantId, tenantId));
    return Number(row?.n ?? 0);
  },
};

export const eventsRepo = {
  /** Idempotent on (source, external_ref) (F13). Returns inserted count. */
  async insertBatch(
    tx: Tx,
    tenantId: string,
    events: { contactId: string; kind: ContactEventRow['kind']; channel: ContactEventRow['channel']; purpose?: ContactEventRow['purpose']; occurredAt: Date; source: string; campaignVersionId?: string | null; externalRef?: string | null }[],
  ): Promise<number> {
    let n = 0;
    for (let i = 0; i < events.length; i += 1000) {
      const chunk = events.slice(i, i + 1000);
      if (!chunk.length) continue;
      const rows = await tx
        .insert(contactEvents)
        .values(chunk.map((e) => ({ ...e, id: newId(), tenantId, purpose: e.purpose ?? null, campaignVersionId: e.campaignVersionId ?? null, externalRef: e.externalRef ?? null })))
        .onConflictDoNothing({ target: [contactEvents.source, contactEvents.externalRef] })
        .returning({ id: contactEvents.id });
      n += rows.length;
    }
    return n;
  },
  async window(tx: Tx, tenantId: string, contactId: string, from: Date, to: Date): Promise<ContactEventRow[]> {
    return tx
      .select()
      .from(contactEvents)
      .where(and(eq(contactEvents.tenantId, tenantId), eq(contactEvents.contactId, contactId), gte(contactEvents.occurredAt, from), lt(contactEvents.occurredAt, to)))
      .orderBy(desc(contactEvents.occurredAt));
  },
  /** One query per evaluation (18 §2.3). */
  async windowBulk(tx: Tx, tenantId: string, contactIds: string[], from: Date, to: Date): Promise<Map<string, ContactEventRow[]>> {
    const out = new Map<string, ContactEventRow[]>();
    for (let i = 0; i < contactIds.length; i += 5000) {
      const ids = contactIds.slice(i, i + 5000);
      if (!ids.length) continue;
      const rows = await tx
        .select()
        .from(contactEvents)
        .where(and(eq(contactEvents.tenantId, tenantId), inArray(contactEvents.contactId, ids), gte(contactEvents.occurredAt, from), lt(contactEvents.occurredAt, to)))
        .orderBy(asc(contactEvents.contactId), desc(contactEvents.occurredAt));
      for (const r of rows) {
        const list = out.get(r.contactId) ?? [];
        list.push(r);
        out.set(r.contactId, list);
      }
    }
    return out;
  },
  async earliest(tx: Tx, tenantId: string): Promise<Date | null> {
    const [row] = await tx.select({ min: sql<Date | null>`min(${contactEvents.occurredAt})` }).from(contactEvents).where(eq(contactEvents.tenantId, tenantId));
    return row?.min ? new Date(row.min) : null;
  },
  async countAny(tx: Tx, tenantId: string): Promise<number> {
    const [row] = await tx.select({ n: sql<number>`count(*)` }).from(contactEvents).where(eq(contactEvents.tenantId, tenantId));
    return Number(row?.n ?? 0);
  },
};
