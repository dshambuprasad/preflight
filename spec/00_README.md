# Preflight — build specification set

**Purpose:** everything a coding agent needs to build Preflight without guessing intent. Read in order. Where a document says *DECISION*, it is settled; where it says *OPEN*, see `12_Decisions_and_Open_Items.md` before proceeding.

**Status:** v1.2 · 2026-09-12 · **handoff-ready after `22` is applied to M0.** 19 documents; LLD complete (flows, failure modes, dictionary, interfaces, libraries, performance); consistency pass done. Rule counts standardised: India pack 23, hygiene pack 2.

## Reading order

| # | Document | What it settles |
|---|---|---|
| 01 | `01_PRD.md` | What we're building, for whom, scope, non-goals, the demo script |
| 02 | `02_Architecture_HLD.md` | System context, containers, components, data flow, prod-readiness decisions |
| 03 | `03_Data_Model.md` | Every table, every column, tenancy, the evidence log |
| 04 | `04_Rule_Engine_Spec.md` | Rule contract, lifecycle, severity, effective dates, coverage, the rule graph |
| 05 | `05_Pipeline_Spec.md` | The six stages, the state machine, versioning, decisions, idempotency |
| 06 | `06_API_Contracts.md` | Every endpoint, request/response shapes, errors |
| 07 | `07_UI_Spec.md` | Screens, flows, components, the five demo moments |
| 08 | `08_Connectors_Spec.md` | CSV, schema mapping, WATI, Meta Graph — read-only contract |
| 09 | `09_NFRs_Security_Ops.md` | Non-functionals, security, observability, deployment, the path to prod |
| 10 | `10_Milestones.md` | M0–M6, each with explicit "done when" acceptance tests |
| 11 | `11_Test_Strategy.md` | Ground-truth fixtures, invariants, determinism, e2e |
| 12 | `12_Decisions_and_Open_Items.md` | Every decision made and why; what still needs a human |
| 13 | `13_Process_Flows.md` | Every use case as a numbered flow; every branch to a terminal; concurrency rules |
| 14 | `14_Failure_Modes.md` | Per stage: failure → detect → action → user sees → recovery → severity |
| 15 | `15_Data_Dictionary_and_Config.md` | Every enum value, every config key, every env var, tables added by 13/14 — wins over 03 on conflict |
| 16 | `16_Interfaces_and_Coupling.md` | Allowed-imports matrix, every cross-package interface with full signatures, where each concern lives |
| 17 | `17_Library_Decisions.md` | Per concern: candidates, choice, why, licence, swap seam; what is deliberately not used |
| 18 | `18_Performance_Plan.md` | Sizing assumptions, hot-path plans with arithmetic, index plan, partitioning, CI benches |
| 19 | `19_Screen_Inventory.md` | Every screen × state × role; amends `07` with D21–D25 (tabbed version detail, review route, landings, provide-router, co-sign screen) |
| 20 | `20_Wireframes.md` | Low-fi ASCII wireframes for every screen-state in `19`; reading order and density settled |
| 21 | `21_Personalisation_Lineage.md` | L3: personalisation you can defend — attribute sources, bindings, variants, 7 rules, GA4/LMS connectors (M5) |
| **22** | **`22_Plan_Review.md`** | **Pre-build review: 38 items; D26–D38; M0 absorbs the cheap-now/rewrite-later fixes (identity, copy-on-write audiences, variants, send window, HMAC identities, timezone). Read before M0.** |
| — | `../CLAUDE.md` | Non-negotiables for the coding agent |

## Conventions used in this set

- **MUST / MUST NOT** — a hard requirement; a test exists or must be written for it.
- **SHOULD** — do it unless there's a documented reason not to.
- **DECISION** — settled; do not relitigate in code comments or PRs. Change via `12_Decisions_and_Open_Items.md`.
- **OPEN** — needs Shambu. Do not guess; implement the stated default and flag it.
- **Rule IDs** (`A-RBI-001`) refer to `../docs/06_Layer_A_Rulebook_India.md`.
- Research citations (`R1`–`R5`, `V1`–`V4`) refer to `../docs/research/`.

## What already exists

- `../builds/PreflightCore/` — a working Tier-0 engine (9 rules, 14 tests, CLI, static UI). **It is the reference implementation of the rule contract** and is ported, not rewritten, into `packages/core` in M0.
- `../docs/` — concept, glossary, open questions, market research, rulebook, scope tightening. Background; not normative for the build except the rulebook.

## The one-paragraph product

Before a lender sends a campaign, Preflight ingests the audience and the message, resolves identities, checks both against a versioned rulebook (regulatory, platform, business), lets the right person fix or accept each finding with a recorded reason, seals an immutable evidence record for the approved version, and hands the corrected campaign to the sending tool. It never certifies compliance; it finds gaps for human review and proves the review happened.
