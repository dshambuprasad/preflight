// F8 — demo tenant, four users (one per role), Layer-C config, identity HMAC key. Password printed once.
import { randomBytes } from 'node:crypto';
import { TenantConfigSchema, createDb, repo, runMigrations, withTransaction } from '@preflight/db';
import { loadEnv } from './env.js';
import { hashSecret } from './auth/hash.js';
import { createSecretBox, newIdentityHmacKey } from './secretbox.js';

export const DEMO_USERS = [
  { email: 'admin@demo.preflight', displayName: 'Asha Menon', roles: ['admin'] as const },
  { email: 'ops@demo.preflight', displayName: 'A. Rao', roles: ['operator'] as const },
  { email: 'review@demo.preflight', displayName: 'R. Mehta', roles: ['reviewer'] as const },
  { email: 'approve@demo.preflight', displayName: 'S. Iyer', roles: ['approver'] as const },
];

export const DEMO_CONFIG = TenantConfigSchema.parse({
  lenderName: 'Example Finance',
  entityType: 'nbfc',
  frequencyCapPerWeek: null,
  rulePacks: ['india-layer-a', 'preflight-hygiene'],
});

export async function seedDemo(env = loadEnv(), password = process.env.PREFLIGHT_SEED_PASSWORD ?? randomBytes(9).toString('base64url')): Promise<{ tenantId: string; password: string; created: boolean }> {
  const handle = createDb(env.DATABASE_URL);
  try {
    await runMigrations(handle.db);
    const box = createSecretBox(env.PREFLIGHT_KMS_KEY);
    return await withTransaction(handle.db, async (tx) => {
      const existing = await repo.tenants.getBySlug(tx, 'demo');
      if (existing) {
        if (!existing.identityHmacKeyEnc) {
          const { enc, iv } = box.seal(newIdentityHmacKey());
          await repo.tenants.setIdentityHmacKey(tx, existing.id, enc, iv);
        }
        return { tenantId: existing.id, password, created: false };
      }
      const { enc, iv } = box.seal(newIdentityHmacKey());
      const tenant = await repo.tenants.create(tx, { slug: 'demo', name: 'Example Finance (demo)', config: DEMO_CONFIG, identityHmacKeyEnc: enc, identityHmacKeyIv: iv });
      const passwordHash = await hashSecret(password);
      for (const u of DEMO_USERS) await repo.users.create(tx, tenant.id, { email: u.email, displayName: u.displayName, roles: [...u.roles], passwordHash });
      await repo.audit.insert(tx, tenant.id, { actorId: null, actorRoles: [], entityType: 'tenant', entityId: tenant.id, action: 'user.created', requestId: 'seed', after: { users: DEMO_USERS.map((u) => u.email) } });
      return { tenantId: tenant.id, password, created: true };
    });
  } finally {
    await handle.close();
  }
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  seedDemo()
    .then((r) => {
      console.log(r.created ? 'Seeded demo tenant.' : 'Demo tenant already present; nothing changed.');
      console.log(`  users: ${DEMO_USERS.map((u) => u.email).join(', ')}`);
      if (r.created) console.log(`  password (all four): ${r.password}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
