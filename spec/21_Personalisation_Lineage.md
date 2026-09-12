# 21 — Personalisation Lineage (L3, M5)

**Positioning:** not *more* personalisation — **personalisation you can defend.** Every variable and every segment in a message carries a lineage: which attribute, from which source, collected for which purpose, under which consent. Preflight already checks the list and the message; this layer checks **how the message was derived.** Personalisation vendors treat that as someone else's problem; compliance vendors never look at it.

**What it is not:** third-party cookie data, data brokers, or inferred audiences bought from anyone. Google data means the tenant's *own* GA4/Firebase events and their *own* Customer Match lists — first-party, consent-gated. Anything else is out of scope by policy, not just by version.

Additive to the spine: no pipeline, state-machine or evidence changes. New tables, one rule pack, one connector, UI on the message editor, one certificate section.

---

## 1. Concepts

| Term | Meaning |
|---|---|
| **Attribute** | A named per-contact value used in personalisation or targeting: `emi_amount`, `product_held`, `preferred_language`, `last_app_open`, `city`. |
| **Attribute source** | Where an attribute comes from and under what terms: system (`lms`, `core_banking`, `ga4`, `upload`, `crm`), **collection purpose** (what the customer was told it was for), lawful basis, sensitivity class, retention. |
| **Binding** | A template variable or segment predicate → an attribute expression. `{{1}} ← emi_amount`, `segment ← product_held = 'PL' AND last_app_open > now-30d`. |
| **Lineage** | Binding → attribute → source → purpose → consent. The chain a finding walks. |
| **Purpose compatibility** | Whether data collected for purpose P may be used for purpose Q. Lender-configured matrix with statutory defaults (DPDP purpose limitation; RBI 85G per-product). |
| **Sensitive attribute** | Attributes that may never drive targeting or personalisation: religion, caste, health, sexual orientation, political opinion, biometric, and (lending-specific) protected-class proxies. Built-in list + tenant additions. |

## 2. Data model (additions; `15` wins on conflict)

### `attribute_sources` (per tenant)
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| tenant_id | uuid fk | |
| attribute | text | canonical name, `snake_case`; unique per tenant |
| label | text | |
| system | text | `lms` `core_banking` `crm` `ga4` `firebase` `upload` `manual` `connector:<kind>` |
| collection_purpose | text | `service` `fraud` `credit_decision` `marketing` `analytics` `personalisation` … (tenant list ∪ built-ins) |
| lawful_basis | text | `consent` `contract` `legal_obligation` `legitimate_use` (DPDP s.7) |
| sensitivity | attr_sensitivity | enum `none` `personal` `financial` `sensitive` `prohibited_for_targeting` |
| retention_months | int nullable | |
| value_type | text | `string` `number` `date` `boolean` `enum` |
| allowed_values | jsonb nullable | for enums |
| description | text | |
| created_at, updated_at | | audited |

### `purpose_compatibility` (per tenant, seeded with statutory defaults)
| from_purpose | to_purpose | allowed | basis | note |
|---|---|---|---|---|
| e.g. `fraud` | `marketing` | false | DPDP s.6 purpose limitation | seeded, admin may only tighten |
| `service` | `service` | true | | |
| `marketing` | `personalisation` | true if consent `marketing` granted | RBI 85L | |

Admins can add rows and set `allowed=false`; they **cannot** set a seeded `false` to `true` (statutory floor).

### `message_variants` — **also fixes a v1 gap (see 22 §G5)**
| column | type | notes |
|---|---|---|
| id, tenant_id, version_id | | |
| key | text | `default` or a selector value, e.g. `lang:hindi`, `segment:PL` |
| selector | jsonb | `{ attribute, op, value }` or `{ default: true }` |
| message | text | |
| template | jsonb nullable | |
| content_hash | text | |
| Unique (version_id, key) |

A version with no variants behaves as today (`default` only).

