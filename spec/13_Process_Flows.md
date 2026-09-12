# 13 — Process Flows

Every user-facing use case as a numbered flow. **Every branch ends at a terminal state** — one of: a named `version_state`, an HTTP error type from `06 §1`, or an explicit "no-op". Where a step writes, the table is named. Where a step emits, the `audit_events.action` is named in `code`.

Notation: `→` next step · `⇢` async job enqueued · `✗ err:<type>` terminates with that problem+json · `[guard]` condition · `T:` terminal.

Actors: **Op** operator · **Rev** reviewer · **App** approver · **Adm** admin · **Sys** system/job · **Sch** scheduler.

---

## F1 — Create campaign and first version (UI or API)

1. Op `POST /campaigns {name, mode}` → insert `campaigns` → `campaign.created` → 201.
2. Op prepares audience: **F1a** inline rows (≤ 5,000) **or** **F1b** upload (F2) then `uploadId`.
3. Op `POST /campaigns/:id/versions` with `Idempotency-Key`.
   - [key seen before for tenant] → return original response, 200. T: no-op.
   - [body invalid] → ✗ `validation` (all issues). T.
   - [campaign.mode = shadow and `sentAt` absent] → ✗ `validation`. T.
   - [campaign.mode = live and `scheduledAt` ≤ now + 5 min] → ✗ `validation` ("schedule must be at least 5 minutes ahead"). T.
4. **INGEST (sync, transactional):**
   a. `version_no` = max(campaign) + 1; `parent_version_id` = body or null.
   b. `config_snapshot` = current `tenants.config`.
   c. Audience rows → `audience_rows` (raw + row_no). Streaming for uploads; **first 5 rows validated before any write**; if the CSV is malformed at row n → rollback, ✗ `validation` with `row: n`. T.
   d. `audience_hash`, `content_hash` computed.
   e. Insert `campaign_versions(state=draft)` → `version.created`.
   f. ⇢ job `resolve(versionId)`; state → `resolving` → `version.state_changed`.
5. → 202 `{ version, jobs: ['resolve'] }`. UI polls `GET /versions/:id`.
6. Continue at **F3**.

## F2 — Upload a CSV and map columns

1. Op `POST /uploads` multipart.
   - [size > 25 MB] → ✗ `validation`. T.
   - [not parseable as CSV within first 64 KB] → ✗ `validation`. T.
2. Sys streams to storage (`uploads.storage_ref`), counts rows, sniffs header, builds `suggestedMapping` from the alias table (`08 §2`).
3. → 201 `{ id, columns, rowCount, sampleRows[5], suggestedMapping, unmapped[] }`.
4. Op edits mapping in UI; `POST /uploads/:id/mapping {ColumnMapping}`.
   - [mapping references unknown column] → ✗ `validation`. T.
   - [no column mapped to phone **or** email] → 200 with `warnings: ['no-identity-column']` (allowed — rows will be `row:` keys; F3 reports it).
5. Sys validates mapping against 100 sampled rows → `{ preview: { normalisedSample, consentDistribution, languageDistribution, identityCoverage } }`.
6. → 200. T: upload ready; used in F1 step 3.

## F3 — RESOLVE → CHECK (system)

1. Job `resolve(versionId)` starts; `version.resolve.started`.
2. For each `audience_rows` row (streamed, batches of 1,000):
   a. Normalise phone → E.164 (region IN) → `phone_e164` or null; email → `email_norm` or null.
   b. `identity_key` = phone ? `phone:` : email ? `email:` : `row:<id>`.
   c. Consent: upload column value → `consent_promotional` + `consent_source='upload'`; else if `consent_records` has current state for (identity, `promotional`, channel|null) → that + `consent_source='consent_records'`; else null.
   d. Language: from upload; alias-normalised.
3. Duplicates: rows sharing `identity_key` (excluding `row:` keys) → all but lowest `row_no` get `duplicate_of_row_id`.
4. Upsert `contacts` per unique identity key (`first_seen_at` on insert, `last_seen_at` always, `preferred_language` if supplied).
5. `version.resolve.completed {rows, unique, duplicates, unresolvable}`.
6. ⇢ job `check(versionId, asOf=null)` (same transaction as step 5 completes — pg-boss transactional insert).
7. Job `check` starts; `version.check.started`.
   a. `asOf` = arg ?? `sent_at` ?? `scheduled_at`.
   b. Load rule packs from `config_snapshot.rulePacks`; `rulebookHash` from `rulegraph`.
   c. Build `Context` (`05 §4`): `history`/`consent`/`platform` present only if the tenant has data / a fresh connector cache.
   d. Active exceptions for (tenant, campaign) → `exceptions_hash`.
   e. [existing `evaluations` row for (version, asOf, rulebookHash, exceptionsHash)] → reuse; skip to g.
   f. `core.evaluate()` → insert `evaluations`, `findings`, `coverage_items` in one transaction.
   g. state → `evaluated`; `version.evaluated {evaluationId, blockers, warnings, info, cannotEvaluate}`.
