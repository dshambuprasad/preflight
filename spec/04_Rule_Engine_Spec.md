# 04 — Rule Engine Specification

`packages/core`. Pure, deterministic, zero runtime dependencies, runs in Node and the browser. **The reference implementation is `builds/PreflightCore/src/`** — port it, keep its tests, extend it. Its ground-truth fixture must produce byte-identical output in the port (see 11).

## 1. The rule contract

```ts
interface Rule {
  id: string;                       // 'A-RBI-001' — stable forever; never reuse
  pack: string;                     // 'india-layer-a'
  layer: 'A' | 'B' | 'C' | 'A→C';
  tier: 0 | 1 | 2;                  // 0 = no integration; 1 = read connectors; 2 = write-back
  category: 'timing'|'consent'|'audience'|'content'|'identity'|'delivery';
  title: string;
  severity: Severity;               // 'block' | 'warn' | 'info'
  effectiveFrom?: ISODate;          // severity switches on this date
  severityBefore?: Severity;        // severity used before effectiveFrom
  citation: Citation;               // { instrument, title, confidence, graphNodeId }
  requires: DataPath[];             // declared data dependencies, e.g. 'campaign.scheduledAt', 'contact.consentPromotional', 'history.contactEvents'
  note?: string;
  appliesTo(ctx: Context): true | false | 'unknown';
  evaluate(ctx: Context): Result;
  suggestFix?(ctx: Context, result: FailResult): SuggestedFix | null;
}

type Result =
  | { status: 'pass'; detail?: object }
  | { status: 'fail'; affected: RowId[]; what: What; detail?: object }
  | { status: 'cannot_evaluate'; missing: DataPath[] }
  | { status: 'not_applicable'; reason: string };

interface What {               // the four-part anatomy, part 1 (R5 — Saifr/Luthor)
  kind: 'schedule' | 'message_text' | 'rows' | 'config' | 'template';
  excerpt?: string;            // the exact text flagged, when message-level
  field?: string;              // the field, when schedule/config-level
}

interface SuggestedFix {       // part 4
  kind: 'reschedule' | 'drop_rows' | 'edit_message' | 'set_config' | 'add_disclosure';
  label: string;               // "Reschedule to 10:00 IST tomorrow"
  payload: object;             // enough for the pipeline to apply it and create a new version
}
```

**Invariants (each has a test):**
1. `evaluate()` is pure: no clock, no randomness, no I/O, no module-level state.
2. Every `Rule.requires` path is a real path in `Context`; the engine validates this at pack load.
3. `cannot_evaluate.missing` lists only paths that are **actually absent** in the input (bug fixed in PreflightCore — keep the test).
4. A rule id, once published in a pack version, is never reused for different logic. Changed logic → new id or a `supersedes` link in the graph.

## 2. The context

```ts
interface Context {
  campaign: { message; channel; scheduledAt; purpose?; borrowerSegment?; template? };
  contacts: Contact[];           // audience rows after RESOLVE
  config: TenantConfig;          // the version's config_snapshot
  asOf: ISOInstant;              // injected. NEVER Date.now()
  classification: Classification;
  effectivePurpose: Purpose;
  ist: { hhmm; hour; minute; weekday } | null;
  history?: HistoryAccess;       // Tier 1: () => ContactEvent[] per contact; absent at Tier 0
  consent?: ConsentAccess;       // Tier 1: current consent per (contact, purpose)
  platform?: PlatformState;      // Tier 1: { qualityRating?, messagingLimit?, templates? }
  exceptions: Exception[];       // active, scoped exceptions for this campaign/tenant
}
```

Tier is not a mode switch — it's whether `history`/`consent`/`platform` are present. Rules declare what they need; the engine reports what's missing. **Coverage is emergent from data, not configured.**

## 3. Evaluation algorithm

```
for rule in pack (sorted by id):
  a = rule.appliesTo(ctx)
  if a == 'unknown'      → cannotEvaluate (missing = actually-absent campaign.* requires)
  if a == false          → notApplicable
  r = rule.evaluate(ctx)
  if cannot_evaluate     → cannotEvaluate
  if not_applicable      → notApplicable
  evaluated++
  if fail:
     sev = severityAt(rule, ctx.asOf)
     if matching active exception → sev = 'info', suppressedBy = exception.id   (never removed)
     finding = { ..., severity: sev, what, explanation: rule.explain(...), suggestedFix: rule.suggestFix?.() }
sort findings by (severity, id)
coverage = { rulesInBook, applicable = evaluated + cannotEvaluate.length, evaluated, cannotEvaluate[], notApplicable[], statement }
summary = { blockers, warnings, info, cannotEvaluate, audienceSize, verdict: null }
```

`verdict` is present in the type **as `null`** so that no one adds it later without a deliberate type change. A test asserts it is null.

## 4. Severity and time

`severityAt(rule, asOf)`:
- no `effectiveFrom` → `rule.severity`
- `asOf >= effectiveFrom` → `rule.severity`
- else → `rule.severityBefore ?? rule.severity`

Presets the UI exposes: **2027-01-01** (RBI RBC 2nd Amdt), **2027-05-13** (DPDP ordinary fiduciaries). The engine has no knowledge of presets; they are just `asOf` values.

## 5. Classification (A-IN-003 as a gate)

