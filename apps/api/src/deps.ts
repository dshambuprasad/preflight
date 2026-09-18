// The composition root's dependency bag (16 §2.5 StageDeps + app-level). Built once in main.ts; tests build a
// smaller one. Stages receive exactly this and never import each other.
import type { Db, Repo } from '@preflight/db';
import type { Logger } from 'pino';
import type { Env } from './env.js';
import type { Rulebook } from './rulebook/index.js';
import type { JobQueue } from './pipeline/jobs.js';
import type { Clock } from './tenancy/ctx.js';
import type { SecretBox } from './secretbox.js';

export interface AppDeps {
  env: Env;
  db: Db;
  repo: Repo;
  rulebook: Rulebook;
  queue: JobQueue;
  clock: Clock;
  logger: Logger;
  secretBox: SecretBox;
  version: string;
}
