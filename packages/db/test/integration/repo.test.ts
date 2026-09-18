import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { repo, withTransaction, type DbHandle } from '../../src/index.js';
import { connect, rejectsWith, seedTenant, seedVersion } from './helpers.js';

let h: DbHandle;
beforeAll(() => { h = connect(); });
afterAll(() => h.close());

describe('tenant-isolation (11 §3.12) — repo level', () => {
  it('rows of tenant A are invisible through every get/list called with tenant B', async () => {
    const a = await seedTenant(h.db);
    const b = await seedTenant(h.db);
    const { set, version } = await seedVersion(h.db, a.tenant.id, a.campaign.id, a.author.id, [{ identityKey: 'phone:+919812340001', phone: '+919812340001' }]);
    const ev = await withTransaction(h.db, (tx) =>
      repo.evaluations.insertWithFindings(
        tx, a.tenant.id,
        { versionId: version.id, asOf: new Date('2026-09-14T14:45:00Z'), rulebookHash: 'rb', rulePackIds: ['india-layer-a'], classification: { classification: 'service', evaluateAs: 'service', confidence: 'high', promotionalMarkers: [], serviceMarkers: ['emi'], reason: 'x' }, effectivePurpose: 'collections', coverage: { rulesInBook: 1, applicable: 1, evaluated: 1, cannotEvaluate: [], notApplicable: [], statement: 's' }, summary: { blockers: 1, warnings: 0, info: 0, cannotEvaluate: 0, audienceSize: 1, verdict: null }, engineVersion: '0.1.0', durationMs: 1, exceptionsHash: 'none' },
        [{ ruleId: 'A-RBI-001', severity: 'block', category: 'timing', title: 't', explanation: 'e', what: { kind: 'schedule' }, suggestedFix: null, affectedCount: 1, affectedRowIds: [], affectedSample: ['r1'], citation: { instrument: 'i', title: 't', confidence: 'SECONDARY', graphNodeId: 'inst:x' } }],
        [{ ruleId: 'A-RBI-001', status: 'evaluated', missing: [] }],
      ),
    );
    const dec = await repo.decisions.insert(h.db, a.tenant.id, { findingId: ev.findings[0]!.id, versionId: version.id, type: 'accept', reasonCode: 'one-time-exception', reasonText: 'because reasons', scope: 'this-campaign', expiresAt: new Date('2026-10-01T00:00:00Z'), actorId: a.reviewer.id, actorRoles: ['reviewer'] });
    const exc = await repo.exceptions.insert(h.db, a.tenant.id, { ruleId: 'A-RBI-001', scope: 'this-campaign', campaignId: a.campaign.id, decisionId: dec.id, expiresAt: new Date('2026-10-01T00:00:00Z') });
    await repo.audit.insert(h.db, a.tenant.id, { actorId: null, actorRoles: [], entityType: 'version', entityId: version.id, action: 'version.created', requestId: 'r' });
    await repo.idempotency.put(h.db, a.tenant.id, { key: 'k1', requestHash: 'h', statusCode: 201, response: { ok: true } });

    const B = b.tenant.id;
    expect(await repo.campaigns.get(h.db, B, a.campaign.id)).toBeNull();
    expect((await repo.campaigns.list(h.db, B)).items.map((c) => c.id)).not.toContain(a.campaign.id);
    expect(await repo.versions.get(h.db, B, version.id)).toBeNull();
    expect(await repo.versions.listByCampaign(h.db, B, a.campaign.id)).toEqual([]);
    expect(await repo.audienceSets.get(h.db, B, set.id)).toBeNull();
    expect(await repo.audience.list(h.db, B, set.id)).toEqual([]);
    expect(await repo.evaluations.get(h.db, B, ev.evaluation.id)).toBeNull();
    expect(await repo.evaluations.listByVersion(h.db, B, version.id)).toEqual([]);
    expect(await repo.findings.get(h.db, B, ev.findings[0]!.id)).toBeNull();
    expect(await repo.findings.listByEvaluation(h.db, B, ev.evaluation.id)).toEqual([]);
    expect(await repo.coverageItems.listByEvaluation(h.db, B, ev.evaluation.id)).toEqual([]);
    expect(await repo.decisions.get(h.db, B, dec.id)).toBeNull();
    expect(await repo.decisions.listByVersion(h.db, B, version.id)).toEqual([]);
    expect(await repo.exceptions.active(h.db, B, a.campaign.id, new Date('2026-09-14T00:00:00Z'))).toEqual([]);
    expect(await repo.reviews.getByVersion(h.db, B, version.id)).toBeNull();
    expect((await repo.audit.list(h.db, B)).items).toEqual([]);
    expect(await repo.users.get(h.db, B, a.author.id)).toBeNull();
    expect((await repo.users.list(h.db, B)).map((u) => u.id)).not.toContain(a.author.id);
    expect(await repo.idempotency.get(h.db, B, 'k1')).toBeNull();
    expect(await repo.contacts.getByIdentityKeys(h.db, B, ['phone:+919812340001'])).toEqual([]);
    // and tenant A sees its own
    expect((await repo.exceptions.active(h.db, a.tenant.id, a.campaign.id, new Date('2026-09-14T00:00:00Z'))).map((e) => e.id)).toEqual([exc.id]);
    expect(await repo.exceptions.active(h.db, a.tenant.id, a.campaign.id, new Date('2026-11-01T00:00:00Z'))).toEqual([]); // expired
    expect((await repo.idempotency.get(h.db, a.tenant.id, 'k1'))?.statusCode).toBe(201);
  });
});

