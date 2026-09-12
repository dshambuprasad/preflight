# 03 — Data Model

**Amended 2026-09-11:** tables and columns added by the process-flow and failure-mode work are defined in `15_Data_Dictionary_and_Config.md §2`, which wins over this document on conflict. Additions: `cosign_requests`, `handoff_pushes`, `platform_templates`, `platform_state`, `connectors`; columns `tenants.sealing_frozen`, `tenants.frozen_reason`, `evidence_records.kind`, `campaign_versions.progress_pct`, `campaign_versions.no_change`, `campaigns.latest_version_state`, `uploads.sha256`, `evaluations.rulebook_hash_at_seal`, `decisions.stale_evaluation`.

Postgres 16. Drizzle ORM. All ids are `uuid` v7 (time-ordered). All timestamps `timestamptz`. Every tenant-scoped table has `tenant_id uuid NOT NULL REFERENCES tenants(id)` and an index leading with it. Soft-delete is **not** used anywhere; the evidence log is append-only and everything else is either immutable or has an `AuditEvent`.

Conventions: `snake_case` columns; JSON columns are `jsonb` with a Zod schema in `packages/db/src/json/`; enums are Postgres enums.

## 1. Tenancy & identity

### `tenants`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| slug | text unique | |
| name | text | |
| config | jsonb | `TenantConfig` — Layer C. See §7 |
| created_at | timestamptz | |

### `users`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id | uuid fk | |
| email | citext | unique per tenant |
| display_name | text | |
| roles | role[] | enum `role`: `admin` `operator` `reviewer` `approver` |
| created_at | timestamptz | |

### `api_keys`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id | uuid fk | |
| user_id | uuid fk | the key acts *as* this user |
| key_hash | text | argon2id; the plaintext is shown once |
| label | text | |
| created_at, revoked_at | timestamptz | |

## 2. Campaigns and versions

### `campaigns`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id | uuid fk | |
| name | text | |
| mode | campaign_mode | enum: `live` `shadow` |
| created_by | uuid fk users | |
| created_at | timestamptz | |

### `campaign_versions` — **immutable after insert** (trigger raises on UPDATE except `state`, `state_changed_at`, `review_evaluation_id`)
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id | uuid fk | |
| campaign_id | uuid fk | |
| version_no | int | 1, 2, 3… unique per campaign |
| parent_version_id | uuid fk nullable | the version this was fixed from |
| state | version_state | see 05 — `draft` `resolving` `evaluated` `in_review` `approved` `rejected` `sealed` `handed_off` `abandoned` `expired` |
| state_changed_at | timestamptz | |
| message | text | |
| channel | channel | enum: `whatsapp` `sms` `email` |
| scheduled_at | timestamptz | |
| sent_at | timestamptz nullable | shadow mode only |
| purpose | purpose nullable | enum: `collections` `promotional` `service` — null = infer |
| borrower_segment | text nullable | `retail` `microfinance` … |
| template | jsonb nullable | `{ body, variables[], externalId?, category? }` |
| config_snapshot | jsonb | the tenant config **at version creation** — evaluations must be reproducible |
| audience_hash | text | sha256 of canonical audience rows |
| content_hash | text | sha256 of canonical (message, channel, scheduled_at, purpose, segment, template) |
| created_by | uuid fk users | |
| created_at | timestamptz | |
| idempotency_key | text nullable | unique (tenant_id, idempotency_key) |

### `audience_rows` — one per recipient per version. Immutable.
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id | uuid fk | |
| version_id | uuid fk | |
| row_no | int | position in upload |
| external_id | text nullable | the customer's id column |
| raw | jsonb | every column as uploaded |
| phone_e164 | text nullable | normalised |
| email_norm | citext nullable | normalised |
| identity_key | text | `phone:<e164>` or `email:<norm>` or `row:<uuid>` — see 05 §3 |
| preferred_language | text nullable | |
| consent_promotional | consent_state nullable | enum: `granted` `denied` `unknown` — null = field absent |
| consent_source | text nullable | where the value came from (upload / consent_records join) |
| duplicate_of_row_id | uuid nullable | set by RESOLVE |
| Indexes: (tenant_id, version_id), (tenant_id, identity_key) |

### `uploads`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id | uuid fk | |
| filename, mime, bytes | | |
| storage_ref | text | v1: Postgres large object / `bytea`; prod: object-store key |
| column_mapping | jsonb nullable | `ColumnMapping` from the mapping wizard (08) |
| row_count | int | |
| created_by, created_at | | |

## 3. Consent and contact history (the tenant's data we hold)

### `contacts` — the tenant's resolved people. Grows as versions are ingested.
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id | uuid fk | |
| identity_key | text | unique per tenant |
| phone_e164, email_norm | | |
| preferred_language | text nullable | last known |
| attributes | jsonb | free-form, from uploads |
| first_seen_at, last_seen_at | timestamptz | |

