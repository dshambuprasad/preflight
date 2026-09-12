# 01 — Product Requirements

## 1. Problem

Regulated lenders in India send high volumes of borrower communications (marketing, servicing, collections) across several vendors (WhatsApp BSPs, SMS aggregators, email). The obligations on those communications are real, enforced, and about to tighten:

- RBI already fines lenders for communication conduct — HDFC Bank (contact outside permitted hours), Hero FinCorp (not in the borrower's language). 79 RBI enforcement actions in FY24-25. *(R1, V1)*
- **RBI Responsible Business Conduct (Second Amendment) Directions 2026** take effect **1 Jan 2027**: explicit per-product consent before any promotional communication, unsubscribe as easy as subscribe, one-year record retention, dark-patterns ban. *(V1, V4)*
- Lenders are liable for their Lending Service Providers' conduct — they carry risk for messages they did not themselves send. *(V1)*

Today the checks are done by analysts in spreadsheets ("validating audience counts, suppression lists, exclusions… before campaign deployment" — live JD text, ₹6–9L/yr) *(R3)*, and the existing tools each cover one slice: consent-capture vendors don't enforce at send time; MLR tools review the message but never the recipient list; engagement platforms cap frequency only within their own walls. *(R2, R4, V4)*

**Nobody evaluates the recipient list and the message together, across vendors, and produces one record.** That is the product.

## 2. Positioning (DECISION)

**Preflight is a campaign operations pipeline with compliance built into the check stage — not a compliance checker with a UI.** The showcase audience is someone automating marketing/collections campaign operations; the compliance officer is the second persona who makes the deal defensible. Both must see themselves in the demo.

Tagline for the demo: *"Check the list and the message, before it sends, and keep the proof."*

## 3. Personas

| Persona | Role in system | What they need | Demo moment |
|---|---|---|---|
| **Campaign operator** (marketing ops / collections ops analyst) | `operator` | Upload, see what's wrong, fix fast, get it out | Pre-flight screen: findings with one-click fixes |
| **Compliance officer** (CCO / compliance analyst — *structurally separate from business by RBI rule*) | `reviewer` | Approve/reject with reasons, see the evidence, export it | Decide stage + evidence certificate |
| **Marketing/collections head** | `approver` | Blast-radius sign-off on large sends | Escalation for audiences over threshold |
| **Tenant admin** | `admin` | Configure Layer C, connectors, users | Settings |
| **Auditor / regulator** (external, read-only, later) | — | A frozen artifact they can hold without system access | Exported evidence certificate |

DECISION: roles are `admin`, `operator`, `reviewer`, `approver`. A user may hold several. The separation that matters: **a `reviewer` cannot approve a version they authored** (enforced in the pipeline, see 05).

## 4. Scope — v1 (the showcase build)

### In scope
1. **Ingest** — CSV upload (audience), message text, channel, scheduled time, purpose, segment; a JSON API for the same.
2. **Resolve** — identity normalisation (E.164 phone, lowercased email), duplicate detection within the audience, consent lookup against the tenant's consent store.
3. **Check** — the India Layer-A rulebook (23 rules after the 2026-09-11 amendment; 8 Tier-0 on day one, 10 with consent columns, more as data connects) plus the 2-rule `preflight-hygiene` pack, Layer-C business config, coverage statement, date-aware severity.
4. **Decide** — per-finding: *fix* (apply remediation, creates a new version), *accept-with-reason* (typed reason code, scope, expiry, actor+role), *abandon*. Section-by-section sign-off (Audience · Message · Rules · Delivery). Blast-radius escalation.
5. **Seal** — immutable, hash-chained evidence record bound to the approved version and the rulebook version. Exportable certificate (JSON + printable HTML).
6. **Hand off** — export corrected audience + message; webhook; (M4) push suppression to WATI.
7. **Rule graph** — rulebook as a graph (Turtle source of truth); "explain this finding" walks rule → clause → instrument → regulator.
8. **Time-travel** — evaluate any version *as of* any date; the UI exposes 1 Jan 2027 and 13 May 2027 as presets.
9. **Coverage radar** — which rules are unlocked by which data; per-tenant readiness.
10. **Shadow mode** — evaluate *past* campaigns (as-of their send date) to show what would have been caught. Same pipeline; no hand-off.
11. **Connectors (M4)** — schema-mapping wizard for arbitrary CSV; WATI read-only (templates, per-contact history, quality rating via webhook); Meta Graph read-only (quality rating, messaging tier).
12. **Advisory (M5, feature-flagged)** — LLM classification of promotional vs service with confidence; audience-quality flags (never-engaged, recently-contacted-elsewhere).

### Out of scope for v1 (explicit)
- Sending messages. Preflight never sends. *(risk ladder, 01_Concept)*
- Blocking a send inside a third-party tool.
- Consent **capture** UI (preference centres, dark-pattern-free forms) — that lives in the lender's own app. *(V4 — we own the enforcement half)*
- Voice/call compliance (CarmaOne/Exotel own it). *(V4)*
- ML models for churn/fatigue. Architecture must not preclude them (event history retained); no models are built.
- Cross-campaign collision optimisation (L4/M6) — designed for, not built.
- Multi-region rule packs beyond India — the cartridge slot exists; only India is filled.
- SSO/SAML, SCIM.

## 5. The demo script (the acceptance test for the whole product)

Eight minutes, two personas, one campaign. Every milestone in `10_Milestones.md` is measured against whether this script runs.

1. **Operator** uploads `sample/contacts.csv` (12 rows) and pastes the collections message, WhatsApp, scheduled 20:15 IST, purpose = collections.
2. Screen shows: **2 blockers** (20:15 breaches the 08:00–19:00 recovery window — with the HDFC precedent cited; template has 3 placeholders, 2 variables), **2 warnings** (6 recipients' language mismatch; lender not named), **1 info** (no frequency cap set). Coverage: *"Checked 5 of 5 applicable rules."*
3. Operator clicks **Fix** on the window finding → picks 10:00 next day → new version v2 auto-evaluated → blocker gone.
4. Operator clicks **Accept with reason** on the language warning → reason `romanised-acceptable`, scope `this campaign`, expiry `30 days` → recorded with name and role.
5. Operator drags the **time-travel** control to 1 Jan 2027 → nothing changes for this collections campaign (correct — the 2027 rules are promotional). Switch to the promotional sample → two warnings (consent, opt-out) become blockers. Drag back.
6. Operator submits v2 for review.
7. **Reviewer** (different user) opens it, sees section sign-offs (Audience ✓ Message ✓ Rules — 1 accepted exception ✓ Delivery ✓), approves.
8. System **seals** the evidence record. Reviewer opens the **certificate**: campaign, version hash, rulebook version hash, every finding, every decision with actor/role/reason/expiry, chain hash, timestamp. Clicks **Verify chain** → green. Exports.
9. Reviewer clicks a finding → **Explain** → graph: finding → A-RBI-001 → RBI/2022-23/108 clause → RBI. Source confidence shown.
10. **Coverage radar**: shows which of the 25 rules (23 India + 2 hygiene) are live, which unlock with WATI history, which with Meta Graph.
11. **Shadow mode**: upload `sample/past_quarter.csv` (a handful of past sends with dates) → "of 8 past campaigns, 5 would have been flagged; 2 blockers."

If any step needs a workaround, the milestone isn't done.

## 6. Success criteria for the showcase

- The demo script runs start to finish on a laptop with `docker compose up` and no manual fixes.
- Every finding on screen has all four parts: **what** (the exact text/field), **which rule** (with citation and source confidence), **why** (one line), **fix** (a suggested remediation or the required disclosure). *(R5 — Saifr/Luthor pattern)*
- The evidence certificate is a real, frozen, verifiable artifact — not a screenshot of a dashboard. *(R5 — DocuSign/Vanta pattern; Credgenics anti-pattern)*
- The rule engine's output for the ground-truth fixture is byte-identical to `builds/PreflightCore`'s.

## 7. Principles carried into every document

1. **Never silently pass.** Unevaluable ≠ pass. Coverage is always stated.
2. **No verdict.** The product finds gaps; humans decide; the record proves it.
3. **Explanation is the product.** Deterministic core; judgement only in the advisory layer, flagged and confidence-scored.
4. **Every path is gated.** API-submitted campaigns go through the same pipeline as UI ones. *(R5 — Braze anti-pattern)*
5. **Reasoning lives in the system of record**, never in email or chat. *(R5 — CleverTap anti-pattern)*
6. **The evidence record is boring.** No marketing metrics inside it. *(R5 — Luthor anti-pattern)*
7. **The future is a parameter.** `as_of` everywhere; nothing reads the wall clock inside the core.
8. **Region and industry are cartridges.** India is the first; the slot is generic.
