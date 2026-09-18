import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { InvalidTransition, repo, withTransaction, type DbHandle } from '../../src/index.js';
import { connect, rejectsWith, seedTenant, seedVersion } from './helpers.js';

let h: DbHandle;
beforeAll(() => { h = connect(); });
afterAll(() => h.close());

describe('version-immutable (11 §3.7)', () => {
  it('UPDATE of a non-state column raises; setState works', async () => {
    const { tenant, author, campaign } = await seedTenant(h.db);
    const { version } = await seedVersion(h.db, tenant.id, campaign.id, author.id);
    await rejectsWith(h.db.execute(sql`update campaign_versions set message = 'edited' where id = ${version.id}`), /immutable/);
    await rejectsWith(h.db.execute(sql`update campaign_versions set scheduled_at = now() where id = ${version.id}`), /immutable/);
    await rejectsWith(h.db.execute(sql`delete from campaign_versions where id = ${version.id}`), /forbidden/);
    const v2 = await withTransaction(h.db, (tx) => repo.versions.setState(tx, tenant.id, version.id, 'draft', 'resolving'));
    expect(v2.state).toBe('resolving');
    const c = await repo.campaigns.get(h.db, tenant.id, campaign.id);
    expect(c?.latestVersionState).toBe('resolving');
  });
});

describe('append-only tables (11 §3.8)', () => {
  it('evidence_records: UPDATE and DELETE raise', async () => {
    const { tenant, author, reviewer, campaign } = await seedTenant(h.db);
    const { version } = await seedVersion(h.db, tenant.id, campaign.id, author.id);
    const rec = await withTransaction(h.db, (tx) =>
      repo.evidence.insert(tx, tenant.id, { versionId: version.id, evaluationId: null, payload: { a: 1 }, payloadCanonical: '{"a":1}', prevHash: 'genesis', hash: 'h1', sealedBy: reviewer.id }),
    );
    expect(rec.seq).toBe(1);
    await rejectsWith(h.db.execute(sql`update evidence_records set payload_canonical = 'x' where id = ${rec.id}`), /append-only/);
    await rejectsWith(h.db.execute(sql`delete from evidence_records where id = ${rec.id}`), /append-only/);
    // second record: seq 2, and the unique (tenant_id, seq) holds
    const rec2 = await withTransaction(h.db, (tx) =>
      repo.evidence.insert(tx, tenant.id, { kind: 'chain_attestation', versionId: null, evaluationId: null, payload: {}, payloadCanonical: '{}', prevHash: 'h1', hash: 'h2', sealedBy: reviewer.id }),
    );
    expect(rec2.seq).toBe(2);
    const walked: number[] = [];
    for await (const r of repo.evidence.walk(h.db, tenant.id, 1)) walked.push(r.seq);
    expect(walked).toEqual([1, 2]);
    expect(await repo.evidence.last(h.db, tenant.id)).toEqual({ seq: 2, hash: 'h2' });
  });
  it('audit_events and consent_records: UPDATE/DELETE raise', async () => {
    const { tenant, author } = await seedTenant(h.db);
    const ev = await repo.audit.insert(h.db, tenant.id, { actorId: author.id, actorRoles: ['operator'], entityType: 'campaign', entityId: author.id, action: 'campaign.created', requestId: 'r1' });
    await rejectsWith(h.db.execute(sql`update audit_events set action = 'x' where id = ${ev.id}`), /append-only/);
    await rejectsWith(h.db.execute(sql`delete from audit_events where id = ${ev.id}`), /append-only/);
    const ids = await repo.contacts.upsertBatch(h.db, tenant.id, [{ identityKey: 'phone:+919812340001', phoneE164: '+919812340001' }]);
    const cid = ids.get('phone:+919812340001')!;
    const cr = await repo.consent.insert(h.db, tenant.id, { contactId: cid, purpose: 'promotional', channel: null, state: 'granted', source: 'upload', recordedAt: new Date('2026-01-01T00:00:00Z') });
    await rejectsWith(h.db.execute(sql`update consent_records set state = 'denied' where id = ${cr.id}`), /append-only/);
    await rejectsWith(h.db.execute(sql`delete from consent_records where id = ${cr.id}`), /append-only/);
    // withdrawal is a new row and becomes current
    await repo.consent.insert(h.db, tenant.id, { contactId: cid, purpose: 'promotional', channel: null, state: 'denied', source: 'api', recordedAt: new Date('2026-02-01T00:00:00Z') });
    expect((await repo.consent.current(h.db, tenant.id, cid, 'promotional', null))?.state).toBe('denied');
    expect((await repo.consent.bulkCurrent(h.db, tenant.id, [cid], 'promotional', null)).get(cid)?.state).toBe('denied');
  });
});

describe('self-review-forbidden (11 §3.9) — trigger', () => {
  it('raises when reviewer is the author; allows a different reviewer', async () => {
    const { tenant, author, reviewer, campaign } = await seedTenant(h.db);
    const { version } = await seedVersion(h.db, tenant.id, campaign.id, author.id);
    const sections = { audience: { outcome: 'approved' as const }, message: { outcome: 'approved' as const }, rules: { outcome: 'approved' as const }, delivery: { outcome: 'approved' as const } };
    await rejectsWith(repo.reviews.insert(h.db, tenant.id, { versionId: version.id, reviewerId: author.id, sections, outcome: 'approved' }), /forbidden-self-review/);
    const r = await repo.reviews.insert(h.db, tenant.id, { versionId: version.id, reviewerId: reviewer.id, sections, outcome: 'approved' });
    expect(r.reviewerId).toBe(reviewer.id);
  });
});

describe('versions.setState CAS', () => {
  it('rejects a wrong `from`, a forbidden pair, and lets exactly one of two concurrent writers win', async () => {
    const { tenant, author, campaign } = await seedTenant(h.db);
    const { version } = await seedVersion(h.db, tenant.id, campaign.id, author.id);
    await expect(withTransaction(h.db, (tx) => repo.versions.setState(tx, tenant.id, version.id, 'evaluated', 'in_review'))).rejects.toBeInstanceOf(InvalidTransition);
    await expect(withTransaction(h.db, (tx) => repo.versions.setState(tx, tenant.id, version.id, 'draft', 'sealed'))).rejects.toBeInstanceOf(InvalidTransition);
    const results = await Promise.allSettled([
      withTransaction(h.db, (tx) => repo.versions.setState(tx, tenant.id, version.id, 'draft', 'resolving')),
      withTransaction(h.db, (tx) => repo.versions.setState(tx, tenant.id, version.id, 'draft', 'resolving')),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
    expect(results.filter((r) => r.status === 'rejected' && r.reason instanceof InvalidTransition).length).toBe(1);
    // tenant B cannot move tenant A's version
    const other = await seedTenant(h.db);
    await expect(withTransaction(h.db, (tx) => repo.versions.setState(tx, other.tenant.id, version.id, 'resolving', 'evaluated'))).rejects.toBeInstanceOf(InvalidTransition);
  });
});

describe('versions.nextVersionNo', () => {
  it('is monotonic under 10 concurrent creators', async () => {
    const { tenant, author, campaign } = await seedTenant(h.db);
    const created = await Promise.all(Array.from({ length: 10 }, () => seedVersion(h.db, tenant.id, campaign.id, author.id)));
    const nos = created.map((c) => c.version.versionNo).sort((a, b) => a - b);
    expect(nos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect((await repo.versions.listByCampaign(h.db, tenant.id, campaign.id)).map((v) => v.versionNo)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });
});