### `consent_records` — purpose-scoped, append-only (withdrawal is a new row)
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id | uuid fk | |
| contact_id | uuid fk | |
| purpose | text | `promotional` `service` `collections` or product-scoped `promotional:<product>` |
| channel | channel nullable | null = all channels |
| state | consent_state | `granted` `denied` |
| source | text | `upload` `api` `connector:wati` … |
| recorded_at | timestamptz | when the consent event happened |
| received_at | timestamptz | when we learned of it |
| evidence | jsonb nullable | pointer to the capture proof, if any |
| Index: (tenant_id, contact_id, purpose, recorded_at desc) |

**Current consent = latest row by `recorded_at` for (contact, purpose, channel-or-null).** Product-scoped purpose is how A-RBI-007 (per-product consent) is evaluated.

### `contact_events` — every known touch. This is the frequency-rule substrate and the ML-readiness store.
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id | uuid fk | |
| contact_id | uuid fk | |
| kind | event_kind | `sent` `delivered` `read` `failed` `inbound` `blocked_proxy` `opt_out` |
| channel | channel | |
| purpose | purpose nullable | |
| occurred_at | timestamptz | |
| source | text | `handoff` `connector:wati` `shadow_import` |
| campaign_version_id | uuid nullable | |
| external_ref | text nullable | provider message id |
| Index: (tenant_id, contact_id, occurred_at desc) · partition-ready by (tenant_id, month) |

**Cold-start is explicit:** the first day a tenant connects, this table is empty for them, and every frequency rule reports *cannot evaluate* until history accrues. *(V3)*

## 4. Evaluation

### `evaluations`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id | uuid fk | |
| version_id | uuid fk | |
| as_of | timestamptz | the instant rules were evaluated *for* |
| rulebook_hash | text | content hash of rule packs used |
| rule_pack_ids | text[] | e.g. `['india-layer-a@1.3.0']` |
| classification | jsonb | `Classification` from core |
| effective_purpose | purpose | |
| coverage | jsonb | `Coverage` from core |
| summary | jsonb | `{blockers, warnings, info, cannotEvaluate, audienceSize}` — **no verdict field, ever** |
| engine_version | text | `packages/core` semver |
| duration_ms | int | |
| created_at | timestamptz | |
| exceptions_hash | text | sha256 of the active exception ids at evaluation time — so an exception change forces a fresh evaluation |
| Unique: (version_id, as_of, rulebook_hash, exceptions_hash) — re-running with identical inputs is a no-op |

### `findings`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id | uuid fk | |
| evaluation_id | uuid fk | |
| rule_id | text | `A-RBI-001` |
| severity | severity | `block` `warn` `info` |
| category | finding_category | `timing` `consent` `audience` `content` `identity` `delivery` — for the scorecard grouping *(R5 Litmus)* |
| title | text | |
| explanation | text | the "why" line |
| what | jsonb | the exact text / field / rows flagged *(R5 four-part anatomy)* |
| suggested_fix | jsonb nullable | `{ kind: 'reschedule'|'drop_rows'|'edit_message'|'set_config'|'add_disclosure', payload }` |
| affected_count | int | |
| affected_row_ids | uuid[] | audience_rows ids; may be empty for message-level findings |
| citation | jsonb | `{ instrument, title, confidence, graphNodeId }` |
| created_at | timestamptz | |

### `coverage_items` — normalised from `evaluations.coverage` for the radar
| column | type |
|---|---|
| evaluation_id, rule_id, status (`evaluated` `cannot_evaluate` `not_applicable`), missing (text[]) |

## 5. Decisions and review

### `decisions` — one per human action on a finding. Append-only.
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id | uuid fk | |
| finding_id | uuid fk | |
| version_id | uuid fk | denormalised for the certificate |
| type | decision_type | `accept` `fix` `abandon` |
| reason_code | text | required for `accept`: `one-time-exception` `rule-is-wrong` `data-was-wrong` `romanised-acceptable` `service-not-promotional` `legal-basis-other` … (tenant-extensible list in config) |
| reason_text | text | free text, required |
| scope | decision_scope | `this-finding` `this-campaign` `this-rule-30d` |
| expires_at | timestamptz nullable | required when scope ≠ this-finding |
| actor_id | uuid fk users | |
| actor_roles | role[] | **snapshot** at decision time |
| resulting_version_id | uuid nullable | for `fix` |
| created_at | timestamptz | |

### `reviews`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id, version_id | | |
| reviewer_id | uuid fk users | MUST ≠ version.created_by (enforced in code and by a check trigger) |
| sections | jsonb | `{ audience: 'approved'|'rejected', message, rules, delivery }` with per-section note *(R5 Braze)* |
| outcome | review_outcome | `approved` `rejected` |
| notes | text | |
| blast_radius_approver_id | uuid nullable | required when audience ≥ threshold |
| created_at | timestamptz | |

