# 19 — Screen Inventory

Every screen the web app has, with its route, who sees it, which flows land on it, and **every state it must render**. The purpose is to make the *screen × state × role* matrix exist on paper, where gaps are cheap. Wireframes (`20`) draw from this list; `07_UI_Spec.md` is amended by §5 below.

Conventions: `S-nn` screen id · roles as in `15 §1` · flows as in `13` · states: **E** empty · **L** loading · **X** error · plus named domain states. "Modal" = overlay on a parent screen, not a route.

## 1. Shell & auth

| ID | Screen | Route | Roles | Flows | States | Notes |
|---|---|---|---|---|---|---|
| S-00 | Login | `/login` | — | F18 | idle · submitting · X (bad credentials) · X (session expired — banner, return URL preserved) · X (tenant sealing frozen — informational after login) | Seeded users only; no signup, no reset in v1 (admin resets). |
| S-01 | App shell | wraps all | any | — | nav collapsed/expanded · **mock-data ribbon** (when `PREFLIGHT_DEMO_MOCK_CONNECTORS`) · **sealing-frozen banner** (tenant-wide, red, links S-60) · **config-drift toast** (per version, see S-21) | Role-aware nav: Review queue only for reviewer/approver/admin; Settings only admin. |
| S-02 | Not found | `*` | any | — | X | Shows `requestId` if the 404 came from the API. |
| S-03 | Forbidden | — (inline) | any | — | X | Rendered in place of a screen when API returns `forbidden-role`; never a redirect loop. |

## 2. Campaigns & pre-flight

| ID | Screen | Route | Roles | Flows | States | Notes |
|---|---|---|---|---|---|---|
| S-10 | Campaigns list (home) | `/campaigns` | any | — | E ("no campaigns — run your first check") · L (skeleton rows) · X · filtered-empty · paged | Columns per `07 §2.1` + `latest_version_state` chip. Operator default landing. Reviewer default landing is S-40. **DECISION** (new). |
| S-11 | Campaign detail | `/campaigns/:id` | any | — | L · X · versions list (v1…vn with state chips; superseded/parent arrows) · single-version (collapses to S-20) | Version tabs live here; S-20 is the tab body. |
| S-12 | New check | `/campaigns/new` and `/campaigns/:id/versions/new` | operator, admin | F1, F2 | blank · with-upload (mapping panel open) · with-inline-rows · validating · X (validation issues listed per field, all at once) · submitting → redirects to S-20 (resolving) | Shows **client-side classification preview** badge as the message is typed (core in browser). Purpose select defaults to "not stated" and warns if classification is `mixed`/`unknown`: *"set Purpose to be precise."* |
| S-13 | Upload & mapping (panel inside S-12; also standalone `/uploads/:id`) | — | operator, admin | F2 | uploading (progress %) · sniffed (columns + suggested mapping) · no-identity-column warning · mapping-invalid X · preview (identity coverage, consent distribution, language distribution, **"n of 25 rules evaluable at Tier 0 with this mapping"**) · preset-saved | M1 basic; M4 wizard replaces the panel body, same states. |

## 3. Version detail (the core) — split into tabs (**DECISION**, see §5.1)

