// CHECK (05 §4, 13 F3 steps 7–8, F4): assemble the Context, run core, persist evaluation + findings + coverage.
// Idempotent on (version, asOf, rulebookHash, exceptionsHash). Never reads the wall clock for asOf.
import { ENGINE_VERSION, evaluate, sha256Hex } from '@preflight/core';
import type { Contact, ConsentAccess, ContactEvent, Exception, HistoryAccess } from '@preflight/core';
import { InvalidTransition, TenantConfigSchema, repo, withTransaction, type EvaluationRow, type FindingInsert } from '@preflight/db';
import type { AppDeps } from '../../deps.js';
import type { JobPayload } from '../jobs.js';

const AFFECTED_ROW_CAP = 50_000; // 18 §2.3
const EVALUATED_STATES = new Set(['resolving', 'evaluated', 'in_review', 'approved', 'sealed', 'handed_off']);

export function exceptionsHashOf(ids: readonly string[]): string {
  return sha256Hex([...ids].sort().join(','));
}

export async function check(deps: AppDeps, job: JobPayload<'check'>): Promise<EvaluationRow | null> {
  const { tenantId, versionId, requestId } = job;
  const version = await repo.versions.get(deps.db, tenantId, versionId);
  if (!version || !EVALUATED_STATES.has(version.state)) {
    deps.logger.warn({ tenantId, versionId, state: version?.state }, 'check: skipped');
    return null;
  }
  const campaign = await repo.campaigns.get(deps.db, tenantId, version.campaignId);
  if (!campaign) return null;
  const log = deps.logger.child({ tenantId, versionId, requestId, stage: 'check' });
  await repo.audit.insert(deps.db, tenantId, { actorId: job.requestedBy ?? null, actorRoles: [], entityType: 'version', entityId: versionId, action: 'version.check.started', requestId, after: { asOf: job.asOf } });

  const asOf = job.asOf ? new Date(job.asOf) : (version.sentAt ?? version.scheduledAt);
  const config = TenantConfigSchema.parse(version.configSnapshot); // validated at ingest; defaults re-applied
  const packs = deps.rulebook.packsFor(config.rulePacks);
  const rulebookHash = deps.rulebook.hashFor(config.rulePacks);
  const advisory = job.advisory ?? ['approved', 'sealed', 'handed_off'].includes(version.state);

  const rows = await repo.audience.list(deps.db, tenantId, version.audienceSetId, { excluding: version.audienceExclusions });
  const contacts: Contact[] = [];
  const duplicates: { rowId: string; duplicateOf: string }[] = [];
  const unresolvable: string[] = [];
  for (const r of rows) {
    if (r.duplicateOfRowId) {
      duplicates.push({ rowId: r.id, duplicateOf: r.duplicateOfRowId });
      continue;
    }
    if (r.identityKey.startsWith('row:')) unresolvable.push(r.id);
    contacts.push({
      id: r.id, externalId: r.externalId, phoneE164: r.phoneE164, emailNorm: r.emailNorm, identityKey: r.identityKey,
      preferredLanguage: r.preferredLanguage, consentPromotional: r.consentPromotional, consentSource: r.consentSource, variantKey: 'default',
    });
  }

  const activeExceptions = await repo.exceptions.active(deps.db, tenantId, campaign.id, asOf);
  const exceptions: Exception[] = activeExceptions.map((e) => ({ id: e.id, ruleId: e.ruleId, scope: e.scope, campaignId: e.campaignId ?? undefined, expiresAt: e.expiresAt.toISOString() }));
  const exceptionsHash = exceptionsHashOf(exceptions.map((e) => e.id));

  const existing = await repo.evaluations.findExisting(deps.db, tenantId, versionId, asOf, rulebookHash, exceptionsHash);
  if (existing) {
    await settleState(deps, tenantId, versionId, version.state, requestId, existing);
    log.info({ evaluationId: existing.id }, 'check: reused existing evaluation');
    return existing;
  }

  // Tier-1 access (05 §4): present only when the tenant has data. Prefetched once per evaluation (18 §2.3).
  const consent = await buildConsentAccess(deps, tenantId, contacts, version.channel);
  const history = await buildHistoryAccess(deps, tenantId, contacts, asOf);

  const t0 = performance.now();
  const result = evaluate({
    campaign: {
      message: version.message, channel: version.channel, scheduledAt: version.scheduledAt.toISOString(),
      sendWindowEnd: version.sendWindowEnd?.toISOString() ?? null, purpose: version.purpose, borrowerSegment: version.borrowerSegment,
      product: version.product, template: version.template ?? null,
    },
    contacts, config, asOf: asOf.toISOString(), packs,
    audience: { rows: rows.length, duplicates, unresolvable },
    consent, history, exceptions,
  });
  const durationMs = Math.round(performance.now() - t0);
  for (const e of result.ruleErrors) {
    log.error({ ruleId: e.ruleId, error: e.error }, 'rule error (14 §3)');
    await repo.audit.insert(deps.db, tenantId, { actorId: null, actorRoles: [], entityType: 'version', entityId: versionId, action: 'version.check.rule_error', requestId, after: { ruleId: e.ruleId, error: e.error } });
  }

  const findingRows: FindingInsert[] = result.findings.map((f) => ({
    ruleId: f.ruleId, severity: f.severity, category: f.category, title: f.title, explanation: f.explanation, what: f.what,
    suggestedFix: f.suggestedFix, affectedCount: f.affectedCount, affectedRowIds: f.affectedRowIds.slice(0, AFFECTED_ROW_CAP),
    affectedSample: f.affectedSample, affectedRowsTruncated: f.affectedRowIds.length > AFFECTED_ROW_CAP, citation: f.citation,
    detail: f.detail, variantKey: f.variantKey, suppressedBy: f.suppressedBy,
  }));
  const coverage = [
    ...result.coverage.cannotEvaluate.map((c) => ({ ruleId: c.ruleId, status: 'cannot_evaluate' as const, missing: c.missing, reason: c.reason })),
    ...result.coverage.notApplicable.map((c) => ({ ruleId: c.ruleId, status: 'not_applicable' as const, missing: [], reason: c.reason ?? null })),
    ...packs.flatMap((p) => p.rules).map((r) => r.id)
      .filter((id) => !result.coverage.cannotEvaluate.some((c) => c.ruleId === id) && !result.coverage.notApplicable.some((c) => c.ruleId === id))
      .map((ruleId) => ({ ruleId, status: 'evaluated' as const, missing: [], reason: null })),
  ];

  const evaluation = await withTransaction(deps.db, async (tx) => {
    try {
      const { evaluation } = await repo.evaluations.insertWithFindings(tx, tenantId, {
        versionId, asOf, rulebookHash, rulePackIds: packs.map((p) => `${p.id}@${p.version}`), classification: result.classification,
        effectivePurpose: result.effectivePurpose, coverage: result.coverage, summary: result.summary, engineVersion: ENGINE_VERSION,
        durationMs, exceptionsHash, advisory,
      }, findingRows, coverage);
      return evaluation;
    } catch (err) {
      // 14 §3: unique violation on the 4-tuple (race) → fetch existing
      const code = (err as { cause?: { code?: string } }).cause?.code;
      if (code === '23505') {
        const again = await repo.evaluations.findExisting(tx, tenantId, versionId, asOf, rulebookHash, exceptionsHash);
        if (again) return again;
      }
      throw err;
    }
  });
  await deps.repo.rulebookVersions.record(deps.db, rulebookHash, packs.map((p) => p.id), { gitRef: deps.rulebook.gitRef, nodeCount: deps.rulebook.graph.nodes.length, ruleCount: packs.reduce((n, p) => n + p.rules.length, 0) }).catch(() => undefined);
  await settleState(deps, tenantId, versionId, version.state, requestId, evaluation);
  log.info({ evaluationId: evaluation.id, durationMs, summary: result.summary }, 'evaluated');
  return evaluation;
}

