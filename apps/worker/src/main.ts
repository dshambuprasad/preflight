// Worker-role entry (16 §1: worker may import api's pipeline/ only). Runs the same stage handlers the api
// runs in-process; with PREFLIGHT_ROLE=worker the api serves HTTP and this process consumes jobs.
// SPEC-GAP (D44): until pg-boss lands in M1 the in-process queue is per-process, so a separate worker
// sees no jobs; PREFLIGHT_ROLE=all is the only working topology in M0.
import { createDb, repo } from '@preflight/db';
import { createPipeline, InProcessJobQueue } from '@preflight/api/pipeline';
import { loadEnv, createLogger, loadRulebook, createSecretBox, systemClock, installNodeCrypto, API_VERSION } from '@preflight/api';

const env = loadEnv({ ...process.env, PREFLIGHT_ROLE: 'worker' });
const logger = createLogger(env.LOG_LEVEL);
installNodeCrypto();
const handle = createDb(env.DATABASE_URL, { poolMax: env.DATABASE_POOL_MAX });
const rulebook = await loadRulebook(env.PREFLIGHT_RULEBOOK_DIR);
const queue = new InProcessJobQueue({ onError: (err, e) => logger.error({ err, ...e }, 'job failed') });
const pipeline = createPipeline({ env, db: handle.db, repo, rulebook, queue, clock: systemClock, logger, secretBox: createSecretBox(env.PREFLIGHT_KMS_KEY), version: API_VERSION });
pipeline.startWorkers();
logger.info({ rulebookHash: rulebook.hash }, 'preflight worker up');
process.on('SIGTERM', async () => {
  await queue.drain();
  await handle.close();
  process.exit(0);
});
