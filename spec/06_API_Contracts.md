# 06 — API Contracts (complete)

REST, JSON, base `/v1`. Fastify + Zod; every schema below is a Zod schema in `apps/api/src/schemas/` and is the source for `packages/api-types` and `/v1/openapi.json`. **Shapes here are normative.** Enum values are defined once in `15 §1` and referenced by name.

## 1. Conventions

- **Auth:** `Authorization: Bearer <api_key>` or session cookie. Tenant derives from the credential; never from body/URL.
- **Ids** uuid v7. **Times** ISO-8601 with offset; responses use UTC `Z`; UI renders IST.
- **Pagination:** `?cursor=<opaque>&limit=<1..500, default 50>` → `{ items: T[], nextCursor: string|null }`.
- **Idempotency:** `Idempotency-Key: <≤128 chars>` on every POST marked ⟲. Same key + same body → original response (200). Same key + different body → 409 `idempotency-conflict`.
- **Errors** (RFC 9457):
  ```ts
  Problem = { type: `https://preflight.dev/errors/${ErrorType}`, title: string, status: number,
              detail?: string, instance: string, requestId: string,
              issues?: { path: string; message: string }[],      // validation only
              data?: Record<string, unknown> }                    // e.g. blockers-outstanding lists rule ids
  ```
  `ErrorType` and HTTP status: `validation` 400 · `unauthenticated` 401 · `forbidden-role` 403 · `forbidden-self-review` 409 · `not-found` 404 · `invalid-transition` 409 · `blockers-outstanding` 409 · `blast-radius-approval-required` 409 · `idempotency-conflict` 409 · `connector-unavailable` 503 · `rate-limited` 429 · `internal` 500.
- **Roles column** lists who may call; `any` = any authenticated user of the tenant.
- **Common shapes** (used below):
  ```ts
  UserRef      = { id, displayName, roles: Role[] }
  Citation     = { instrument: string, title: string, confidence: SourceConfidence, graphNodeId: string, url?: string }
  What         = { kind: WhatKind, excerpt?: string, field?: string }
  SuggestedFix = { kind: FixKind, label: string, payload: Record<string, unknown> }
  Classification = { classification: ClassificationValue, evaluateAs: 'promotional'|'service', confidence: 'high'|'low',
                     promotionalMarkers: string[], serviceMarkers: string[], reason: string,
                     advisory?: { classification, confidence: number, rationale, provider, model, promptVersion } }
  Coverage     = { rulesInBook: number, applicable: number, evaluated: number,
                   cannotEvaluate: { ruleId, title, reason: string, missing: string[] }[],
                   notApplicable: { ruleId, title, reason?: string }[], statement: string }
  Summary      = { blockers: number, warnings: number, info: number, cannotEvaluate: number, audienceSize: number, verdict: null }
  Decision     = { id, findingId, versionId, type: DecisionType, reasonCode: string, reasonText: string,
                   scope: DecisionScope, expiresAt: ISO|null, actor: UserRef, resultingVersionId: uuid|null,
                   staleEvaluation: boolean, createdAt: ISO }
  Finding      = { id, evaluationId, ruleId, severity: Severity, category: FindingCategory, title, explanation,
                   what: What, suggestedFix: SuggestedFix|null, affectedCount: number, affectedSample: string[],
                   affectedRowsTruncated: boolean, citation: Citation, suppressedBy: uuid|null, decisions: Decision[] }
  VersionSummary = { id, campaignId, versionNo, parentVersionId: uuid|null, state: VersionState, stateChangedAt,
                     channel: Channel, scheduledAt: ISO, sentAt: ISO|null, purpose: Purpose|null,
                     borrowerSegment: string|null, product: string|null, audienceSize: number,
                     latestEvaluation: { id, asOf, rulebookHash, summary: Summary }|null,
                     supersededBy: uuid[], progressPct: number|null, queuePosition: number|null,
                     configDrift: boolean, noChange: boolean, createdBy: UserRef, createdAt }
  ```

## 2. Auth & identity

| Method | Path | Roles | Request | Response |
|---|---|---|---|---|
| POST | `/auth/session` | — | `{ email: string, password: string }` | 204 + cookie · 401 |
| DELETE | `/auth/session` | any | — | 204 |
| GET | `/me` | any | — | `{ user: UserRef, tenant: { id, slug, name, entityType }, sealingFrozen: boolean }` |
| GET | `/users` | admin | — | `{ items: (UserRef & { email, createdAt })[] }` |
| POST ⟲ | `/users` | admin | `{ email, displayName, roles: Role[], password: string }` | 201 UserRef |
| PATCH | `/users/:id` | admin | `{ roles?: Role[], displayName? }` | 200 UserRef · 400 "at least one admin required" |
| POST ⟲ | `/api-keys` | admin | `{ userId, label }` | 201 `{ id, label, plaintext }` (plaintext shown once) |
| DELETE | `/api-keys/:id` | admin | — | 204 |

## 3. Uploads

| Method | Path | Roles | Request | Response |
|---|---|---|---|---|
| POST | `/uploads` | operator, admin | multipart `file` (≤ 25 MB, text/csv) | 201 `{ id, filename, bytes, rowCount, columns: string[], sampleRows: Record<string,string>[], suggestedMapping: ColumnMapping, unmapped: string[], warnings: string[] }` |
| POST | `/uploads/:id/mapping` | operator, admin | `ColumnMapping` (15 §6) | 200 `{ mapping, preview: { normalisedSample: Row[], identityCoverage: { phone, email, none }, consentDistribution: { granted, denied, unknown, absent }, languageDistribution: Record<string, number>, rulesEvaluableAtTier0: number } }` |
| GET | `/uploads/:id` | any | — | 200 upload meta (no rows) |
| DELETE | `/uploads/:id` | admin | — | 204 · 409 if referenced by a sealed version (raw purged, hash kept — returns 200 `{ purged: true }`) |

## 4. Campaigns & versions

### `POST ⟲ /campaigns` — operator, admin
```ts
Req  { name: string(1..120), mode: CampaignMode }
Res  201 { id, name, mode, latestVersionState: null, createdBy: UserRef, createdAt }
```
### `GET /campaigns` — any
`?state=<VersionState>&mode=<CampaignMode>&q=<name substring>` → `{ items: { id, name, mode, latestVersion: VersionSummary|null, createdAt }[], nextCursor }`

### `GET /campaigns/:id` — any
→ `{ id, name, mode, versions: VersionSummary[] (desc), createdBy, createdAt }`

### `POST ⟲ /campaigns/:id/versions` — operator, admin
```ts
Req  {
  message: string(1..4096),
  channel: Channel,                        // 'voice'|'visit' rejected in v1: validation
  scheduledAt: ISO,                        // live: ≥ now + config.scheduleMinLeadMinutes
  sentAt?: ISO,                            // required iff campaign.mode = 'shadow'; then scheduledAt := sentAt
  purpose?: Purpose,
  borrowerSegment?: string(1..40),
  product?: string(1..80),
  template?: { body: string(1..1024), variables: string[](≤20), externalId?: string, category?: 'MARKETING'|'UTILITY'|'AUTHENTICATION' },
  audience: { uploadId: uuid, mapping?: ColumnMapping } | { rows: Record<string,string>[](1..5000) },
  parentVersionId?: uuid
}
Res  202 { version: VersionSummary, jobs: ['resolve'] }
Err  400 validation (all issues) · 404 campaign · 409 invalid-transition (campaign has a non-terminal version in 'in_review'? no — allowed; multiple drafts are fine)
```
### `GET /versions/:id` — any
→ `VersionSummary & { message, template, configSnapshot: TenantConfig, review: ReviewSummary|null, evidence: { id, seq, hash }|null, audience: { size, duplicates, unresolvable, consent: { granted, denied, unknown, absent } } }`

### `POST /versions/:id/evaluate` — operator, admin
```ts
Req  { asOf?: ISO }                                  // default: sentAt ?? scheduledAt
Res  202 { evaluationId: null, job: 'check', advisory: boolean }   // new run
     200 { evaluationId, advisory: boolean }                        // existing (same 4-tuple)