describe('evaluations.findExisting — 4-tuple idempotency (03 §4)', () => {
  it('returns the existing row for identical inputs and refuses a duplicate insert', async () => {
    const { tenant, author, campaign } = await seedTenant(h.db);
    const { version } = await seedVersion(h.db, tenant.id, campaign.id, author.id);
    const asOf = new Date('2026-09-14T14:45:00Z');
    const base = { versionId: version.id, asOf, rulebookHash: 'rb', rulePackIds: [], classification: { classification: 'unknown', evaluateAs: 'promotional', confidence: 'low', promotionalMarkers: [], serviceMarkers: [], reason: '' }, effectivePurpose: 'promotional' as const, coverage: { rulesInBook: 0, applicable: 0, evaluated: 0, cannotEvaluate: [], notApplicable: [], statement: '' }, summary: { blockers: 0, warnings: 0, info: 0, cannotEvaluate: 0, audienceSize: 0, verdict: null }, engineVersion: '0', durationMs: 0, exceptionsHash: 'e1' };
    const first = await withTransaction(h.db, (tx) => repo.evaluations.insertWithFindings(tx, tenant.id, base, [], []));
    expect((await repo.evaluations.findExisting(h.db, tenant.id, version.id, asOf, 'rb', 'e1'))?.id).toBe(first.evaluation.id);
    expect(await repo.evaluations.findExisting(h.db, tenant.id, version.id, asOf, 'rb', 'e2')).toBeNull();
    await rejectsWith(withTransaction(h.db, (tx) => repo.evaluations.insertWithFindings(tx, tenant.id, base, [], [])), /23505|duplicate key/);
  });
});

describe('audience.markDuplicates (05 §3, 18 §2.2)', () => {
  it('marks all but the lowest row_no per identity key; row: keys are never duplicates', async () => {
    const { tenant, author, campaign } = await seedTenant(h.db);
    const { set } = await seedVersion(h.db, tenant.id, campaign.id, author.id, [
      { identityKey: 'phone:+919812340001', phone: '+919812340001' },
      { identityKey: 'phone:+919812340002', phone: '+919812340002' },
      { identityKey: 'phone:+919812340001', phone: '+919812340001' },
      { identityKey: 'row:r4' },
      { identityKey: 'row:r5' },
      { identityKey: 'phone:+919812340001', phone: '+919812340001' },
    ]);
    expect(await repo.audience.markDuplicates(h.db, tenant.id, set.id)).toBe(2);
    const rows = await repo.audience.list(h.db, tenant.id, set.id);
    const first = rows.find((r) => r.rowNo === 1)!;
    expect(rows.filter((r) => r.duplicateOfRowId).map((r) => r.rowNo)).toEqual([3, 6]);
    expect(rows.filter((r) => r.duplicateOfRowId).every((r) => r.duplicateOfRowId === first.id)).toBe(true);
    expect(await repo.audience.stats(h.db, tenant.id, set.id)).toEqual({ rows: 6, duplicates: 2, unresolvable: 2 });
    expect((await repo.audience.list(h.db, tenant.id, set.id, { excluding: [3, 6], includeDuplicates: false })).map((r) => r.rowNo)).toEqual([1, 2, 4, 5]);
    const streamed: number[] = [];
    for await (const r of repo.audience.stream(h.db, tenant.id, set.id, { pageSize: 2 })) streamed.push(r.rowNo);
    expect(streamed).toEqual([1, 2, 3, 4, 5, 6]);
    // RESOLVE columns may change; identity columns may not
    await repo.audience.setResolved(h.db, tenant.id, [{ id: first.id, preferredLanguage: 'hindi', consentPromotional: 'granted', consentSource: 'upload' }]);
    expect((await repo.audience.getMany(h.db, tenant.id, [first.id]))[0]?.preferredLanguage).toBe('hindi');
  });
});

