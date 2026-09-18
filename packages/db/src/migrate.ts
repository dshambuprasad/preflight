import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDb, type Db } from './client.js';

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

/** Applies every migration in ./migrations (Drizzle journal order). Idempotent. */
export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(2);
  }
  const handle = createDb(url, { poolMax: 2 });
  runMigrations(handle.db)
    .then(async () => {
      console.log('migrations applied');
      await handle.close();
    })
    .catch(async (err) => {
      console.error(err);
      await handle.close();
      process.exit(1);
    });
}
