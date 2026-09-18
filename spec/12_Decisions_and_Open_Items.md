# 12 — Decisions and Open Items

## A. Decisions (settled — change here, not in code comments)

| # | Decision | Why | Ref |
|---|---|---|---|
| D1 | Product is a campaign-ops pipeline with compliance in the check stage, not a compliance checker | Showcase audience is marketing/collections ops; compliance officer is persona 2 | 01 §2 |
| D2 | Demo vertical: lending (banks/NBFCs), India | Present enforcement + 1 Jan 2027 deadline + list-and-log obligations match the gap | docs/05 |
| D3 | TypeScript monorepo; Fastify, Drizzle, pg-boss, React, Cytoscape | Reasons in 02 §2 | 02 |
| D4 | Postgres from day one; no SQLite | Migration cost | 02 §8 |
| D5 | `tenant_id` on every table; explicit tenant arg on every query | Retrofit cost; isolation | 02 §6 |
| D6 | Roles: admin/operator/reviewer/approver; reviewer ≠ author; operators cannot accept blockers | RBI compliance-separation fact | 02 §7 |
| D7 | Versions immutable; fixes create versions; evidence binds to one version | Reproducibility, gap 2 | 05 |
| D8 | Evidence log append-only, hash-chained per tenant, RFC 8785 canonical JSON, sha256 | Tamper-evidence cheaply; retention obligation | 03 §6 |
| D9 | `asOf` injected; core never reads a clock; presets 2027-01-01, 2027-05-13 | Time-travel and shadow mode for free | 04 §4 |
| D10 | Rulebook metadata in Turtle (source of truth), logic in code, no reasoner, parity validated at boot | Provenance + explainability without opacity | 04 §7 |
| D11 | Identity = exact E.164 phone else exact email else row-id; no fuzzy in v1 | Honest, testable; stated in coverage | 05 §3 |
| D12 | `mixed`/`unknown` classification evaluates as promotional; LLM may only tighten | Never silently switch consent rules off | 04 §5 |
| D13 | Exceptions downgrade to info, never remove; ≤ 90 days; only `rule-is-wrong` feeds Layer D | Layer D failure mode | 05 §5 |
| D14 | Preflight never sends; only opt-in suppression push; `sent` events only on confirmation | Never overclaim what went out (gap 5) | 05 §8 |
| D15 | Every entry point (API included) goes through the same pipeline | Braze anti-pattern | 05 §10 |
| D16 | Certificate contains no marketing metrics | Luthor anti-pattern | 03 §8 |
| D17 | Four-part finding anatomy; six-category scorecard; four-section review; blast-radius co-sign | R5 patterns | 07 |
| D18 | Mock connectors in all tests and in demo mode with a visible ribbon | No real creds; demoable Tier-1 | 08 §5 |
| D19 | `builds/PreflightCore` is ported, not rewritten; its output is the byte-identical baseline | Keep the ground truth | 04, 11 |
| D20 | Not-a-send-check obligations live in the graph, not the pack | Never overclaim coverage | 04 §6 |
| D21 | Version detail is tabbed (Findings · Audience · Versions & activity); header/summary/coverage/as-of persist | 1280×800 density; coverage must stay visible | 19 §5.1 |
| D22 | Review is its own route `/versions/:id/review`, sections-first | Different reading order for reviewer | 19 §5.2 |
| D23 | Default landing by role: operator/admin → Campaigns; reviewer/approver → Review queue | Two personas, one nav | 19 §5.3 |
| D24 | "Provide →" replaced by a router modal that sends config/version/upload/connector gaps to the right place and role | Immutability + roles | 19 §5.4 |
| D25 | Approver co-sign has its own screen `/cosign` (code entry) | Was missing entirely | 19 §5.5 |
| D26 | Identity precedence configurable, `externalId` first; `contact_identifiers` many-to-one | Recycled/shared mobiles; customer id is the true key | 22 A1 |
| D27 | Copy-on-write audiences (`audience_sets` + per-version exclusions) | Fix must not duplicate 1M rows | 22 A2 |
| D28 | Message variants are v1 core; content rules evaluate per variant | Language variants are day-one reality | 22 A3 |
| D29 | Send window `[scheduledAt, sendWindowEnd]`; window rules evaluate the interval | Throttled sends | 22 A4 |
| D30 | Batch campaigns only; event-triggered messaging via sealed template approvals | Keep real-time out of the pipeline | 22 A5 |
| D31 | Identities HMAC-hashed in all hashes/certificates; erasure = tombstone plaintext | DPDP erasure vs 7y retention | 22 A7 |
| D32 | `timezone` in tenant config; nothing zone-specific in core | Cartridge promise | 22 B2 |
| D33 | Events: 90-day hot + `contact_touch_summary` + Parquet cold; summary is the default path | 18B rows won't fit one PG | 22 B1 |
| D34 | Chunked CHECK > 250k rows, deterministic merge | 10M blasts | 22 B4 |
| D35 | Admin cannot accept blockers without `reviewer`; approver ≠ any blocker-acceptor | Close the one-person loophole | 22 C2 |
| D36 | Generic `idempotency_keys` middleware | Retries on fix/decisions | 22 C3 |
| D37 | Deny wins across consent sources; connector consent never overrides explicit deny | Mis-mapped connector safety | 22 C6 |
| D38 | Rule packs published as immutable versions; engine loads by version id | Reproducibility without git checkout | 22 B3 |