async function settleState(deps: AppDeps, tenantId: string, versionId: string, state: string, requestId: string, evaluation: EvaluationRow): Promise<void> {
  if (state === 'resolving') {
    try {
      await withTransaction(deps.db, (tx) => repo.versions.setState(tx, tenantId, versionId, 'resolving', 'evaluated'));
    } catch (err) {
      if (!(err instanceof InvalidTransition)) throw err; // already moved by a concurrent check
    }
  }
  await repo.audit.insert(deps.db, tenantId, {
    actorId: null, actorRoles: [], entityType: 'version', entityId: versionId, action: 'version.evaluated', requestId,
    after: { evaluationId: evaluation.id, asOf: evaluation.asOf.toISOString(), advisory: evaluation.advisory, ...evaluation.summary },
  });
}

async function buildConsentAccess(deps: AppDeps, tenantId: string, contacts: Contact[], channel: string): Promise<ConsentAccess | undefined> {
  if ((await repo.consent.countAny(deps.db, tenantId)) === 0) return undefined;
  const keys = contacts.map((c) => c.identityKey!).filter((k) => !k.startsWith('row:'));
  const contactRows = await repo.contacts.getByIdentityKeys(deps.db, tenantId, keys);
  const idByKey = new Map(contactRows.map((c) => [c.identityKey, c.id]));
  const ids = [...idByKey.values()];
  const channels: (string | null)[] = [null, 'whatsapp', 'sms', 'email', 'voice'];
  const maps = new Map<string, Awaited<ReturnType<typeof repo.consent.bulkCurrent>>>();
  for (const ch of channels) maps.set(ch ?? '', await repo.consent.bulkCurrent(deps.db, tenantId, ids, 'promotional', ch as never));
  void channel;
  return {
    current(identityKey, purpose, ch) {
      if (purpose !== 'promotional') return null; // SPEC-GAP: product-scoped purposes are prefetched in M4
      const cid = idByKey.get(identityKey);
      if (!cid) return null;
      const rec = maps.get(ch ?? '')?.get(cid);
      // consent_records holds granted|denied (03 §3); anything else is treated as denied (D37)
      return rec ? { purpose: rec.purpose, channel: rec.channel, state: rec.state === 'granted' ? 'granted' : 'denied', source: rec.source, recordedAt: rec.recordedAt.toISOString() } : null;
    },
    productScoped: false,
  };
}

