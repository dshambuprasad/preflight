# 09 — Non-Functionals, Security, Operations

## 1. Non-functional requirements

| Area | Requirement | How verified |
|---|---|---|
| **Determinism** | Same (version, asOf, rulebookHash) → byte-identical evaluation | test 11 §2 |
| **Evaluation latency** | 10⁵ contacts × 25 rules < 2 s single-thread; 10⁴ < 300 ms | benchmark in CI (`pnpm bench`), fails on 2× regression |
| **Ingest** | 10⁶-row CSV streams without loading into memory; < 60 s | benchmark |
| **API latency** | p95 < 300 ms for reads; writes enqueue and return 202 | k6 smoke in CI |
| **Availability (prod target)** | 99.5% monthly; stateless api/worker; Postgres managed | runbook |
| **Data retention** | evidence + audit: ≥ 7 years, never deleted; uploads: 90 days then object-store cold; contact_events: per tenant config, default 24 months | retention job + test |
| **Integrity** | evidence chain verifies end-to-end; verification cost O(n) with n ≤ 10⁵ per tenant fine | `GET /evidence/verify` |
| **Reproducibility** | any past evaluation re-runnable against the rulebook hash it used (git keeps every rulebook) | test: check out old hash, re-evaluate, compare |

## 2. Security

- **Tenancy isolation:** every query takes `tenantId` explicitly (02 §6). A CI test greps `packages/db` for raw queries lacking a tenant predicate. RLS policies scripted, enabled in prod.
- **Auth:** argon2id for passwords and API-key hashes; session cookies `HttpOnly; Secure; SameSite=Lax`; CSRF token on state-changing web requests.
- **Authorization:** role guards at route level **and** in the pipeline (defence in depth — the state machine re-checks roles).
- **Secrets:** env only; `.env.example` committed, `.env` never; connector credentials encrypted at rest (08 §1); no secret is ever logged (pino redact paths).
- **PII:** phone/email are PII. Logs redact them. Exports are tenant-scoped and audited. Certificates contain hashes of the audience, not rows (03 §8). Uploads are deletable by admin (audited) except where referenced by a sealed record, in which case only the raw file is purged and the hash retained.
- **Input:** Zod on every boundary; CSV parsed with a streaming parser with cell length limits; template bodies HTML-escaped on render; message text rendered as text, never HTML.
- **Rate limiting** (06 §6); request size limit 25 MB (uploads) / 1 MB (JSON).
- **Dependencies:** `pnpm audit` in CI; lockfile committed; renovate weekly. **Licence allowlist** (MIT, Apache-2.0, BSD-2/3, ISC, 0BSD, Unlicense) enforced by `license-checker` in CI — BUSL/SSPL/AGPL in the runtime path fail the build.
- **Headers:** Helmet defaults; CSP `default-src 'self'`; no third-party scripts in the web app (Cytoscape/recharts are bundled).
- **LLM (M5):** the advisory adapter sends *only* the message text and classification — never audience rows, never PII. Provider and prompt version recorded on the evaluation. Disabled by default.

## 3. Observability

- **Logs:** pino JSON; every line carries `requestId`, `tenantId`, `userId?`, `versionId?`; PII redacted.
- **Metrics:** Prometheus at `/metrics`: request latency histograms, job durations by stage, evaluation duration, findings by severity, chain-verify results, connector sync counts/failures.
- **Tracing:** OpenTelemetry SDK wired with a no-op exporter by default; OTLP endpoint via env.
- **Health:** `/health` checks DB, queue, rulebook loaded (returns hash).
- **Audit:** everything a human does is an `audit_events` row (03 §6) — this is product, not ops.

## 4. Deployment

**Laptop / demo:** `docker compose up` → postgres:16, api (api+worker in one process), web (Vite build served by nginx). Seed script creates a tenant, four users (one per role), config, and the sample campaigns. `PREFLIGHT_DEMO_MOCK_CONNECTORS=true` by default in the compose file.

**Pilot:** same images; managed Postgres (RDS/Cloud SQL); api and worker as separate services (`PREFLIGHT_ROLE=api|worker`); object storage for uploads/certificates (`PREFLIGHT_STORAGE=s3`); TLS at the load balancer; secrets from the platform's secret manager.

**Prod:** as pilot + replicas, read replica, RLS on, partitioning migration for `contact_events`, backups with PITR, restore drill documented.

Images are multi-stage, non-root, pinned base digests. CI: lint → typecheck → unit → integration (Postgres service) → e2e (Playwright against compose) → bench → build → push.

## 5. Runbooks (written in M6; stubs in M1)

- Chain verification failure → freeze sealing for tenant, page, investigate from `firstBrokenSeq`.
- Rulebook hash mismatch on boot → refuse to start (a rulebook that doesn't validate never serves).
- Connector sync failures → capability marked degraded; coverage radar reflects it; no rule silently passes.
- Job stuck → pg-boss visibility; manual retry endpoint (admin).
- `libphonenumber-js` metadata update → treated as a **re-resolution event**: run the identity-key diff script against `contacts`; any key change is logged and surfaced before deploy.

## 6. Compliance posture of Preflight itself

Preflight holds borrower PII on behalf of regulated entities. It is a **data processor** under DPDP. v1 documents: data map (which tables hold PII), retention, deletion path, and the processor obligations. Not a legal review — a checklist so the product doesn't fail the buyer's vendor due diligence on the first question.
