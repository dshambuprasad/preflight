// RESOLVE (05 §3, 13 F3 steps 1–6): duplicates, consent join (D37 deny wins), contacts + identifiers upsert.
import { strictestConsent } from '@preflight/core';
import type { ConsentState } from '@preflight/core';
import { repo, withTransaction, type AudienceRow } from '@preflight/db';
import type { AppDeps } from '../../deps.js';
import type { JobPayload } from '../jobs.js';

export async function resolve(deps: AppDeps, job: JobPayload<'resolve'>): Promise<void> {
  const { tenantId, versionId, requestId } = job;
  const version = await repo.versions.get(deps.db, tenantId, versionId);
  if (!version) {
    deps.logger.warn({ tenantId, versionId }, 'resolve: version missing');
    return;
  }
  if (version.state !== 'resolving') {
    deps.logger.info({ tenantId, versionId, state: version.state }, 'resolve: not in resolving; no-op');
    return;
  }
  const log = deps.logger.child({ tenantId, versionId, requestId, stage: 'resolve' });
  await repo.audit.insert(deps.db, tenantId, { actorId: null, actorRoles: [], entityType: 'version', entityId: versionId, action: 'version.resolve.started', requestId });

  await withTransaction(deps.db, async (tx) => {
    const setId = version.audienceSetId;
    const excluding = version.audienceExclusions;
    const set = await repo.audienceSets.get(tx, tenantId, setId);
    // 3. duplicates — one SQL pass over the set (18 §2.2). Idempotent.
    await repo.audience.markDuplicates(tx, tenantId, setId);
    const rows = await repo.audience.list(tx, tenantId, setId, { excluding });

    // 2c. upload-internal consent conflicts: strictest value survives on the surviving row (14 §2, D37)
    const byKey = new Map<string, AudienceRow[]>();
    for (const r of rows) {
      if (r.identityKey.startsWith('row:')) continue;
      const g = byKey.get(r.identityKey) ?? [];
      g.push(r);
      byKey.set(r.identityKey, g);
    }
    const updates = new Map<string, { consentPromotional?: ConsentState | null; consentSource?: string | null; preferredLanguage?: string | null }>();
    for (const group of byKey.values()) {
      if (group.length < 2) continue;
      const stated = group.map((r) => r.consentPromotional).filter((v): v is ConsentState => v !== null);
      if (new Set(stated).size > 1) {
        const survivor = group.find((r) => r.duplicateOfRowId === null) ?? group[0]!;
        updates.set(survivor.id, { consentPromotional: strictestConsent(...stated), consentSource: 'upload:conflict' });
      }
    }

    // 4. contacts upsert (ordered by identity_key inside the repo) + identifiers (D26)
    const unique = rows.filter((r) => r.duplicateOfRowId === null && !r.identityKey.startsWith('row:'));
    const contactIds = await repo.contacts.upsertBatch(
      tx,
      tenantId,
      unique.map((r) => ({ identityKey: r.identityKey, phoneE164: r.phoneE164, emailNorm: r.emailNorm, preferredLanguage: r.preferredLanguage })),
    );
    const identifiers: { contactId: string; kind: 'external_id' | 'phone' | 'email'; value: string }[] = [];
    for (const r of unique) {
      const cid = contactIds.get(r.identityKey);
      if (!cid) continue;
      if (r.externalId) identifiers.push({ contactId: cid, kind: 'external_id', value: r.externalId });
      if (r.phoneE164) identifiers.push({ contactId: cid, kind: 'phone', value: r.phoneE164 });
      if (r.emailNorm) identifiers.push({ contactId: cid, kind: 'email', value: r.emailNorm });
    }
    await repo.contactIdentifiers.upsertBatch(tx, tenantId, identifiers);

    // 2c. consent join against consent_records (upload → records → null), deny wins across sources (D37)
    if ((await repo.consent.countAny(tx, tenantId)) > 0) {
      const ids = [...contactIds.values()];
      const current = await repo.consent.bulkCurrent(tx, tenantId, ids, 'promotional', version.channel);
      const uploadedAt = set?.createdAt ?? version.createdAt;
      for (const r of unique) {
        const cid = contactIds.get(r.identityKey);
        const rec = cid ? current.get(cid) : undefined;
        if (!rec) continue;
        const pending = updates.get(r.id) ?? {};
        const uploadValue = pending.consentPromotional ?? r.consentPromotional;
        if (uploadValue === null) {
          updates.set(r.id, { ...pending, consentPromotional: rec.state, consentSource: 'consent_records' });
        } else if (rec.state === 'denied' && uploadValue !== 'denied' && rec.recordedAt.getTime() > uploadedAt.getTime()) {
          updates.set(r.id, { ...pending, consentPromotional: 'denied', consentSource: 'records:later-withdrawal' });
        }
      }
    }

    if (updates.size) await repo.audience.setResolved(tx, tenantId, [...updates.entries()].map(([id, u]) => ({ id, ...u })));

    const stats = await repo.audience.stats(tx, tenantId, setId, excluding);
    await repo.audit.insert(tx, tenantId, {
      actorId: null, actorRoles: [], entityType: 'version', entityId: versionId, action: 'version.resolve.completed', requestId,
      after: { rows: stats.rows, unique: stats.rows - stats.duplicates, duplicates: stats.duplicates, unresolvable: stats.unresolvable },
    });
    log.info(stats, 'resolved');
  });

  // 6. ⇢ check. (pg-boss makes this transactional in M1; in-process enqueues after commit — D44)
  await deps.queue.enqueue(null, 'check', { tenantId, versionId, asOf: null, requestId }, { singletonKey: `version:${versionId}:null` });
}
