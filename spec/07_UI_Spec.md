# 07 — UI Specification

**Amended 2026-09-11 by `19_Screen_Inventory.md` (D21–D25):** version detail is tabbed; review is its own route; role-based landings; "Provide →" is a router modal; co-sign has a screen. Where this document and `19` differ, `19` wins.

`apps/web`. React 19 + Vite + TanStack Router/Query + Tailwind + Radix primitives. Cytoscape.js for the graph. No component library beyond Radix (keeps the look ours). Desktop-first; usable at 1280×800; no mobile work in v1.

**Visual principle:** calm, document-like, high contrast. Findings look like a checklist someone competent wrote, not a dashboard. The evidence certificate looks like a legal document because it is one.

## 1. Navigation (left rail)

```
Preflight
  ├ Campaigns          (home)
  ├ New check          (the pre-flight screen — primary CTA)
  ├ Review queue       (reviewer/approver see a badge count)
  ├ Evidence           (sealed records; verify chain)
  ├ Shadow mode
  ├ Rulebook           (graph + coverage radar)
  └ Settings           (admin: config, connectors, users)
```
Primary object is the **Campaign**; its versions are tabs inside it. *(R5 — IA question)*

## 2. Screens

### 2.1 Campaigns (home)
Table: name · mode · latest version · state chip · blockers/warnings · scheduled · last actor. Filter by state. Row click → Campaign detail. Empty state: *"No campaigns yet. Run your first pre-flight check."* → New check.

### 2.2 New check (the pre-flight screen) — **the demo's first screen**
Two columns.
**Left:** message (textarea, char count, template toggle → body+variables fields), channel, purpose, segment, product (optional), scheduled date+time (**IST, labelled**).
**Right:** audience — drop zone for CSV, or paste rows; after upload: mapping panel (08 §2) with column → concept chips, sample preview, row count, *"n rows have no phone or email"*.
Footer: **Run pre-flight** (primary). Also *Save as draft*.

On run → navigates to Version detail with a progress strip (Ingested → Resolved → Checked) driven by polling `GET /versions/:id`.

### 2.3 Version detail — **the core screen**
Header: campaign name · v{n} · state chip · scheduled (IST) · channel · purpose (with classification badge: *promotional / service / mixed — low confidence*) · **as-of control** (§3.1).

**Summary strip:** `2 blockers · 2 warnings · 1 info` · **Coverage:** *"Checked 5 of 5 applicable rules."* — coverage text is always visible, never collapsed. Unevaluated rules show a muted list: *"Could not evaluate: A-RBI-011 (needs lender name) · A-WA-003 (needs template)"* each with a *Provide →* link that jumps to the field.

**Scorecard** *(R5 — Litmus)*: six category rows — Timing · Consent · Audience · Content · Identity · Delivery — each with a status pill (pass / n findings / not checked) and expandable finding cards beneath.

**Finding card** — the four-part anatomy *(R5 — Saifr/Luthor)*:
```
[BLOCK]  A-RBI-001  Recovery contact only between 08:00 and 19:00 IST
WHAT     Scheduled 20:15 IST                                   ← exact field/text, highlighted
WHY      Outside the 08:00–19:00 window RBI permits for recovery communications.
         12 recipients affected.
RULE     RBI/2022-23/108 (12 Aug 2022) · source: SECONDARY · [Explain ↗]
FIX      [Reschedule to 10:00 IST tomorrow]   [Edit schedule…]   [Accept with reason]
DECISIONS  (none)  |  ✓ Accepted by R. Mehta (reviewer) — romanised-acceptable — this campaign — expires 14 Oct
```
- `Accept with reason` opens a modal: reason code (select, tenant list), reason text (required, ≥10 chars), scope (radio), expiry (auto, editable within cap). For **blockers** the button is disabled for operators with tooltip *"Blockers can only be accepted by a reviewer."*
- `Fix` applies the suggested fix → toast *"Created v2 — re-checking…"* → navigates to v2. The old version shows a *superseded by v2* banner.
- Suppressed-by-exception findings show as info with a chip *"suppressed by exception until 14 Oct"*.

**Right sidebar:** Audience summary (size, duplicates, consent coverage donut: granted / denied / unknown / no field), Versions list (v1 → v2 → v3 with what changed), Activity (audit events).

**Footer actions** by state: `evaluated` → *Submit for review* (disabled with reason if blockers outstanding) · `in_review` → reviewer sees *Review* · `sealed` → *Certificate* · *Export* · *Hand off*.

### 2.4 Review (reviewer)
Same version detail, read-only, plus a right panel with four section cards *(R5 — Braze)*: **Audience** (size, dupes, consent coverage) · **Message** (content findings) · **Rules** (all findings with their decisions, accepted exceptions highlighted) · **Delivery** (channel, schedule IST, template status). Each: Approve / Reject + note. Bottom: *Approve version* (enabled only when all four approved) / *Reject with notes*. If blast radius: a banner *"Audience 12,400 ≥ 10,000 — approver co-sign required"* with a *Request co-sign* that shows a code the approver enters from their session.

