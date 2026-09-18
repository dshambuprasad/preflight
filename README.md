# Preflight

Before a lender sends a campaign, Preflight checks the recipient list and the message together against a versioned rulebook, lets the right person fix or accept each finding with a recorded reason, seals an immutable evidence record, and hands the corrected campaign to the sending tool. It never certifies compliance; it finds gaps for human review and proves the review happened.

The specification set in `spec/` is normative (start at `spec/00_README.md`); `CLAUDE.md` lists the non-negotiables.

## Run it (M0)

```bash
docker compose -f infra/compose.yaml up --build        # postgres:16 · api (api+worker) · web (nginx)
# api on http://localhost:3000, web on http://localhost:8080
# demo users: admin@ / ops@ / review@ / approve@ demo.preflight — password demo-pass-1234 (PREFLIGHT_SEED_PASSWORD)
```

Local development:

```bash
pnpm install && pnpm build
docker compose -f infra/compose.yaml up -d db
cp .env.example .env   # fill PREFLIGHT_KMS_KEY (32 bytes base64) and PREFLIGHT_SESSION_SECRET
pnpm seed              # prints the demo password once
pnpm dev               # api on :3000 (migrations run on boot)
pnpm --filter @preflight/web dev   # web on :5173, proxies /v1 → :3000
```

## Verify

```bash
pnpm ci:local          # same steps as .github/workflows/ci.yml: build · api-types drift · lint · licences · unit · integration · bench
pnpm test              # unit (core + rules use node:test; the rest vitest)
pnpm test:integration  # needs DATABASE_URL (Postgres from compose)
pnpm bench             # 18 §7 — fails on 2× regression vs bench/baseline.json
```

## Layout

`packages/core` (pure engine) · `packages/rules-india` (rule packs) · `packages/rulegraph` (Turtle graph loader) · `packages/db` (Drizzle schema, migrations, tenant-first repo) · `packages/api-types` (generated contract) · `apps/api` · `apps/web` · `apps/worker` · `rulebook/` (`*.ttl`) · `infra/` · `bench/` · `e2e/`.

Milestone status: **M0** (spine skeleton) — see `spec/10_Milestones.md`; decisions taken during the build are in `spec/12_Decisions_and_Open_Items.md §H`.