### `variable_bindings` (per version)
| column | type | notes |
|---|---|---|
| id, tenant_id, version_id, variant_id | | |
| variable | text | `{{1}}`, or `segment`, or `selector` |
| expression | jsonb | `{ attribute }` \| `{ attribute, format }` \| predicate tree for segments |
| attributes_used | text[] | flattened for indexing and rules |
| values_hash | text | sha256 over (row_no, rendered value) for all rows — proves *what* was rendered without storing it twice |

### `contact_attributes` (long-format, per tenant) — replaces free-form `contacts.attributes` for anything bound
| contact_id, attribute, value jsonb, source_system, observed_at, expires_at nullable |
| Index (tenant_id, contact_id, attribute) · (tenant_id, attribute) |

`contacts.attributes` jsonb stays for unbound, display-only data.

### `evaluations` additions
`personalisation jsonb` — `{ variantsEvaluated, bindings, attributesUsed, lineageChecked: n, lineageUnresolved: n }`.

### Certificate additions (`03 §8`)
```
dataUsed: [{ variable, attribute, source: { system, collectionPurpose, lawfulBasis, sensitivity }, consentPurpose, valuesHash }],
variants:  [{ key, selector, contentHash, recipientCount }]
```

## 3. Rules — pack `india-personalisation` (Layer A/B, category `content`/`audience`)

| ID | Rule | Sev | Tier | Logic | Citation |
|---|---|---|---|---|---|
| **A-DP-001** | Attribute used without a compatible purpose | block | 1 | for each binding attribute: `purpose_compatibility[source.collection_purpose → campaign purpose]` must be `allowed`; consent for `marketing`/`personalisation` present where basis = consent | DPDP Act 2023 s.6 (purpose limitation), s.7; RBI RBC 2026 85G/85L · PRIMARY/SECONDARY as per rulebook |
| **A-DP-002** | Sensitive attribute drives targeting or content | block | 0/1 | any `attributes_used` with sensitivity ∈ {`sensitive`, `prohibited_for_targeting`} | DPDP (sensitive data handling); RBI fair-practices / non-discrimination; Annex IIA dark patterns (manipulation) · DERIVED |
| **A-DP-003** | Attribute value stale beyond source retention | warn | 1 | `observed_at + retention_months < asOf` | source policy · Layer C |
| **A-DP-004** | Binding references an attribute with no registered source | warn → block after tenant opts to enforce | 0 | attribute ∉ `attribute_sources` | product rule (lineage must exist) |
| **A-DP-005** | Variant selector uses an attribute unavailable for n recipients (fallback used) | info | 0 | rows with null selector attribute → `default` variant; report count | product rule |
| **A-RBI-014** | Promotional credit message lacks rate/fee disclosure | warn | 0 | promotional ∧ product is credit ∧ no rate/fee phrase (deterministic pattern list + optional LLM confirm) | RBI RBC 2026 **85K** — "shall disclose the interest rate and other fees / charges" · PRIMARY |
| **C-PERS-001** | Segment uses tenant-banned attribute | block | 0 | `config.bannedTargetingAttributes` | Layer C |

All rules obey the contract in `04`: pure, `cannot_evaluate` when `attribute_sources` is empty (with the message *"register attribute sources to enable lineage checks"*), explanation per rule, fix suggestions: `A-DP-001` → *remove variable* / *switch to a compatible attribute*; `A-DP-002` → *remove attribute from segment*; `A-DP-004` → *register source (admin)*.

## 4. Pipeline touch-points (no new stages)

- **INGEST** accepts `variants[]` and `bindings[]` on `POST /versions`; validates every `{{n}}` in every variant has a binding or a literal; `content_hash` becomes hash of all variants + bindings.
- **RESOLVE** additionally resolves bound attributes per row from `contact_attributes` (bulk, chunked like consent), computes `values_hash`, and assigns each row a `variant_key` (first matching selector else `default`). Rows lacking the attribute for a *content* binding get flag `binding_missing` → **A-DP-005** counts them; the rendered fallback is the literal default if one is given, else the row is `cannot render` and becomes a `drop_rows` candidate.
- **CHECK** evaluates every existing rule **per (variant, rows-in-variant)** — e.g. A-RBI-003 language now compares each variant's script against *its* recipients, which fixes the false-positive problem from the very first run of PreflightCore. Findings carry `variantKey`.
- **SEAL** freezes `dataUsed` + `variants` into the certificate.
- **HANDOFF** export ZIP gains `variants/<key>.txt` and `audience.csv` gets a `variant_key` column.