Self-review: the whole panel is replaced by *"You authored this version. A different reviewer must approve it."*

### 2.5 Evidence certificate — **the demo's closing screen**
A document, not a dashboard. Serif headings, A4-ish width, printable.
```
PREFLIGHT EVIDENCE RECORD                                  seq 0017
Tenant · Campaign · Version v2 · Sealed 2026-09-14 10:42 IST by R. Mehta (reviewer)

1. What was checked      message (full text), channel, schedule, purpose, template
2. Who it was going to   12 recipients · audience hash 3f9a…
3. Rules applied         rulebook india-layer-a@1.3.0 · hash 8c1e… · evaluated as of 2026-09-15 10:00 IST
4. Findings              table: rule · severity · what · why · citation
5. Decisions             table: finding · type · reason code · reason · scope · expiry · actor (role) · when
6. Review                four sections, outcome, notes, co-signer
7. Integrity             prev hash · this hash · [Verify chain ✓ 17 records, unbroken]
Disclaimer (verbatim from 03 §8)
```
Buttons: *Download JSON* · *Print / PDF* · *Verify chain*. No metrics, no charts. *(R5 — DocuSign/Vanta; Luthor anti-pattern)*

### 2.6 Explain (rule graph)
Opens from any finding. Cytoscape, left-to-right dagre layout: **Finding → Rule → Clause(s) → Instrument → Regulator**, with **Enforcement actions** hanging off the rule (HDFC, Hero FinCorp…). Node click → side panel with the node's data (clause text where PRIMARY, source confidence chip, URL). A *"Related in other jurisdictions"* section shows `skos:closeMatch` edges when present. Whole-rulebook view toggle with filter by layer/tier/category.

### 2.7 Rulebook → Coverage radar
Radial or grouped-bar (recharts): 25 rules by category (23 India + 2 hygiene); each *live* (green), *needs data* (amber, hover: *"unlocks with WATI history"*), *not a send-time check* (grey). Below: *"Connect WATI to unlock 4 more rules"* CTA → Settings. This screen sells the tiers without a deck.

### 2.8 Shadow mode
Upload past campaigns CSV → batch progress → results table: campaign · sent at · evaluated as of · blockers · warnings · top finding. Header stat: *"Of 8 past campaigns, 5 would have been flagged — 2 with blockers."* Row click → version detail (read-only, labelled *shadow — evaluated as of the date it was sent*).

### 2.9 Settings
Tabs: **Business rules** (Layer C form: lender name, frequency cap, quiet hours, banned phrases, romanised-acceptable languages, blast-radius threshold, reason codes) · **Connectors** (cards: CSV mapping presets, WATI, Meta Graph — status, last sync, probe) · **Users & roles** · **Webhook** · **Advisory** (M5 flags with a plain warning that judgement features record both opinions).

## 3. Cross-cutting components

### 3.1 As-of control (time-travel)
In the version header: a date-time input defaulting to the version's `scheduledAt`, with preset chips **Today** · **1 Jan 2027 (RBI RBC)** · **13 May 2027 (DPDP)**. Changing it calls `POST /versions/:id/evaluate {asOf}` and re-renders; the summary strip animates severity changes (warn→block turns red). A persistent note: *"Evaluated as of {date}. Sealing uses the scheduled send time."*

### 3.2 Coverage statement
A single component used everywhere an evaluation is shown. Never hidden. Wording comes from the API verbatim.

### 3.3 Source-confidence chip
`PRIMARY` (green) · `SECONDARY` (amber, tooltip *"primary text not yet verified"*) · `DERIVED` (amber) · `PLATFORM` (blue). Appears on every citation.

### 3.4 State chip
draft · resolving (spinner) · evaluated · in review · approved · sealed (lock icon) · handed off · rejected · abandoned · expired.

## 4. The five demo moments (each must be one click from the version screen)

1. **Fix → new version** — the blocker disappears, v2 appears, nothing was edited in place.
2. **Time-travel** — drag to 1 Jan 2027, watch two warnings become blockers on the promotional sample.
3. **Explain** — click a finding, see the path to the regulator with the HDFC enforcement action hanging off it.
4. **Certificate + Verify** — a frozen document with a hash, and a green *unbroken chain* result.
5. **Coverage radar** — *"connect WATI to unlock 4 more rules."*

Shadow mode is the sixth, from its own screen.

## 5. Accessibility & i18n

Keyboard-navigable; all colour states have text/icon equivalents; WCAG AA contrast. English only in v1; all strings in one `messages.ts` so Hindi/Japanese can follow.

## 6. Empty, loading, error states

Every screen defines all three. Errors show the problem+json `title` and the `requestId`. Loading uses skeletons, not spinners, except the pipeline progress strip.