Err  409 invalid-transition (state draft/resolving/abandoned/expired)
```
### `GET /versions/:id/evaluations` — any → `{ items: { id, asOf, rulebookHash, exceptionsHash, advisory, summary, createdAt }[] }`

### `GET /evaluations/:id` — any
```ts
→ { id, versionId, asOf, rulebookHash, rulePackIds: string[], engineVersion, durationMs, advisory: boolean,
    classification: Classification, effectivePurpose: Purpose, coverage: Coverage, summary: Summary,
    findings: Finding[] (sorted severity, ruleId), createdAt }
```
### `GET /findings/:id` — any → `Finding & { versionId, evaluationId }`
### `GET /findings/:id/rows` — any → `{ items: { rowId, rowNo, externalId, identityKey, preferredLanguage, consentPromotional }[], nextCursor }` (affected rows, upload order)

### `POST ⟲ /versions/:id/fix` — operator, admin
```ts
Req  { findingId?: uuid,
       fix?: SuggestedFix['payload'],                  // apply the rule's suggestion
       edit?: { message?: string, scheduledAt?: ISO, dropRowIds?: uuid[], template?: Template, purpose?: Purpose, borrowerSegment?: string } }
     // exactly one of fix|edit; allowed from state evaluated | rejected | expired
Res  201 { version: VersionSummary, decisionId: uuid|null }
     200 { requiresConfigChange: true, key: string, value: unknown }   // set_config fixes; no version created