## 5. Connectors (M5)

| Connector | Reads | Writes `contact_attributes` with | Capability |
|---|---|---|---|
| **GA4 / Firebase via BigQuery export** | event tables for the tenant's own properties | `last_app_open`, `pages_viewed_30d`, `product_page_viewed:<x>` … with `source_system='ga4'`, `collection_purpose` **as configured by admin** (default `analytics` — which is *not* compatible with `marketing` until the admin asserts consent basis) | `attributes` |
| **LMS / core banking (CSV or API)** | account and loan data | `emi_amount`, `due_date`, `product_held`, `dpd_bucket` … `collection_purpose='service'`/`contract` | `attributes` |
| **Google Ads Customer Match** | — | **write-back** (push identity list) — far end of risk ladder, opt-in, logged, **not in M5** | `suppress`-like |

The GA4 default of `analytics` → not marketing-compatible is deliberate: the tool's first useful act is to *refuse* to personalise on browsing data until someone with authority records the consent basis. That is the demo moment.

## 6. UI additions (amend `19`/`20`)

- **S-12 New check:** *Variants* accordion (add variant → selector attribute/value → its own message); each `{{n}}` gets a **binding chip** `{{1}} ← emi_amount · LMS · service ✓` (green) / `{{2}} ← pages_viewed_30d · GA4 · analytics ✗` (red, tooltip: "not compatible with marketing"). Segment builder shows attribute chips with sensitivity badges.
- **S-21 Findings:** lineage findings render WHAT as the chain `{{2}} ← pages_viewed_30d ← GA4 ← analytics`.
- **S-51 Certificate:** section *"8. Data used"* table.
- **S-76 Settings → Data sources** (new): attribute registry table (attribute · system · purpose · basis · sensitivity · retention), purpose-compatibility matrix (seeded rows locked), banned targeting attributes.

## 7. Configuration (`15 §3` additions)
| key | type | default | effect |
|---|---|---|---|
| `personalisation.enabled` | bool | false | shows variants/bindings UI and loads the pack |
| `personalisation.enforceRegistry` | bool | false | A-DP-004 warn → block |
| `bannedTargetingAttributes` | string[] | `[]` | C-PERS-001 |
| `sensitiveAttributes` (additions) | string[] | `[]` | extends built-in list |
| `purposeCompatibilityOverrides` | rows | `[]` | may only tighten |

## 8. Performance notes (extends `18`)
- Attribute resolution is one bulk query per bound attribute per evaluation (`contact_attributes (tenant_id, attribute, contact_id)`), chunked at 5,000 ids — at 10 attributes × 10⁵ contacts ≈ 200 queries ≈ 6 s; acceptable at Tier 1 budget (< 4 s target → raise to < 8 s when personalisation is on, documented).
- `values_hash` computed streaming during RESOLVE; never stores rendered text per row.
- Variants multiply CHECK by `#variants` only for content rules; recipient-level rules run once.

## 9. Demo moment (adds step 12 to `01 §5`)
Operator adds variant `lang:hindi` and binds `{{3}}` to `pages_viewed_30d` from GA4. Preflight blocks: *"`{{3}}` uses GA4 browsing data collected for analytics — not compatible with a promotional message. Remove the variable, or have an admin record a marketing consent basis for this source."* Operator removes it; A-RBI-003 now passes for the Hindi variant's recipients. Certificate section 8 lists exactly what data shaped the message.

## 10. Honest limits
- Lineage is only as good as the registry the tenant maintains; A-DP-004 exists to make gaps visible, not to invent provenance.
- We cannot verify a source's *claimed* collection purpose; we record who asserted it and when (audit).
- No inference, no lookalikes, no scoring in this layer. If a tenant wants propensity models, they run them upstream and the *output* becomes an attribute with a registered source and purpose — which is exactly the point.
