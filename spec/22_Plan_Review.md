# 22 — Full Plan Review (pre-build)

One deliberate pass over `00`–`21` asking: *will this survive a real lender's data, a real reviewer, and a second region?* Each item: what's wrong → why it causes rework later → the fix → where it lands → **when** (NOW = before M0; Mn = that milestone; LATER = designed-for only).

Severity: **R1** would force a data-model or pipeline rewrite · **R2** would force a visible product change · **R3** cleanup.

---

## A. Data realism — will real customer data fit?

| # | Gap | Why it bites | Fix | Where | When | Sev |
|---|---|---|---|---|---|---|
| **A1** | **Identity ignores the customer's own id.** `identity_key` = phone → email → row. Indian mobiles are recycled, shared within families, and a borrower often has 2–3 numbers; the lender's `customer_id` is the true key. | Frequency and consent joins mis-attribute across people; dedupe merges family members. Changing the key later re-keys `contacts`, `consent_records`, `contact_events`. | Tenant-configurable **identity precedence**: default `externalId → phone → email → row`. `identity_key` prefix `ext:`. Phone/email become *attributes* of the contact, with many-to-one allowed (`contact_identifiers` table: contact_id, kind, value, observed_at). | 03/15 (new table), 05 §3, 16 repo | **NOW** | R1 |
| **A2** | **Audience rows are copied per version.** A fix that drops 6 of 1,000,000 rows re-inserts 999,994 rows. 2.5 versions × 1M × 10k campaigns/day at prod = untenable. | Storage and ingest time scale with versions, not campaigns; the "fix creates a version" principle becomes expensive and gets worked around. | **Copy-on-write audiences:** `audience_sets` (immutable row store keyed by upload) + per-version `audience_ref { set_id, exclusions: row_no[] or bitmap, additions_set_id? }`. Effective audience = set − exclusions. `audience_hash` = hash(set_hash ‖ exclusions). Rows are never duplicated by a fix. | 03/15, 05 INGEST/F5, 18 | **NOW** | R1 |
| **A3** | **One message per version.** A real lender sends Hindi to Hindi speakers and English to the rest in the *same* campaign. A-RBI-003 flagged 6/12 in the first real run for exactly this reason. | Without variants the language rule is unusable and personalisation is impossible; adding variants later changes `content_hash`, certificate shape, and every content rule's evaluation loop. | `message_variants` + per-row `variant_key` (defined in `21 §2`) **become part of v1**, with only the `default` variant used until M5. Content rules evaluate per variant from M0. | 03/15, 04 §3, 05, 21 | **NOW** | R1 |
| **A4** | **Send is a single instant.** Real sends are throttled over a window (18:00–21:30) or across days. A-RBI-001 evaluated at `scheduledAt` alone passes a send that starts at 18:30 and runs past 19:00. | Window rules give false passes on the most enforced rule we have. | `scheduledAt` + `sendWindowEnd` (nullable; default = scheduledAt). Window rules evaluate the **whole interval**; finding says *"send window 18:30–21:30 overlaps the prohibited period from 19:00."* | 03/15, 06 body, rules, 13 F1 | **NOW** | R2 |
| **A5** | **Event-triggered / transactional sends are out of scope but not stated.** A lender will ask to run 5M OTPs/day through Preflight. | Scope creep into a real-time path the architecture isn't built for (202 + job queue). | PRD: Preflight governs **batch campaigns**. Event-triggered messaging is governed by *template + rulebook pre-approval* (a sealed version of the template with an empty audience = "approved template" record), not per-message checks. Add `campaign.kind = batch | template_approval`. | 01, 05, 15 | **NOW** (scope text) · M3 (template_approval kind) | R2 |
| **A6** | **No bulk import of history at onboarding.** A real customer arrives with years of consent records and send logs. Only audience CSV upload exists. | Cold-start lasts months instead of a day; frequency rules stay `cannot_evaluate`. | `POST /imports/consent` and `POST /imports/events` — streamed CSV, mapping wizard reuse, idempotent on (source, external_ref) — plus `POST /imports/attributes` (M5). Import jobs with progress. | 06, 08, 13 (F19), 15 | **M2** | R2 |
| **A7** | **Erasure requests vs 7-year retention.** DPDP gives a right to erasure; sealed versions keep audience rows 7 years; `audience_hash` covers raw phone numbers. | Cannot honour erasure without breaking hash reproducibility → legal exposure or broken evidence. | **Hash identities, not PII.** `audience_hash` and certificate `identityKeysHash` are computed over `HMAC(tenant_key, identity_key)` per row, never over phone/email. Erasure = **tombstone** plaintext in `contact_identifiers`/`audience_rows` (set to null, `erased_at`), keep the HMAC. Chain verify unaffected. Add `POST /erasure` (admin) + audit. | 03/15, 05 SEAL, 09 §2/§6, 06 | **NOW** (hash design) · M6 (endpoint) | R1 |
| **A8** | **Recurring campaigns** (daily EMI reminders) aren't modelled; each run would be a manual version. | Version explosion or operators bypassing the tool for the most frequent sends. | `campaigns.recurrence` (RRULE) + a scheduler job that materialises a version per occurrence with the latest approved template and a fresh audience import ref; each occurrence is a real version and gets a real evidence record (regulator wants exactly that). Cheap once A2 lands. | 03/15, 13 (F20), 10 | **M4** | R2 |
| **A9** | **Multi-channel with fallback** (WhatsApp → SMS if undelivered) is one campaign to the lender, two to us. | Coverage statement and certificate split awkwardly; frequency counts both. | v1: one channel per version; fallback is a linked version (`fallback_of_version_id`) evaluated with its channel's rules; the certificate lists linked versions. Document; don't build multi-channel versions. | 03/15, 01 | **M3** | R3 |
| **A10** | **Consent has no expiry or capture-evidence requirement.** Some banks age consent; RBI 85G wants records retained "till one year from cessation". | Fine for v1, but `consent_records` needs `expires_at` and `contract_ended_at` to compute the retention rule later. | Add both nullable columns now; A-RBI-009 becomes computable per record. | 03/15 | **NOW** (columns) | R3 |

