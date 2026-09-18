// Fresh schema for every integration run; fails loudly without DATABASE_URL (never skipped).
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required for @preflight/db integration tests (docker compose -f infra/compose.yaml up -d db)');
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;');
  await migrate(drizzle(pool), { migrationsFolder: join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations') });
  await pool.end();
}