| ID | Screen | Route | Roles | Flows | States | Notes |
|---|---|---|---|---|---|---|
| S-20 | Version header + summary strip | `/versions/:id` (all tabs share) | any | F3–F7, F16, F17 | per `version_state`: **draft** (rare: job not yet picked) · **resolving** (progress strip Ingested→Resolved→Checked with %, `queuePosition` if any) · **evaluated** · **in_review** · **approved** ("sealing…") · **sealed** (lock) · **handed_off** · **rejected** (reviewer notes banner + *Edit & resubmit*) · **abandoned** · **expired** (*Clone with new schedule*) · **superseded** (derived; banner "superseded by v3") · **shadow** (labelled "evaluated as of {sentAt}"; no actions) · **advisory-evaluation** (as-of ≠ scheduled: amber note) · **config-drift** (banner) · **rulebook-updated-since-check** (banner) · **cannot-evaluate-nonzero** (coverage line lists rules; each with the correct affordance — see §5.4) · **no-findings** (*"No findings from the rules that could be evaluated"* + coverage; never "compliant") | The as-of control lives in the header, disabled when state ∉ {evaluated,…}. |
| S-21 | Tab: Findings | `/versions/:id` (default tab) | any | F5, F6 | E (no findings) · scorecard with 6 categories (each: pass / n / not checked) · finding cards expanded/collapsed · card sub-states: **no decisions** · **accepted** (chip with actor/role/reason/expiry) · **suppressed-by-exception** (info + chip) · **fixed-into vN** (chip, link) · **stale-evaluation** decision (muted, under "earlier decisions") · **affected rows truncated** (link to S-24) · **fix requires config** (button routes admin; operator sees explanatory tooltip) · **blocker + operator** (Accept disabled with tooltip) | Modals: **Accept with reason** (M-01) · **Edit schedule** (M-02) · **Edit message** (M-03) · **Drop rows confirm** (M-04). |
| S-22 | Tab: Audience | `/versions/:id/audience` | any | F3 | L · summary cards (size, duplicates, unresolvable, consent donut granted/denied/unknown/absent) · rows table (paged 50; columns: row no · external id · identity key · language · consent · consent source · flags[dup/unresolvable/affected-by]) · filter by flag · E (inline 0 rows — impossible; guard) | Row click opens no detail in v1 (no per-contact screen). |
| S-23 | Tab: Versions & activity | `/versions/:id/history` | any | — | version chain (v1→v2→v3 with what changed: message/schedule/audience ±) · diff view between two (S-25) · activity feed (audit events, newest first, paged) | |
| S-24 | Affected rows | `/findings/:id/rows` | any | — | L · paged · E (finding is message-level: "no rows — this finding is about the message/schedule") | Opened from a finding card. |
| S-25 | Version diff | `/versions/:id/diff/:otherId` | any | — | L · X (different campaigns) · diff (message inline diff · schedule before/after · audience added/removed with sample) | |

Modals on S-21:
| ID | Modal | Roles | Fields / states |
|---|---|---|---|
| M-01 | Accept with reason | operator (warn/info), reviewer/admin (any) | reason code select (built-in ∪ tenant) · reason text (≥10) · scope radio (this finding / this campaign / this rule 30d) · expiry (auto from scope, editable ≤ cap) · X per field · submitting · **rule-is-wrong** selected → note "this will propose a rulebook change" |
| M-02 | Edit schedule | operator, admin | date-time (IST) · suggested slot prefilled · X (< now+lead) · creates new version |
| M-03 | Edit message | operator, admin | textarea prefilled (with disclosure applied if fix) · live classification preview · char count · creates new version |
| M-04 | Drop rows | operator, admin | count + sample · "also drops their duplicates (n)" · confirm · creates new version |
| M-05 | Abandon | operator, admin | reason (≥5) · confirm |
| M-06 | Provide missing data (see §5.4) | varies | routes to the correct place rather than an inline field |

## 4. Review, approval, evidence