describe('contacts.upsertBatch', () => {
  it('is idempotent, refreshes last_seen_at and keeps known fields', async () => {
    const { tenant } = await seedTenant(h.db);
    const a = await repo.contacts.upsertBatch(h.db, tenant.id, [{ identityKey: 'ext:B-1', phoneE164: '+919812340001', preferredLanguage: 'tamil' }, { identityKey: 'ext:B-2' }, { identityKey: 'ext:B-1' }]);
    expect(a.size).toBe(2);
    const before = (await repo.contacts.get(h.db, tenant.id, a.get('ext:B-1')!))!;
    await new Promise((r) => setTimeout(r, 20));
    const b = await repo.contacts.upsertBatch(h.db, tenant.id, [{ identityKey: 'ext:B-1', preferredLanguage: null }]);
    expect(b.get('ext:B-1')).toBe(a.get('ext:B-1'));
    const after = (await repo.contacts.get(h.db, tenant.id, a.get('ext:B-1')!))!;
    expect(after.lastSeenAt.getTime()).toBeGreaterThan(before.lastSeenAt.getTime());
    expect(after.firstSeenAt.getTime()).toBe(before.firstSeenAt.getTime());
    expect(after.preferredLanguage).toBe('tamil');
    expect(after.phoneE164).toBe('+919812340001');
    await repo.contactIdentifiers.upsertBatch(h.db, tenant.id, [{ contactId: after.id, kind: 'phone', value: '+919812340001' }, { contactId: after.id, kind: 'phone', value: '+919812340001' }]);
    expect((await repo.contactIdentifiers.listByContact(h.db, tenant.id, after.id)).length).toBe(1);
    expect(await repo.contacts.countAny(h.db, tenant.id)).toBe(2);
  });
});

describe('events', () => {
  it('insertBatch is idempotent on (source, external_ref); window/windowBulk/earliest', async () => {
    const { tenant } = await seedTenant(h.db);
    const ids = await repo.contacts.upsertBatch(h.db, tenant.id, [{ identityKey: 'ext:B-1' }]);
    const cid = ids.get('ext:B-1')!;
    const ev = { contactId: cid, kind: 'sent' as const, channel: 'whatsapp' as const, occurredAt: new Date('2026-09-01T10:00:00Z'), source: 'connector:wati', externalRef: 'm-1' };
    expect(await repo.events.insertBatch(h.db, tenant.id, [ev, { ...ev, externalRef: 'm-2', occurredAt: new Date('2026-09-05T10:00:00Z') }])).toBe(2);
    expect(await repo.events.insertBatch(h.db, tenant.id, [ev])).toBe(0);
    expect((await repo.events.window(h.db, tenant.id, cid, new Date('2026-09-04T00:00:00Z'), new Date('2026-09-06T00:00:00Z'))).length).toBe(1);
    expect((await repo.events.windowBulk(h.db, tenant.id, [cid], new Date('2026-08-01T00:00:00Z'), new Date('2026-10-01T00:00:00Z'))).get(cid)?.length).toBe(2);
    expect((await repo.events.earliest(h.db, tenant.id))?.toISOString()).toBe('2026-09-01T10:00:00.000Z');
  });
});

describe('idempotency & campaigns.list cursor', () => {
  it('put is first-writer-wins; list pages by cursor', async () => {
    const { tenant, author } = await seedTenant(h.db);
    const first = await repo.idempotency.put(h.db, tenant.id, { key: 'k', requestHash: 'h1', statusCode: 201, response: { n: 1 } });
    const again = await repo.idempotency.put(h.db, tenant.id, { key: 'k', requestHash: 'h2', statusCode: 500, response: { n: 2 } });
    expect(again.requestHash).toBe(first.requestHash);
    for (let i = 0; i < 5; i++) await repo.campaigns.create(h.db, tenant.id, { name: `C${i}`, mode: 'live', createdBy: author.id });
    const p1 = await repo.campaigns.list(h.db, tenant.id, { limit: 4 });
    expect(p1.items.length).toBe(4);
    expect(p1.nextCursor).not.toBeNull();
    const p2 = await repo.campaigns.list(h.db, tenant.id, { limit: 4, cursor: p1.nextCursor });
    expect(p2.items.length).toBe(2); // 5 created here + 1 from seedTenant
    expect(p2.nextCursor).toBeNull();
    expect((await repo.campaigns.list(h.db, tenant.id, { q: 'C3' })).items.map((c) => c.name)).toEqual(['C3']);
  });
});
