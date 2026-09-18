// The orchestrator (16 §2.5): wires stages to the queue. Stages never import each other.
import type { AppDeps } from '../deps.js';
import { ingest, type IngestInput, type IngestOutput } from './stages/ingest.js';
import { resolve } from './stages/resolve.js';
import { check } from './stages/check.js';
import type { Ctx } from '../tenancy/ctx.js';
import { TenantConfigSchema, repo } from '@preflight/db';

export type { IngestInput, IngestOutput };
export { ingest, resolve, check };
export * from './jobs.js';

export interface Pipeline {
  /** INGEST then ⇢ resolve (F1 steps 4–5). */
  createVersion(ctx: Ctx, input: IngestInput): Promise<IngestOutput>;
  /** F4 — enqueue a CHECK for an explicit asOf; returns the existing evaluation id when the 4-tuple exists. */
  requestEvaluation(ctx: Ctx, versionId: string, asOf: string | null): Promise<{ existingEvaluationId: string | null; advisory: boolean }>;
  /** Registers job handlers on the queue (api role=all or the worker process). */
  startWorkers(): void;
}

export function createPipeline(deps: AppDeps): Pipeline {
  return {
    async createVersion(ctx, input) {
      const out = await ingest(ctx, deps, input);
      await deps.queue.enqueue(null, 'resolve', { tenantId: ctx.tenantId, versionId: out.version.id, requestId: ctx.requestId }, { singletonKey: `version:${out.version.id}` });
      return out;
    },
    async requestEvaluation(ctx, versionId, asOf) {
      const version = await repo.versions.get(deps.db, ctx.tenantId, versionId);
      if (!version) return { existingEvaluationId: null, advisory: false };
      const advisory = ['approved', 'sealed', 'handed_off'].includes(version.state);
      const when = asOf ? new Date(asOf) : (version.sentAt ?? version.scheduledAt);
      const campaign = await repo.campaigns.get(deps.db, ctx.tenantId, version.campaignId);
      const active = await repo.exceptions.active(deps.db, ctx.tenantId, campaign?.id ?? null, when);
      const { exceptionsHashOf } = await import('./stages/check.js');
      const existing = await repo.evaluations.findExisting(deps.db, ctx.tenantId, versionId, when, deps.rulebook.hashFor(TenantConfigSchema.parse(version.configSnapshot).rulePacks), exceptionsHashOf(active.map((e) => e.id)));
      if (existing) return { existingEvaluationId: existing.id, advisory };
      await deps.queue.enqueue(null, 'check', { tenantId: ctx.tenantId, versionId, asOf: asOf ?? null, requestedBy: ctx.userId, requestId: ctx.requestId, advisory }, { singletonKey: `version:${versionId}:${asOf ?? 'null'}` });
      return { existingEvaluationId: null, advisory };
    },
    startWorkers() {
      const concurrency = deps.env.PREFLIGHT_JOB_CONCURRENCY;
      deps.queue.work('resolve', (job) => resolve(deps, job.payload), { concurrency, timeoutMs: deps.env.PREFLIGHT_CHECK_TIMEOUT_MS });
      deps.queue.work('check', async (job) => { await check(deps, job.payload); }, { concurrency, timeoutMs: deps.env.PREFLIGHT_CHECK_TIMEOUT_MS });
    },
  };
}
