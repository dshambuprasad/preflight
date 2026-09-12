# 02 — Architecture (High-Level Design)

## 1. System context

```
                     ┌──────────────────────────────────────────────┐
   Operator ───────▶ │                                              │
   Reviewer ───────▶ │                 PREFLIGHT                    │ ──▶ Sending tools (export / webhook /
   Approver ───────▶ │   check the list + the message, keep proof   │     WATI suppression push — M4)
   Admin    ───────▶ │                                              │
                     └───────┬───────────────────┬──────────────────┘
                             │ read-only         │ read-only
                             ▼                   ▼
                    WhatsApp BSP (WATI)     Meta Graph API
                    templates · history     quality_rating · tier
                    quality webhook

   Tenant data in: CSV upload · JSON API · (M4) mapped schema import
   Rulebook in:    Turtle files in the repo, versioned by git + content hash
   Advisory (M5):  LLM provider behind an adapter, feature-flagged
```

Preflight **never sends a message**. All external integrations are read-only in v1 except the M4 suppression push to WATI, which is explicitly opt-in and logged.

## 2. Containers (DECISION)

Monorepo, pnpm workspaces, TypeScript everywhere.

| Container | Tech | Responsibility |
|---|---|---|
| `packages/core` | TS, **zero runtime deps**, no I/O | Rule contract, evaluation engine, coverage, classification heuristics, identity normalisation. Ported from `builds/PreflightCore`. Runs in Node **and** the browser. |
| `packages/rules-india` | TS + data | The India rule pack. Each rule: metadata + `evaluate()`. Generated/validated against the rule graph. |
| `packages/rulegraph` | TS + N3 (Turtle) | Loads `rulebook/*.ttl`, validates it, computes the rulebook content hash, serves graph JSON, checks every code rule has a graph node and vice versa. |
| `packages/db` | Drizzle ORM + Postgres | Schema, migrations, typed queries, tenancy helpers. |
| `apps/api` | Fastify 5, Zod, pg-boss | REST API, pipeline orchestration, job queue, evidence sealing, connectors, auth. |
| `apps/web` | React 19, Vite, TanStack Query/Router, Cytoscape.js | The UI. Talks only to `apps/api`. |
| `apps/worker` | Node, pg-boss consumer | Runs pipeline jobs. **In v1 it is the same process as `apps/api`** (single `node` invocation runs both); the split is a deployment flag, not a code change. |
| `infra/` | Docker Compose, Dockerfiles | Postgres 16, api, web. `docker compose up` = full system. |