async function buildHistoryAccess(deps: AppDeps, tenantId: string, contacts: Contact[], asOf: Date): Promise<HistoryAccess | undefined> {
  if ((await repo.events.countAny(deps.db, tenantId)) === 0) return undefined;
  const keys = contacts.map((c) => c.identityKey!).filter((k) => !k.startsWith('row:'));
  const contactRows = await repo.contacts.getByIdentityKeys(deps.db, tenantId, keys);
  const idByKey = new Map(contactRows.map((c) => [c.identityKey, c.id]));
  const from = new Date(asOf.getTime() - 90 * 86_400_000);
  const to = new Date(asOf.getTime() + 86_400_000);
  const events = await repo.events.windowBulk(deps.db, tenantId, [...idByKey.values()], from, to);
  const earliest = await repo.events.earliest(deps.db, tenantId);
  const toCore = (e: (typeof events extends Map<string, infer V> ? V : never)[number]): ContactEvent => ({ kind: e.kind, channel: e.channel, purpose: e.purpose, occurredAt: e.occurredAt.toISOString(), source: e.source });
  return {
    events(identityKey, f, t) {
      const cid = idByKey.get(identityKey);
      if (!cid) return [];
      const fromMs = Date.parse(f);
      const toMs = Date.parse(t);
      return (events.get(cid) ?? []).filter((e) => e.occurredAt.getTime() >= fromMs && e.occurredAt.getTime() < toMs).map(toCore);
    },
    hasAnyHistory(identityKey) {
      const cid = idByKey.get(identityKey);
      return !!cid && (events.get(cid)?.length ?? 0) > 0;
    },
    earliestKnown: earliest?.toISOString() ?? null,
  };
}
