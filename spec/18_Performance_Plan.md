# 18 — Performance Plan

Not targets — the plan for how they're met, with the arithmetic. Targets themselves are in `09 §1`.

## 1. Sizing assumptions (12-month pilot horizon)

| Quantity | Demo | Pilot (per tenant) | Prod (50 tenants) |
|---|---|---|---|
| Campaigns / month | 5 | 200 | 10,000 |
| Versions / campaign | 2 | 2.5 | 2.5 |
| Audience / version (median · p95) | 12 · 12 | 20k · 250k | 20k · 1M |
| `audience_rows` / month | 120 | 10M | 500M |
| Unique `contacts` | 12 | 2M | 100M |
| `contact_events` / month (with connectors) | 0 | 15M | 750M |
| `findings` / month | 25 | 50k | 2.5M |
| `evidence_records` / month | 5 | 300 | 15k |
| Concurrent evaluations | 1 | 5 | 50 |

**Consequence:** `audience_rows` and `contact_events` are the only large tables. Everything else is small and index-bound. Design effort goes there.

## 2. Hot paths and their plan

### 2.1 INGEST — 10⁶ rows in < 60 s
- Stream the CSV (`csv-parse`) → batches of 1,000 → `COPY`-style multi-row INSERT via Drizzle (`insert().values(batch)`), one transaction per 10,000 rows (not one giant transaction — keeps WAL and locks sane; a failure rolls back to the last 10k boundary and the version is deleted as a unit).
- Row normalisation (phone/email) happens in the stream, single pass; libphonenumber `min` metadata ≈ 20 µs/parse → 20 s per 10⁶ worst case; acceptable, and it's CPU on the API process only for inline; for uploads it runs in the RESOLVE job.
- Memory: constant (streams); no `readFileSync`.
- Budget: parse 10 s + normalise 20 s + insert 25 s ≈ 55 s at 10⁶. **Bench asserts < 60 s; alert at 45 s.**

### 2.2 RESOLVE — duplicates and consent join
- Duplicates: `identity_key` is written during INGEST; a single SQL pass:
  `UPDATE audience_rows a SET duplicate_of_row_id = f.id FROM (SELECT DISTINCT ON (identity_key) id, identity_key FROM audience_rows WHERE version_id=$1 ORDER BY identity_key, row_no) f WHERE a.version_id=$1 AND a.identity_key=f.identity_key AND a.id<>f.id AND a.identity_key NOT LIKE 'row:%'`
  — one index scan on `(tenant_id, version_id, identity_key)`. O(n log n) in Postgres, not in Node.
- Consent join: `consent.bulkCurrent(identityKeys[])` in chunks of 5,000 using `DISTINCT ON (contact_id, purpose) ... ORDER BY recorded_at DESC` against index `(tenant_id, contact_id, purpose, recorded_at desc)`. 10⁶ keys → 200 queries ≈ 200 × 30 ms = 6 s.
- Contacts upsert: `INSERT ... ON CONFLICT (tenant_id, identity_key) DO UPDATE` in batches, **ordered by identity_key** to avoid deadlocks between concurrent versions.

### 2.3 CHECK — 10⁵ contacts × 22 rules < 2 s single thread
- Contacts loaded once into memory as a compact array (≈ 200 B/contact → 20 MB at 10⁵; 200 MB at 10⁶ — **at ≥ 250k contacts the job streams contacts in 50k chunks and rules that are per-contact run per chunk; whole-audience rules (size vs tier) get counts, not rows**).
- Rules iterate contacts at most once each: 22 × 10⁵ = 2.2M cheap operations ≈ 200–400 ms.
- Tier-1 `HistoryAccess.events()` is the only thing that can blow the budget. Plan: **one pre-fetch per evaluation**, not per contact: `events.windowBulk(identityKeys[], from, to)` → grouped in memory (`Map<identityKey, ContactEvent[]>`), then `events()` is a Map lookup. Query uses `(tenant_id, contact_id, occurred_at desc)` with `occurred_at >= now - 30d` (the widest window any rule uses). At 10⁵ contacts × ~5 events/30d = 5×10⁵ rows ≈ 1–2 s from a warm cache; **this is the item that decides whether 10⁵ stays under 2 s at Tier 1 — bench it explicitly**; if it doesn't, the fallback is a materialised per-contact rolling summary (`contact_touch_summary`: last_sent_at, sends_7d, sends_30d) maintained by trigger, which turns the query into one index read per contact.
- Findings insert: batched; `affected_row_ids uuid[]` capped at 50,000 per finding — beyond that the finding stores a count and a query handle (version + rule) rather than the array; the UI paginates affected rows via `GET /findings/:id/rows`.
- Rules are independent: **v1 runs them sequentially** (simplicity, determinism); the engine's contract permits `Promise.all` per rule later, output sorted by id — test 11 §3.4 already guards equivalence.

### 2.4 SEAL — chain integrity under load
- One seal per tenant at a time (singleton). Payload build is O(findings + decisions); at 5,000+ findings it rolls up (14 §6). Canonicalisation of a 1 MB payload ≈ 50 ms.
- Chain verify is O(n) over `evidence_records (tenant_id, seq)` — 10⁴ records ≈ 1 s. Run nightly per tenant; on demand from the UI with a progress indicator beyond 2,000 records.

