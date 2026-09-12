# 14 — Failure Modes

Per stage and per dependency: **what fails → how we detect it → what the system does → what the user sees → how it recovers.** Every row maps to a test or a runbook entry. The governing rule from `CLAUDE.md`: a failure must never produce a silent pass, a lost approval, or a broken chain.

Severity: **S1** data integrity / evidence · **S2** user blocked · **S3** degraded · **S4** cosmetic.

## 1. INGEST (F1, F2)

| Failure | Detect | System action | User sees | Recovery | Sev |
|---|---|---|---|---|---|
| CSV malformed at row n | streaming parser error | rollback entire version; nothing persisted | `validation` with `row: n`, first 200 chars of the offending line | fix file, re-upload | S2 |
| Upload interrupted mid-stream | content-length mismatch / socket close | delete partial `uploads` row + storage object | 400 "upload incomplete" | retry | S2 |
| Header has duplicate column names | sniff | reject | `validation` "duplicate column: phone" | rename | S2 |
| 0 data rows | count | reject | `validation` "no rows" | — | S2 |
| Non-UTF-8 encoding | BOM/decoder error | attempt UTF-16/latin-1 detection once; else reject | "could not decode; save as UTF-8" | re-save | S2 |
| Cell > 4 KB | parser limit | reject row | `validation` with row | — | S2 |
| Idempotency key reused, different body | stored hash ≠ body hash | 409 | `idempotency-conflict` | new key | S2 |
| Storage write fails (disk/S3) | exception | rollback; no `uploads` row | 503 `internal` with requestId | retry; alert | S1 |
| `tenants.config` invalid at snapshot time (shouldn't happen — validated on PUT) | Zod at snapshot | refuse INGEST | 500 `internal`; alert Adm | fix config (F12) | S1 |

## 2. RESOLVE (F3 steps 1–6)

| Failure | Detect | System action | User sees | Recovery | Sev |
|---|---|---|---|---|---|
| Phone unparseable | libphonenumber returns invalid | `phone_e164=null`; fall through to email/row key | coverage line "n recipients had no phone or email" | mapping/upload fix | S3 |
| Conflicting consent for same identity within one upload (row A `yes`, row B `no`) | dedupe step | keep the **stricter** (`denied`) on the surviving row; record `consent_source='upload:conflict'` | finding `A-PF-002 Conflicting consent in upload` (warn) listing rows | fix source | S3 |
| Upload consent contradicts `consent_records` (upload `yes`, records `denied` later) | join step | **records win when their `recorded_at` is later**; else upload wins; `consent_source` says which | A-PF-002 variant "upload consent overridden by a later withdrawal" | — | S3 |
| Job crashes (OOM, bug) | pg-boss failure | retry ×3 backoff 10s/1m/5m; then state → `draft`, `version.resolve.failed {error}` | progress strip shows "Resolve failed — retry" button | Op retries (`POST /versions/:id/evaluate`) which re-enqueues resolve | S2 |
| `contacts` upsert deadlock (two versions, same identities) | PG 40P01 | retry the batch (ordered upsert by identity_key to prevent) | none | automatic | S3 |
| Audience > 1M rows | count | allowed; batched; progress % in `GET /versions/:id` | progress | — | S3 |

## 3. CHECK (F3 steps 7–8, F4)

| Failure | Detect | System action | User sees | Recovery | Sev |
|---|---|---|---|---|---|
| Rule throws (bug in one rule) | try/catch per rule | that rule → `coverage.cannotEvaluate {reason:'rule-error', ruleId}`; **others continue**; `version.check.rule_error` logged with stack; metric `rule_errors_total` | "1 rule could not be evaluated (internal error) — reported to the team" | fix rule; re-evaluate | S1 |
| Rulebook fails validation at boot | rulegraph loader | **process refuses to start** | `/health` 503; nobody can use the system | fix rulebook; redeploy | S1 |
| Rulebook hash changed between evaluate and seal | seal compares `evaluation.rulebook_hash` vs current | **seal uses the evaluation's hash** (old rulebook still in git); records both on the certificate as `rulebookHashAtSeal` | note on certificate | none needed | S3 |
| Rulebook hash changed while version `in_review` | on `GET /versions/:id` | banner "rulebook updated since this check"; review may proceed (it reviews the evaluation as run) or Op re-evaluates (invalidates review) | banner | Op's choice | S3 |
| `history`/`consent` access query times out | timeout 30 s | rules needing it → `cannot_evaluate {missing:['history.contactEvents'], reason:'timeout'}`; **never pass** | coverage lists them with "(timed out)" | re-evaluate | S3 |
| Platform cache stale > 24 h | `fetched_at` | treat as absent | A-WA-004/005 "cannot evaluate — platform data stale; sync connector" | F15 | S3 |
| Classification `unknown` | heuristic | evaluate as promotional; banner | "Purpose could not be determined — evaluated under the stricter reading; set Purpose to be precise" | Op sets purpose (F5 edit) | S3 |
| Evaluation > 2 s for 10⁵ | metric | complete anyway; warn in logs | none | perf work | S4 |
| Unique violation on `evaluations` 4-tuple (race) | PG 23505 | fetch existing, return it | none | automatic | S4 |
| Job crashes | pg-boss | retry ×3; then state → `draft` with `version.check.failed` | "Check failed — retry" | Op retry | S2 |

## 4. DECIDE (F5, F6)

| Failure | Detect | System action | User sees | Recovery | Sev |
|---|---|---|---|---|---|
| Operator tries to accept a blocker | role guard | 403 | button disabled + tooltip; API `forbidden-role` | reviewer does it | S2 |
| Reason code not in list | validation | 400 | inline error | pick valid | S2 |
| Fix produces a version identical to parent (same content+audience hashes) | hash compare in INGEST | still creates the version (user intent), flags `no_change: true` | toast "No change detected — v3 is identical to v2" | — | S4 |
| Fix `reschedule` lands inside window but on a Sunday/holiday | not a rule in v1 | allowed | — | Layer C `quietDays` later | S4 |
| `set_config` fix by non-admin | role | no version created; returns `requiresConfigChange` | "an admin must apply this" | Adm F12 | S3 |
| Exception created but re-check job fails | job failure | exception persists (it's a decision); evaluation stale | banner "re-check pending/failed — retry" | retry | S3 |
| Decision on a finding from an older evaluation | finding.evaluation_id ≠ latest | accept it (history), respond 201 with `staleEvaluation: true` | shown under "earlier decisions" | — | S4 |

## 5. REVIEW (F7, F8, F8a)

| Failure | Detect | System action | User sees | Recovery | Sev |
|---|---|---|---|---|---|
| Submit with unaccepted blockers | check | 409 `blockers-outstanding` + list | disabled button with reason; API error lists rule ids | fix/accept | S2 |
| Reviewer = author | compare ids | 409 | notice panel | another reviewer | S2 |
| Version re-evaluated after submit | `review_evaluation_id` ≠ latest | state → `evaluated`, `review.invalidated` | reviewer sees "this version changed — returned to operator" | Op resubmits | S3 |
| Schedule passes during review | F16 sweep | → `expired` | "expired before approval" with *clone with new schedule* | clone | S3 |
| Co-sign code expired / wrong | TTL check | 404 | "code expired; request again" | re-request | S3 |
| Approver co-signs but reviewer never submits | token TTL 10 min | token expires | — | re-request | S4 |
| Only one user has `reviewer` and they authored everything | structural | product cannot proceed | Settings → Users shows "add a second reviewer" warning at seed time | Adm adds user | S2 |
| Two reviewers approve simultaneously | row lock | second gets `invalid-transition` | "already approved by X" | — | S4 |

## 6. SEAL (F9)

| Failure | Detect | System action | User sees | Recovery | Sev |
|---|---|---|---|---|---|
| Canonicalisation throws (unexpected type e.g. NaN, undefined) | try/catch | job fails; **state stays `approved`** (never lose an approval); `seal.failed` alert | version shows "Approved — sealing pending" | fix; retry job (admin endpoint) | S1 |
| `prev_hash` read races with another seal | singleton key prevents; if violated (bug), unique(seq) fails | transaction rolls back; job retries | none | automatic | S1 |
| DB write succeeds but state update fails | same transaction → impossible; if seen, it's a bug | — | — | — | S1 |
| Chain verify finds a break | verify endpoint / nightly job | **freeze sealing for tenant** (`tenants.sealing_frozen=true`), page on-call, `evidence.chain_broken {firstBrokenSeq}` | Evidence page red banner; new approvals queue as `approved` | runbook: investigate from firstBrokenSeq; never "repair" by rewriting; append a signed `evidence_records` row of kind `chain_attestation` explaining the incident | S1 |
| User display name changed after seal | — | certificate keeps the frozen name (payload) | historical name on certificate, note "as at sealing" | none | S4 |
| Very large payload (10⁵ findings) | size | payload stores findings summarised per rule with counts + affected hash; full findings remain in `findings` table linked by evaluation id | certificate shows per-rule rollup | — | S3 |

## 7. HANDOFF & WEBHOOK (F10, F11, F13)

| Failure | Detect | System action | User sees | Recovery | Sev |
|---|---|---|---|---|---|
| Webhook endpoint down | non-2xx/timeout | retry schedule; after 5 → `webhook.failed` | Settings → Webhook shows failure + *Retry now* | manual retry | S3 |
| Webhook secret rotated by tenant | 401 from target | same as down; Adm banner "signature rejected — check secret" | banner | update secret | S3 |
| Export ZIP > 500 MB | size | stream; no in-memory build | download | — | S4 |
| `wati:suppress` partial success (300 of 500 pushed) | provider response | record `handoff_pushes` with per-key status; state **not** `handed_off`; `handoff.push.partial` | "300/500 suppressed — retry remaining" | retry pushes only failed keys | S2 |
| Confirmation callback for unknown version | lookup | 404; log | — | — | S4 |
| Duplicate confirmation | (source, external_ref) unique | ignore | — | — | S4 |
| Confirmation claims more recipients than the version had | count compare | accept known identities; log `send_confirmed.excess {n}`; alert Adm | Activity note | investigate | S3 |

## 8. CONNECTORS (F15)

| Failure | Detect | System action | User sees | Recovery | Sev |
|---|---|---|---|---|---|
| Auth failure | 401/403 | `status=degraded`; capabilities unavailable; **rules relying on them → cannot evaluate** | Settings card red; coverage radar amber; findings say "connector degraded" | fix creds | S3 |
| Rate limited by provider | 429 | backoff honoring `Retry-After`; cursor preserved | sync "paused (rate limit)" | automatic | S3 |
| Provider changed API shape | Zod on response fails | capability marked `unsupported` with sample logged (redacted); alert | "provider API changed — capability disabled" | code fix | S2 |
| History sync backlog too large | > N pages | bounded per run; resumes next run; progress % | "importing history: 42%" | automatic | S3 |
| Webhook from provider unsigned/invalid signature | verify | 401; drop | — | — | S3 |
| Mock connectors enabled in a prod build | env check at boot | **refuse to start** | /health 503 | unset flag | S1 |

## 9. AUTH, TENANCY, CONFIG (F12, F18)

| Failure | Detect | System action | User sees | Recovery | Sev |
|---|---|---|---|---|---|
| Query without tenant predicate | CI grep + runtime assertion in db helpers | CI fails / request 500 | — | fix code | S1 |
| API key revoked mid-session | lookup | 401 | "key revoked" | new key | S2 |
| Session idle > 12 h | TTL | 401; UI redirects to login preserving return URL | login | — | S4 |
| Config PUT removes a rule pack in use | validation | allowed; existing versions keep snapshot | banner on those versions | — | S3 |
| Config PUT sets `blastRadiusThreshold` < 100 | validation | reject (min 100) | inline error | — | S4 |
| Last admin removes own admin role | validation | reject | "at least one admin required" | — | S2 |

## 10. INFRASTRUCTURE

| Failure | Detect | System action | User sees | Recovery | Sev |
|---|---|---|---|---|---|
| Postgres unavailable | health probe | api returns 503 on all routes; jobs pause | maintenance page | restore DB | S1 |
| Postgres restored from backup (data loss window) | ops | evidence chain may have a gap: verify reports `firstBrokenSeq` at the gap | Evidence banner | runbook: attestation record; tenants informed | S1 |
| pg-boss table bloat | metrics | maintenance job archives completed > 7 d | none | automatic | S4 |
| Disk full (uploads) | write error | INGEST S1 row above | 503 | ops | S1 |
| Clock skew between api replicas | `asOf` is data, not clock, for evaluation; only `expired` sweep and TTLs use `now()` from **Postgres** (`now()` in SQL), not app clock | none | — | — | S4 |
| Migration fails halfway | Drizzle transactional migrations | rolled back; app refuses to start on schema mismatch | 503 | fix migration | S1 |

## 11. Things that are deliberately NOT failures

- A campaign with **zero findings** is not "compliant" — the UI says *"No findings from the rules that could be evaluated"* and shows coverage. (`D16`, no verdict.)
- A `cannot_evaluate` is not an error. It is information.
- An exception expiring is not an error; the finding simply returns at its real severity on the next evaluation.
- A shadow-mode version with blockers is the *point*, not a problem.
