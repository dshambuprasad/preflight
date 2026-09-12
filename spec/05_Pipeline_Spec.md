# 05 — Pipeline Specification

Six stages, one state machine, one axiom: **a `CampaignVersion` is immutable; change means a new version.**

## 1. Stages

| Stage | Trigger | Input | Output | Job? |
|---|---|---|---|---|
| **INGEST** | `POST /campaigns/:id/versions` | message, channel, scheduledAt, purpose?, segment?, template?, audience (rows or uploadId+mapping) | `CampaignVersion(draft)` + `audience_rows` + `config_snapshot` + hashes | sync (streams the CSV) |
| **RESOLVE** | auto after INGEST | audience_rows | identity keys, `duplicate_of_row_id`, consent join, `contacts` upsert | job |
| **CHECK** | auto after RESOLVE; or `POST /versions/:id/evaluate {asOf}` | version + rule packs + config_snapshot + tier data | `Evaluation` + `Finding[]` + `coverage_items` | job |
| **DECIDE** | human actions | findings | `decisions`, `exceptions`, new versions (fix) | sync |
| **SEAL** | auto on review approve | approved version + its evaluation + decisions + review | `evidence_records` row | job (serialised per tenant) |
| **HANDOFF** | `GET /versions/:id/export` or `POST /versions/:id/handoff` | sealed version | export bundle / webhook / connector push; `contact_events(kind=sent, source=handoff)` **only when the target confirms** | job |

Every stage transition emits an `audit_events` row and, where state changes, updates `campaign_versions.state` in the same transaction as its output.

## 2. State machine

```
             ┌───────────────────────────────────────────────────────────┐
             │                                                           ▼
 draft ──▶ resolving ──▶ evaluated ──▶ in_review ──▶ approved ──▶ sealed ──▶ handed_off
   ▲                        │  ▲           │                                   
   │                        │  │           └──▶ rejected ──▶ (new version from rejected) ──▶ draft
   │                        │  └── re-evaluate (asOf change) stays in evaluated
   │                        └──▶ fix → new version (draft) ; this version → superseded*
   └── any non-terminal ──▶ abandoned
   in_review, approved ──▶ expired   (scheduledAt passes before seal; see §6)
```

\* `superseded` is not a state; it's derivable (`exists child with parent_version_id = this`). The UI shows it.

**Terminal states:** `sealed`, `handed_off`, `abandoned`, `expired`. Terminal versions never change state again.

Transition rules (enforced in `pipeline/machine.ts`, tested exhaustively):

| From | To | Who | Guard |
|---|---|---|---|
| draft | resolving | system | — |
| resolving | evaluated | system | RESOLVE + CHECK succeeded |
| resolving | draft | system | job failed; error recorded; retryable |
| evaluated | evaluated | operator/system | re-evaluate with different `asOf` or after exception change |
| approved \| sealed \| handed_off | (same) | operator, admin | **advisory** re-evaluation (`advisory: true`): stored, never sealed, state unchanged |
| evaluated | in_review | operator, admin | **no `block` findings without an accept decision by a `reviewer`/`admin`** |
| in_review | approved | reviewer, admin | reviewer ≠ author; all four sections approved; blast-radius approver present if required |
| in_review | rejected | reviewer, admin | reviewer ≠ author |
| rejected \| expired | (new draft) | operator, admin | via `POST /versions/:id/fix {edit}`; new version with `parent_version_id`; reviewer notes carried into the new version's activity |
| approved | sealed | system | evidence record written |
| sealed | handed_off | operator, admin | export/webhook/push completed |
| in_review \| approved | expired | system (scheduler) | `now > scheduledAt` and not sealed *(R5 — CleverTap: define what happens when send time arrives first)* |
| any non-terminal | abandoned | operator, admin | reason required |

## 3. RESOLVE — identity, duplicates, consent

**Identity key (DECISION, v1):**
```
phone present → 'phone:' + E.164        (libphonenumber-js, default region IN)
else email    → 'email:' + lowercase(trim(email))
else          → 'row:' + audience_row.id     (unresolvable; still evaluated)
```
Exact match only. No fuzzy matching in v1. The limitation is stated in the coverage statement when any `row:` keys exist: *"n recipients had no phone or email and could not be matched to history or consent."*

**Duplicates:** rows sharing an identity key within a version → all but the first get `duplicate_of_row_id`. A finding `A-PF-001 Duplicate recipients` (pack `preflight-hygiene`, category `audience`, severity `warn`, fix `drop_rows`) reports them. This is the first *audience-quality* rule and it needs no history.

**Consent join:** for each row, `consent_promotional` is set from (in priority) the upload column → `consent_records` current state for (contact, `promotional`, channel) → `null`. `consent_source` records which. Product-scoped consent (`promotional:<product>`) is looked up when `campaign.product` is set (M4+).

**Contacts upsert:** identity key → `contacts` row; `last_seen_at` updated; `preferred_language` updated if supplied.

## 4. CHECK — assembling the context