### 2.5 API reads — p95 < 300 ms
- Version detail = 4 queries (version, evaluation, findings page of 50, decisions for those findings). All index-bound.
- Campaign list paginates by `(tenant_id, created_at desc, id)` cursor; latest-version state denormalised onto `campaigns.latest_version_state` (updated by `setState`) to avoid a join.
- No N+1: the repo exposes `listByEvaluation` and `decisions.listByFinding(ids[])`.

## 3. Index plan (justified)

| Index | Serves |
|---|---|
| `audience_rows (tenant_id, version_id, identity_key)` | dedupe pass; affected-row lookups |
| `audience_rows (tenant_id, version_id, row_no)` | paging affected rows in upload order |
| `contacts (tenant_id, identity_key)` unique | upsert target |
| `consent_records (tenant_id, contact_id, purpose, recorded_at desc)` | current-consent DISTINCT ON |
| `contact_events (tenant_id, contact_id, occurred_at desc)` | history windows |
| `contact_events (source, external_ref)` unique | idempotent confirmation |
| `evaluations (version_id, as_of, rulebook_hash, exceptions_hash)` unique | idempotent CHECK |
| `findings (tenant_id, evaluation_id, severity, rule_id)` | pre-flight screen ordering |
| `decisions (tenant_id, finding_id, created_at)` | finding history |
| `exceptions (tenant_id, campaign_id, expires_at)` partial `WHERE expires_at > now()` | active-exception lookup |
| `evidence_records (tenant_id, seq)` unique | chain walk; `last()` |
| `campaign_versions (tenant_id, state, scheduled_at)` partial `WHERE state IN ('in_review','approved')` | expiry sweep |
| `audit_events (tenant_id, entity_type, entity_id, created_at desc)` | activity panel |
| `campaigns (tenant_id, created_at desc, id)` | list cursor |

No index on `audience_rows.raw` (jsonb) — never queried. No GIN indexes in v1.

## 4. Partitioning and retention (when, not if)

- `contact_events`: **declaratively partitioned by month from M6**, `PARTITION BY RANGE (occurred_at)`; retention job drops partitions older than `retention.contactEventsMonths`. Until M6 a plain table is fine (< 15M rows at pilot).
- `audience_rows`: partition by `(tenant_id hash)` only if a single tenant exceeds ~200M rows — not expected in the horizon; retention: rows for versions older than 90 days that are **not** referenced by a sealed record are deleted; sealed versions keep rows for 7 years (they're part of what the hash covers via `audience_hash`, but the rows themselves are needed to reproduce it).
- `uploads` raw files: 90 days then deleted (hash retained in `uploads.sha256`).

## 5. Job concurrency

- Worker concurrency 4 per process (env). RESOLVE/CHECK are CPU + I/O balanced; SEAL is serialised per tenant; SYNC is I/O bound and rate-limited by providers.
- Fairness: pg-boss priority = tenant-level round robin via `priority` column computed as `-(jobs_in_flight_for_tenant)` at enqueue — prevents one tenant's 1M-row upload starving another's 12-row check.
- Backpressure: if queue depth for `check` > 100 per worker, `POST /versions` still returns 202 but `GET /versions/:id` reports `queuePosition`.

## 6. Caching

- Rule packs + graph: loaded once per process; keyed by `rulebookHash`; reloaded only on process restart (rulebook changes are deployments).
- Platform state: 15 min table cache (08 §4).
- Tenant config: request-scoped read (one row); no cross-request cache in v1.
- HTTP: `ETag` on `GET /evaluations/:id` and `GET /evidence/:id` (immutable content → `Cache-Control: immutable`).

## 7. Benchmarks in CI (`pnpm bench`, fails on 2× regression vs `bench/baseline.json`)

| Bench | Input | Budget |
|---|---|---|
| `ingest-1e6` | generated CSV 10⁶ rows | < 60 s |
| `resolve-1e5` | 10⁵ rows, 10% dupes | < 10 s |
| `check-t0-1e5` | 10⁵ contacts, Tier 0 | < 2 s |
| `check-t1-1e5` | 10⁵ contacts, 5×10⁵ events | < 4 s (Tier 1 budget is looser; documented) |
| `check-t0-1e4` | 10⁴ | < 300 ms |
| `seal-5k-findings` | | < 500 ms |
| `verify-1e4` | 10⁴ evidence records | < 2 s |
| `api-version-detail` | k6, 50 VUs | p95 < 300 ms |

## 8. What we will not optimise in v1 (and why it's safe)

- Per-rule parallelism — sequential meets budget at 10⁵.
- Read replicas — single Postgres handles pilot reads.
- Client-side virtualisation beyond 50-row pages — pagination is enough.
- Precomputed coverage radar — computed per request from `coverage_items` (≤ 22 rows).

If any bench in §7 fails at 2× on a PR, the PR does not merge; if it fails at 1.2×, the PR needs a comment explaining why.
