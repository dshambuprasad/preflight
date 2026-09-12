# 10 — Milestones

Each milestone is shippable and demoable on its own. **"Done when" is the acceptance test — all items must pass, in CI, before the next milestone starts.** Order is fixed; scope inside a milestone is not negotiable without updating `12_Decisions_and_Open_Items.md`.

Demo script steps refer to `01_PRD.md §5`.

## M0 — Spine skeleton (≈ 1 week)
Monorepo, Postgres via compose, core ported, API + web shells.
- pnpm workspaces: `packages/core`, `packages/rules-india`, `packages/rulegraph`, `packages/db`, `apps/api`, `apps/web`, `infra/`.
- `packages/core` ported from `builds/PreflightCore/src` with its 14 tests **plus** a test asserting the ground-truth fixture output is byte-identical to the original.
- All 23 rules stubbed in `rules-india` (plus `preflight-hygiene` skeleton) (Tier-1 ones return `cannot_evaluate` with correct `missing`).
- `rulebook/india-layer-a.ttl` with all 23 rule nodes (+ 3 not-send-time context nodes), clauses, instruments, regulators, 3 enforcement actions (HDFC, Hero FinCorp, Shaha Finlease); `rulegraph` validates and hashes it; boot refuses on validation failure.
- Drizzle schema for **every** table in `03_Data_Model.md`; migrations run in compose.
- `POST /v1/campaigns/:id/versions` (inline rows only) → INGEST → RESOLVE → CHECK in-process → `GET /evaluations/:id` returns findings.
- Web: routes + layout + New check screen + Version detail rendering findings (no decisions yet).
**Done when:** `docker compose up` → seed → demo steps 1–2 work in the browser · `pnpm test` green · `pnpm bench` shows 10⁴ contacts < 300 ms · ESLint blocks any Node/DB import inside `core`.

## M1 — Pipeline + evidence (≈ 1.5 weeks)
State machine, decisions, review, seal, hash chain, export.
- pg-boss jobs for RESOLVE/CHECK/SEAL; state machine exhaustively tested (every transition in `05 §2`, allowed and forbidden).
- Decisions API with role rules (operators can't accept blockers); exceptions with expiry; fix → new version; review with four sections; self-review blocked; blast-radius co-sign; expiry scheduler.
- Evidence records: canonical JSON, chain, `GET /evidence/verify`, certificate HTML, ZIP export, outbound webhook with HMAC.
- Audit events on every transition. Idempotency keys.
- Web: finding cards with four-part anatomy, Accept-with-reason modal, Fix, Submit, Review panel, Certificate page with Verify.
**Done when:** demo steps 1–4, 6–8 run end to end with two users · chain-verify test tampers a row and detects it · API-only submission test proves no bypass (`05 §10`) · every error type in `06 §1` has a test.

## M2 — Time-travel, coverage, uploads (≈ 1 week)
- `asOf` on evaluate; UI as-of control with presets; severity animation.
- `GET /coverage` + radar screen; "Provide →" links from unevaluated rules.
- CSV upload streaming, basic header mapping (`08 §2`), duplicates rule `A-PF-001`.
- Seed data: `sample/contacts.csv`, both sample campaigns, `sample/past_quarter.csv`.
**Done when:** demo step 5 (both directions) and step 10 pass · 10⁶-row CSV ingests < 60 s in bench · coverage radar shows **10 live / 11 needs-data / 4 not-send-time** on the sample (consent columns present).

## M3 — Explain graph + second pack (≈ 1 week)
- `GET /rulebook/graph`, `/explain/:ruleId`; Cytoscape explain view with enforcement actions and confidence chips.
- `generic-commerce` pack (3 rules) proving the cartridge slot; tenant config selects packs.
- `rulebookHash` visibly shown on evaluations and certificates; re-evaluate-under-old-hash test.
**Done when:** demo step 9 passes · switching a tenant to `generic-commerce` changes findings and hash · graph↔code validation test fails when a rule is added to only one side.

## M4 — Connectors + shadow mode (≈ 2 weeks)
- Connector interface + mock; WATI (templates, history, quality webhook, opt-in suppress push); Meta Graph (quality, tier, templates); 15-min platform cache with staleness rule.
- Mapping wizard with live readiness preview; mapping presets.
- Shadow import + batch screen.
- Tier-1 rules light up with mock data in demo mode; cold-start banner.
**Done when:** demo step 11 passes · with mocks on, coverage shows ≥ 20 live · with mocks off, those rules report *cannot evaluate* (never pass) · credentials never appear in logs (redaction test) · `wati:suppress` records exactly what was pushed and is reversible.

## M5 — Advisory (feature-flagged) (≈ 1 week)
- LLM adapter interface + null impl + one provider; classification override rule (`04 §5`); both opinions recorded.
- Audience-quality flags: never-engaged, contacted-elsewhere-within-N-days (needs history), consent-unknown-ratio.
- Settings → Advisory toggles with the plain warning.
**Done when:** flags off → evaluations byte-identical to M4 · flags on → LLM never loosens a rule (test with an adversarial fixture) · no PII in any adapter request (test intercepts payload).

## M6 — Pilot hardening (≈ 1.5 weeks)
- `PREFLIGHT_ROLE=api|worker` split; object storage; RLS policies enabled; partitioning migration for `contact_events`; retention jobs; runbooks; restore drill; k6 load test at pilot numbers (`02 §9`).
**Done when:** worker scaled to 3 replicas processes 1,000 versions/hour with chain intact · RLS test proves cross-tenant read returns zero rows · restore from backup verified.

## Deferred (designed for, not scheduled)
L4 collision detection/optimisation (contacts × days heatmap; OR allocation) · additional BSPs (DoubleTick next — has history) · region packs (Japan APPI/LINE, EU GDPR) · Layer-B claims packs · SSO/SCIM.