| ID | Screen | Route | Roles | Flows | States | Notes |
|---|---|---|---|---|---|---|
| S-40 | Review queue | `/review` | reviewer, approver, admin | F7, F8 | E ("nothing waiting") · L · list (campaign · version · submitted by · submitted at · audience size · blockers accepted n · **needs co-sign** flag · **you authored** flag) · filter mine/all | Reviewer default landing. **DECISION** (new). |
| S-41 | Review | `/versions/:id/review` (**own route**, §5.2) | reviewer, admin | F8 | L · **self-authored** (whole screen replaced by notice) · **not in_review** (notice + link to S-20) · **re-evaluated since submit** (X banner, reload) · four section cards each: unset / approved / rejected (+note) · **blast radius**: banner + *Request co-sign* → code shown (M-07) → *Co-signed by X* · submit enabled only when all four set (approve needs all approved) · submitting · done → redirect S-20 (approved/sealing…) | Left: read-only version (S-20/21 content). Right: sections. Reading order: sections first. |
| S-42 | Co-sign entry | `/cosign` | approver, admin | F8a | idle (6-digit input) · X (expired/unknown) · approved (shows what was approved: campaign, version, audience size; "the reviewer can now submit") · already-used | **New screen — was missing.** Also reachable from the nav badge for approvers. |
| S-50 | Evidence list | `/evidence` | any | — | E ("nothing sealed yet") · L · list (seq · campaign · version · sealed by · at · hash short · kind chip for attestations) · **Verify chain** button → verifying (progress if > 2,000) → ok / **broken at seq n** (red, links S-60) | |
| S-51 | Certificate | `/evidence/:id` | any | F9 | L · document (per `07 §2.5`) · **advisory-hash note** (`rulebookHashAtSeal` differs) · **attestation record** variant (kind=chain_attestation: shows summary, firstBrokenSeq) · actions: Download JSON · Print · Verify chain (client-side offline verify of this record's hash + server chain verify) | Print stylesheet is part of the screen definition. |
| S-52 | Export / hand-off | modal on S-20 (sealed) | operator, admin | F11 | target select (export / webhook / wati:suppress — last only if connector active + opted in) · confirm · **push progress** (n/m) · **partial** (retry failed) · done | |

## 5. Rulebook, coverage, shadow, settings, admin

| ID | Screen | Route | Roles | Flows | States | Notes |
|---|---|---|---|---|---|---|
| S-30 | Rulebook — explain | `/rulebook/explain/:ruleId` | any | — | L · graph (dagre) · node panel (clause text if PRIMARY; confidence chip; URL) · enforcement list · related jurisdictions (E if none) · **rule not in graph** X | Opened from any finding's *Explain*. |
| S-31 | Rulebook — browse | `/rulebook` | any | — | L · list of 25 rules (filter layer/tier/category/pack) · rulebook hash + pack versions header · whole-graph toggle | |
| S-32 | Coverage radar | `/rulebook/coverage` | any | — | L · radar (live / needs-data / not-send-time) · per-rule hover (missing paths, unlockedBy) · **connector degraded** variant (amber with reason) · CTA to S-71 | |
| S-33 | Shadow mode | `/shadow` | operator, admin | F14 | E (explainer + upload) · uploading · **batch progress** (evaluated/pending) · results table · row-level rejected list (from import) · X | |
| S-70 | Settings — business rules | `/settings/rules` | admin (read: any) | F12 | form (every `TenantConfig` key per `15 §3` with validation) · saving · X per field · **saved + drift notice** ("n evaluated versions were checked under the previous rules") | Non-admin sees read-only. |
| S-71 | Settings — connectors | `/settings/connectors` | admin | F15 | E · cards (kind · status active/degraded/disabled · capabilities · last sync · last error) · **add connector** (M-08: kind → credential fields per kind → probe result) · sync-in-progress · **not supported** list (Gupshup/AiSensy/Interakt/Zoko: "history not available via public API") | Credentials never displayed after save. |
| S-72 | Settings — users & roles | `/settings/users` | admin | — | list · add (M-09) · edit roles · **last-admin guard** X · **only-one-reviewer warning** | |
| S-73 | Settings — webhook | `/settings/webhook` | admin | F10 | url + secret (write-only) · recent deliveries (delivered/retry/failed) · **Retry now** | |
| S-74 | Settings — advisory | `/settings/advisory` | admin | — | two toggles + plain warning · provider/model shown (read-only from env) | M5. |
| S-75 | Settings — API keys | `/settings/api-keys` | admin | — | list · create (plaintext shown once, copy) · revoke | |
| S-60 | Admin — audit log | `/admin/audit` | admin | — | filters · paged · before/after diff expand | |
| S-61 | Admin — jobs | `/admin/jobs` | admin | — | list by kind/state · **retry** · error expand | |
| S-62 | Admin — chain incident | `/admin/evidence` | admin | — | frozen state + firstBrokenSeq · **Attest** form (M-10: summary ≥ 20 chars) → unfreezes | Linked from the red banner. |

Modals: M-07 co-sign code display · M-08 add connector · M-09 add user · M-10 attest.

## 6. Decisions forced by the inventory (amend `07`)

### 5.1 Version detail becomes tabbed — **DECISION D21**
Findings (default) · Audience · Versions & activity. The header + summary strip + coverage line + as-of control persist above the tabs. The old right sidebar is dissolved into the Audience and History tabs. Rationale: at 1280×800 the single-page layout from `07 §2.3` cannot show the scorecard and a finding card without scrolling past the coverage statement, which must stay visible.

### 5.2 Review is its own route — **DECISION D22**
`/versions/:id/review`, reviewer-only, sections-first layout. `07 §2.4`'s "same screen plus a panel" is withdrawn.

### 5.3 Two default landings — **DECISION D23**
Operator → S-10 Campaigns. Reviewer/approver → S-40 Review queue. Admin → S-10. A user with both operator and reviewer roles → S-40 if the queue is non-empty, else S-10.

### 5.4 "Provide →" is replaced by a router modal (M-06) — **DECISION D24**
An unevaluated rule's missing data has exactly three sources, and the affordance depends on which:
| Missing path | Where it's provided | Who | Affordance |
|---|---|---|---|
| `config.*` (lenderName, frequencyCap…) | S-70 | admin | admin: deep link to the field, returns to S-20 with drift notice; operator: "ask an admin" + copyable field name |
| `campaign.*` (purpose, segment, template) | new version | operator | opens M-02/M-03-style edit → new version |
| `contact.*` (language, consent) | the upload | operator | "re-upload with a `preferredLanguage` column" + link to S-13 mapping preview |
| `history.*` / `platform.*` | connector | admin | link to S-71 with the capability named |
`07 §2.3`'s "jumps to the field" is withdrawn.

### 5.5 Co-sign has a screen — **DECISION D25**
S-42 `/cosign` for approvers, reachable from nav (badge when a request is pending for this tenant). Code entry, not a link — the code is spoken/typed across two sessions by design.

### 5.6 Nothing on any screen says "compliant" — restated
Zero findings renders *"No findings from the rules that could be evaluated"* with the coverage statement. No green tick on a version. The only green tick in the product is the chain-verify result.

## 7. Matrix check (what this inventory guarantees)

- Every `version_state` in `15 §1` has a rendered state on S-20 (10 states + derived superseded/shadow/advisory/drift).
- Every flow F1–F18 has at least one landing screen; F13 (send confirmation) and F16 (expiry sweep) are system flows whose effects appear on S-23 activity and S-20 state.
- Every role has a default landing and a screen for each action in `02 §7`.
- Every error type in `06 §1` has a rendering: `validation` → per-field; `unauthenticated` → S-00 with return URL; `forbidden-role` → S-03; `forbidden-self-review` → S-41 notice; `not-found` → S-02; `invalid-transition` → toast + state refresh; `blockers-outstanding` → S-20 footer reason; `blast-radius-approval-required` → S-41 banner; `idempotency-conflict` → toast; `connector-unavailable` → S-52/S-71; `rate-limited` → toast with retry-after; `internal` → toast with requestId.
- Every modal creates either a decision row, a new version, or a config change — never an in-place edit of an evaluated version.

## 8. Counts

23 screens · 10 modals · 4 new versus `07` (S-42 co-sign, S-24 affected rows, S-25 diff, S-62 chain incident) · 4 decisions that amend `07` (D21–D25) · 0 screens without an empty/loading/error definition.
