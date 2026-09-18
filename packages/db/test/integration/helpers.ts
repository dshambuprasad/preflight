import { createDb, repo, withTransaction, type Db, type DbHandle } from '../../src/index.js';
import { TenantConfigSchema } from '../../src/json/index.js';
import { newId } from '../../src/ids.js';

export function connect(): DbHandle {
  return createDb(process.env.DATABASE_URL!, { poolMax: 8 });
}

export async function seedTenant(db: Db, slug = `t-${newId().slice(-8)}`) {
  const tenant = await repo.tenants.create(db, { slug, name: `Tenant ${slug}`, config: TenantConfigSchema.parse({ lenderName: 'Example Finance' }) });
  const author = await repo.users.create(db, tenant.id, { email: `ops-${slug}@example.test`, displayName: 'A. Rao', roles: ['operator'], passwordHash: null });
  const reviewer = await repo.users.create(db, tenant.id, { email: `review-${slug}@example.test`, displayName: 'R. Mehta', roles: ['reviewer'], passwordHash: null });
  const campaign = await repo.campaigns.create(db, tenant.id, { name: 'Sept EMI reminder', mode: 'live', createdBy: author.id });
  return { tenant, author, reviewer, campaign };
}

export async function seedVersion(db: Db, tenantId: string, campaignId: string, createdBy: string, rows: { externalId?: string; phone?: string | null; identityKey: string }[] = []) {
  return withTransaction(db, async (tx) => {
    const set = await repo.audienceSets.create(tx, tenantId, { source: 'inline', uploadId: null, rowCount: rows.length, setHash: 'set-hash', createdBy });
    await repo.audience.insertBatch(
      tx,
      tenantId,
      set.id,
      rows.map((r, i) => ({ rowNo: i + 1, externalId: r.externalId ?? null, raw: { phone: r.phone ?? '' }, phoneE164: r.phone ?? null, identityKey: r.identityKey, identityHmac: `hmac:${r.identityKey}` })),
    );
    const versionNo = await repo.versions.nextVersionNo(tx, tenantId, campaignId);
    const version = await repo.versions.create(tx, tenantId, {
      campaignId, versionNo, message: 'Your EMI is overdue.', channel: 'whatsapp', scheduledAt: new Date('2026-09-14T14:45:00Z'),
      purpose: 'collections', configSnapshot: TenantConfigSchema.parse({ lenderName: 'Example Finance' }), audienceSetId: set.id,
      audienceHash: 'aud-hash', contentHash: 'content-hash', createdBy,
    });
    return { set, version };
  });
}

/** drizzle wraps driver errors ("Failed query: …") and keeps the Postgres message in `cause`. */
export async function rejectsWith(p: Promise<unknown>, re: RegExp): Promise<void> {
  try {
    await p;
  } catch (e) {
    const err = e as { cause?: { message?: string; code?: string }; message?: string };
    const msg = `${err.cause?.code ?? ''} ${err.cause?.message ?? ''} ${err.message ?? ''}`;
    if (re.test(msg)) return;
    throw new Error(`expected rejection matching /${re.source}/ but got: ${msg}`);
  }
  throw new Error(`expected a rejection matching /${re.source}/`);
}
