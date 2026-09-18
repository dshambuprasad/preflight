// INGEST (05 §1, 13 F1 step 4): validate, normalise, snapshot → CampaignVersion(draft) + audience set + hashes.
// Synchronous and transactional. Copy-on-write audiences (D27), HMAC'd identities (D31), variants (D28).
import { canonicalJSON, hmacSha256Hex, identityKey, sha256Hex, missing } from '@preflight/core';
import { TenantConfigSchema, newId, repo, withTransaction, type Tx, type VersionRow, type Role } from '@preflight/db';
import { AppError, notFound } from '../../errors.js';
import type { AppDeps } from '../../deps.js';
import type { Ctx } from '../../tenancy/ctx.js';
import type { CreateVersionBody } from '../../schemas/index.js';
import { normaliseRow, suggestMapping } from '../mapping.js';

export interface IngestInput {
  campaignId: string;
  body: CreateVersionBody;
  idempotencyKey?: string | null;
  /** F5 fix: reuse an existing set with exclusions instead of new rows (D27) */
  audienceRef?: { setId: string; exclusions: number[] } | null;
}

export interface IngestOutput {
  version: VersionRow;
  audience: { rows: number; unresolvable: number };
}

const ROLES_CREATE: Role[] = ['operator', 'admin'];

export async function ingest(ctx: Ctx, deps: AppDeps, input: IngestInput): Promise<IngestOutput> {
  // roles re-checked in the pipeline (02 §7, 09 §2): the route guard is not the only gate
  if (ctx.via !== 'system' && !ROLES_CREATE.some((r) => ctx.roles.includes(r))) throw new AppError('forbidden-role', 'operator or admin required');
  const { body } = input;
  const now = ctx.clock.now();

  return withTransaction(deps.db, async (tx: Tx) => {
    const campaign = await repo.campaigns.get(tx, ctx.tenantId, input.campaignId);
    if (!campaign) throw notFound('campaign');
    const tenant = await repo.tenants.get(tx, ctx.tenantId);
    if (!tenant) throw notFound('tenant');

    // 14 §1: config invalid at snapshot time is an internal error, never a silent default
    const cfgParsed = TenantConfigSchema.safeParse(tenant.config);
    if (!cfgParsed.success) throw new AppError('internal', 'tenant config is invalid; an admin must fix it (F12)');
    const config = cfgParsed.data;

    // F1 step 3 guards
    const issues: { path: string; message: string }[] = [];
    let scheduledAt = new Date(body.scheduledAt);
    let sentAt: Date | null = null;
    if (campaign.mode === 'shadow') {
      if (!body.sentAt) issues.push({ path: 'sentAt', message: 'required for shadow campaigns' });
      else {
        sentAt = new Date(body.sentAt);
        if (sentAt.getTime() > now.getTime()) issues.push({ path: 'sentAt', message: 'shadow sends must be in the past (22 C5)' });
        scheduledAt = sentAt;
      }
    } else {
      const lead = config.scheduleMinLeadMinutes * 60_000;
      if (scheduledAt.getTime() < now.getTime() + lead) issues.push({ path: 'scheduledAt', message: `schedule must be at least ${config.scheduleMinLeadMinutes} minutes ahead` });
    }
    let sendWindowEnd: Date | null = null;
    if (body.sendWindowEnd) {
      sendWindowEnd = new Date(body.sendWindowEnd);
      if (sendWindowEnd.getTime() < scheduledAt.getTime()) issues.push({ path: 'sendWindowEnd', message: 'must not be before scheduledAt' });
      else if (sendWindowEnd.getTime() - scheduledAt.getTime() > config.sendWindowMaxHours * 3_600_000) {
        issues.push({ path: 'sendWindowEnd', message: `send window may not exceed ${config.sendWindowMaxHours} hours (sendWindowMaxHours)` });
      }
    }
    if (body.parentVersionId) {
      const parent = await repo.versions.get(tx, ctx.tenantId, body.parentVersionId);
      if (!parent || parent.campaignId !== campaign.id) issues.push({ path: 'parentVersionId', message: 'must be a version of this campaign' });
    }
    if (issues.length) throw new AppError('validation', 'version is invalid', { issues });

    // identity HMAC key (D31)
    if (!tenant.identityHmacKeyEnc || !tenant.identityHmacKeyIv) throw new AppError('internal', 'tenant has no identity HMAC key; re-run seed/onboarding');
    const hmacKey = deps.secretBox.open(tenant.identityHmacKeyEnc, tenant.identityHmacKeyIv);

    // audience: new set from inline rows, or an existing set with exclusions (F5)
    let setId: string;
    let setHash: string;
    let exclusions: number[] = [];
    let rowCount = 0;
    let unresolvable = 0;
    if (input.audienceRef) {
      const set = await repo.audienceSets.get(tx, ctx.tenantId, input.audienceRef.setId);
      if (!set) throw notFound('audience set');
      setId = set.id;
      setHash = set.setHash;
      exclusions = [...new Set(input.audienceRef.exclusions)].sort((a, b) => a - b);
      const stats = await repo.audience.stats(tx, ctx.tenantId, setId, exclusions);
      rowCount = stats.rows;
      unresolvable = stats.unresolvable;
    } else if ('rows' in body.audience) {
      if (body.audience.rows.length > deps.env.PREFLIGHT_INLINE_ROWS_MAX) {
        throw new AppError('validation', `inline audiences are limited to ${deps.env.PREFLIGHT_INLINE_ROWS_MAX} rows; upload a CSV`, { issues: [{ path: 'audience.rows', message: 'too many rows' }] });
      }
      const headers = [...new Set(body.audience.rows.flatMap((r) => Object.keys(r)))];
      const mapping = suggestMapping(headers);
      const hmacs: string[] = [];
      const rows = body.audience.rows.map((raw, i) => {
        const n = normaliseRow(raw, mapping);
        const id = newId();
        const key = identityKey({ externalId: n.externalId, phoneE164: n.phoneE164, emailNorm: n.emailNorm }, id, config.identityPrecedence);
        if (key.startsWith('row:')) unresolvable++;
        const identityHmac = hmacSha256Hex(hmacKey, key);
        hmacs.push(identityHmac);
        return {
          id,
          rowNo: i + 1,
          externalId: n.externalId,
          raw,
          phoneE164: n.phoneE164,
          emailNorm: n.emailNorm,
          identityKey: key,
          identityHmac,
          preferredLanguage: n.preferredLanguage,
          consentPromotional: n.consentPromotional,
          consentSource: n.consentPromotional === null ? null : 'upload',
        };
      });
      setHash = sha256Hex(hmacs.join('\n'));
      const set = await repo.audienceSets.create(tx, ctx.tenantId, { source: 'inline', uploadId: null, rowCount: rows.length, setHash, createdBy: ctx.userId ?? campaign.createdBy });
      setId = set.id;
      rowCount = rows.length;
      await repo.audience.insertBatch(tx, ctx.tenantId, setId, rows);
    } else {
      // SPEC-GAP (10 M0): uploads arrive in M2; inline rows only.
      throw new AppError('validation', 'uploadId audiences are not available until M2; send inline rows', { issues: [{ path: 'audience.uploadId', message: 'not yet supported' }] });
    }

    const variants = [{ key: 'default', selector: { default: true }, message: body.message, template: body.template ?? null }];
    const contentHash = sha256Hex(
      canonicalJSON({
        variants: variants.map((v) => ({ key: v.key, message: v.message, template: v.template })),
        channel: body.channel,
        scheduledAt: scheduledAt.toISOString(),
        sendWindowEnd: sendWindowEnd?.toISOString() ?? null,
        purpose: body.purpose ?? null,
        borrowerSegment: body.borrowerSegment ?? null,
        product: body.product ?? null,
        template: body.template ?? null,
      }),
    );
    const audienceHash = sha256Hex(setHash + '\n' + canonicalJSON(exclusions));

    const versionNo = await repo.versions.nextVersionNo(tx, ctx.tenantId, campaign.id);
    const version = await repo.versions.create(tx, ctx.tenantId, {
      campaignId: campaign.id,
      versionNo,
      parentVersionId: body.parentVersionId ?? null,
      message: body.message,
      channel: body.channel,
      scheduledAt,
      sendWindowEnd,
      sentAt,
      purpose: body.purpose ?? null,
      borrowerSegment: body.borrowerSegment ?? null,
      product: body.product ?? null,
      template: body.template ?? null,
      configSnapshot: config,
      audienceSetId: setId,
      audienceExclusions: exclusions,
      audienceHash,
      contentHash,
      createdBy: ctx.userId ?? campaign.createdBy,
      idempotencyKey: input.idempotencyKey ?? null,
    });
    await repo.messageVariants.insertBatch(tx, ctx.tenantId, version.id, variants.map((v) => ({ ...v, contentHash: sha256Hex(canonicalJSON({ message: v.message, template: v.template })) })));

    // 14 §4: a fix identical to its parent is still created, but flagged
    if (body.parentVersionId) {
      const parent = await repo.versions.get(tx, ctx.tenantId, body.parentVersionId);
      if (parent && parent.contentHash === contentHash && parent.audienceHash === audienceHash) await repo.versions.setNoChange(tx, ctx.tenantId, version.id, true);
    }

    await repo.audit.insert(tx, ctx.tenantId, {
      actorId: ctx.userId, actorRoles: ctx.roles, entityType: 'version', entityId: version.id, action: 'version.created', requestId: ctx.requestId,
      after: { versionNo, campaignId: campaign.id, audienceSetId: setId, rows: rowCount, contentHash, audienceHash },
    });
    const resolving = await repo.versions.setState(tx, ctx.tenantId, version.id, 'draft', 'resolving');
    await repo.audit.insert(tx, ctx.tenantId, {
      actorId: null, actorRoles: [], entityType: 'version', entityId: version.id, action: 'version.state_changed', requestId: ctx.requestId,
      before: { state: 'draft' }, after: { state: 'resolving' },
    });
    return { version: resolving, audience: { rows: rowCount, unresolvable } };
  });
}

export { missing as _missing };
