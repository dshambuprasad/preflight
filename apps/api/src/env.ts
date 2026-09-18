// 15 §4 — every environment variable, validated with Zod at boot. Any problem → refuse to start, print all.
import { z } from 'zod';

const bool = z
  .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0'), z.literal('')])
  .default('false')
  .transform((v) => v === 'true' || v === '1');
const int = (def: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  z.coerce.number().int().min(min).max(max).default(def);

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PREFLIGHT_ROLE: z.enum(['api', 'worker', 'all']).default('all'),
    PORT: int(3000, 1, 65535),
    DATABASE_URL: z.string().min(1),
    DATABASE_POOL_MAX: int(10, 1, 200),
    PREFLIGHT_KMS_KEY: z.string().min(1).refine((s) => Buffer.from(s, 'base64').length === 32, '32-byte base64 key'),
    PREFLIGHT_SESSION_SECRET: z.string().min(32),
    PREFLIGHT_SESSION_TTL_HOURS: int(12, 1, 720),
    PREFLIGHT_STORAGE: z.enum(['postgres', 's3']).default('postgres'),
    S3_ENDPOINT: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_REGION: z.string().optional(),
    PREFLIGHT_DEMO_MOCK_CONNECTORS: bool,
    PREFLIGHT_RULEBOOK_DIR: z.string().default('./rulebook'),
    PREFLIGHT_JOB_CONCURRENCY: int(4, 1, 64),
    PREFLIGHT_CHECK_TIMEOUT_MS: int(120_000, 1000),
    PREFLIGHT_HISTORY_QUERY_TIMEOUT_MS: int(30_000, 100),
    PREFLIGHT_PLATFORM_CACHE_MINUTES: int(15, 1),
    PREFLIGHT_PLATFORM_STALE_HOURS: int(24, 1),
    PREFLIGHT_RATE_LIMIT_PER_MIN: int(100, 1),
    PREFLIGHT_UPLOAD_MAX_MB: int(25, 1),
    PREFLIGHT_INLINE_ROWS_MAX: int(5000, 1),
    PREFLIGHT_WEBHOOK_TIMEOUT_MS: int(10_000, 100),
    PREFLIGHT_LLM_PROVIDER: z.enum(['null', 'anthropic']).default('null'),
    ANTHROPIC_API_KEY: z.string().optional(),
    PREFLIGHT_LLM_MODEL: z.string().optional(),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
    PREFLIGHT_PUBLIC_URL: z.string().url(),
    PREFLIGHT_EVENTS_HOT_DAYS: int(90, 1),
    PREFLIGHT_CHECK_CHUNK_ROWS: int(100_000, 1000),
  })
  .superRefine((env, ctx) => {
    if (env.PREFLIGHT_STORAGE === 's3') {
      for (const k of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_REGION'] as const) {
        if (!env[k]) ctx.addIssue({ code: 'custom', path: [k], message: `required when PREFLIGHT_STORAGE=s3` });
      }
    }
    if (env.PREFLIGHT_LLM_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['ANTHROPIC_API_KEY'], message: 'required when PREFLIGHT_LLM_PROVIDER=anthropic' });
    }
    // 14 §8: mock connectors in a production build → refuse to start.
    if (env.NODE_ENV === 'production' && env.PREFLIGHT_DEMO_MOCK_CONNECTORS) {
      ctx.addIssue({ code: 'custom', path: ['PREFLIGHT_DEMO_MOCK_CONNECTORS'], message: 'refused when NODE_ENV=production' });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(`environment invalid:\n  ${problems.join('\n  ')}`);
    this.name = 'EnvError';
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const r = EnvSchema.safeParse(source);
  if (!r.success) {
    throw new EnvError(r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`));
  }
  return r.data;
}