Err  409 invalid-transition · 404 finding · 400 validation
```
### `POST /versions/:id/submit` — operator, admin
→ 200 `{ state: 'in_review', reviewEvaluationId }` · 409 `blockers-outstanding` `{ data: { ruleIds: string[] } }` · 409 `invalid-transition` (shadow, schedule passed, wrong state)

### `POST /versions/:id/abandon` — operator, admin · `{ reason: string(5..500) }` → 200 `{ state: 'abandoned' }`

### `GET /versions/:id/diff/:otherId` — any
→ `{ message: { changed: boolean, before, after }, scheduledAt: {...}, template: {...}, audience: { added: number, removed: number, removedSample: string[] } }` · 400 if different campaigns

## 5. Decisions & review

### `POST ⟲ /findings/:id/decisions` — see 02 §7
```ts
Req  { type: 'accept'|'abandon', reasonCode: string, reasonText: string(10..2000),
       scope: DecisionScope, expiresAt?: ISO }
Res  201 Decision & { exceptionId: uuid|null, reevaluation: 'queued'|null }
Err  403 forbidden-role (block + operator) · 400 validation (code, text, expiry > cap) · 409 invalid-transition
```
### `POST /versions/:id/cosign-request` — reviewer, admin → 201 `{ code: string(6), expiresAt }`
### `POST /cosign/:code/approve` — approver, admin → 200 `{ token: string, expiresAt }` · 404 · 403
### `POST /versions/:id/review` — reviewer, admin
```ts
Req  { sections: { audience: Section, message: Section, rules: Section, delivery: Section },   // Section = { outcome: SectionOutcome, note?: string(≤2000) }
       outcome: ReviewOutcome, notes?: string(≤4000), blastRadiusApproverToken?: string }