```
ctx = {
  campaign: from version,
  contacts: audience_rows (non-duplicate) → Contact[],
  config: version.config_snapshot,          // NOT tenants.config — reproducibility
  asOf: request.asOf ?? version.sent_at ?? version.scheduled_at,
  history: tenant has any contact_events ? HistoryAccess(tenant) : undefined,
  consent: tenant has any consent_records ? ConsentAccess(tenant) : undefined,
  platform: connector state cached within 15 min ? PlatformState : undefined,
  exceptions: active exceptions for (tenant, campaign)
}
```

Persist `Evaluation` + `Finding[]` + `coverage_items` in one transaction. Unique on `(version_id, as_of, rulebook_hash)` → re-running with identical inputs returns the existing evaluation (idempotent).

**Shadow mode:** identical, with `asOf = sent_at`. The UI labels it *"evaluated as of the date it was sent"*. Shadow versions can never reach `in_review`.

## 5. DECIDE — decisions, authority, exceptions

A decision is a row, never an edit. Rules:

- `accept` on `block` → actor must hold `reviewer` or `admin`. Operators get a 403 with the message *"Blockers can only be accepted by a reviewer."* — and the UI shows the button disabled with the same text.
- `accept` requires `reason_code` (from built-ins ∪ tenant list) **and** `reason_text` (min 10 chars). *(R5 — Braze typed override)*
- `scope` ∈ `this-finding` | `this-campaign` | `this-rule-30d`; the latter two create an `exceptions` row with `expires_at` (campaign: the version's scheduledAt + 7d; rule-30d: +30d). Exceptions never last longer than 90 days (hard cap; admin can re-grant).
- Only `reason_code = 'rule-is-wrong'` decisions feed `rule_proposals` (Layer D). Everything else is an exception, not learning. *(01_Concept Layer D)*
- `fix` → apply `suggested_fix.payload` (or an operator-supplied edit) → INGEST a new version with `parent_version_id` → RESOLVE → CHECK. The decision row's `resulting_version_id` links them. The old version stays `evaluated` and shows as superseded.
- Decisions are visible on the finding immediately and copied verbatim into the certificate at SEAL.

## 6. Review and expiry

- Submitting for review snapshots the current evaluation id on the version (`review_evaluation_id`); a re-evaluation after submission **invalidates the review** (state back to `evaluated`, audit event `review.invalidated`). The reviewer always reviews what was sealed.
- Four sections, each `approved` | `rejected` with an optional note: **Audience** (size, dupes, consent coverage), **Message** (content findings), **Rules** (all findings + decisions), **Delivery** (channel, schedule, template). *(R5 — Braze section sign-off)*
- Blast radius: if `audienceSize ≥ config.blastRadiusThreshold`, an `approver` must co-sign before `approved`. *(R5 — Braze escalation)*
- A scheduler job (every minute) moves `in_review`/`approved` versions whose `scheduledAt` has passed to `expired`, with an audit event. Expired versions can be cloned to a new draft with a new schedule.

## 7. SEAL — the evidence record

Serialised per tenant (pg-boss singleton key = tenant id) so `seq` and the chain are strictly ordered.

```
payload      = build certificate (03 §8)
canonical    = RFC 8785 JSON canonicalisation
prev_hash    = last evidence_records.hash for tenant, or sha256('preflight-genesis:' + tenant.id)
hash         = sha256(prev_hash + '\n' + canonical)
insert row; set version.state = sealed
```

`GET /evidence/:id` returns the payload + hashes. `GET /evidence/:id/certificate` renders it as a self-contained HTML page (print → PDF) with the hash printed on it. `GET /evidence/verify` walks the tenant's chain and returns `{ ok, checked, firstBrokenSeq? }`.

The certificate's content is *frozen* — it renders from `payload`, never from live tables. *(R5 — DocuSign/Vanta: portable artifact separate from live dashboard)*

## 8. HANDOFF

v1 targets:
- `export` — ZIP: `audience.csv` (non-duplicate, non-dropped rows), `message.txt`, `campaign.json`, `certificate.html`, `certificate.json`.
- `webhook` — POST the certificate JSON + a signed download URL to `tenant.config.webhookUrl` (HMAC-SHA256 signature header).
- `wati:suppress` (M4) — push dropped/no-consent identity keys to a WATI suppression list. Opt-in per tenant. Logged. Reversible (we record what we pushed).

Preflight records `contact_events(kind=sent)` **only** when a target confirms the send (webhook callback or connector event). Otherwise the export is recorded as `handed_off` and the coverage statement for future frequency checks says history is *"as reported by connected tools; exports without confirmation are not counted."* *(01_Concept gap 5 — never claim to know what was sent)*

## 9. Idempotency and retries

- All POSTs that create work accept `Idempotency-Key`; the key is stored on the created row; a repeat returns the original response (200, not 201).
- Jobs are retried 3× with backoff; a failing job records `error` on the version's latest `audit_events` and returns it to `draft` (RESOLVE/CHECK) or leaves it `approved` with a `seal.failed` event (SEAL — never lose an approval).
- CHECK is idempotent by construction (unique on version/asOf/rulebookHash).

## 10. Every entry point is gated

The JSON API creates versions through the identical INGEST → RESOLVE → CHECK path as the UI. There is no "trusted" or "transactional" bypass. *(R5 — Braze anti-pattern)* A test submits via API and asserts findings are produced and review is required.
