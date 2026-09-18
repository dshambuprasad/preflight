// 16 §2.5 JobQueue + 15 §7 payloads. M0 ships the in-process implementation (12 §H D44); M1 adds
// pg-boss behind the same interface. Stage code never knows which one is running.
import type { Tx } from '@preflight/db';

export type JobKind = 'resolve' | 'check' | 'seal' | 'webhook' | 'push_suppress' | 'sync' | 'expire_sweep' | 'retention';

export interface JobPayloads {
  resolve: { tenantId: string; versionId: string; requestId: string };
  check: { tenantId: string; versionId: string; asOf: string | null; requestedBy?: string | null; requestId: string; advisory?: boolean };
  seal: { tenantId: string; versionId: string; requestId: string };
  webhook: { tenantId: string; evidenceId: string; event: string };
  push_suppress: { tenantId: string; versionId: string; connectorId: string; identityKeys: string[] };
  sync: { tenantId: string; connectorId: string; scope: string; since?: string };
  expire_sweep: Record<string, never>;
  retention: Record<string, never>;
}
export type JobPayload<K extends JobKind> = JobPayloads[K];
export type JobId = string;

export interface Job<K extends JobKind> {
  id: JobId;
  kind: K;
  payload: JobPayload<K>;
  attempt: number;
}

export interface JobQueue {
  enqueue<K extends JobKind>(tx: Tx | null, kind: K, payload: JobPayload<K>, opts?: { singletonKey?: string; startAfter?: Date }): Promise<JobId>;
  work<K extends JobKind>(kind: K, handler: (job: Job<K>) => Promise<void>, opts: { concurrency: number; timeoutMs: number }): void;
  retry(jobId: JobId): Promise<void>;
  /** Wait until nothing is queued or running (tests, graceful shutdown). */
  drain(): Promise<void>;
  status(): { queued: number; running: number; failed: number };
}

const RETRY_DELAYS_MS = [10_000, 60_000, 300_000]; // 15 §7: 3 × (10s, 1m, 5m)

interface Entry {
  id: JobId;
  kind: JobKind;
  payload: unknown;
  singletonKey?: string;
  attempt: number;
  lastError?: string;
  state: 'queued' | 'running' | 'done' | 'failed';
}

/**
 * In-process queue: FIFO per kind, singleton keys dedupe queued (not running) jobs, retries with backoff.
 * `retryDelayMs` can be overridden (0 in tests). Never persisted — an api restart drops queued work,
 * which is why 05 §9 keeps versions in `resolving` recoverable via re-evaluate (M1 pg-boss makes it durable).
 */
export class InProcessJobQueue implements JobQueue {
  private entries = new Map<JobId, Entry>();
  private queues = new Map<JobKind, JobId[]>();
  private handlers = new Map<JobKind, { handler: (job: Job<JobKind>) => Promise<void>; concurrency: number; timeoutMs: number; running: number }>();
  private seq = 0;
  private waiters: (() => void)[] = [];
  private failedCount = 0;

  constructor(private readonly opts: { retryDelays?: number[]; onError?: (err: unknown, entry: { id: string; kind: string; attempt: number }) => void } = {}) {}

  async enqueue<K extends JobKind>(_tx: Tx | null, kind: K, payload: JobPayload<K>, opts: { singletonKey?: string } = {}): Promise<JobId> {
    if (opts.singletonKey) {
      // pg-boss semantics: one job per singleton key while it is queued OR running
      for (const e of this.entries.values()) {
        if (e.kind === kind && (e.state === 'queued' || e.state === 'running') && e.singletonKey === opts.singletonKey) return e.id;
      }
    }
    const id = `job-${++this.seq}`;
    this.entries.set(id, { id, kind, payload, singletonKey: opts.singletonKey, attempt: 0, state: 'queued' });
    const q = this.queues.get(kind) ?? [];
    q.push(id);
    this.queues.set(kind, q);
    queueMicrotask(() => this.pump(kind));
    return id;
  }

  work<K extends JobKind>(kind: K, handler: (job: Job<K>) => Promise<void>, opts: { concurrency: number; timeoutMs: number }): void {
    this.handlers.set(kind, { handler: handler as (job: Job<JobKind>) => Promise<void>, concurrency: opts.concurrency, timeoutMs: opts.timeoutMs, running: 0 });
    queueMicrotask(() => this.pump(kind));
  }

  async retry(jobId: JobId): Promise<void> {
    const e = this.entries.get(jobId);
    if (!e || e.state !== 'failed') return;
    e.state = 'queued';
    e.attempt = 0;
    this.failedCount--;
    const q = this.queues.get(e.kind) ?? [];
    q.push(e.id);
    this.queues.set(e.kind, q);
    queueMicrotask(() => this.pump(e.kind));
  }

  status() {
    let queued = 0;
    let running = 0;
    for (const e of this.entries.values()) {
      if (e.state === 'queued') queued++;
      else if (e.state === 'running') running++;
    }
    return { queued, running, failed: this.failedCount };
  }

  drain(): Promise<void> {
    const { queued, running } = this.status();
    if (queued === 0 && running === 0) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private settle(): void {
    const { queued, running } = this.status();
    if (queued === 0 && running === 0) {
      const w = this.waiters;
      this.waiters = [];
      for (const r of w) r();
    }
  }

  private pump(kind: JobKind): void {
    const h = this.handlers.get(kind);
    const q = this.queues.get(kind);
    if (!h || !q) return;
    while (h.running < h.concurrency && q.length) {
      const id = q.shift()!;
      const e = this.entries.get(id);
      if (!e || e.state !== 'queued') continue;
      e.state = 'running';
      e.attempt++;
      h.running++;
      const job: Job<JobKind> = { id, kind, payload: e.payload as JobPayload<JobKind>, attempt: e.attempt };
      const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`job ${kind} timed out after ${h.timeoutMs} ms`)), h.timeoutMs).unref());
      Promise.race([h.handler(job), timeout])
        .then(() => {
          e.state = 'done';
        })
        .catch((err: unknown) => {
          e.lastError = err instanceof Error ? err.message : String(err);
          this.opts.onError?.(err, { id, kind, attempt: e.attempt });
          const delays = this.opts.retryDelays ?? RETRY_DELAYS_MS;
          if (e.attempt <= delays.length) {
            e.state = 'queued';
            const delay = delays[e.attempt - 1] ?? 0;
            setTimeout(() => {
              q.push(id);
              this.pump(kind);
            }, delay).unref();
          } else {
            e.state = 'failed';
            this.failedCount++;
          }
        })
        .finally(() => {
          h.running--;
          this.pump(kind);
          this.settle();
        });
    }
  }
}
