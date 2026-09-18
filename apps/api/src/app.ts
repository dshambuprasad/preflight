// Fastify bootstrap (02 §3): plugins, error mapping (06 §1), routes under /v1, OpenAPI at /v1/openapi.json.
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import { ZodError, z } from 'zod';
import { createJsonSchemaTransform, createJsonSchemaTransformObject, hasZodFastifySchemaValidationErrors, isResponseSerializationError, serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import * as S from './schemas/index.js';
import { InvalidTransition, NotFound } from '@preflight/db';
import { randomUUID } from 'node:crypto';
import { AppError, type Problem } from './errors.js';
import { authPlugin } from './auth/plugin.js';
import { idempotencyPlugin } from './idempotency.js';
import { authRoutes } from './routes/auth.js';
import { campaignRoutes } from './routes/campaigns.js';
import { versionRoutes } from './routes/versions.js';
import { rulebookRoutes } from './routes/rulebook.js';
import { healthRoutes } from './routes/health.js';
import { createPipeline, type Pipeline } from './pipeline/index.js';
import type { AppDeps } from './deps.js';

export interface App {
  fastify: FastifyInstance;
  pipeline: Pipeline;
}

export async function buildApp(deps: AppDeps, opts: { webOrigin?: string } = {}): Promise<App> {
  const app = Fastify({
    loggerInstance: deps.logger,
    genReqId: (req) => (typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : randomUUID()),
    bodyLimit: 1024 * 1024, // 09 §2: 1 MB JSON
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } } });
  await app.register(cors, { origin: opts.webOrigin ?? true, credentials: true, exposedHeaders: ['x-request-id', 'idempotent-replayed'] });
  await app.register(cookie);
  await app.register(rateLimit, { max: deps.env.PREFLIGHT_RATE_LIMIT_PER_MIN, timeWindow: '1 minute', keyGenerator: (req) => req.headers.authorization ?? req.cookies?.pf_session ?? req.ip });
  // named components so packages/api-types gets reusable types (16 §2.6)
  const named: Record<string, z.ZodType> = {
    UserRef: S.UserRef, Citation: S.Citation, What: S.What, SuggestedFix: S.SuggestedFix, Classification: S.Classification, Coverage: S.Coverage,
    Summary: S.Summary, Decision: S.Decision, Finding: S.Finding, Template: S.Template, VersionSummary: S.VersionSummary, VersionDetail: S.VersionDetail,
    Problem: S.Problem, Campaign: S.Campaign, CampaignListItem: S.CampaignListItem, CampaignDetail: S.CampaignDetail, CreateCampaignBody: S.CreateCampaignBody,
    CreateVersionBody: S.CreateVersionBody, CreateVersionResponse: S.CreateVersionResponse, EvaluationDetail: S.EvaluationDetail, EvaluationListItem: S.EvaluationListItem,
    Me: S.Me, LoginBody: S.LoginBody, RulebookInfo: S.RulebookInfo, RuleListItem: S.RuleListItem, Health: S.Health, EvaluateBody: S.EvaluateBody,
  };
  for (const [id, schema] of Object.entries(named)) if (!z.globalRegistry.has(schema)) z.globalRegistry.add(schema, { id });
  await app.register(swagger, {
    openapi: { info: { title: 'Preflight API', version: '1' }, servers: [{ url: '/v1' }] },
    transform: createJsonSchemaTransform({ schemaRegistry: z.globalRegistry }),
    transformObject: createJsonSchemaTransformObject({ schemaRegistry: z.globalRegistry }),
  });

  app.setErrorHandler((err: unknown, req, reply) => {
    const instance = req.url;
    const requestId = req.id;
    let problem: Problem;
    if (err instanceof AppError) problem = err.toProblem(instance, requestId);
    else if (hasZodFastifySchemaValidationErrors(err)) {
      problem = new AppError('validation', 'request failed validation', { issues: err.validation.map((v) => ({ path: String(v.instancePath || v.params?.issue?.path?.join('.') || ''), message: v.message ?? 'invalid' })) }).toProblem(instance, requestId);
    } else if (isResponseSerializationError(err)) {
      req.log.error({ err, cause: err.cause }, 'response failed schema (06 contract)');
      problem = new AppError('internal', 'response did not match the API contract').toProblem(instance, requestId);
    } else if (err instanceof ZodError) {
      problem = new AppError('validation', 'request failed validation', { issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) }).toProblem(instance, requestId);
    } else if (err instanceof InvalidTransition) problem = new AppError('invalid-transition', err.message).toProblem(instance, requestId);
    else if (err instanceof NotFound) problem = new AppError('not-found', err.message).toProblem(instance, requestId);
    else if (typeof err === 'object' && err && (err as { statusCode?: number }).statusCode === 429) {
      problem = new AppError('rate-limited').toProblem(instance, requestId);
    } else if (typeof err === 'object' && err && (err as { statusCode?: number }).statusCode === 413) {
      problem = new AppError('validation', 'request body too large').toProblem(instance, requestId);
    } else if (typeof err === 'object' && err && String((err as { code?: string }).code ?? '').startsWith('FST_ERR_CTP')) {
      problem = new AppError('validation', 'malformed request body').toProblem(instance, requestId);
    } else {
      req.log.error({ err }, 'unhandled error');
      problem = new AppError('internal').toProblem(instance, requestId);
    }
    reply.header('x-request-id', requestId).code(problem.status).type('application/problem+json').send(problem);
  });
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).type('application/problem+json').send(new AppError('not-found', `no route ${req.method} ${req.url}`).toProblem(req.url, req.id));
  });
  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });

  const pipeline = createPipeline(deps);
  await app.register(authPlugin, deps);
  await app.register(idempotencyPlugin, deps);
  await app.register(
    async (v1) => {
      await v1.register(healthRoutes, deps);
      await v1.register(authRoutes, deps);
      await v1.register(campaignRoutes, { ...deps, pipeline });
      await v1.register(versionRoutes, { ...deps, pipeline });
      await v1.register(rulebookRoutes, deps);
      v1.get('/openapi.json', { config: { public: true } }, async () => v1.swagger());
    },
    { prefix: '/v1' },
  );
  return { fastify: app as unknown as FastifyInstance, pipeline };
}
