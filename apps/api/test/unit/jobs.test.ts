import { describe, expect, it } from 'vitest';
import { InProcessJobQueue } from '../../src/pipeline/jobs.js';

describe('InProcessJobQueue (D44)', () => {
  it('runs jobs, dedupes singleton keys, retries then fails', async () => {
    const q = new InProcessJobQueue({ retryDelays: [0, 0, 0] });
    const seen: string[] = [];
    let attempts = 0;
    q.work('resolve', async (job) => { seen.push(job.payload.versionId); }, { concurrency: 2, timeoutMs: 1000 });
    q.work('check', async () => { attempts++; throw new Error('boom'); }, { concurrency: 1, timeoutMs: 1000 });
    await q.enqueue(null, 'resolve', { tenantId: 't', versionId: 'v1', requestId: 'r' }, { singletonKey: 'v1' });
    await q.enqueue(null, 'resolve', { tenantId: 't', versionId: 'v1', requestId: 'r' }, { singletonKey: 'v1' });
    await q.enqueue(null, 'resolve', { tenantId: 't', versionId: 'v2', requestId: 'r' });
    await q.enqueue(null, 'check', { tenantId: 't', versionId: 'v1', asOf: null, requestId: 'r' });
    await q.drain();
    expect(seen.sort()).toEqual(['v1', 'v2']);
    expect(attempts).toBe(4); // 1 + 3 retries (15 §7)
    expect(q.status().failed).toBe(1);
  });
});