## B. Architecture choices to re-examine

| # | Item | Concern | Decision |
|---|---|---|---|
| **B1** | **`contact_events` in Postgres at prod scale.** 750M rows/month (18 §1) → ~18B rows at 24-month retention. Not a comfortable single-Postgres table even partitioned. | Frequency queries degrade; vacuum and backups hurt everything else. | **Decide now, build in M6:** Postgres keeps **90 days** of raw events (partitioned) + a **`contact_touch_summary`** table (per contact: last_sent_at per channel/purpose, counts 7d/30d/90d) maintained on insert. Raw events older than 90 days go to **Parquet on object storage** (queryable via DuckDB for audits). The `HistoryAccess` interface is unchanged; the summary becomes the default path, not the fallback. |
| **B2** | **IST hard-coded in rules** (`istMinutes`). | Blocks the Japan/EU cartridge promise; `voice`/`visit` scoping already showed rules need context. | `ctx.timezone` from `TenantConfig.timezone` (default `Asia/Kolkata`); rules call `localMinutes(ctx, instant)`. India single-zone stays a *default*, not an assumption. **NOW** — it's a two-line change in core and a rewrite later. |
| **B3** | **Rulebook "re-run under old hash" assumes old code is runnable.** | Checking out an old git ref to reproduce an evaluation is heavy and fragile. | Publish rule packs as **immutable versioned artifacts** in the monorepo (`packages/rules-india/versions/1.3.0/…` kept; `latest` symlink). The engine can load any published version by id. Graph `.ttl` files likewise versioned. **M3.** |
| **B4** | **CHECK is single-process per version.** At 10M recipients (a bank's promo blast) 25 rules × 10M ≈ 60 s single-thread plus I/O. | Exceeds the job timeout; a big tenant blocks the queue. | **Chunked CHECK** above 250k rows: split into 100k-row chunks as child jobs, each producing partial findings; a reduce job merges (dedupe by rule, sum counts, concat samples) and writes the evaluation. Deterministic because chunk order is fixed and the merge is order-independent. Designed now (job payload has `chunk?`), built **M6**. |
| **B5** | **Uploads as Postgres `bytea` until pilot.** | A 25 MB × thousands table bloats the primary DB; PITR gets slow. | Default `PREFLIGHT_STORAGE=s3` from **M2** with MinIO in compose. Postgres storage kept only for `pnpm test`. |
| **B6** | **`audit_events` growth** (~200k/day at prod). | Same partitioning need as events. | Partition by month from M6; retention ≥ 7y means cold partitions → Parquet like B1. |
| **B7** | **Exact-match identity + no survivorship rules.** | Two uploads disagree on a contact's language; last write wins silently. | `contacts` field-level `observed_at`; newest wins **per field**, with `source` recorded; conflicts surface in the audience tab. **M2.** |
| **B8** | **Classification heuristic is English keyword-based.** Hinglish ("aapka EMI due hai, offer bhi hai") slips through. | Operators either get false `mixed` or false `service`; both erode trust. | Marker lists become **tenant-extensible** (`config.classificationMarkers.promotional[]/service[]`) with built-in Hinglish/Hindi romanised terms; the LLM classifier (M5) is the real fix and can only tighten. **M1** for config; **M5** for LLM. |

## C. Loopholes (ways the guarantees could be quietly broken)

| # | Loophole | Close it |
|---|---|---|
| **C1** | Co-sign code is 6 digits with a 30-min TTL — brute-forceable. | Max 5 attempts per code, then invalidate; rate-limit `/cosign/*` to 10/min per user. **M1.** |
| **C2** | An admin who is also operator and reviewer can author, accept blockers, and approve alone. Reviewer ≠ author is enforced, but admin is exempt from the "operators can't accept blockers" rule. | **Admin can accept blockers only if they also hold `reviewer`**; and a version's approver must differ from *every* actor who accepted a blocker on it (`distinct_actors` check). Tenant option `requireSeparateAcceptorAndApprover` default true. **M1.** |
| **C3** | Idempotency keys live on individual rows, so `fix`/`decisions` retries can double-create. | Generic `idempotency_keys (tenant_id, key, request_hash, response, created_at)` table; middleware, not per-route logic. **M0.** |
| **C4** | Exceptions with scope `this-rule-30d` apply to *all campaigns* — an operator can silence a rule tenant-wide for a month via one accept. | Rule-scoped exceptions require `reviewer`/`admin`; the UI says so; `exception.created` events for rule scope trigger a daily digest to admins. **M1.** |
| **C5** | Shadow versions can't be reviewed — but nothing stops an operator from importing a *future* campaign as shadow to peek at findings without a record. | Harmless (evaluation is the point) — but `sentAt` must be ≤ now for shadow; future dates rejected. **M2.** |
| **C6** | Connector `sync('consent')` writes `consent_records` — a mis-mapped connector could grant consent en masse. | Connector-sourced consent is written with `state` but flagged `source='connector:*'`; **granted-by-connector never overrides an explicit `denied` from upload or API** (deny wins across sources). Test. **M4.** |
| **C7** | `set_config` fix by admin changes rules for *all* tenants' versions going forward, including ones in review. | Config drift banner exists; add: versions `in_review` at the time of a config change are **not** invalidated (they evaluate against snapshot), but the reviewer sees the drift note. Already consistent — make it a test. **M1.** |
| **C8** | Webhook `certificateUrl` could leak if the tenant's endpoint is compromised. | URLs are **signed, 24h, tenant-scoped**; the certificate JSON contains hashes not audience rows anyway. **M1.** |

## D. Subjective language that would cause rework

| # | Where | Subjective | Make objective |
|---|---|---|---|
| **D1** | Rule severities | Judgement per rule | Already per-rule with citation; add a **severity rationale** field in the graph (`pf:severityBasis`) so a change is a documented decision. **M0.** |
| **D2** | "Sensible default" frequency cap 2/week | Arbitrary | Keep as default but label it in UI as *"default — set your own"*; log when unchanged for 30 days. Fine. |
| **D3** | "Calm, document-like" UI | Taste | Tokens in `tokens.ts` (type scale, spacing, 5 colours); `20` fixes layout. Enough. |
| **D4** | Fix suggestion "next permitted slot" | Which slot? | Deterministic: window open + 60 min on the same day if in future, else next day; never a weekend if `config.quietDays` set. **M1.** |
| **D5** | "Romanised text can be a false positive — review" | Rule that says "maybe" | With A3 (variants) the rule is precise: evaluate each variant against its recipients; keep the romanised-acceptable config for Latin-script variants. |
| **D6** | Blast-radius "large" | Threshold only | Add a second, separate threshold for **shadow imports** (none) and for **API-created** versions (same). Fine. |
| **D7** | "Plain language" explanations | Unbounded | Explanation ≤ 240 chars, must name the count affected, must not contain the word "compliant". Lint test. **M0.** |

## E. Configurable choices — is enough configurable, and nothing too much?

- **Add to `TenantConfig`:** `timezone` (B2) · `identityPrecedence` (A1) · `classificationMarkers` (B8) · `quietDays` (D4) · `requireSeparateAcceptorAndApprover` (C2) · `personalisation.*` (`21`) · `sendWindowMaxHours` (A4 guard, default 6).
- **Add to env:** `PREFLIGHT_EVENTS_HOT_DAYS` (B1, default 90) · `PREFLIGHT_CHECK_CHUNK_ROWS` (B4, default 100000).
- **Deliberately NOT configurable:** the statutory floor in `purpose_compatibility`; `verdict`; hash algorithm; the reviewer≠author rule; audit retention minimum. Making these configurable is how a product quietly stops being trustworthy.

## F. Data-volume preparation (revises `18`)

| Assumption | Old | Revised for a real bank |
|---|---|---|
| p95 audience | 1M | **10M** (a promo blast to a large book) |
| Versions / campaign | 2.5 | 2.5 — but rows **not** duplicated (A2) |
| Raw events retention in PG | 24 months | **90 days hot**, summary forever, Parquet cold (B1) |
| CHECK parallelism | sequential | chunked above 250k (B4) |
| Ingest 10M rows | — | ~10 min streamed; acceptable for a blast; progress % shown |
| Contacts per tenant | 2M pilot | **50M** for a large bank — `contacts` + `contact_identifiers` indexes sized accordingly; identity resolution batched by HMAC prefix |

Benches to add: `ingest-1e7`, `check-chunked-1e7`, `summary-update-1e6-events`.

## G. Gaps in the specs themselves (missed items)

| # | Gap | Fix / where |
|---|---|---|
| **G1** | No `POST /erasure` and no erasure flow | 06, 13 F21 (M6), A7 |
| **G2** | No template pre-approval path for event-triggered messages | A5 · `campaign.kind` · 13 F22 |
| **G3** | No bulk imports | A6 · 06 · 13 F19 |
| **G4** | No recurrence | A8 · 13 F20 |
| **G5** | No message variants | A3 · `21 §2` promoted to v1 |
| **G6** | Retention job may orphan `findings.affected_row_ids` when purging non-sealed audience rows | Purge the whole non-sealed version tree (rows, evaluations, findings, decisions) together after 90 days; sealed trees never purged. 15/18. |
| **G7** | No `idempotency_keys` table | C3 |
| **G8** | RBI **85K** (rate/fee disclosure in promotional materials) is a PRIMARY, deterministic-ish content rule we haven't encoded | A-RBI-014 in `21 §3` → move to `india-layer-a` (it is Layer A, not personalisation). Pack count 24. |
| **G9** | Certificate has no locale; a Hindi certificate may be asked for | LATER; `messages.ts` structure already allows it |
| **G10** | The demo script has no failure-path moment | Add step: submit with a blocker outstanding → see the reason; reviewer tries to self-review → notice. Shows the guarantees, not just the happy path. 01 §5 |

## H. Decisions taken by this review (add to `12 §A`)

- **D26** Identity precedence configurable; `externalId` first by default; `contact_identifiers` many-to-one. (A1)
- **D27** Copy-on-write audiences: `audience_sets` + per-version exclusions; rows never duplicated by a fix. (A2)
- **D28** Message variants are v1 core; every content rule evaluates per variant. (A3)
- **D29** Send window `[scheduledAt, sendWindowEnd]`; window rules evaluate the interval. (A4)
- **D30** Preflight governs batch campaigns; event-triggered messaging via sealed template approvals. (A5)
- **D31** Identities are HMAC-hashed in every hash and certificate; erasure = tombstone plaintext. (A7)
- **D32** `timezone` in tenant config; no zone hard-coded in core. (B2)
- **D33** Events: 90-day hot table + `contact_touch_summary` + Parquet cold; summary is the default frequency path. (B1)
- **D34** Chunked CHECK above 250k rows with deterministic merge. (B4)
- **D35** Admin cannot accept blockers without `reviewer`; approver must differ from every blocker-acceptor. (C2)
- **D36** Generic `idempotency_keys` middleware. (C3)
- **D37** Deny-wins across consent sources; connector consent never overrides explicit deny. (C6)
- **D38** Rule packs published as immutable versions; engine loads by version id. (B3)

## I. What this changes in the milestone plan

- **M0** absorbs: A1, A2, A3 (schema + core loop), A4, A7 hashing, A10, B2, C3, D1, D7, G8. Estimate +4 days. These are the ones that are cheap now and rewrites later — the whole point of this review.
- **M1** absorbs: C1, C2, C4, C7, C8, D4, B8-config.
- **M2** absorbs: A6, B5, B7, C5.
- **M3**: A5 template_approval, A9, B3.
- **M4**: A8.
- **M5**: `21` as written.
- **M6**: B1, B4, B6, G1.

Nothing here changes the pipeline stages, the state machine, the evidence chain, the role model, or the rule contract. The spine held; the review found the places where *data shape* would have forced rework — identity, audience storage, variants, send windows, erasure — and moved them to before the first line of code.