## B. Defaults the coding agent should implement without asking (flag in PR, don't block)

| # | Default |
|---|---|
| F1 | Blast-radius threshold 10,000 |
| F2 | Exception caps: campaign +7d, rule-30d +30d, hard max 90d |
| F3 | Platform cache 15 min; stale > 24 h → absent |
| F4 | Reason codes built-in: `one-time-exception`, `rule-is-wrong`, `data-was-wrong`, `romanised-acceptable`, `service-not-promotional`, `legal-basis-other` |
| F5 | Frequency cap suggested default 2/week (labelled as default) |
| F6 | Rate limits per 06 §6 |
| F7 | Retention: evidence/audit ≥ 7y; uploads 90d; events 24m |
| F8 | Seeded demo users: `admin@`, `ops@`, `review@`, `approve@` `demo.preflight` with a printed password on seed |
| F9 | Inline audience ≤ 5,000 rows; above that, upload |
| F10 | IST is the only timezone in v1 (India single-zone); `scheduledAt` accepts any offset and is displayed in IST |

## C. OPEN — needs Shambu (implement the default; surface prominently)

| # | Question | Default until answered |
|---|---|---|
| ~~O1~~ | **Resolved 2026-09-11** — primary text read; see `docs/06` amendment. 85L/85G/85M/85I confirmed; A-RBI-012 re-scoped to calls/visits; retention = contract + 1y | — |
| O8 | **Confirm the NBFC sibling direction.** RBI/2026-27/115 covers commercial banks only. Does an equivalent NBFC amendment exist with the same clauses and date? | 2027 rules `PRIMARY` for banks, `UNVERIFIED` for NBFCs; amber chip shown for NBFC tenants |
| ~~O2~~ | **Resolved 2026-09-12.** "preflight" is the permanent internal codename and npm scope (`@preflight/*`). Customer-facing brand is decided later; all user-visible strings live in `messages.ts` so a brand is a copy change. Trademark check before any public launch. | — |
| O3 | Is a second demo vertical wanted for the pitch (generic-commerce pack is minimal)? | Ship the 3-rule pack in M3 only as proof |
| O4 | LLM provider for M5 (Anthropic API is the obvious default) | Null adapter + Anthropic adapter behind flag |
| O5 | Deploy target for pilot (AWS / GCP / Hetzner)? | Compose only; images are cloud-neutral |
| ~~O6~~ | **Resolved 2026-09-12.** Remote: `https://github.com/dshambuprasad/preflight`. Claude Code sets `origin`, prepares commits on `main` (M0) then milestone branches `m1`…; **Shambu pushes.** | — |
| O7 | Should `wati:suppress` exist in v1 at all, or stay read-only until a pilot asks? | Build behind opt-in; default off |

## D. Known risks carried into the build

- 118 days to the RBI date is short; incumbents will move. The build is a showcase, not a race.
- A-RBI-003 false-positive rate — mitigated by `romanisedAcceptableLanguages` config and the two-option fix; measure on real data in the first pilot.
- Cold-start on frequency rules — designed in; the banner and coverage statement make it honest.
- Regulated buyers do vendor due diligence — 09 §6 exists so the first question has an answer.

## E. Gap review 2026-09-11 (resolved in place)

| # | Gap | Resolution |
|---|---|---|
| G1 | `05 §6` writes `review_evaluation_id` onto a version, but `03 §2` forbade all non-state updates | `03` now allows that column; still immutable otherwise |
| G2 | Changing an exception did not invalidate an evaluation (unique key ignored exceptions) | `evaluations.exceptions_hash` added to the unique key |
| G3 | `A-PF-001 Duplicate recipients` (05 §3) belongs to a pack not listed in `04 §6` | Pack `preflight-hygiene` ships in M2 alongside the upload work; add to `04 §6` list when implementing |

