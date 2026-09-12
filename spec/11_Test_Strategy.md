# 11 — Test Strategy

Tests are the acceptance criteria. Every MUST in this spec set has a test; a PR that adds a MUST without one is incomplete.

## 1. Layers

| Layer | Tool | Runs where | What it proves |
|---|---|---|---|
| Unit — core & rules | `node:test` (core has zero deps; keep it that way) | every push | rule logic, classification, normalisation, coverage arithmetic |
| Unit — api/web | Vitest | every push | pure functions, machine transitions, canonical JSON, hashing, UI components |
| Integration | Vitest + Postgres service container | every push | pipeline stages, tenancy, decisions, chain, migrations |
| Contract | OpenAPI schema validation of every response in integration tests | every push | API matches `06` |
| E2E | Playwright against `docker compose` | every PR to main | the demo script, both personas |
| Bench | tinybench + CSV generator | every PR to main | `09 §1` latency envelopes; fails on 2× regression vs baseline file |
| Security | dependency audit, secret scan, redaction test, tenancy grep | every push | `09 §2` |

## 2. Ground-truth fixtures (the first tests)

- `packages/core/test/fixtures/ground-truth.json` — the PreflightCore fixture and its **full expected report**, computed by hand before code. Asserted whole. **Byte-identical to `builds/PreflightCore` output** (a test runs both).
- `packages/rules-india/fixtures/<RULE-ID>.json` — per rule: ≥1 pass, ≥1 fail, ≥1 cannot_evaluate, ≥1 not_applicable input, with expected `Result` **and** expected `missing[]`. Boundary cases for windows (07:59/08:00/18:59/19:00, and IST vs UTC offsets).
- `packages/db/test/fixtures/tenant-seed.sql` — the demo tenant, four users, config, both sample campaigns.

## 3. Invariants (each is a named test; they never get deleted)

1. `never-silent-pass` — a rule returning `cannot_evaluate` never appears as pass; `coverage.evaluated < applicable` when any exist.
2. `missing-is-actually-missing` — every path in `missing[]` resolves to absent in the input.
3. `verdict-is-null` — `summary.verdict === null`, always; the type forbids other values.
4. `deterministic` — same input twice → identical JSON; parallel rule evaluation → identical to sequential.
5. `no-clock-in-core` — `core` throws without `asOf`; grep test for `Date.now`/`new Date()` without args in `packages/core` and `rules-*`.
6. `core-is-pure` — bundling `core` for browser yields no Node built-ins; ESLint `no-restricted-imports` passes.
7. `version-immutable` — UPDATE on any non-state column of `campaign_versions` raises.
8. `evidence-append-only` — UPDATE/DELETE on `evidence_records` raises; chain verify detects a tampered `payload_canonical`.
9. `self-review-forbidden` — 409 at API and exception in machine.
10. `operator-cannot-accept-blockers` — 403.
11. `every-entry-point-gated` — API-created version requires review before seal.
12. `tenant-isolation` — user of tenant A cannot read any tenant B row via any endpoint (property test over all GET routes).
13. `exception-expiry` — an expired exception has no effect; an active one downgrades to info and never removes.
14. `review-invalidated-on-reevaluate` — re-evaluating an `in_review` version returns it to `evaluated` with an audit event.
15. `explanation-not-shared` — no two rules share an identical `explain()` output for the same context (guards the provenance-leak bug).
16. `graph-code-parity` — every rule id in packs ↔ graph; `effectiveFrom` equal on both sides.
17. `no-pii-in-logs` / `no-pii-to-llm` — interceptors assert redaction.
18. `advisory-never-loosens` — with LLM enabled and an adversarial "it's just service" opinion, the stricter classification stands.
19. `jcs-conformant` — `core.canonicalJSON` matches every RFC 8785 test vector; a drift in the `canonicalize` package fails here before it can touch the chain.

## 4. E2E — the demo script as a test

`e2e/demo.spec.ts` executes `01_PRD.md §5` steps 1–11 literally, as two browser contexts (operator, reviewer), asserting the exact counts (2/2/1; 2 blockers after time-travel on the promotional sample; chain verify green; shadow "5 of 8 flagged, 2 blockers"). Screenshots are captured at each demo moment and committed to `e2e/__screens__/` for review.

## 5. Bench baselines

`bench/baseline.json` committed; `pnpm bench` compares. Generators: `bench/gen-audience.ts` (n rows, seeded PRNG so runs are comparable).

## 6. Test data policy

No real phone numbers or emails anywhere. Generated numbers use the `+91 98123 4xxxx` block in fixtures and are labelled synthetic. No real lender names.
