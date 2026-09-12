# 15 — Data Dictionary & Configuration Reference

Single source for **every enum value, every configurable key, every environment variable, and the tables/columns added since `03`**. Where this document and `03` disagree, this one wins and `03` gets patched.

## 1. Enumerations (Postgres enums; TypeScript unions generated from these)

| Enum | Values | Notes |
|---|---|---|
| `role` | `admin` `operator` `reviewer` `approver` | Users hold ≥1. |
| `campaign_mode` | `live` `shadow` | Shadow never reaches review. |
| `version_state` | `draft` `resolving` `evaluated` `in_review` `approved` `rejected` `sealed` `handed_off` `abandoned` `expired` | Terminal: `sealed` `handed_off` `abandoned` `expired`. |
| `channel` | `whatsapp` `sms` `email` `voice` `visit` | `voice`/`visit` exist only so A-RBI-012 can be scoped; **not selectable in v1 UI**. |
| `purpose` | `collections` `promotional` `service` | `null` on a version means *infer*. |
| `consent_state` | `granted` `denied` `unknown` | `null` column = field absent (≠ `unknown`). |
| `event_kind` | `sent` `delivered` `read` `failed` `inbound` `blocked_proxy` `opt_out` | `blocked_proxy` = inferred from quality decay, never a provider fact. |
| `severity` | `block` `warn` `info` | Ordering block < warn < info for sorting. |
| `finding_category` | `timing` `consent` `audience` `content` `identity` `delivery` | Scorecard rows. |
| `coverage_status` | `evaluated` `cannot_evaluate` `not_applicable` | |
| `decision_type` | `accept` `fix` `abandon` | |
| `decision_scope` | `this-finding` `this-campaign` `this-rule-30d` | |
| `review_outcome` | `approved` `rejected` | |
| `section_outcome` | `approved` `rejected` | Per section in `reviews.sections`. |
| `evidence_kind` | `seal` `chain_attestation` | Attestation rows document incidents; they are chained like any other. |
| `connector_kind` | `csv` `wati` `meta-graph` `mock` | `mock` refused in prod builds. |
| `connector_status` | `active` `degraded` `disabled` | |
| `capability` | `templates` `history` `quality_rating` `messaging_limit` `consent` `suppress` | |
| `sync_scope` | `templates` `history` `quality` `consent` | |
| `handoff_target` | `export` `webhook` `wati:suppress` | |
| `push_status` | `pending` `ok` `failed` | Per identity key in `handoff_pushes`. |
| `job_kind` | `resolve` `check` `seal` `webhook` `push_suppress` `sync` `expire_sweep` `retention` | pg-boss queue names. |
| `source_confidence` | `PRIMARY` `SECONDARY` `DERIVED` `PLATFORM` | On citations. |
| `rule_layer` | `A` `B` `C` `A→C` | |
| `rule_tier` | `0` `1` `2` | int, not enum. |
| `classification` | `promotional` `service` `mixed` `unknown` | From core. |
| `classification_confidence` | `high` `low` | |
| `fix_kind` | `reschedule` `drop_rows` `edit_message` `set_config` `add_disclosure` | |
| `what_kind` | `schedule` `message_text` `rows` `config` `template` | |
| `audit_action` | see §5 | string, not enum (extensible). |
| `error_type` | `validation` `unauthenticated` `not-found` `forbidden-role` `forbidden-self-review` `invalid-transition` `blockers-outstanding` `blast-radius-approval-required` `idempotency-conflict` `connector-unavailable` `rate-limited` `internal` | RFC 9457 `type` suffix. |

### Built-in reason codes (extensible per tenant)
`one-time-exception` · `rule-is-wrong` · `data-was-wrong` · `romanised-acceptable` · `service-not-promotional` · `legal-basis-other` · `duplicate-intended` · `test-send`

Only `rule-is-wrong` feeds `rule_proposals`.

## 2. Tables added since `03` (from 13/14)

### `cosign_requests`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id, version_id | uuid fk | |
| code | text | 6 digits, unique among unexpired per tenant |
| requested_by | uuid fk users | the reviewer |
| approved_by | uuid fk users nullable | the approver |
| token_hash | text nullable | single-use; argon2id |
| expires_at | timestamptz | code TTL 30 min; token TTL 10 min from approval |
| consumed_at | timestamptz nullable | |

### `handoff_pushes`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id, version_id, connector_id | uuid fk | |
| target | handoff_target | |
| identity_key | text | one row per key pushed |
| status | push_status | |
| provider_ref | text nullable | |
| error | text nullable | |
| pushed_at | timestamptz | |
| Unique: (version_id, connector_id, identity_key) |

### `platform_templates` (cache)
| column | type |
|---|---|
| id uuid pk · tenant_id · connector_id · external_id text · name text · status text (`APPROVED` `PENDING` `REJECTED` `PAUSED` `DISABLED` — provider vocab, stored raw) · category text (`MARKETING` `UTILITY` `AUTHENTICATION`) · body text · variable_count int · rejection_reason text nullable · fetched_at timestamptz |
| Unique: (connector_id, external_id) |