Deterministic keyword heuristic in core (`classify()`), returning `{ classification: promotional|service|mixed|unknown, evaluateAs, confidence, markers, reason }`. `mixed` and `unknown` evaluate as **promotional** (strict). The M5 advisory LLM classifier, when enabled, **overrides only when its confidence ≥ 0.9 and it agrees with or is stricter than the heuristic**; otherwise the heuristic stands and both opinions are recorded on the evaluation. Judgement never silently loosens a rule.

## 6. Rule packs

```
packages/rules-india/src/
  index.ts              exports pack { id: 'india-layer-a', version, rules[] }
  rules/A-RBI-001.ts    one file per rule; imports only from core
  rules/...
  fixtures/A-RBI-001.json  ground-truth fixture per rule (see 11)
```

**All 23 rules from `docs/06_Layer_A_Rulebook_India.md` (22 original + A-RBI-013 from the 2026-09-11 amendment) are in the pack.** `A-RBI-012` is scoped to `voice`/`visit` and is therefore not-applicable for every v1 channel. A second pack `preflight-hygiene` (`A-PF-001` duplicates, `A-PF-002` conflicting consent) ships in M2. Tier-1 rules (`A-RBI-004`, `A-RBI-007`, `A-IN-001`, `A-IN-002`, `A-IN-005`, `A-WA-001`, `A-WA-002`, `A-WA-004`, `A-WA-005`, frequency enforcement under `A-RBI-005`) declare `history`/`consent`/`platform` requires and return `cannot_evaluate` when absent. They are *written* in M0/M1 so the coverage radar is honest from day one; they *light up* in M4.

Rules marked `not-a-send-check` in the rulebook (`A-RBI-009`, `A-RBI-010`, `A-IN-006`) are **in the graph, not in the pack** — they appear in the explain view as context, never as findings.

A second, tiny pack `generic-commerce` (3 rules: opt-out presence, quiet hours from config, template shape) ships in M3 to prove the cartridge slot is real.

## 7. The rule graph (`packages/rulegraph`)

Source of truth for rule *metadata*: `rulebook/india-layer-a.ttl` (Turtle). Code holds *logic*; the graph holds *meaning and provenance*.

Vocabulary (own namespace `pf:` plus PROV-O and SKOS):
```
pf:Rule            pf:id, pf:layer, pf:tier, pf:category, pf:severity, pf:effectiveFrom,
                   pf:requires, pf:derivedFrom → pf:Clause, pf:supersedes → pf:Rule,
                   skos:closeMatch → (rules in other jurisdictions)
pf:Clause          pf:text (quoted where PRIMARY), pf:paragraph, prov:wasQuotedFrom → pf:Instrument
pf:Instrument      pf:reference ('RBI/2022-23/108'), dcterms:title, dcterms:issued, pf:effectiveFrom,
                   pf:sourceConfidence ('PRIMARY'|'SECONDARY'|'DERIVED'|'PLATFORM'),
                   prov:wasAttributedTo → pf:Regulator, pf:url
pf:Regulator       rdfs:label ('Reserve Bank of India')
pf:EnforcementAction  pf:entity, pf:date, pf:amount, pf:summary, pf:evidences → pf:Rule
```

**No reasoner.** N3 parses; we walk. Validation at load:
- every `pf:Rule` node has exactly one code rule with the same id, and vice versa (`not-a-send-check` nodes are flagged `pf:sendTimeCheck false` and exempt);
- every rule has ≥1 `pf:derivedFrom`; every clause has an instrument; every instrument has a regulator and a `sourceConfidence`;
- `effectiveFrom` in graph == in code.

Content hash = sha256 of (canonical N-Triples of all loaded `.ttl`) ‖ (sha256 of each pack's compiled rule source). This is `rulebookHash`.

API: `GET /rulebook/graph` → `{ nodes, edges }` for Cytoscape; `GET /rulebook/explain/:ruleId` → the path rule → clauses → instruments → regulator + enforcement actions.

## 8. Explanation text

Each rule owns its explanation template (`explain(ctx, result)`). **No sharing of explanation strings between rules** — a provenance claim true of one instrument must not leak into another (bug found in PreflightCore; keep the lesson). Templates are plain language, one line, and name the number affected.

## 9. Fix suggestions (part 4 of the anatomy)

| Rule | `suggestFix` |
|---|---|
| A-RBI-001/002/012 | `reschedule` → next permitted slot (window open + 1h, next day if needed), IST |
| A-RBI-003 | `drop_rows` (affected) **or** `set_config` (`romanisedAcceptableLanguages` add) — offered as two options |
| A-RBI-005 | `set_config` → `frequencyCapPerWeek: 2` (FACE-style sensible default, labelled as a default) |
| A-RBI-006 | `drop_rows` (no-consent rows) |
| A-RBI-008 | `add_disclosure` → append `" Reply STOP to opt out."` |
| A-RBI-011 | `add_disclosure` → prefix `"<lenderName>: "` |
| A-WA-003 | `edit_message` → null payload, label "Fix template variables" (needs a human) |

Applying a fix = the pipeline creates version N+1 with the payload applied and re-runs RESOLVE→CHECK. The decision row records `type: fix, resulting_version_id`.

## 10. Performance envelope

- 10⁵ contacts × 25 rules MUST evaluate in < 2 s on a laptop, single thread. Rules iterate contacts at most once each; no O(n²).
- Rules are independent → the engine MAY evaluate them in parallel; the output MUST be identical to sequential (sort by id after).
- History access is a function, not a preloaded array, so Tier-1 rules can query a window without loading all events.
