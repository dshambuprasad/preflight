import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { TenantConfigSchema, repo } from '@preflight/db';
import { AppError, notFound } from '../errors.js';
import { EvaluateBody, EvaluateExisting, EvaluateQueued, EvaluationDetail, EvaluationListItem, Finding, Problem, Uuid, VersionDetail } from '../schemas/index.js';
import { finding, versionSummary } from './present.js';
import type { AppDeps } from '../deps.js';
import type { Pipeline } from '../pipeline/index.js';

export const versionRoutes: FastifyPluginAsyncZod<AppDeps & { pipeline: Pipeline }> = async (app, deps) => {
  app.get('/versions/:id', {
    schema: { params: z.object({ id: Uuid }), response: { 200: VersionDetail, 404: Problem } },
    handler: async (req) => {
      const v = await repo.versions.get(deps.db, req.ctx.tenantId, req.params.id);
      if (!v) throw notFound('version');
      const campaign = await repo.campaigns.get(deps.db, req.ctx.tenantId, v.campaignId);
      const tenant = await repo.tenants.get(deps.db, req.ctx.tenantId);
      const currentCfg = TenantConfigSchema.safeParse(tenant?.config);
      const configDrift = currentCfg.success && JSON.stringify(currentCfg.data) !== JSON.stringify(v.configSnapshot);
      const stats = await repo.audience.stats(deps.db, req.ctx.tenantId, v.audienceSetId, v.audienceExclusions);
      const rows = await repo.audience.list(deps.db, req.ctx.tenantId, v.audienceSetId, { excluding: v.audienceExclusions, includeDuplicates: false });
      const consent = { granted: 0, denied: 0, unknown: 0, absent: 0 };
      for (const r of rows) consent[r.consentPromotional ?? 'absent']++;
      const summary = await versionSummary(deps.db, req.ctx.tenantId, v, { audienceSize: stats.rows, configDrift });
      const lastFailure = v.state === 'draft' ? await repo.audit.latestForEntity(deps.db, req.ctx.tenantId, 'version', v.id) : null;
      return {
        ...summary,
        message: v.message,
        template: v.template ?? null,
        configSnapshot: v.configSnapshot as Record<string, unknown>,
        review: null,
        evidence: null,
        audience: { size: stats.rows, duplicates: stats.duplicates, unresolvable: stats.unresolvable, consent },
        campaignName: campaign?.name ?? '',
        campaignMode: campaign?.mode ?? 'live',
        lastError: lastFailure?.action.endsWith('.failed') ? String(lastFailure.after?.error ?? lastFailure.action) : null,
      };
    },
  });

  // F4 — time-travel / re-evaluate
  app.post('/versions/:id/evaluate', {
    schema: { params: z.object({ id: Uuid }), body: EvaluateBody, response: { 202: EvaluateQueued, 200: EvaluateExisting, 409: Problem, 404: Problem } },
    config: { roles: ['operator', 'admin'] },
    handler: async (req, reply) => {
      const v = await repo.versions.get(deps.db, req.ctx.tenantId, req.params.id);
      if (!v) throw notFound('version');
      if (!['evaluated', 'in_review', 'approved', 'sealed', 'handed_off'].includes(v.state)) {
        // 14 §2/§3: a failed resolve/check leaves the version in draft; re-evaluate re-enqueues resolve
        if (v.state === 'draft') {
          await deps.db.transaction((tx) => repo.versions.setState(tx, req.ctx.tenantId, v.id, 'draft', 'resolving'));
          await deps.queue.enqueue(null, 'resolve', { tenantId: req.ctx.tenantId, versionId: v.id, requestId: req.id }, { singletonKey: `version:${v.id}` });
          return reply.code(202).send({ evaluationId: null, job: 'check', advisory: false });
        }
        throw new AppError('invalid-transition', `cannot evaluate a version in state '${v.state}'`);
      }
      const r = await deps.pipeline.requestEvaluation(req.ctx, v.id, req.body.asOf ?? null);
      if (r.existingEvaluationId) return reply.code(200).send({ evaluationId: r.existingEvaluationId, advisory: r.advisory });
      return reply.code(202).send({ evaluationId: null, job: 'check', advisory: r.advisory });
    },
  });

  app.get('/versions/:id/evaluations', {
    schema: { params: z.object({ id: Uuid }), response: { 200: z.object({ items: z.array(EvaluationListItem) }), 404: Problem } },
    handler: async (req) => {
      const v = await repo.versions.get(deps.db, req.ctx.tenantId, req.params.id);
      if (!v) throw notFound('version');
      const items = await repo.evaluations.listByVersion(deps.db, req.ctx.tenantId, v.id);
      return { items: items.map((e) => ({ id: e.id, asOf: e.asOf.toISOString(), rulebookHash: e.rulebookHash, exceptionsHash: e.exceptionsHash, advisory: e.advisory, summary: e.summary, createdAt: e.createdAt.toISOString() })) };
    },
  });

  app.get('/evaluations/:id', {
    schema: { params: z.object({ id: Uuid }), response: { 200: EvaluationDetail, 404: Problem } },
    handler: async (req, reply) => {
      const e = await repo.evaluations.get(deps.db, req.ctx.tenantId, req.params.id);
      if (!e) throw notFound('evaluation');
      const rows = await repo.findings.listByEvaluation(deps.db, req.ctx.tenantId, e.id);
      reply.header('cache-control', 'private, immutable, max-age=31536000');
      reply.header('etag', `"${e.id}"`);
      return {
        id: e.id, versionId: e.versionId, asOf: e.asOf.toISOString(), rulebookHash: e.rulebookHash, rulePackIds: e.rulePackIds, engineVersion: e.engineVersion,
        durationMs: e.durationMs, advisory: e.advisory, classification: e.classification, effectivePurpose: e.effectivePurpose, coverage: e.coverage,
        summary: e.summary, findings: rows.map((f) => finding(f)), createdAt: e.createdAt.toISOString(),
      };
    },
  });

  app.get('/findings/:id', {
    schema: { params: z.object({ id: Uuid }), response: { 200: Finding.extend({ versionId: Uuid }), 404: Problem } },
    handler: async (req) => {
      const f = await repo.findings.get(deps.db, req.ctx.tenantId, req.params.id);
      if (!f) throw notFound('finding');
      const e = await repo.evaluations.get(deps.db, req.ctx.tenantId, f.evaluationId);
      return { ...finding(f), versionId: e!.versionId };
    },
  });
};