### `platform_state` (cache, one row per connector)
| column | type |
|---|---|
| connector_id uuid pk · tenant_id · quality_rating text nullable (`GREEN` `YELLOW` `RED` `UNKNOWN`) · messaging_limit_tier text nullable (`TIER_250` `TIER_1K` `TIER_10K` `TIER_100K` `TIER_UNLIMITED`) · name_status text nullable · raw jsonb · fetched_at timestamptz |

### `connectors`
| column | type |
|---|---|
| id uuid pk · tenant_id · kind connector_kind · label text · status connector_status · capabilities capability[] · credentials_enc bytea · credentials_iv bytea · config jsonb (`{ suppressOptIn: bool, historyLookbackDays: int }`) · cursor jsonb nullable · last_sync_at timestamptz nullable · last_error text nullable · created_at |

### `rulebook_versions` — as in 03 §9, plus `attestation text nullable`.

### Columns added
- `tenants.sealing_frozen bool default false` · `tenants.frozen_reason text nullable`
- `evidence_records.kind evidence_kind default 'seal'`
- `campaign_versions.review_evaluation_id uuid nullable` (mutable, per G1) · `campaign_versions.progress_pct smallint nullable` (mutable during resolving) · `campaign_versions.no_change bool default false`
- `audience_rows.consent_source` may be `upload` · `consent_records` · `upload:conflict` · `records:later-withdrawal`
- `evaluations.rulebook_hash_at_seal text nullable` (set by SEAL if differs)
- `decisions.stale_evaluation bool default false`

## 3. `TenantConfig` — every key

| key | type | default | range / validation | who | effect |
|---|---|---|---|---|---|
| `lenderName` | string | — (required) | 2–80 chars | admin | A-RBI-011; certificate header |
| `entityType` | `'bank'` \| `'nbfc'` \| `'hfc'` \| `'other'` | `'bank'` | enum | admin | Source-confidence chip for 2027 rules: `PRIMARY` if bank, `UNVERIFIED` otherwise (O8) |
| `frequencyCapPerWeek` | int \| null | null | 1–14 | admin | A-RBI-005 existence; Tier-1 enforcement |
| `quietHours` | `{start:'HH:MM', end:'HH:MM'}` \| null | null | valid times; may wrap midnight | admin | Layer-C rule `C-QUIET-001` (warn), stricter than statute only |
| `bannedPhrases` | string[] | `[]` | ≤ 200 entries, each ≤ 80 chars, case-insensitive substring | admin | `C-BANNED-001` (block) |
| `romanisedAcceptableLanguages` | string[] | `[]` | ISO-ish lowercase names from alias table | admin | A-RBI-003 treats Latin-script message as OK for these preferences |
| `blastRadiusThreshold` | int | 10000 | 100–10,000,000 | admin | F8 co-sign trigger |
| `reasonCodes` | string[] | `[]` | kebab-case, ≤ 40 chars, ≤ 50 entries | admin | extends built-ins |
| `rulePacks` | string[] | `['india-layer-a','preflight-hygiene']` | must exist in registry | admin | which packs CHECK loads |
| `layerBPacks` | string[] | `[]` | must exist | admin | claims packs (none in v1) |
| `mappingPresets` | `Record<string, ColumnMapping>` | `{}` | ≤ 20 | admin/operator | upload wizard |
| `webhookUrl` | string \| null | null | https only | admin | F10 |
| `webhookSecret` | string (write-only) | — | 32–128 chars; stored encrypted; never returned | admin | HMAC |
| `advisory.llmClassification` | bool | false | — | admin | M5 |
| `advisory.audienceQuality` | bool | false | — | admin | M5 |
| `retention.contactEventsMonths` | int | 24 | 6–120 | admin | retention job |
| `exceptionMaxDays` | int | 90 | 1–90 (hard cap) | admin | F6 |
| `scheduleMinLeadMinutes` | int | 5 | 0–1440 | admin | F1 guard |

`PUT /config` validates the whole object; partial updates are not supported (send the full object; UI does this).

## 4. Environment variables (`apps/api`, `apps/worker`, `apps/web` build)