**Why these:**
- *Fastify* over Express: schema-first with Zod, fast, first-class TS, plugin isolation per tenant context.
- *Drizzle* over Prisma: SQL-transparent migrations (auditable), no query engine binary, works with row-level security later.
- *pg-boss* over Redis/BullMQ: the queue lives in Postgres — one infra dependency, transactional enqueue with the row that caused it, prod-capable to ~thousands of jobs/min, which is far beyond v1.
- *Cytoscape.js* (MIT) over vis-network for the rule graph: better layout algorithms, active maintenance, no BUSL concerns.
- *N3* for Turtle parsing: small, standards-compliant, no reasoner (we don't want one — see 04 §7).

## 3. Components inside `apps/api`

```
apps/api/src/
  server.ts              Fastify bootstrap, plugins, routes
  auth/                  API-key + session auth, role guard, tenant context
  tenancy/               tenant resolution middleware; every query goes through it
  pipeline/
    stages/ingest.ts     normalise input → CampaignVersion (immutable snapshot)
    stages/resolve.ts    identity normalisation, dedupe, consent lookup
    stages/check.ts      calls packages/core with the tenant's rule packs + config
    stages/decide.ts     records Decisions; enforces authority + separation rules
    stages/seal.ts       writes EvidenceRecord with hash chain
    stages/handoff.ts    export / webhook / (M4) connector push
    machine.ts           the CampaignVersion state machine (05)
    jobs.ts              pg-boss job definitions; one job per stage transition
  rulebook/              loads rule packs; caches by rulebook hash
  evidence/              canonical JSON, hashing, chain verification, certificate render
  connectors/            csv/, mapping/, wati/, meta/ — each behind the Connector interface (08)
  advisory/              (M5) LLM adapter interface + null implementation
  observability/         pino, request ids, /health, /metrics (OpenTelemetry-ready)
```

## 4. Primary data flow (the happy path)

```
1. POST /campaigns            → Campaign row (tenant-scoped)
2. POST /campaigns/:id/versions
      body: message, channel, scheduledAt, purpose, segment, audience (rows | uploadId)
      → INGEST: validate, normalise, snapshot → CampaignVersion(state=draft) + AudienceRow[]
      → enqueue job resolve(versionId)
3. RESOLVE job                → identity keys, dupes, consent join → AudienceRow updated
      → enqueue job check(versionId, asOf=null)
4. CHECK job                  → packages/core.evaluate(...) → Evaluation + Finding[]
      → state=evaluated
5. Operator acts (UI/API):
      fix     → POST /versions/:id/fix  → creates version N+1 from N with the remediation applied → back to step 3
      accept  → POST /findings/:id/decisions {type:accept, reasonCode, scope, expiresAt}
      submit  → POST /versions/:id/submit → state=in_review
6. Reviewer: POST /versions/:id/review {sections:{audience,message,rules,delivery}, outcome}
      → state=approved | rejected (rejected → back to draft with reviewer notes)
7. SEAL job (auto on approve)  → EvidenceRecord(prev_hash, hash, ...) → state=sealed
8. HANDOFF: GET /versions/:id/export | POST /versions/:id/handoff {target} → state=handed_off
```

**Every transition writes an `AuditEvent`.** The evidence record is a *sealed snapshot*; the audit log is the *running history*. Both exist; they are not the same thing. *(01_Concept — report vs evidence record)*

## 5. Time and versions — the two axes the whole system runs on

- **`asOf`** — the instant the rules are evaluated *for*. Defaults to the version's `scheduledAt`. Time-travel sets it explicitly. Shadow mode sets it to the historical `sentAt`. The core never reads a clock.
- **`rulebookHash`** — the content hash of the rule pack(s) used. Stored on every Evaluation and every EvidenceRecord. Changing a rule changes the hash; old evaluations remain reproducible against the old rulebook (the repo keeps every version in git; the hash is the pointer).
- **`CampaignVersion`** — immutable once created. Fixes create new versions. The evidence record binds to exactly one version. *(01_Concept gap 2)*

## 6. Multi-tenancy (DECISION)

- `tenant_id` on **every** table except `tenants` itself and global rulebook tables.
- Resolved once per request from the API key / session; injected into a request-scoped context; **every query helper in `packages/db` requires it as its first argument** — there is no way to write a cross-tenant query by accident.
- Postgres row-level security is *prepared for* (policies can be added per table) but not enabled in v1.
- Rulebooks are global and read-only; Layer-C config, exceptions and learned proposals are per tenant.

## 7. Authorization model (DECISION)

| Action | Roles | Additional rule |
|---|---|---|
| Create campaign / version, run fix | `operator`, `admin` | — |
| Accept-with-reason on a `warn`/`info` finding | `operator`, `reviewer`, `admin` | Recorded with actor + role |
| Accept-with-reason on a `block` finding | `reviewer`, `admin` | Operators cannot waive blockers |
| Submit for review | `operator`, `admin` | — |
| Review (approve/reject) | `reviewer`, `admin` | **MUST NOT be the author of the version** |
| Blast-radius approval | `approver`, `admin` | Required when `audienceSize ≥ tenant.config.blastRadiusThreshold` (default 10,000) |
| Seal | system | On approve |
| Manage config / connectors / users | `admin` | — |

This encodes the RBI fact that compliance is structurally separate from business. *(05_Scope_Tightening)*

## 8. Prod-readiness decisions made now (because they're rewrites later)

| Decision | Why now |
|---|---|
| Postgres from day one | SQLite→PG migration bites on types, constraints, concurrency |
| `tenant_id` everywhere | Retrofitting tenancy is a full data-model rewrite |
| Append-only hash-chained evidence | History can't be made tamper-evident retroactively |
| Roles in the model | The reviewer/author separation is a product fact, not a feature |
| Stages behind a job interface | In-process today; distributed workers later without touching stage code |
| `asOf` + `rulebookHash` on every evaluation | Reproducibility can't be added after the fact |
| Connector interface with a null/mock implementation | Tests never hit real APIs; real connectors are drop-ins |
| Idempotency keys on all POSTs that create work | Retries are safe from day one |
| Structured logs with request + tenant ids | Debuggable in prod without redesign |

## 9. Scaling path (what changes, what doesn't)

| Load | What changes |
|---|---|
| Demo (1 tenant, 10² contacts) | Nothing. `docker compose up`. |
| Pilot (5 tenants, 10⁵ contacts/campaign) | Run `apps/worker` as a separate process (flag). Add Postgres indexes already defined in 03. Stream CSV ingest (already streaming). |
| Production (50 tenants, 10⁶ contacts/campaign, 10³ campaigns/day) | Multiple worker replicas (pg-boss handles it). Partition `audience_rows` and `contact_events` by tenant+month. Read replica for the UI. Object storage (S3-compatible) for uploads and certificates instead of Postgres `bytea`. Enable RLS. |
| Beyond | Evaluate per-rule parallelism inside `check` (rules are independent — trivially parallel); move contact events to a columnar store for frequency queries. |

Nothing in the list above changes the rule contract, the pipeline state machine, the data model's logical shape, or the API. That is the point of deciding §8 now.

## 10. What the core must never know about

`packages/core` MUST NOT import from `db`, `api`, any connector, or any HTTP/FS module. It receives plain data and returns plain data. This is enforced with an ESLint `no-restricted-imports` rule and a test that bundles `core` for the browser and asserts the bundle has no Node built-ins.