### `exceptions` — standing, scoped exceptions derived from decisions with scope ≠ this-finding
| column | type |
|---|---|
| id, tenant_id, rule_id, scope, campaign_id nullable, decision_id, expires_at, created_at |
| The CHECK stage consults this table and **downgrades** matching findings to `info` with `suppressedBy: exceptionId` — never removes them. Expired exceptions are ignored. |

### `rule_proposals` — Layer D. Only `reason_code = 'rule-is-wrong'` decisions feed this.
| column | type |
|---|---|
| id, tenant_id, rule_id, decision_ids uuid[], proposal jsonb, status (`open` `accepted` `dismissed`), created_at |

## 6. Evidence and audit

### `evidence_records` — **append-only, hash-chained per tenant.** Trigger forbids UPDATE and DELETE.
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id | uuid fk | |
| seq | bigint | monotonic per tenant |
| version_id | uuid fk | exactly one record per sealed version |
| evaluation_id | uuid fk | the evaluation the approval was based on |
| payload | jsonb | the full frozen certificate content (§8) |
| payload_canonical | text | RFC 8785 canonical JSON of `payload` |
| prev_hash | text | previous record's `hash` for this tenant, or the tenant genesis hash |
| hash | text | `sha256(prev_hash ‖ payload_canonical)` |
| sealed_by | uuid fk users | the approving reviewer |
| sealed_at | timestamptz | |
| Unique: (tenant_id, seq), (version_id) |

Verification: walk `seq` ascending, recompute each hash, compare. Exposed as `GET /evidence/verify`.

### `audit_events` — running history of everything. Append-only.
| column | type |
|---|---|
| id, tenant_id, actor_id nullable, actor_roles, entity_type, entity_id, action, before jsonb nullable, after jsonb nullable, request_id, created_at |

## 7. `TenantConfig` (Layer C) — `tenants.config`

```ts
{
  lenderName: string,
  frequencyCapPerWeek?: number,            // A-RBI-005 requires it to exist
  quietHours?: { start: 'HH:MM', end: 'HH:MM' },   // stricter than statute if set
  bannedPhrases?: string[],
  romanisedAcceptableLanguages?: string[], // e.g. ['hindi'] — tames A-RBI-003 false positives
  blastRadiusThreshold: number,            // default 10000
  reasonCodes?: string[],                  // extends the built-in list
  rulePacks: string[],                     // ['india-layer-a'] — the cartridge slot
  layerBPacks?: string[],                  // ['india-lending-claims'] when it exists
  advisory: { llmClassification: boolean, audienceQuality: boolean }  // M5 flags, default false
}
```

## 8. The certificate payload (what gets sealed)

```ts
{
  schema: 'preflight.evidence/1',
  tenant: { id, slug, name },
  campaign: { id, name, mode },
  version: { id, no, contentHash, audienceHash, scheduledAt, channel, purpose, segment,
             message, template?, configSnapshot },
  audience: { size, identityKeysHash },      // not the rows — the hash of them
  evaluation: { id, asOf, rulebookHash, rulePackIds, engineVersion, classification,
                coverage, summary },
  findings: [{ ruleId, severity, category, title, what, explanation, citation, affectedCount }],
  decisions: [{ findingRuleId, type, reasonCode, reasonText, scope, expiresAt,
                actor: { id, displayName, roles }, at }],
  review: { reviewer: { id, displayName, roles }, sections, outcome, notes,
            blastRadiusApprover?, at },
  sealedAt, sealedBy: { id, displayName, roles },
  disclaimer: 'This record evidences that a pre-send review was performed and what it found. It does not certify compliance and is not legal advice.'
}
```

**Contains no marketing metrics, no ROI, no open rates.** *(R5 — Luthor anti-pattern)*

## 9. Rulebook tables (global, read-only at runtime)

Rulebooks are **files**, not rows: `rulebook/india-layer-a.ttl` + `packages/rules-india`. At startup `packages/rulegraph` loads them and computes the content hash. A small table records what has been seen:

### `rulebook_versions`
| column | type |
|---|---|
| hash text pk, pack_ids text[], loaded_at, git_ref text nullable, node_count int, rule_count int |

## 10. Indexes summary (non-obvious ones)

- `audience_rows (tenant_id, identity_key)` — dupes + consent join
- `contact_events (tenant_id, contact_id, occurred_at desc)` — frequency window queries
- `consent_records (tenant_id, contact_id, purpose, recorded_at desc)` — current-consent lookup
- `findings (tenant_id, evaluation_id, severity)` — the pre-flight screen
- `evidence_records (tenant_id, seq)` — chain walk
- `campaign_versions (tenant_id, campaign_id, version_no)` unique

## 11. Migration policy

Drizzle SQL migrations, committed, reviewed. **No destructive migrations on `evidence_records` or `audit_events` ever** — additive only, enforced by a CI check that greps migrations for `DROP`/`ALTER … DROP` on those tables.
