# 17 — Library Decisions

Per concern: candidates considered, choice, why, licence, maintenance signal, and the seam that lets us swap it. Verified 2026-09-11 (light pass; version numbers are what npm showed that day — pin exact versions in the lockfile, not here).

**Rule:** anything that touches the evidence chain, the rule engine, or identity normalisation must be either zero-dependency or a standards-implementing library with a conformance test we run ourselves.

| Concern | Candidates | **Choice** | Why | Licence | Swap seam |
|---|---|---|---|---|---|
| **Canonical JSON (RFC 8785)** | `canonicalize`, `json-canonicalize`, hand-rolled | **`canonicalize`** (reference JS impl of JCS) — *and* a **conformance test** against the RFC's published test vectors in `core/test/jcs.test.ts` | The certificate hash depends on this being bit-exact across Node and browser. `json-canonicalize` adds non-standard extensions (cyclic refs) we don't want near evidence. If the package ever drifts, the conformance test fails, and the algorithm is small enough (~80 lines) to vendor. | MIT | `core.canonicalJSON()` — single function; vendor if needed |
| **Hashing** | Node `crypto`, WebCrypto, `hash-wasm` | **Node `crypto` (server) / WebCrypto `subtle.digest` (browser)**, injected via `core.setCrypto()` | Zero deps; both are SHA-256 conformant. Core stays pure. | — | `setCrypto()` |
| **Job queue** | pg-boss, BullMQ (Redis), Graphile Worker, Temporal | **pg-boss** (v12.x, actively released — 12.30 published this week) | Postgres-only infra; transactional enqueue with the row that caused it; singleton keys (needed for per-tenant seal serialisation); partitioned job table since v10; retries default-on. Graphile Worker is a fine alternative but lacks singleton semantics out of the box. BullMQ needs Redis. Temporal is overkill for six stages. | MIT | `JobQueue` interface (16 §2.5) |
| **ORM / migrations** | Drizzle, Prisma, Kysely + raw SQL | **Drizzle** | SQL-visible migrations (auditable for the append-only tables), no query-engine binary, TS-first, works with RLS and advisory locks without escape hatches. Prisma's migration SQL is generated and harder to review; Kysely has no migration story of its own. | Apache-2.0 | `repo` in `packages/db` — the only place SQL lives |
| **Postgres driver** | `pg`, `postgres` (porsager) | **`pg`** | pg-boss and Drizzle both target it; boring and everywhere. | MIT | via Drizzle |
| **HTTP framework** | Fastify, Hono, Express, NestJS | **Fastify 5** | Schema-first (Zod via `fastify-type-provider-zod`), request-scoped context for tenancy, first-class OpenAPI generation, mature plugin isolation. Hono is excellent but younger for long-running Node services with streaming multipart; Nest adds ceremony. | MIT | routes are thin; pipeline is framework-free |
| **Validation** | Zod, Valibot, TypeBox | **Zod 3/4** | Single schema → runtime validation + TS types + OpenAPI; ecosystem. | MIT | schemas in one folder |
| **CSV parsing** | `csv-parse` (csv-suite), `fast-csv`, `papaparse`, `csv-parser` | **`csv-parse`** (server, streaming) · **`papaparse`** (browser preview only) | csv-parse is the most spec-compliant streaming parser (RFC 4180 quoting, BOM, relaxed modes) and has been maintained since 2010; benchmarks disagree on "fastest" but all are far above our 60 s / 10⁶-row budget. Correctness beats speed here — malformed files are a documented failure mode (14 §1). PapaParse is the only mature browser streamer, used solely for the mapping-preview sample. | MIT / MIT | `connectors/csv` |
| **Phone normalisation** | `libphonenumber-js`, `google-libphonenumber`, `awesome-phonenumber` | **`libphonenumber-js`** with the `min` metadata + an **India test table** (mobile 10-digit with/without 0 / +91 / 91, landlines, short codes → invalid) | 145 kB vs 550 kB; runs in browser for previews; skips short-code/emergency edge cases we explicitly want rejected anyway. **Metadata is versioned — pin and update deliberately**; changes can alter `phone_e164` and therefore identity keys, so an update is a migration event with a re-resolution note. | MIT | `core.normalisePhone()` |
| **Email normalisation** | `validator`, hand-rolled | **hand-rolled** (trim, lowercase, single `@`, no spaces, IDN left as-is) | Full RFC 5322 validation rejects real addresses; we need a stable key, not a validity oracle. | — | `core.normaliseEmail()` |
| **Turtle parsing** | `n3`, `rdflib.js`, `oxigraph` (wasm) | **`n3`** | Small, streaming, standards-compliant, no reasoner, no store needed — we walk triples into our own graph structure. rdflib.js is heavy; oxigraph is a full store. | MIT | `packages/rulegraph` loader |
| **Graph rendering** | Cytoscape.js (+`cytoscape-dagre`), vis-network, React Flow, D3 | **Cytoscape.js + dagre layout** | Best layouts for DAG explain paths, MIT, active, framework-agnostic. React Flow is node-editor oriented; vis-network is fine but layouts are weaker; D3 is a toolkit not a solution. | MIT | one `<RuleGraph>` component |
| **Charts (coverage radar)** | recharts, visx, Chart.js | **recharts** | Declarative React, enough for one radar/bar. | MIT | one component |
| **Certificate → PDF** | Print CSS (browser), Playwright/Chromium render, `pdfkit`, `@react-pdf/renderer` | **Print CSS in v1** (`Print / PDF` = browser print); **server-side Chromium (Playwright) in M6** for emailed/archived PDFs | Zero infra for the demo; the HTML is the artifact and it's self-contained. Server PDF adds a Chromium dependency — worth it only when a regulator needs a file without a browser. pdfkit would mean a second layout engine to keep in sync with the HTML. | — / Apache-2.0 | `evidence/certificate.ts` renders HTML; PDF is a wrapper |
| **Script detection** | `franc` (language), Unicode-range regex | **Unicode-range regex in core** (already in PreflightCore `lang.js`) | We detect *script*, not language, on purpose (04, 06 rulebook); franc would overclaim Hindi vs Marathi and pull in a trigram table. | — | `core.detectScript()` |
| **Password / key hashing** | argon2, bcrypt, scrypt (Node) | **`argon2`** (native) | OWASP-recommended; API keys hashed the same way. Native build is fine in Docker. | MIT | `auth/hash.ts` |
| **Symmetric encryption (creds)** | Node `crypto` AES-256-GCM, libsodium | **Node `crypto` AES-256-GCM** | Zero deps; KMS integration later replaces the key source, not the cipher. | — | `SecretBox` |
| **Logging** | pino, winston | **pino** + `pino-http` | Fast JSON; redaction paths built in (PII). | MIT | `observability/` |
| **Metrics / tracing** | `prom-client`, OpenTelemetry SDK | **`prom-client`** now; **OTel SDK** wired with no-op exporter | Prometheus is the pilot ask; OTel keeps the door open. | Apache-2.0 | `observability/` |
| **Rate limiting** | `@fastify/rate-limit` | **`@fastify/rate-limit`** with Postgres-free in-memory store per replica (v1) | Adequate for pilot; a shared store is a one-line change later. | MIT | plugin |
| **Web framework** | React + Vite, Next.js, Remix | **React 19 + Vite** (SPA) | No SSR need; API is separate; simplest deploy (static). | MIT | — |
| **Routing / data** | TanStack Router + Query | **TanStack** | Typed routes; cache/polling for pipeline progress. | MIT | — |
| **UI primitives** | Radix, shadcn, MUI | **Radix + Tailwind** | Accessible primitives, our own look (07). | MIT | — |
| **Testing** | Vitest, `node:test`, Playwright, tinybench, dependency-cruiser | as in 11 | core uses `node:test` to stay zero-dep. | MIT | — |
| **Monorepo** | pnpm workspaces + Turborepo, Nx | **pnpm workspaces + Turborepo** | Caching for CI; minimal config. | MIT | — |
| **LLM (M5)** | Anthropic SDK, OpenAI SDK, Vercel AI SDK | **Anthropic SDK behind `LLMAdapter`** | Default provider; adapter keeps it swappable; prompt versioned in repo. | MIT | `LLMAdapter` |

## Things deliberately **not** used

- **OWL reasoners / rdflib / OrionBelt at runtime** — explainability requirement (04 §7). Ontology thinking informed the graph; the tool is not a dependency.
- **Redis** — one infra dependency (Postgres) until a measured need.
- **An auth SaaS (Auth0/Clerk)** — regulated buyers prefer self-contained; v1 auth is simple and ours; SSO is deferred (01).
- **A CDP / identity-resolution library** — exact-match only in v1 (D11); adding probabilistic matching is a product decision, not a library choice.
- **Any BUSL / SSPL-licensed dependency in the runtime path** — licence check in CI (`license-checker` allowlist: MIT, Apache-2.0, BSD, ISC, 0BSD, Unlicense).

## Upgrade policy

Lockfile committed; Renovate weekly with grouped minor updates; **`libphonenumber-js` metadata, `canonicalize`, `pg-boss`, and `drizzle-kit` are pinned exact and updated only in a dedicated PR with the conformance/identity re-resolution notes attached.**