## F. Additions surfaced by 13/14 — **applied 2026-09-11** (15 §2, 03 header, 05 §2, 06, 11)

| Item | Where | Note |
|---|---|---|
| Tables `cosign_requests`, `handoff_pushes`, `platform_templates`, `platform_state` | 13 F8a, F11, F15 | add to 03 |
| Column `tenants.sealing_frozen bool` | 14 §6 | chain-break freeze |
| Column `evidence_records.kind` (`seal` \| `chain_attestation`) | 14 §6 | incident attestation rows |
| Certificate field `rulebookHashAtSeal` | 14 §3 | when rulebook moved between evaluate and seal |
| Rule `A-PF-002 Conflicting consent` (pack `preflight-hygiene`) | 14 §2 | upload-internal and upload-vs-records variants |
| Error type `unauthenticated` (401) | 13 F18 | add to 06 §1 list |
| Endpoints `POST /versions/:id/cosign-request`, `POST /cosign/:code/approve`, `POST /callbacks/sent`, admin `POST /jobs/:id/retry` | 13 | add to 06 |
| `GET /versions/:id` carries `progress %` during resolve/check | 14 §2 | add to 06 |
| Fix from `rejected`/`expired` states allowed (`edit:{}`) | 13 F5, F8, F16 | update 05 §2 transition table |
| Advisory evaluations on approved/sealed versions (`advisory: true`) | 13 F4 | update 05 §2 |

## G. Additions surfaced by 15–18 — **applied 2026-09-11** (03 header, 06, 09, 11, 16)

| Item | Where | Note |
|---|---|---|
| `campaigns.latest_version_state` denormalised column, maintained by `versions.setState` | 18 §2.5 | add to 03/15 |
| `uploads.sha256` retained after raw deletion | 18 §4 | add to 03/15 |
| `events.windowBulk(identityKeys[], from, to)` on repo; optional `contact_touch_summary` fallback | 18 §2.3 | add to 16 §2.4 if Tier-1 bench misses |
| `GET /findings/:id/rows` (paged affected rows) when `affected_row_ids` exceeds 50k | 18 §2.3 | add to 06 |
| `GET /versions/:id` may carry `queuePosition` | 18 §5 | add to 06 |
| JCS conformance test against RFC 8785 vectors in `core` | 17 | add to 11 §3 as invariant 19 `jcs-conformant` |
| Licence allowlist CI check (MIT/Apache/BSD/ISC/0BSD/Unlicense) | 17 | add to 09 §2 |
| `libphonenumber-js` metadata pin — update is a "re-resolution event" | 17 | note in 09 runbooks |

## H. Conflicts resolved during the M0 build — **recorded 2026-09-12** (per `CLAUDE.md` precedence: 03 on schema, 05 on behaviour, 06 on shapes)

