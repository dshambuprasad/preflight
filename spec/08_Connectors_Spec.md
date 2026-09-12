# 08 — Connectors Specification

All connectors are **read-only** in v1 except the explicitly opt-in `wati:suppress` push (05 §8). Every connector implements one interface and ships with a **mock implementation used by all tests**. Real credentials never appear in tests or fixtures.

## 1. The interface

```ts
interface Connector {
  kind: 'csv' | 'wati' | 'meta-graph' | (later: 'gupshup' | 'doubletick' | 'shopify')
  probe(creds): Promise<{ ok: boolean; detail: string; capabilities: Capability[] }>
  capabilities: Capability[]          // what this connector can supply; drives the coverage radar
  sync(scope: 'templates'|'history'|'quality'|'consent', since?: ISO): Promise<SyncResult>
  push?(op: 'suppress', payload): Promise<PushResult>      // only where supported; opt-in
}
type Capability = 'templates' | 'history' | 'quality_rating' | 'messaging_limit' | 'consent' | 'suppress'
```

`GET /coverage` computes `unlockedBy` from `Capability` ↔ `Rule.requires` (04 §2): e.g. `history.contactEvents` ← `history`; `platform.qualityRating` ← `quality_rating`.

Credentials: stored in `connectors.credentials_enc` (AES-256-GCM, key from env `PREFLIGHT_KMS_KEY`; prod: KMS). Never logged; never returned by the API.

## 2. CSV + schema mapping (M1 basic, M4 wizard)

**Basic (M1):** header sniffing; recognised names map automatically:
```
id | customer_id | external_id                       → externalId
phone | mobile | msisdn | contact_number             → phone
email | email_id                                     → email
language | preferred_language | lang | pref_lang      → preferredLanguage
consent | consent_promotional | promo_consent | opt_in → consentPromotional   (yes/no/true/false/1/0/granted/denied)
state | region                                       → attributes.state
```
Unrecognised columns → `raw` only. The mapping is returned as `suggestedMapping`; the user confirms or edits.

**Wizard (M4)** — the OrionBelt-Analytics-inspired idea: the customer's columns on the left, canonical concepts on the right (Contact.phone, Contact.email, Contact.preferredLanguage, Consent.promotional, Consent.promotional:<product>, Attribute.<free>), drag or select to map; sample values shown per column; a **readiness preview** updates live: *"With this mapping, 10 of 25 rules can be evaluated."* Mappings save as presets per tenant (`uploads.column_mapping` + `tenant.config.mappingPresets`).

Normalisation rules (in core, tested):
- phone → E.164 via libphonenumber-js, default region `IN`; failures keep raw and set `phone_e164 = null`
- email → trim, lowercase; invalid → null
- consent → `granted` for `/^(y|yes|true|1|granted|opted?.?in)$/i`, `denied` for `/^(n|no|false|0|denied|opted?.?out)$/i`, else `unknown`; **blank → null (field absent)**, which is different from `unknown` (field present, value unclear)
- language → lowercase; a small alias table (`hi`→`hindi`, `ta`→`tamil`, …)

## 3. WATI (M4) — the BSP whose docs expose what we need *(V3)*

| Need | Endpoint (per public docs) | Capability |
|---|---|---|
| Templates + status | `GET /api/v1/getMessageTemplates` | `templates` |
| Per-contact history | `GET /api/ext/v3/conversations/{target}/messages` (paginated) | `history` |
| Quality rating | webhook `quality_rating_update` (verify field name at build) | `quality_rating` |
| Suppression push | contact attribute / opt-out update (verify) | `suppress` |

`sync('history', since)` walks contacts known to the tenant (bounded: last 90 days, max N per run, resumable cursor) and writes `contact_events(source='connector:wati')`. **Cold-start banner** in the UI until the first sync completes: *"History from WATI is being imported; frequency rules will be evaluated from {date}."*

Verify each endpoint against the live docs at build time; the field names above are from V3 and may have moved. If an endpoint is gone, the capability is dropped, not faked.

## 4. Meta Graph API (M4) — quality and tier *(V3)*

Requires the tenant to grant the app access to their WABA (Embedded Signup or a System User token they mint). Reads:
- `GET /{phone-number-id}?fields=quality_rating,messaging_limit_tier,name_status`
- `GET /{waba-id}/message_templates?fields=name,status,category,components`
- webhook `account_update` / `phone_number_quality_update` → `platform` state refresh

Cache `PlatformState` per tenant for 15 minutes; CHECK uses cached state and records `platform.fetchedAt` on the evaluation. If stale > 24h → `platform` is treated as absent (rules go to *cannot evaluate*), never as "still green".

## 5. Mock connector

`connectors/mock/` implements every capability from JSON fixtures in `test/fixtures/connectors/`. Used by all tests and by the demo when `PREFLIGHT_DEMO_MOCK_CONNECTORS=true` — so the coverage radar and Tier-1 rules can be **demoed** on a laptop without real credentials. The UI shows a *"mock data"* ribbon when this flag is on; it cannot be enabled in production builds.

## 6. What no connector can supply (state it, don't fake it)

- A "user blocked/reported you" event — no provider exposes one. Quality-rating decay is the only proxy. *(V3)*
- History from Meta Cloud API directly — push-only, no backfill. *(V3)*
- History from Gupshup / AiSensy / Interakt / Zoko — not publicly documented. Listed in Settings as *"not yet supported — history not available via public API"*.