8. T: `evaluated`. UI stops polling and renders.

**Failure branches:** see `14 §F3`.

## F4 — Re-evaluate as of a date (time-travel)

1. Op `POST /versions/:id/evaluate {asOf}`.
   - [state ∉ {evaluated, in_review, approved, sealed, handed_off}] → ✗ `invalid-transition`. T.
   - [asOf not ISO] → ✗ `validation`. T.
2. [state = in_review] → **review invalidated**: state → `evaluated`, `review.invalidated {reason:'re-evaluated'}`, existing `reviews` row untouched (history).
   [state ∈ {approved, sealed, handed_off}] → evaluation is **advisory only**: it is stored but does **not** change state and cannot be sealed (sealed versions bind to `review_evaluation_id`). Response carries `advisory: true`.
3. ⇢ job `check(versionId, asOf)` → F3 step 7 (idempotent on the 4-tuple).
4. → 202 (or 200 if reused). T.

## F5 — Fix a finding (creates a new version)

1. Op `POST /versions/:id/fix {findingId, fix? | edit?}`.
   - [state ∉ {evaluated, rejected, expired}] → ✗ `invalid-transition`. T. (From `rejected`/`expired` only `edit` is allowed — there is no live finding to `fix`.)
   - [finding not on this version's latest evaluation] → ✗ `not-found`. T.
   - [neither fix nor edit] → ✗ `validation`. T.
2. Build the new version body from the old: apply `fix.payload` (`04 §9`) **or** `edit` fields. Applying:
   - `reschedule` → new `scheduledAt` (must be ≥ now + 5 min else ✗ `validation`).
   - `drop_rows` → audience minus `affected_row_ids` (∪ their duplicates).
   - `edit_message` / `add_disclosure` → new message text.
   - `set_config` → **not applied to the version**; instead returns `{ requiresConfigChange: true, key, value }` and the UI routes an Adm to F12. T (no version created). Op sees *"This fix changes business rules — an admin must apply it."*
3. Insert `decisions {type:'fix', finding_id, actor, actor_roles}` (resulting_version_id filled after step 4).
4. F1 step 4 (INGEST) with `parent_version_id = old`. → new version `draft` → `resolving` ⇢ F3.
5. Update `decisions.resulting_version_id`; `version.fixed_into {newVersionId}`.
6. → 201 `{ version: new }`. Old version remains `evaluated` (superseded = derived). T.

## F6 — Accept a finding with reason

1. Op/Rev `POST /findings/:id/decisions {type:'accept', reasonCode, reasonText, scope, expiresAt?}`.
   - [finding.severity = block and actor lacks reviewer|admin] → ✗ `forbidden-role`. T.
   - [reasonCode ∉ built-ins ∪ tenant list] → ✗ `validation`. T.
   - [reasonText.length < 10] → ✗ `validation`. T.
   - [scope ≠ this-finding and expiresAt > cap] → ✗ `validation` (cap from F2 defaults). T.
   - [version state ∉ {evaluated, in_review}] → ✗ `invalid-transition`. T.
2. Insert `decisions` (actor_roles snapshot).
3. [scope ≠ this-finding] → insert `exceptions {rule_id, scope, campaign_id?, expires_at}` → `exception.created`.
   [reasonCode = rule-is-wrong] → upsert `rule_proposals` (open) → `rule_proposal.updated`.
4. [version state = in_review] → review invalidated (F4 step 2 logic) — a new decision changes what the reviewer would approve.
5. [scope ≠ this-finding] → ⇢ `check(versionId, asOf=current)` — exceptions_hash changed, so a fresh evaluation is produced in which the finding is `info` with `suppressedBy`.
6. → 201 decision. T.

## F7 — Submit for review

1. Op `POST /versions/:id/submit`.
   - [state ≠ evaluated] → ✗ `invalid-transition`. T.
   - [campaign.mode = shadow] → ✗ `invalid-transition` ("shadow versions cannot be reviewed"). T.
   - [any finding with severity block on latest evaluation lacks an `accept` decision by reviewer|admin] → ✗ `blockers-outstanding` with the list. T.
   - [scheduledAt < now] → ✗ `invalid-transition` ("schedule has passed; create a new version"). T.
2. Set `review_evaluation_id` = latest evaluation id; state → `in_review`; `version.submitted`.
3. Notify: Review queue badge (derived from state; no push in v1).
4. → 200. T: `in_review`.

## F8 — Review (approve / reject) with optional co-sign

1. Rev opens version; UI `GET /versions/:id` + `GET /evaluations/:review_evaluation_id`.
   - [rev.id = version.created_by] → UI shows self-review notice; API `POST /review` → ✗ `forbidden-self-review`. T.
2. Rev fills four sections; `POST /versions/:id/review {sections, outcome, notes, blastRadiusApproverToken?}`.
   - [state ≠ in_review] → ✗ `invalid-transition`. T.
   - [outcome = approved and any section ≠ approved] → ✗ `validation`. T.
   - [audienceSize ≥ config.blastRadiusThreshold and no valid token] → ✗ `blast-radius-approval-required`. T. **Co-sign sub-flow F8a.**
   - [latest evaluation id ≠ review_evaluation_id] → ✗ `invalid-transition` ("version was re-evaluated; reload"). T.
3. Insert `reviews`; `review.recorded`.
4. [outcome = rejected] → state → `rejected`; `version.rejected`. Op may F5-style clone: `POST /versions/:id/fix {edit:{}}` is allowed from `rejected` and carries reviewer notes forward. T: `rejected`.
5. [outcome = approved] → state → `approved`; `version.approved`; ⇢ job `seal(versionId)`. → F9.
6. → 200. T.

### F8a — Blast-radius co-sign
1. Rev clicks *Request co-sign* → `POST /versions/:id/cosign-request` → creates a 6-digit code (`cosign_requests`, TTL 30 min) → 201 `{ code }`. *(new small table; add to 03)*
2. App logs in, enters code → `POST /cosign/:code/approve` → [App lacks approver role] ✗ `forbidden-role` · [expired] ✗ `not-found` · else returns `{ token }` (single-use, 10 min).
3. Rev submits F8 step 2 with `blastRadiusApproverToken`. Sys validates, records `reviews.blast_radius_approver_id`, consumes token.

## F9 — SEAL (system, serialised per tenant)

1. Job `seal(versionId)` with singleton key `tenant:<id>`.
   - [state ≠ approved] → log, exit. T: no-op.
2. Build payload (`03 §8`) from: version, `review_evaluation_id` evaluation + findings, all decisions for version, review, tenant, users (display names resolved now and frozen).
3. Canonicalise (RFC 8785); `prev_hash` = last record for tenant or genesis; compute `hash`.
4. Insert `evidence_records` (seq = last + 1) and set state → `sealed` in **one transaction**; `version.sealed {evidenceId, seq, hash}`.
5. [tenant.config.webhookUrl set] → ⇢ job `webhook(evidenceId)` → F10.
6. T: `sealed`.

## F10 — Outbound webhook

1. Job `webhook(evidenceId)`: build body (`06 §5`), sign HMAC, POST with 10 s timeout.
2. [2xx] → `webhook.delivered`. T.
   [non-2xx or timeout] → retry ×5 (1m, 5m, 30m, 2h, 12h) → `webhook.retry`; after final failure → `webhook.failed` and Adm sees it in Settings → Webhook with *Retry now*. T (version state unaffected — sealing is independent of delivery).

## F11 — Export / hand off

1. Op `GET /versions/:id/export`.
   - [state ∉ {sealed, handed_off}] → ✗ `invalid-transition`. T.
2. Sys builds ZIP (`05 §8`) from frozen payload + current non-dropped audience rows → streams → `version.exported`.
3. Op `POST /versions/:id/handoff {target}`:
   - `export` → state → `handed_off`; `version.handed_off {target}`. T.
   - `webhook` → F10 with event `version.handed_off`; state → `handed_off`. T.
   - `wati:suppress` → [connector absent/not opted-in] ✗ `connector-unavailable` · else ⇢ job `push_suppress` → records `handoff_pushes {identity_keys[], provider_ref}`; on success state → `handed_off`; on failure state unchanged, `handoff.push.failed`, Op sees error. T.
4. **No `contact_events(kind=sent)` are written here.** They are written only by F13 (confirmation).

## F12 — Change tenant config (Layer C)

1. Adm `PUT /config {TenantConfig}`.
   - [invalid] → ✗ `validation`. T.
   - [rulePacks includes unknown pack] → ✗ `validation`. T.
2. Diff old→new; write `audit_events {action:'config.updated', before, after}`; update `tenants.config`.
3. **Existing versions are unaffected** (they carry `config_snapshot`). UI on any `evaluated` version whose snapshot differs shows *"Business rules changed since this check — re-check?"* → F4 is **not** the path (asOf unchanged); instead Op uses F5 with `edit:{}` to create a fresh version under the new config. T.

## F13 — Confirmation of a send (inbound)

1. Source: webhook callback from tenant (`POST /v1/callbacks/sent` with API key) **or** connector sync (F15) reporting delivered messages for a handed_off version.
2. For each confirmed recipient → insert `contact_events {kind:'sent', source, campaign_version_id, occurred_at}`; idempotent on (source, external_ref).
3. `version.send_confirmed {count}`. T. (Feeds frequency rules for future versions.)

## F14 — Shadow import

1. Op `POST /shadow/import` with CSV (`name, message, channel, sentAt, purpose?, audienceUploadId`).
   - [row invalid] → row-level error list; valid rows proceed; 202 `{ batchId, accepted, rejected[] }`.
2. Per row: F1 (mode=shadow, `sent_at` set, `scheduled_at = sent_at`) → F3 with `asOf = sent_at`.
3. `GET /shadow/batches/:id` aggregates. Shadow versions: terminal at `evaluated`; F7 refuses them. T.

## F15 — Connector sync (Adm or Sch)

1. `POST /connectors/:id/sync {scope}` or scheduled (history: every 6 h; quality/templates: every 15 min).
2. Job `sync(connectorId, scope, since)`:
   - `templates` → upsert `platform_templates` cache.
   - `history` → paginate; for each message → `contact_events {source:'connector:<kind>'}`; cursor saved per connector.
   - `quality` → `platform_state` cache with `fetched_at`.
   - `consent` → `consent_records {source:'connector:<kind>'}`.
3. [auth failure] → connector `status=degraded`, `connector.auth_failed`; coverage radar shows capabilities as unavailable; **no rule passes on stale data** (`08 §4`). T.
4. `connector.synced {scope, count}`. T.

## F16 — Expiry sweep (Sch, every minute)

1. Select versions in `in_review` or `approved` with `scheduled_at < now()` and no `evidence_records`.
2. Each → state → `expired`; `version.expired {reason:'schedule passed before seal'}`.
3. Op can clone from `expired` via F5 `edit:{scheduledAt}`. T.

## F17 — Abandon

1. Op/Adm `POST /versions/:id/abandon {reason}`.
   - [state terminal] → ✗ `invalid-transition`. T.
   - [reason < 5 chars] → ✗ `validation`. T.
2. state → `abandoned`; `version.abandoned {reason}`. T.

## F18 — Authentication

1. Web: `POST /auth/session {email, password}` → [bad creds] ✗ 401 `forbidden-role` variant `unauthenticated` (add to error list) · else cookie; `auth.login`. Session TTL 12 h idle.
2. API key: `Authorization: Bearer` → hash lookup → [revoked/unknown] 401 · else request context `{tenantId, userId, roles}`.
3. Every route: role guard → [insufficient] ✗ `forbidden-role`.

---

## Concurrency rules (apply across flows)

| Situation | Rule |
|---|---|
| Two `fix` calls on the same version | Both succeed; two children with `version_no` n+1 and n+2 (serialised by a per-campaign advisory lock on version_no allocation). Neither is "the" successor; the UI lists both. |
| Two `submit` calls | Second → ✗ `invalid-transition` (state already `in_review`). |
| Two reviewers approve simultaneously | Row lock on `campaign_versions`; second → ✗ `invalid-transition`. |
| Decision recorded while `check` job runs | Decision references finding ids from the *current* evaluation; if the job completes first and produces a new evaluation, the decision remains attached to the old finding and the UI shows it under history. Exceptions (scoped) still apply to the new evaluation. |
| Config PUT during INGEST | INGEST snapshots at step 4b inside its transaction; whichever committed first wins; no torn read. |
| Seal for two versions of one tenant | Singleton job key serialises; `seq` strictly increases. |
| Idempotency-Key reuse with a different body | ✗ `idempotency-conflict` (409). |
