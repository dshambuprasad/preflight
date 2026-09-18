// F1 → F3 through the API against Postgres: the M0 "done when" (10), 05 §10 every-entry-point-gated,
// tenant isolation (11 §3.12), idempotency (D36), role guards (02 §7).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sampleCampaign, sampleRows, world, type TestWorld } from './helpers.js';

let w: TestWorld;
let A: Awaited<ReturnType<TestWorld['tenant']>>;
let B: Awaited<ReturnType<TestWorld['tenant']>>;

beforeAll(async () => {
  w = await world();
  A = await w.tenant('a');
  B = await w.tenant('b');
});
afterAll(async () => w.close());

async function createVersion(headers: Record<string, string>, campaignId: string, over: Record<string, unknown> = {}) {
  return w.app.fastify.inject({
    method: 'POST', url: `/v1/campaigns/${campaignId}/versions`, headers,
    payload: { ...sampleCampaign('collections_campaign'), scheduledAt: '2026-09-14T20:15:00+05:30', audience: { rows: sampleRows() }, ...over },
  });
}

describe('M0 pipeline', () => {
  it('demo steps 1–2: collections sample → 2 blockers, 2 warnings, 1 info, coverage stated', async () => {
    const h = await w.login(A.users.operator!.email);
    const c = await w.app.fastify.inject({ method: 'POST', url: '/v1/campaigns', headers: h, payload: { name: 'Sept EMI reminder', mode: 'live' } });
    expect(c.statusCode).toBe(201);
    const v = await createVersion(h, c.json().id);
    expect(v.statusCode).toBe(202);
    expect(v.json().version.state).toBe('resolving');
    expect(v.json().jobs).toEqual(['resolve']);
    await w.queue.drain();
    const d = await w.app.fastify.inject({ method: 'GET', url: `/v1/versions/${v.json().version.id}`, headers: h });
    expect(d.statusCode).toBe(200);
    expect(d.json().state).toBe('evaluated');
    expect(d.json().audience).toEqual({ size: 12, duplicates: 0, unresolvable: 0, consent: { granted: 6, denied: 2, unknown: 0, absent: 4 } });
    const e = await w.app.fastify.inject({ method: 'GET', url: `/v1/evaluations/${d.json().latestEvaluation.id}`, headers: h });
    expect(e.statusCode).toBe(200);
    const ev = e.json();
    expect(ev.summary).toEqual({ blockers: 2, warnings: 2, info: 1, cannotEvaluate: 3, audienceSize: 12, verdict: null });
    expect(ev.coverage.statement).toBe('Checked 9 of 12 applicable rules. 3 could not be evaluated — history.contactEvents, campaign.template.externalId, platform.templates, platform.messagingLimit.');
    expect(ev.findings.map((f: { ruleId: string }) => f.ruleId)).toEqual(['A-RBI-001', 'A-WA-003', 'A-RBI-003', 'A-RBI-011', 'A-RBI-005']);
    const lang = ev.findings.find((f: { ruleId: string }) => f.ruleId === 'A-RBI-003');
    expect(lang.affectedCount).toBe(6);
    expect(lang.citation.confidence).toBe('DERIVED');
    expect(ev.findings[0].suggestedFix.kind).toBe('reschedule');
    expect(ev.rulebookHash).toHaveLength(64);
    // determinism: re-running with the same 4-tuple reuses the evaluation
    const again = await w.app.fastify.inject({ method: 'POST', url: `/v1/versions/${v.json().version.id}/evaluate`, headers: h, payload: {} });
    expect(again.statusCode).toBe(200);
    expect(again.json().evaluationId).toBe(ev.id);
  });

  it('time-travel: asOf 2027 on the promotional sample turns two warnings into blockers', async () => {
    const h = await w.login(A.users.operator!.email);
    const c = await w.app.fastify.inject({ method: 'POST', url: '/v1/campaigns', headers: h, payload: { name: 'Top-up offer', mode: 'live' } });
    const v = await createVersion(h, c.json().id, { ...sampleCampaign('promotional_campaign'), scheduledAt: '2026-09-14T19:45:00+05:30', template: undefined, purpose: undefined, borrowerSegment: undefined });
    expect(v.statusCode).toBe(202);
    await w.queue.drain();
    const d = await w.app.fastify.inject({ method: 'GET', url: `/v1/versions/${v.json().version.id}`, headers: h });
    expect(d.json().latestEvaluation.summary.blockers).toBe(0);
    const tt = await w.app.fastify.inject({ method: 'POST', url: `/v1/versions/${v.json().version.id}/evaluate`, headers: h, payload: { asOf: '2027-01-01T10:00:00+05:30' } });
    expect(tt.statusCode).toBe(202);
    await w.queue.drain();
    const list = await w.app.fastify.inject({ method: 'GET', url: `/v1/versions/${v.json().version.id}/evaluations`, headers: h });
    const future = list.json().items.find((x: { asOf: string }) => x.asOf.startsWith('2027-01-01'));
    expect(future.summary.blockers).toBe(2);
  });

  it('every-entry-point-gated: an API-key submission lands in evaluated, never further (05 §10)', async () => {
    const { generateApiKey, hashSecret } = await import('../../src/auth/hash.js');
    const { repo } = await import('@preflight/db');
    const k = generateApiKey();
    await repo.apiKeys.create(w.handle.db, A.id, A.users.operator!.id, 'test', k.keyPrefix, await hashSecret(k.secret));
    const h = { authorization: `Bearer ${k.plaintext}` };
    const c = await w.app.fastify.inject({ method: 'POST', url: '/v1/campaigns', headers: h, payload: { name: 'via api', mode: 'live' } });
    expect(c.statusCode).toBe(201);
    const v = await createVersion(h, c.json().id);
    expect(v.statusCode).toBe(202);
    await w.queue.drain();
    const d = await w.app.fastify.inject({ method: 'GET', url: `/v1/versions/${v.json().version.id}`, headers: h });
    expect(d.json().state).toBe('evaluated');
    expect(d.json().evidence).toBeNull();
    expect(d.json().latestEvaluation.summary.blockers).toBe(2);
  });

  it('tenant-isolation: tenant B cannot read tenant A rows through any GET', async () => {
    const ha = await w.login(A.users.operator!.email);
    const hb = await w.login(B.users.operator!.email);
    const c = await w.app.fastify.inject({ method: 'POST', url: '/v1/campaigns', headers: ha, payload: { name: 'private', mode: 'live' } });
    const v = await createVersion(ha, c.json().id);
    await w.queue.drain();
    const d = await w.app.fastify.inject({ method: 'GET', url: `/v1/versions/${v.json().version.id}`, headers: ha });
    const evalId = d.json().latestEvaluation.id;
    const findingId = (await w.app.fastify.inject({ method: 'GET', url: `/v1/evaluations/${evalId}`, headers: ha })).json().findings[0].id;
    for (const url of [`/v1/campaigns/${c.json().id}`, `/v1/versions/${v.json().version.id}`, `/v1/versions/${v.json().version.id}/evaluations`, `/v1/evaluations/${evalId}`, `/v1/findings/${findingId}`]) {
      const r = await w.app.fastify.inject({ method: 'GET', url, headers: hb });
      expect(r.statusCode, url).toBe(404);
      expect(r.json().type).toBe('https://preflight.dev/errors/not-found');
    }
    const list = await w.app.fastify.inject({ method: 'GET', url: '/v1/campaigns', headers: hb });
    expect(list.json().items.some((x: { id: string }) => x.id === c.json().id)).toBe(false);
    const post = await w.app.fastify.inject({ method: 'POST', url: `/v1/campaigns/${c.json().id}/versions`, headers: hb, payload: { ...sampleCampaign('collections_campaign'), audience: { rows: sampleRows() } } });
    expect(post.statusCode).toBe(404);
  });

  it('roles: reviewer cannot create campaigns; unauthenticated gets 401; cookie mutation needs the header', async () => {
    const hr = await w.login(A.users.reviewer!.email);
    const r = await w.app.fastify.inject({ method: 'POST', url: '/v1/campaigns', headers: hr, payload: { name: 'x', mode: 'live' } });
    expect(r.statusCode).toBe(403);
    expect(r.json().type).toBe('https://preflight.dev/errors/forbidden-role');
    const u = await w.app.fastify.inject({ method: 'GET', url: '/v1/campaigns' });
    expect(u.statusCode).toBe(401);
    const noHeader = await w.app.fastify.inject({ method: 'POST', url: '/v1/campaigns', headers: { cookie: hr.cookie! }, payload: { name: 'x', mode: 'live' } });
    expect(noHeader.statusCode).toBe(403);
  });

  it('idempotency: same key + same body replays (200); different body → 409', async () => {
    const h = await w.login(A.users.operator!.email);
    const key = `idem-${Date.now()}`;
    const a = await w.app.fastify.inject({ method: 'POST', url: '/v1/campaigns', headers: { ...h, 'idempotency-key': key }, payload: { name: 'once', mode: 'live' } });
    const b = await w.app.fastify.inject({ method: 'POST', url: '/v1/campaigns', headers: { ...h, 'idempotency-key': key }, payload: { name: 'once', mode: 'live' } });
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(200);
    expect(b.json().id).toBe(a.json().id);
    const c = await w.app.fastify.inject({ method: 'POST', url: '/v1/campaigns', headers: { ...h, 'idempotency-key': key }, payload: { name: 'twice', mode: 'live' } });
    expect(c.statusCode).toBe(409);
    expect(c.json().type).toBe('https://preflight.dev/errors/idempotency-conflict');
  });

  it('validation: schedule lead time, shadow needs sentAt, voice channel rejected, > inline max', async () => {
    const h = await w.login(A.users.operator!.email);
    const c = await w.app.fastify.inject({ method: 'POST', url: '/v1/campaigns', headers: h, payload: { name: 'v', mode: 'live' } });
    const past = await createVersion(h, c.json().id, { scheduledAt: '2026-09-12T10:01:00+05:30' });
    expect(past.statusCode).toBe(400);
    expect(past.json().issues[0].path).toBe('scheduledAt');
    const voice = await createVersion(h, c.json().id, { channel: 'voice' });
    expect(voice.statusCode).toBe(400);
    const s = await w.app.fastify.inject({ method: 'POST', url: '/v1/campaigns', headers: h, payload: { name: 's', mode: 'shadow' } });
    const shadow = await createVersion(h, s.json().id);
    expect(shadow.statusCode).toBe(400);
    expect(shadow.json().issues[0].path).toBe('sentAt');
    const window = await createVersion(h, c.json().id, { scheduledAt: '2026-09-14T10:00:00+05:30', sendWindowEnd: '2026-09-14T20:00:00+05:30' });
    expect(window.statusCode).toBe(400);
    expect(window.json().issues[0].path).toBe('sendWindowEnd');
  });

  it('rulebook + health + openapi are served', async () => {
    const h = await w.login(A.users.operator!.email);
    const rb = await w.app.fastify.inject({ method: 'GET', url: '/v1/rulebook', headers: h });
    expect(rb.json().packs.map((p: { id: string; ruleCount: number }) => `${p.id}:${p.ruleCount}`)).toEqual(['india-layer-a:22', 'preflight-hygiene:2']);
    const rules = await w.app.fastify.inject({ method: 'GET', url: '/v1/rulebook/rules', headers: h });
    expect(rules.json().items).toHaveLength(27);
    const ex = await w.app.fastify.inject({ method: 'GET', url: '/v1/rulebook/explain/A-RBI-001', headers: h });
    expect(ex.statusCode).toBe(200);
    const health = await w.app.fastify.inject({ method: 'GET', url: '/v1/health' });
    expect(health.json().ok).toBe(true);
    const oa = await w.app.fastify.inject({ method: 'GET', url: '/v1/openapi.json' });
    expect(Object.keys(oa.json().paths)).toContain('/campaigns/{id}/versions');
  });
});
