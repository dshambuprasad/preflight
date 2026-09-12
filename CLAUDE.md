# CLAUDE.md — Preflight

You are the execution engine. The thinking is done and lives in `spec/` (19 documents). Read `spec/00_README.md` first, then the documents in order. **Before M0, apply `spec/22_Plan_Review.md §I` — it moves several schema decisions (D26–D38) into M0.** `13`–`18` are the low-level design: process flows, failure modes, data dictionary (wins over `03`), interfaces (implement signatures exactly), library choices (do not substitute), performance plan (benches are gates). Do not redesign; build what is specified. Where the spec says OPEN, implement the stated default and note it in the PR description.

## Non-negotiables (each has a test in `spec/11_Test_Strategy.md §3`)

1. **Never silently pass.** A rule that cannot be evaluated is reported as such and counted separately. Coverage is always stated.
2. **No verdict.** `summary.verdict` is `null`. Preflight finds gaps for human review; it never certifies compliance.
3. **`packages/core` is pure.** No I/O, no clock, no DB, no HTTP imports. `asOf` is injected. Same input → byte-identical output.
4. **Versions are immutable.** Change = new version. Evidence binds to exactly one version and one rulebook hash.
5. **Evidence is append-only and hash-chained.** Never UPDATE or DELETE `evidence_records` or `audit_events`. No destructive migrations on them.
6. **Tenant on every query.** Every `packages/db` helper takes `tenantId` first. No endpoint takes a tenant from the body or URL.
7. **Roles are enforced twice** — at the route and in the state machine. Reviewer ≠ author. Operators cannot accept blockers.
8. **Every entry point is gated.** API-created versions go through the same pipeline and review.
9. **Explanations are per rule.** Never share explanation strings between rules.
10. **Preflight never sends a message.** Connectors are read-only except the opt-in suppression push.
11. **No PII in logs or LLM requests.** Redaction is tested.
12. **`builds/PreflightCore` is the baseline.** Port it; its ground-truth output must match byte for byte.

## Working method

- One milestone at a time (`spec/10_Milestones.md`). Do not start M(n+1) until M(n)'s "done when" list passes in CI.
- Write the test first for every MUST you implement. Fixtures per `spec/11 §2`.
- Verify before declaring done: run tests, run the compose stack, exercise the demo step, capture a screenshot. Do not claim success unseen.
- If two spec documents conflict, `03_Data_Model` wins on schema, `05_Pipeline` on behaviour, `06_API` on shapes; then record the conflict in `spec/12` section A as a new decision.
- Remote is `https://github.com/dshambuprasad/preflight` (`git remote add origin …` once). Never push under Shambu's identity. Prepare commits; leave the push to him (`spec/12` O6).
- Package scope is `@preflight/*`; "preflight" is the permanent codename. Do not introduce any other product name in code.
- Commit messages: `M1: <what> — <why>`; reference spec sections.

## Stack (do not substitute)

pnpm workspaces · TypeScript strict · Node 22 · Fastify 5 + Zod · Drizzle + Postgres 16 · pg-boss · React 19 + Vite + TanStack Router/Query + Tailwind + Radix · Cytoscape.js · N3 · libphonenumber-js · pino · Vitest / `node:test` (core) / Playwright · Docker Compose.

## Layout

```
preflight/
  CLAUDE.md          this file
  spec/              the specification set (normative)
  docs/              research and concept (background; rulebook 06 is normative for rule content)
  builds/PreflightCore/   reference implementation of the rule contract
  rulebook/          *.ttl rule graphs
  packages/          core · rules-india · rulegraph · db · api-types
  apps/              api · web · worker
  infra/             compose, Dockerfiles
  e2e/  bench/
```

## When stuck

Do not guess intent. Implement the default from `spec/12 §B`, leave a `// SPEC-GAP:` comment with the question, list it in the PR. Shambu resolves gaps in `spec/12`, not in chat.