| var | required | default | notes |
|---|---|---|---|
| `NODE_ENV` | yes | — | `development` \| `test` \| `production` |
| `PREFLIGHT_ROLE` | no | `all` | `api` \| `worker` \| `all` |
| `PORT` | no | 3000 | api |
| `DATABASE_URL` | yes | — | postgres URI |
| `DATABASE_POOL_MAX` | no | 10 | |
| `PREFLIGHT_KMS_KEY` | yes | — | 32-byte base64; AES-256-GCM for connector creds + webhook secret |
| `PREFLIGHT_SESSION_SECRET` | yes | — | ≥ 32 chars |
| `PREFLIGHT_SESSION_TTL_HOURS` | no | 12 | |
| `PREFLIGHT_STORAGE` | no | `postgres` | `postgres` \| `s3` |
| `S3_ENDPOINT` `S3_BUCKET` `S3_ACCESS_KEY` `S3_SECRET_KEY` `S3_REGION` | if s3 | — | |
| `PREFLIGHT_DEMO_MOCK_CONNECTORS` | no | `false` | **refused when NODE_ENV=production** |
| `PREFLIGHT_RULEBOOK_DIR` | no | `./rulebook` | Turtle files |
| `PREFLIGHT_JOB_CONCURRENCY` | no | 4 | per worker process |
| `PREFLIGHT_CHECK_TIMEOUT_MS` | no | 120000 | job hard limit |
| `PREFLIGHT_HISTORY_QUERY_TIMEOUT_MS` | no | 30000 | Tier-1 access |
| `PREFLIGHT_PLATFORM_CACHE_MINUTES` | no | 15 | |
| `PREFLIGHT_PLATFORM_STALE_HOURS` | no | 24 | |
| `PREFLIGHT_RATE_LIMIT_PER_MIN` | no | 100 | per key |
| `PREFLIGHT_UPLOAD_MAX_MB` | no | 25 | |
| `PREFLIGHT_INLINE_ROWS_MAX` | no | 5000 | |
| `PREFLIGHT_WEBHOOK_TIMEOUT_MS` | no | 10000 | |
| `PREFLIGHT_LLM_PROVIDER` | no | `null` | `null` \| `anthropic` |
| `ANTHROPIC_API_KEY` | if anthropic | — | |
| `PREFLIGHT_LLM_MODEL` | no | — | recorded on evaluation |
| `LOG_LEVEL` | no | `info` | pino |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | no | — | tracing off when absent |
| `PREFLIGHT_PUBLIC_URL` | yes | — | for certificate/webhook links |
| `VITE_API_BASE` | web build | `/v1` | |

Boot validates all of these with Zod and **refuses to start** on any error, printing the full list of problems.

## 5. Audit actions (string catalogue)

`auth.login` `auth.logout` `auth.key_created` `auth.key_revoked` · `campaign.created` · `version.created` `version.state_changed` `version.resolve.started` `version.resolve.completed` `version.resolve.failed` `version.check.started` `version.evaluated` `version.check.failed` `version.check.rule_error` `version.fixed_into` `version.submitted` `version.rejected` `version.approved` `version.sealed` `version.exported` `version.handed_off` `version.abandoned` `version.expired` `version.send_confirmed` · `decision.recorded` `exception.created` `exception.expired` `rule_proposal.updated` · `review.recorded` `review.invalidated` `cosign.requested` `cosign.approved` `cosign.consumed` · `seal.failed` `evidence.chain_broken` `evidence.attested` · `webhook.delivered` `webhook.retry` `webhook.failed` · `handoff.push.partial` `handoff.push.failed` · `config.updated` · `connector.created` `connector.synced` `connector.auth_failed` `connector.disabled` · `user.created` `user.roles_changed` · `upload.created` `upload.mapped` `upload.deleted`

Every row: `actor_id` (null for system), `actor_roles` snapshot, `entity_type`, `entity_id`, `request_id`, `before`/`after` where a value changed.

## 6. `ColumnMapping`

```ts
{
  version: 1,
  columns: Record<string, Target>,      // uploaded header → target
  consentValueMap?: { granted: string[], denied: string[] },   // e.g. { granted:['Y','opted in'], denied:['N'] }
  languageAliases?: Record<string,string>
}
type Target =
  | 'externalId' | 'phone' | 'email' | 'preferredLanguage' | 'consentPromotional'
  | `consentPromotional:${string}`        // per product
  | `attribute:${string}`                 // free attribute
  | 'ignore'
```
Validation: at most one column per target except `attribute:*`; header names must exist in the upload.

## 7. Job payloads (pg-boss)

| job | payload | singleton key | retry |
|---|---|---|---|
| `resolve` | `{tenantId, versionId}` | `version:<id>` | 3 × (10s, 1m, 5m) |
| `check` | `{tenantId, versionId, asOf: ISO\|null, requestedBy?}` | `version:<id>:<asOf>` | 3 |
| `seal` | `{tenantId, versionId}` | `tenant:<id>` | 5 × (10s…1h); never drops |
| `webhook` | `{tenantId, evidenceId, event}` | — | 5 × (1m,5m,30m,2h,12h) |
| `push_suppress` | `{tenantId, versionId, connectorId, identityKeys[]}` | `version:<id>:push` | 3 |
| `sync` | `{tenantId, connectorId, scope, since?}` | `connector:<id>:<scope>` | 3 |
| `expire_sweep` | `{}` | `global` | cron `* * * * *` |
| `retention` | `{}` | `global` | cron `0 3 * * *` |

## 8. Size limits (single place)

message ≤ 4,096 chars · template body ≤ 1,024 · variables ≤ 20 · inline rows ≤ 5,000 · upload ≤ 25 MB / 2,000,000 rows · CSV cell ≤ 4 KB · reasonText 10–2,000 chars · notes ≤ 4,000 · bannedPhrases ≤ 200 · attributes per row ≤ 50 keys · certificate findings rollup when > 5,000 findings.