Res  200 { state: 'approved'|'rejected', reviewId, seal: 'queued'|null }
Err  409 forbidden-self-review · 409 invalid-transition (not in_review; re-evaluated since submit) · 409 blast-radius-approval-required { data: { audienceSize, threshold } } · 400 validation (approved with a rejected section)
```
`ReviewSummary = { id, reviewer: UserRef, sections, outcome, notes, blastRadiusApprover: UserRef|null, createdAt }`

## 6. Evidence

| Method | Path | Roles | Response |
|---|---|---|---|
| GET | `/evidence` | any | `{ items: { id, seq, kind: EvidenceKind, versionId, campaignName, versionNo, hash, sealedBy: UserRef, sealedAt }[], nextCursor }` |
| GET | `/evidence/:id` | any | `{ id, seq, kind, versionId, evaluationId, payload: CertificatePayload, payloadCanonical: string, prevHash, hash, sealedBy, sealedAt }` — `Cache-Control: immutable`, `ETag: hash` |
| GET | `/evidence/:id/certificate` | any | `text/html` self-contained; same caching |
| GET | `/evidence/verify` | any | `{ ok: boolean, checked: number, headHash: string|null, firstBrokenSeq: number|null, verifiedAt }` |
| GET | `/versions/:id/export` | operator, reviewer, admin | `application/zip` stream · 409 unless sealed/handed_off |
| POST ⟲ | `/versions/:id/handoff` | operator, admin | `{ target: HandoffTarget }` → 202 `{ state: 'handed_off'|'sealed', job?: 'push_suppress'|'webhook' }` · 503 connector-unavailable |
| GET | `/versions/:id/pushes` | any | `{ items: { identityKey, status: PushStatus, providerRef, error, pushedAt }[] }` |
| POST | `/callbacks/sent` | api key | `{ versionId, recipients: { identityKey?: string, phone?: string, email?: string, externalRef: string, occurredAt: ISO }[] }` → 202 `{ accepted, ignoredDuplicates, unknown }` |

`CertificatePayload` = `03 §8` plus `rulebookHashAtSeal?: string` and `schema: 'preflight.evidence/1'`.

## 7. Rulebook, explain, coverage

| Method | Path | Response |
|---|---|---|
| GET `/rulebook` | `{ hash, graphHash, packs: { id, version, ruleCount, sourceHash }[], loadedAt, gitRef: string|null }` |
| GET `/rulebook/rules` | `{ items: { id, pack, layer, tier, category, title, severity, severityBefore, effectiveFrom, requires: string[], sendTimeCheck: boolean, citation: Citation }[] }` |
| GET `/rulebook/graph` | `{ nodes: { id, type: 'rule'|'clause'|'instrument'|'regulator'|'enforcement', label, data: Record<string,unknown> }[], edges: { source, target, type: 'derivedFrom'|'quotedFrom'|'attributedTo'|'evidences'|'supersedes'|'closeMatch' }[] }` |
| GET `/rulebook/explain/:ruleId` | `{ rule, path: { clauses: Clause[], instruments: Instrument[], regulator }, enforcement: { entity, date, amount, summary, url }[], related: { ruleId, jurisdiction, relation }[] }` |
| GET `/coverage` | `{ items: { ruleId, title, tier, category, status: 'live'|'needs-data'|'not-send-time', missing: string[], unlockedBy: Capability[] }[], live: number, needsData: number, notSendTime: number }` |

## 8. Config, connectors, admin

| Method | Path | Roles | Request → Response |
|---|---|---|---|
| GET `/config` | any | → `TenantConfig` (secrets omitted) |
| PUT `/config` | admin | `TenantConfig` (full object; `webhookSecret` write-only) → 200 `TenantConfig` · 400 validation |
| GET `/connectors` | admin | → `{ items: { id, kind, label, status, capabilities, lastSyncAt, lastError, config }[] }` |
| POST ⟲ `/connectors` | admin | `{ kind: ConnectorKind, label, credentials: Record<string,string>, config?: { suppressOptIn?: boolean, historyLookbackDays?: number } }` → 201 connector + `probe: { ok, detail, capabilities }` |
| POST `/connectors/:id/sync` | admin | `{ scope: SyncScope, since?: ISO }` → 202 `{ job: 'sync' }` |
| PATCH `/connectors/:id` | admin | `{ label?, status?: 'active'|'disabled', config? }` → 200 |
| DELETE `/connectors/:id` | admin | → 204 |
| GET `/audit` | admin | `?entityType=&entityId=&action=&from=&to=` → `{ items: { id, actor: UserRef|null, entityType, entityId, action, before, after, requestId, createdAt }[], nextCursor }` |
| GET `/jobs` | admin | `?kind=&state=` → `{ items: { id, kind, state, payload (redacted), retryCount, createdAt, startedAt, completedAt, error }[] }` |
| POST `/jobs/:id/retry` | admin | → 202 |
| POST `/evidence/attest` | admin | `{ summary: string(20..4000), firstBrokenSeq?: number }` → 201 evidence record `kind: chain_attestation`; unfreezes sealing |

## 9. Shadow mode

| Method | Path | Roles | Request → Response |
|---|---|---|---|
| POST ⟲ `/shadow/import` | operator, admin | multipart CSV `name,message,channel,sentAt,purpose?,audienceUploadId` → 202 `{ batchId, accepted: number, rejected: { row: number, issues: string[] }[] }` |
| GET `/shadow/batches/:id` | any | → `{ id, total, evaluated, pending, summary: { flagged, withBlockers, withWarnings }, campaigns: { campaignId, versionId, name, sentAt, summary: Summary|null }[] }` |

## 10. Health

`GET /health` → `{ ok, db: 'ok'|'down', queue: 'ok'|'down', rulebookHash, version: string }` · `GET /metrics` → Prometheus text (network-restricted).

## 11. Outbound webhook

`POST <tenant.config.webhookUrl>` · headers `X-Preflight-Event: version.sealed|version.handed_off`, `X-Preflight-Signature: sha256=<hex HMAC of body>`, `X-Preflight-Delivery: <uuid>` ·
body `{ event, tenant: { slug }, version: { id, campaignId, versionNo }, evidence: { id, seq, hash, certificateUrl }, at }` · retries 1m/5m/30m/2h/12h.

## 12. Rate limits & sizes

100 req/min per credential · uploads 10/min · `POST /versions` 30/min · `POST /shadow/import` 2/min. 429 with `Retry-After`. Body sizes per `15 §8`.

## 13. Versioning

Additive changes in `/v1` (new optional fields, new endpoints) with `CHANGELOG.md`; breaking → `/v2`. The generated `packages/api-types` is regenerated on every schema change; the web build fails on drift.