| # | Conflict | Resolution | Ref |
|---|---|---|---|
| D39 | `02 §2` / `11 §1` / `16 §1` say `packages/core` has zero runtime deps; `16 §2.1` + `17` put `normalisePhone` (libphonenumber-js) and `canonicalJSON` (`canonicalize`) in core | Core carries exactly **one** runtime dependency, `libphonenumber-js` (pinned exact, `min` metadata, browser-safe, pure). JCS is **vendored** in `core/src/jcs.ts` (`17` permits: "small enough to vendor") with the RFC 8785 conformance test. The purity tests (browser bundle has no Node built-ins; no clock) are unchanged. | 02, 16, 17 |
| D40 | Rule counts: `00`/`04`/`10` say "23 India rules"; `docs/06` enumerates A-RBI-001..014 (014 via `22 G8`), A-IN-001..006, A-WA-001..005 = 25 ids, of which 3 are not-send-time (`D20`: graph only) | Pack `india-layer-a` = **22** send-time rules (incl. A-RBI-012 voice/visit-scoped and A-RBI-014). Graph `india-layer-a.ttl` = 25 rule nodes (3 with `pf:sendTimeCheck false`). Pack `preflight-hygiene` = 2. The enumerated list wins over the prose count. | 04 §6, docs/06 |
| D41 | `01 §5` step 2 expects coverage *"Checked 5 of 5 applicable rules"*; `04 §6` requires Tier-1 rules to exist from M0 and report `cannot_evaluate` | Behaviour (`04`/`05`) wins. On the collections sample the statement is computed by the engine and reads *"Checked 9 of 12 applicable rules. 3 could not be evaluated — history.contactEvents, campaign.template.externalId, platform.templates, platform.messagingLimit."* (pinned in `packages/rules-india/test/samples.test.ts`; A-RBI-004, A-WA-002, A-WA-004 are the three) The e2e assertion (M1+) uses the computed string. Demo copy in `01 §5` is descriptive, not normative. | 01 §5, 04 §6 |
| D42 | `D19`/`11 §2` byte-identity with `builds/PreflightCore`, but the ported report is a superset (`category`, `what`, `suggestedFix`, `variantKey`, `affectedRowIds`, typed `citation.confidence`) and the full pack has 22 rules, not 9 | Byte-identity is asserted on the **projection** of the new report onto PreflightCore's output shape (its exact keys, in its key order, `citation.confidence` excluded because it is now the `SourceConfidence` enum), evaluated with the **9-rule Tier-0 selection** of the pack. Explanation text and `detail` for the 9 ported rules are unchanged. Test: `packages/rules-india/test/ground-truth.test.ts` runs both engines. Fixture: `packages/core/test/fixtures/ground-truth.json`. | 04, 11 |
| D43 | `04 §1` rule contract omits `explain`; `04 §3`/`§8` call `rule.explain(ctx, result)` | `explain(ctx, result: FailResult): string` is a **required** member of `Rule`. `perVariant?: boolean` (default: `category === 'content'`) is an optional member added for `D28`. | 04 |
| D44 | `10 M0` says RESOLVE→CHECK run "in-process"; `16 §2.5` defines `JobQueue` | M0 ships an `InProcessJobQueue` implementing `JobQueue` (same interface pg-boss fills in M1). INGEST is synchronous; RESOLVE→CHECK run in-process after the 202. No stage code changes in M1. | 10, 16 |
| D45 | `22 D7`: explanation "must name the count affected" — message-level findings have `affectedCount = 0` | The lint requires the number in the text only when `affectedCount > 0`; ≤ 240 chars and no "compliant" always. | 22 D7 |
| D46 | `04 §2` `Context.ist`; `22 B2` says nothing zone-specific in core | `Context.local: { hhmm, hour, minute, weekday } \| null` computed in `config.timezone` (default `Asia/Kolkata`). The India pack's `detail.sendTimeIST` key is kept for byte-identity (it is an India-pack label, not a core assumption). | 04, 22 |
| D47 | `05 §4`: `contacts` = non-duplicate rows; `A-PF-001` must report duplicates | `Context.audience = { rows, duplicates: { rowId, duplicateOf }[], unresolvable: RowId[] }` is added to the context; `contacts` stays unique; `summary.audienceSize = contacts.length`. | 05 §3/§4 |
| D48 | `16 §2.1` `identityKey(phoneE164, emailNorm, rowId)`; `D26` puts `externalId` first, configurable | `identityKey({ externalId?, phoneE164?, emailNorm? }, rowId, precedence = ['externalId','phone','email'])`; prefixes `ext:` `phone:` `email:` `row:`. | 16, 22 A1 |
| D49 | `A-RBI-005` enforcement of a configured cap (Tier 1) shares an id with the existence check (Tier 0, `info`) | M0/M1: A-RBI-005 is the **existence** check exactly as in PreflightCore (pass-with-note when a cap is set). Enforcement is a `// SPEC-GAP` (needs a severity of its own; candidate `C-FREQ-001`). Layer-C rules `C-QUIET-001`/`C-BANNED-001` (`15 §3`) are M1 with the config work. | 04 §6, 15 §3 |
| D50 | M0 schema shape for `D26`/`D27`/`D28`/`D29`/`D31` | `audience_sets` (immutable, `set_hash`) + `audience_rows.set_id`; `campaign_versions.audience_set_id` + `audience_exclusions int[]` (row_no); `audience_hash = sha256(set_hash ‖ canonical(exclusions))`; `set_hash` over `HMAC-SHA256(tenant.identity_hmac_key, identity_key)` per row in row order (identity keys are computed at INGEST — pure normalisation; RESOLVE does duplicates/consent/contacts). `audience_rows.identity_hmac` stored. `contact_identifiers(contact_id, kind, value, observed_at, erased_at)`. `message_variants` per `21 §2`; `campaign_versions.message/template` mirror the `default` variant. `campaign_versions.send_window_end`, `campaigns.kind`, `consent_records.expires_at/contract_ended_at`, `idempotency_keys`. `tenants.identity_hmac_key` is stored AES-256-GCM-sealed under `PREFLIGHT_KMS_KEY`. | 22 §H |

Config keys added by `22 §E` and implemented in M0: `timezone` (default `Asia/Kolkata`), `identityPrecedence` (default `['externalId','phone','email']`), `sendWindowMaxHours` (default 6). `classificationMarkers`, `quietDays`, `requireSeparateAcceptorAndApprover` are M1.
