import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { RuleListItem, RulebookInfo, Problem } from '../schemas/index.js';
import { notFound } from '../errors.js';
import type { AppDeps } from '../deps.js';

export const rulebookRoutes: FastifyPluginAsyncZod<AppDeps> = async (app, deps) => {
  const rb = deps.rulebook;
  app.get('/rulebook', {
    schema: { response: { 200: RulebookInfo } },
    handler: async () => ({
      hash: rb.hash,
      graphHash: rb.graphHash,
      packs: Object.values(rb.packs).sort((a, b) => a.id.localeCompare(b.id)).map((p) => ({ id: p.id, version: p.version, ruleCount: p.rules.length, sourceHash: p.sourceHash })),
      loadedAt: rb.loadedAt.toISOString(),
      gitRef: rb.gitRef,
    }),
  });
  app.get('/rulebook/rules', {
    schema: { response: { 200: z.object({ items: z.array(RuleListItem) }) } },
    handler: async () => ({
      items: rb.metadata.map((m) => ({
        id: m.id, pack: m.pack, layer: m.layer, tier: m.tier, category: m.category, title: m.title, severity: m.severity,
        severityBefore: m.severityBefore ?? null, effectiveFrom: m.effectiveFrom ?? null, requires: m.requires, sendTimeCheck: m.sendTimeCheck, citation: m.citation,
      })),
    }),
  });
  app.get('/rulebook/graph', {
    schema: { response: { 200: z.object({ nodes: z.array(z.object({ id: z.string(), type: z.string(), label: z.string(), data: z.record(z.string(), z.unknown()) })), edges: z.array(z.object({ source: z.string(), target: z.string(), type: z.string() })) }) } },
    handler: async () => ({ nodes: rb.graph.nodes, edges: rb.graph.edges }),
  });
  app.get('/rulebook/explain/:ruleId', {
    schema: { params: z.object({ ruleId: z.string() }), response: { 200: z.record(z.string(), z.unknown()), 404: Problem } },
    handler: async (req) => {
      if (!rb.graph.ruleIds().includes(req.params.ruleId)) throw notFound('rule');
      return rb.graph.explain(req.params.ruleId) as unknown as Record<string, unknown>;
    },
  });
};
