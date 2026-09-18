import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { repo } from '@preflight/db';
import { notFound } from '../errors.js';
import { Campaign, CampaignDetail, CampaignListItem, CampaignListQuery, CreateCampaignBody, CreateVersionBody, CreateVersionResponse, Paged, Problem, Uuid } from '../schemas/index.js';
import { userRef, versionSummary } from './present.js';
import type { AppDeps } from '../deps.js';
import type { Pipeline } from '../pipeline/index.js';

export const campaignRoutes: FastifyPluginAsyncZod<AppDeps & { pipeline: Pipeline }> = async (app, deps) => {
  app.post('/campaigns', {
    schema: { body: CreateCampaignBody, response: { 201: Campaign, 200: Campaign } },
    config: { roles: ['operator', 'admin'], idempotent: true },
    handler: async (req, reply) => {
      const c = await repo.campaigns.create(deps.db, req.ctx.tenantId, { name: req.body.name, mode: req.body.mode, createdBy: req.ctx.userId! });
      await repo.audit.insert(deps.db, req.ctx.tenantId, { actorId: req.ctx.userId, actorRoles: req.ctx.roles, entityType: 'campaign', entityId: c.id, action: 'campaign.created', requestId: req.id, after: { name: c.name, mode: c.mode } });
      const user = await repo.users.get(deps.db, req.ctx.tenantId, req.ctx.userId!);
      return reply.code(201).send({ id: c.id, name: c.name, mode: c.mode, latestVersionState: null, createdBy: userRef(user!), createdAt: c.createdAt.toISOString() });
    },
  });

  app.get('/campaigns', {
    schema: { querystring: CampaignListQuery, response: { 200: Paged(CampaignListItem) } },
    handler: async (req) => {
      const page = await repo.campaigns.list(deps.db, req.ctx.tenantId, req.query);
      const items = [];
      for (const c of page.items) {
        const versions = await repo.versions.listByCampaign(deps.db, req.ctx.tenantId, c.id);
        const latest = versions[0];
        items.push({ id: c.id, name: c.name, mode: c.mode, latestVersion: latest ? await versionSummary(deps.db, req.ctx.tenantId, latest) : null, createdAt: c.createdAt.toISOString() });
      }
      return { items, nextCursor: page.nextCursor };
    },
  });

  app.get('/campaigns/:id', {
    schema: { params: z.object({ id: Uuid }), response: { 200: CampaignDetail, 404: Problem } },
    handler: async (req) => {
      const c = await repo.campaigns.get(deps.db, req.ctx.tenantId, req.params.id);
      if (!c) throw notFound('campaign');
      const versions = await repo.versions.listByCampaign(deps.db, req.ctx.tenantId, c.id);
      const user = await repo.users.get(deps.db, req.ctx.tenantId, c.createdBy);
      return {
        id: c.id, name: c.name, mode: c.mode,
        versions: await Promise.all(versions.map((v) => versionSummary(deps.db, req.ctx.tenantId, v))),
        createdBy: user ? userRef(user) : { id: c.createdBy, displayName: '(deleted)', roles: [] },
        createdAt: c.createdAt.toISOString(),
      };
    },
  });

  // F1 — every entry point goes through INGEST → RESOLVE → CHECK (05 §10, D15)
  app.post('/campaigns/:id/versions', {
    schema: { params: z.object({ id: Uuid }), body: CreateVersionBody, response: { 202: CreateVersionResponse, 200: CreateVersionResponse, 400: Problem, 404: Problem } },
    config: { roles: ['operator', 'admin'], idempotent: true },
    handler: async (req, reply) => {
      const key = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : null;
      const out = await deps.pipeline.createVersion(req.ctx, { campaignId: req.params.id, body: req.body, idempotencyKey: key });
      const summary = await versionSummary(deps.db, req.ctx.tenantId, out.version, { latest: null, children: [], audienceSize: out.audience.rows });
      return reply.code(202).send({ version: summary, jobs: ['resolve'] });
    },
  });
};
