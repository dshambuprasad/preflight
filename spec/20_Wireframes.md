# 20 — Wireframes (low-fi)

ASCII, 1280-wide mental canvas, one block per screen-state from `19_Screen_Inventory.md`. Layout and reading order are normative; visual style is `07 §"Visual principle"`. Copy in quotes is the actual copy (strings live in `messages.ts`).

Legend: `[Button]` `[Primary]` `( ) radio` `[x] check` `▾ select` `┆` scroll region · `⚠` warn colour · `✖` block colour · `ℹ` info · `🔒` sealed.

---

## S-01 Shell (all screens)

```
┌──────────────┬──────────────────────────────────────────────────────────────────────────────────┐
│ PREFLIGHT    │  ▒▒ MOCK DATA — connectors are simulated (PREFLIGHT_DEMO_MOCK_CONNECTORS) ▒▒     │ ← ribbon, only when flag on
│              │  ■ Sealing is frozen for this tenant: chain break at seq 17. [Open incident]      │ ← red banner, admin link
│ Campaigns    ├──────────────────────────────────────────────────────────────────────────────────┤
│ New check    │                                                                                  │
│ Review (3)   │                          <screen body>                                           │
│ Evidence     │                                                                                  │
│ Shadow mode  │                                                                                  │
│ Rulebook     │                                                                                  │
│ ──────────   │                                                                                  │
│ Settings     │                                                                                  │
│              │                                                                                  │
│ R. Mehta     │                                                                                  │
│ reviewer ▾   │                                                                                  │
└──────────────┴──────────────────────────────────────────────────────────────────────────────────┘
```
Nav rules: *Review (n)* only for reviewer/approver/admin; approver also sees *Co-sign* when a request is pending; *Settings* admin-only; role chip shows all roles.

## S-00 Login
```
              ┌─────────────────────────────────┐
              │ PREFLIGHT                        │
              │ Email     [______________]       │
              │ Password  [______________]       │
              │           [Sign in]              │
              │ ⚠ "Your session expired. Sign in │   ← only after 401 mid-session
              │    to return to v2 of Sept EMI." │
              └─────────────────────────────────┘
```

## S-10 Campaigns (home) — populated / empty
```
Campaigns                                                         [ + New check ]
[All ▾] [Live ▾]  🔍 name…
┌──────────────────────┬───────┬──────┬────────────┬────────┬─────────────┬──────────────┐
│ Name                 │ Mode  │ Ver  │ State      │ ✖ / ⚠  │ Scheduled   │ Last actor   │
├──────────────────────┼───────┼──────┼────────────┼────────┼─────────────┼──────────────┤
│ Sept EMI reminder    │ live  │ v2   │ IN REVIEW  │ 0 / 1  │ 15 Sep 10:00│ A. Rao (op)  │
│ Top-up offer Q3      │ live  │ v1   │ EVALUATED  │ 3 / 2  │ 14 Sep 19:45│ A. Rao (op)  │
│ Aug collections wk2  │ live  │ v3   │ 🔒 SEALED  │ 0 / 0  │ 21 Aug 10:00│ R. Mehta (rv)│
│ (shadow) Jul blast   │shadow │ v1   │ EVALUATED  │ 2 / 1  │ sent 3 Jul  │ —            │
└──────────────────────┴───────┴──────┴────────────┴────────┴─────────────┴──────────────┘
                                                                     ‹ prev   next ›
--- empty ---
          ┌───────────────────────────────────────────┐
          │  No campaigns yet.                        │
          │  "Run your first pre-flight check."       │
          │            [ + New check ]                │
          └───────────────────────────────────────────┘
```

## S-12 New check — blank → with upload
```
New check                                                 Campaign: [Sept EMI reminder ▾] or [+ new]
┌──────────────────── MESSAGE ─────────────────────┐ ┌──────────────── AUDIENCE ───────────────────┐
│ [x] This is a WhatsApp template                   │ │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    │
│ Body                                              │ │    Drop a CSV here, or [Choose file]         │
│ ┌───────────────────────────────────────────────┐ │ │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘    │
│ │Dear customer, your EMI of Rs {{1}} is overdue │ │ │  or [Paste rows…] (≤ 5,000)                  │
│ │since {{2}}. Please pay immediately … {{3}}    │ │ │                                              │
│ └───────────────────────────────────────────────┘ │ │  ── after upload (S-13 panel) ──             │
│ Variables  [8,450] [28 Aug] [+ add]     2 of 3 ⚠  │ │  contacts.csv · 12 rows · 4 columns          │
│ 118 / 1024                                        │ │  id ─────────────▸ [externalId ▾]            │
│ Reads as: SERVICE (high confidence)          ℹ    │ │  phone ──────────▸ [phone ▾]                 │
│                                                   │ │  preferredLanguage ▸ [preferredLanguage ▾]   │
│ Channel   [WhatsApp ▾]   Purpose  [Collections ▾] │ │  consentPromotional▸ [consentPromotional ▾]  │
│ Segment   [Retail ▾]     Product  [_________]     │ │  Identity: 12 phone · 0 email · 0 none       │
│ Scheduled [14 Sep 2026] [20:15]  IST              │ │  Consent: 6 granted · 2 denied · 4 absent    │
│                                                   │ │  "10 of 25 rules can be evaluated at Tier 0" │
└───────────────────────────────────────────────────┘ │  [Save as preset ▾]                           │
                                                      └──────────────────────────────────────────────┘
⚠ "Purpose not stated — message reads as MIXED; set Purpose to be precise."   ← only when unknown/mixed
                                                        [Save draft]   [ Run pre-flight ]
--- validation error state: every failing field gets an inline line; a summary strip at top lists them all ---
```

## S-20 Version header (persists above tabs) — evaluated
```
‹ Sept EMI reminder                                                                   v2  [EVALUATED]
WhatsApp · Collections · Retail · 12 recipients · Scheduled 14 Sep 20:15 IST · by A. Rao
As of: [14 Sep 2026 20:15 ▾]  (Today) (1 Jan 2027 — RBI RBC) (13 May 2027 — DPDP)   ℹ "Sealing uses the scheduled send time."
──────────────────────────────────────────────────────────────────────────────────────────────────────
 ✖ 2 blockers   ⚠ 2 warnings   ℹ 1 info        COVERAGE  "Checked 5 of 5 applicable rules."
──────────────────────────────────────────────────────────────────────────────────────────────────────
[ Findings ]  [ Audience ]  [ Versions & activity ]
```
Variants (replace/append lines):
```
resolving:   ● Ingested ─── ◐ Resolved (64%) ─── ○ Checked        queue position 3
in_review:   [IN REVIEW] · "Submitted 14 Sep 11:02 · waiting for a reviewer"     as-of control DISABLED (tooltip: re-evaluating would invalidate the review)
approved:    [APPROVED] · "Sealing…"  (spinner)                                   → auto-refresh to sealed
sealed:      [🔒 SEALED] · seq 0017 · hash 8c1e…   [Certificate] [Export] [Hand off ▾]
rejected:    [REJECTED] ■ "Rejected by R. Mehta: audience contains 2 test numbers."   [Edit & resubmit]
expired:     [EXPIRED] ■ "Scheduled time passed before approval."                     [Clone with new schedule]
superseded:  ┆ "Superseded by v3 (rescheduled to 15 Sep 10:00)."  [Open v3]
shadow:      [EVALUATED · SHADOW] "Evaluated as of the date it was sent: 3 Jul 2026."   no footer actions
advisory:    ⚠ "Evaluated as of 1 Jan 2027 — advisory only; not the evaluation under review."
drift:       ℹ "Business rules changed since this check (frequency cap set). [Re-check as new version]"
rulebook:    ℹ "Rulebook updated since this check (india-layer-a 1.3.0 → 1.3.1). [Re-evaluate]"
cannot-eval: COVERAGE "Checked 3 of 5 applicable rules. 2 could not be evaluated —"
               · A-RBI-011 needs config.lenderName            [Provide ▸]   ← opens M-06 router
               · A-WA-003  needs campaign.template.body       [Provide ▸]
no-findings: "No findings from the rules that could be evaluated."  + coverage line   (NO tick, NO "compliant")
```
Footer (sticky, by state): evaluated → `[Abandon]  [Submit for review]` (disabled + reason when blockers outstanding) · rejected/expired → `[Edit & resubmit]`/`[Clone]` · sealed → certificate/export/hand-off.

## S-21 Tab: Findings — scorecard + cards
```
 TIMING     ✖ 1        CONSENT    —  not applicable      AUDIENCE   ✓ pass
 CONTENT    ⚠ 1        IDENTITY   ⚠ 1                    DELIVERY   ✖ 1
──────────────────────────────────────────────────────────────────────────────────────────────────────
┃ ✖ BLOCK   A-RBI-001   Recovery contact only between 08:00 and 19:00 IST                    [Explain ↗]
┃ WHAT      Scheduled ▌20:15 IST▐
┃ WHY       "Outside the 08:00–19:00 window RBI permits for recovery communications. 12 recipients affected.
┃            The restriction covers messages, not just calls."
┃ RULE      RBI/2022-23/108 (12 Aug 2022) · ● SECONDARY
┃ FIX       [ Reschedule to 15 Sep 10:00 IST ]   [ Edit schedule… ]        [ Accept with reason ]  ← DISABLED for operator: "Blockers can only be accepted by a reviewer."
┃ DECISIONS (none)
┠────────────────────────────────────────────────────────────────────────────────────────────────────
┃ ✖ BLOCK   A-WA-003    WhatsApp template variables match the approved template
┃ WHAT      Template ▌{{1}} {{2}} {{3}}▐ vs 2 variables supplied
┃ WHY       "Body contains placeholders [1,2,3] but 2 variable(s) were supplied. WhatsApp will reject this send."
┃ RULE      WhatsApp Business Platform policy · ● PLATFORM
┃ FIX       [ Fix template variables… ]                                     [ Accept with reason ]
┠────────────────────────────────────────────────────────────────────────────────────────────────────
┃ ⚠ WARN    A-RBI-003   Communication in the borrower's understood language
┃ WHAT      6 recipients: hindi ×1, tamil ×1, telugu ×1, marathi ×1, kannada ×1, bengali ×1   [see rows ↗]
┃ WHY       "Message script is Latin; these recipients state another language. Romanised text can be a
┃            false positive — review, don't auto-drop. 1 of 12 has no stated language and was not assessed."
┃ RULE      RBI (NBFC – RBC) Directions 2025 · ● DERIVED (Hero FinCorp)
┃ FIX       [ Drop 6 rows ]   [ Mark romanised acceptable (admin) ]         [ Accept with reason ]
┃ DECISIONS ✓ Accepted by R. Mehta (reviewer) · romanised-acceptable · this campaign · expires 14 Oct
┠────────────────────────────────────────────────────────────────────────────────────────────────────
┃ ℹ INFO    A-RBI-005   A contact-frequency cap must exist        ┆ suppressed by exception until 14 Oct
┃ …
```
Card sub-states drawn above: no decisions · accepted (chip) · suppressed (info + chip) · blocker-operator (disabled) · fix-needs-admin (button labelled "(admin)"; operator tooltip "an admin must apply this"). Also: `fixed-into v3` chip replaces FIX row on superseded versions; `stale` decisions render muted under "Earlier decisions (v1)".

## M-01 Accept with reason
```
┌─ Accept finding A-RBI-003 with reason ───────────────────────────────┐
│ Reason code   [romanised-acceptable ▾]                                │
│               ℹ shown when rule-is-wrong: "This will propose a rulebook change." │
│ Reason        [Message is romanised Hindi; borrowers read it fine.  ]  │
│               ______________________________________ 48 / 2000  (min 10)│
│ Scope         ( ) this finding   (•) this campaign   ( ) this rule, 30 days │
│ Expires       [14 Oct 2026]  (max 90 days)                             │
│ Recorded as   R. Mehta · reviewer                                      │
│                                              [Cancel]   [Accept]       │
└───────────────────────────────────────────────────────────────────────┘
```

## M-06 Provide missing data (router)
```
┌─ A-RBI-011 needs: config.lenderName ─────────────────────────────────┐
│ This is a business rule setting.                                      │
│ admin:     "Set it in Settings → Business rules. This check will show │
│             a drift notice; re-check as a new version afterwards."    │
│             [Open Settings ▸]                                         │
│ operator:  "Ask an admin to set:  lenderName   [copy]"                │
└───────────────────────────────────────────────────────────────────────┘
Variants: campaign.* → "[Edit as new version ▸]" (opens M-02/M-03) · contact.* → "Re-upload with a preferredLanguage column [Mapping preview ▸]" · history.*/platform.* → "Connect WATI to unlock this rule [Connectors ▸]"
```

## S-22 Tab: Audience
```
 12 recipients   ·  0 duplicates   ·  0 unresolvable        Consent  ◔ 6 granted · 2 denied · 0 unknown · 4 absent
[All ▾] [Affected by ▾] [Flag ▾]
┌────┬─────────┬──────────────────┬──────────┬─────────┬────────────────┬──────────────┐
│ #  │ Ext id  │ Identity         │ Language │ Consent │ Source         │ Flags        │
├────┼─────────┼──────────────────┼──────────┼─────────┼────────────────┼──────────────┤
│ 1  │ B-1001  │ phone:+91981…01  │ hindi    │ granted │ upload         │ A-RBI-003    │
│ 3  │ B-1003  │ phone:+91981…03  │ tamil    │ —       │ —              │ A-RBI-003    │
│ 5  │ B-1005  │ phone:+91981…05  │ —        │ granted │ consent_records│              │
└────┴─────────┴──────────────────┴──────────┴─────────┴────────────────┴──────────────┘
```

## S-23 Tab: Versions & activity
```
 v1 ──▶ v2 ──▶ v3            v1: 20:15 · 12 rows          v2: rescheduled 10:00 · 12 rows      v3: dropped 6 rows
                             [Compare v2 ↔ v3]
 Activity
 14 Sep 11:02  A. Rao (operator)     submitted v2 for review
 14 Sep 10:58  R. Mehta (reviewer)   accepted A-RBI-003 · romanised-acceptable · this campaign
 14 Sep 10:51  system                v2 evaluated · 0 blockers · 1 warning · 1 info · checked 5/5
 14 Sep 10:50  A. Rao (operator)     fixed A-RBI-001 on v1 → created v2 (reschedule)
```

## S-40 Review queue
```
Review queue                                              [Mine] [All]
┌──────────────────────┬─────┬──────────────┬──────────┬──────────┬───────────────┬──────────────┐
│ Campaign             │ Ver │ Submitted by │ When     │ Audience │ Accepted ✖    │ Flags        │
├──────────────────────┼─────┼──────────────┼──────────┼──────────┼───────────────┼──────────────┤
│ Sept EMI reminder    │ v2  │ A. Rao       │ 11:02    │ 12       │ 0             │              │
│ Diwali top-up blast  │ v1  │ P. Singh     │ 09:40    │ 12,400   │ 1 (by admin)  │ NEEDS CO-SIGN│
│ Aug collections wk3  │ v2  │ R. Mehta     │ yest.    │ 340      │ 0             │ YOU AUTHORED │
└──────────────────────┴─────┴──────────────┴──────────┴──────────┴───────────────┴──────────────┘
--- empty: "Nothing waiting for review." ---
```

## S-41 Review (own route, sections first)
```
‹ Review · Sept EMI reminder v2                                          evaluation 7f3a… (as submitted)
┌──────────────── VERSION (read-only) ────────────────┐ ┌──────────────── SIGN-OFF ─────────────────────┐
│ header + summary strip + coverage (as S-20)         │ │ AUDIENCE   12 recipients · 0 dupes · consent 6/2/0/4 │
│ scorecard + finding cards, collapsed, no actions    │ │            (•) Approve  ( ) Reject  note [____]      │
│ ┆                                                   │ │ MESSAGE    1 content finding (A-RBI-003, accepted)   │
│ ┆                                                   │ │            (•) Approve  ( ) Reject  note [____]      │
│ ┆                                                   │ │ RULES      5 checked · 1 accepted exception          │
│ ┆                                                   │ │            (•) Approve  ( ) Reject  note [____]      │
│ ┆                                                   │ │ DELIVERY   WhatsApp · 15 Sep 10:00 IST · template ✓  │
│ ┆                                                   │ │            (•) Approve  ( ) Reject  note [____]      │
│                                                     │ │ ─────────────────────────────────────────────────── │
│                                                     │ │ Notes [_________________________________________]  │
│                                                     │ │ [Reject with notes]        [ Approve version ]     │
└─────────────────────────────────────────────────────┘ └────────────────────────────────────────────────────┘
Variants:
 self-authored:   whole right panel → "You authored this version. A different reviewer must approve it."
 blast radius:    ■ "Audience 12,400 ≥ 10,000 — approver co-sign required." [Request co-sign] → code 482 913 (30 min) → "Co-signed by V. Iyer (approver) 11:20"
 re-evaluated:    ■ "This version was re-evaluated after submission and returned to the operator." [Back]
 not in review:   ℹ "This version is not awaiting review (state: SEALED)." [Open version]
```

## S-42 Co-sign entry (approver)
```
Co-sign a large send
 Enter the 6-digit code shown to the reviewer:  [4][8][2][9][1][3]    [Verify]
 ── after verify ──
 Diwali top-up blast · v1 · 12,400 recipients · submitted by P. Singh · reviewer R. Mehta
 "By co-signing you approve sending to an audience above the 10,000 threshold."
                                                              [Cancel]  [ Co-sign ]
 ── done: "Co-signed. The reviewer can now approve." · expired: "This code has expired; ask the reviewer to request again."
```

## S-50 Evidence list
```
Evidence                                                    [ Verify chain ]  ✓ 17 records, unbroken (11:31)
┌──────┬──────────────────────┬─────┬───────────────┬─────────────────┬────────────┬──────────────┐
│ Seq  │ Campaign             │ Ver │ Sealed by     │ Sealed at       │ Hash       │ Kind         │
├──────┼──────────────────────┼─────┼───────────────┼─────────────────┼────────────┼──────────────┤
│ 0017 │ Sept EMI reminder    │ v2  │ R. Mehta      │ 14 Sep 11:42    │ 8c1e…f2    │ seal         │
│ 0016 │ Aug collections wk2  │ v3  │ R. Mehta      │ 21 Aug 09:10    │ 41d0…9a    │ seal         │
│ 0009 │ —                    │ —   │ K. Nair (adm) │ 02 Aug 18:00    │ c77b…10    │ attestation  │
└──────┴──────────────────────┴─────┴───────────────┴─────────────────┴────────────┴──────────────┘
--- broken: ■ "Chain broken at seq 0012. Sealing is frozen. [Open incident]" ---
```

## S-51 Certificate (document)
```
                     PREFLIGHT EVIDENCE RECORD                                  seq 0017
   Example Finance · Sept EMI reminder · v2 · Sealed 14 Sep 2026 11:42 IST by R. Mehta (reviewer)
   ─────────────────────────────────────────────────────────────────────────────────────
   1. WHAT WAS CHECKED
      Channel WhatsApp · Purpose collections · Segment retail · Scheduled 15 Sep 2026 10:00 IST
      Message  "Dear customer, your EMI of Rs 8,450 is overdue since 28 Aug. …"
      Template body/variables …
   2. WHO IT WAS GOING TO      12 recipients · audience hash 3f9a…c1
   3. RULES APPLIED            india-layer-a 1.3.0 + preflight-hygiene 1.0.0 · rulebook hash 8c1e…
                               evaluated as of 15 Sep 2026 10:00 IST · engine 1.0.2
                               ℹ (only if differs) "Rulebook at sealing: 9a02… — evaluation used 8c1e…"
   4. FINDINGS
      ┌──────────┬──────┬──────────────────────────┬─────────────────────────────┬──────────────────┐
      │ Rule     │ Sev  │ What                     │ Why                         │ Citation · conf  │
      ├──────────┼──────┼──────────────────────────┼─────────────────────────────┼──────────────────┤
      │ A-RBI-003│ warn │ 6 recipients' language   │ Latin script vs stated …    │ RBC 2025 · DERIVED│
      │ A-RBI-005│ info │ no frequency cap         │ RBI sets no number …        │ RBC 2025 · DERIVED│
      └──────────┴──────┴──────────────────────────┴─────────────────────────────┴──────────────────┘
   5. DECISIONS
      A-RBI-003 · accept · romanised-acceptable · "Message is romanised Hindi…" · this campaign · exp 14 Oct · R. Mehta (reviewer) · 14 Sep 10:58
   6. REVIEW                   Audience ✓ · Message ✓ · Rules ✓ · Delivery ✓ · approved · R. Mehta (reviewer) · 14 Sep 11:41
   7. INTEGRITY                prev 41d0…9a  ·  this 8c1e…f2                     [ Verify ✓ ]  ← client-side recompute + server chain
   ─────────────────────────────────────────────────────────────────────────────────────
   This record evidences that a pre-send review was performed and what it found. It does not certify
   compliance and is not legal advice.
                                     [Download JSON]  [Print / PDF]
```
Attestation variant: sections 1–6 replaced by "INCIDENT ATTESTATION — summary — firstBrokenSeq — attested by".

## S-30 Explain
```
‹ Explain · A-RBI-001
 ┌────────┐    ┌───────────┐    ┌──────────────────┐    ┌──────────────────────┐    ┌──────┐
 │FINDING │───▶│ A-RBI-001 │───▶│ Clause (recovery │───▶│ RBI/2022-23/108      │───▶│ RBI  │
 │ 20:15  │    │ 08–19 IST │    │ agents, timing)  │    │ 12 Aug 2022 ● SECOND.│    └──────┘
 └────────┘    └─────┬─────┘    └──────────────────┘    └──────────────────────┘
                     │ evidences
               ┌─────┴──────────────┐  ┌──────────────────────┐
               │ HDFC Bank penalty  │  │ (related: EU ePrivacy│
               │ calling window     │  │  Art.13 · closeMatch)│
               └────────────────────┘  └──────────────────────┘
 ┌ Node ────────────────────────────────────────────────────────────────┐
 │ RBI/2022-23/108 · Outsourcing of Financial Services – Responsibilities │
 │ of REs employing Recovery Agents · ● SECONDARY "primary text not yet   │
 │ verified" · [rbi.org.in ↗]                                             │
 └───────────────────────────────────────────────────────────────────────┘
```

## S-32 Coverage radar
```
Coverage — Example Finance                    10 live · 11 need data · 4 not send-time checks
      TIMING    ████████░░  3/4        "unlocks with: —"
      CONSENT   ███░░░░░░░  2/6        "unlocks with: WATI consent, upload consent column"
      AUDIENCE  ██░░░░░░░░  1/4        "unlocks with: WATI history"
      CONTENT   ████████░░  2/3
      IDENTITY  █████░░░░░  1/2
      DELIVERY  ██░░░░░░░░  1/6        "unlocks with: Meta Graph quality/tier, WATI templates"
   ■ WATI connector degraded (auth failed 09:12) — 4 rules temporarily unevaluable.
                                              [ Connect WATI to unlock 4 more rules ▸ ]
```

## S-33 Shadow mode
```
Shadow mode — "See what past campaigns would have been flagged."   [Upload past campaigns CSV]
 Batch 3 · 8 campaigns · 8 evaluated · 0 pending
 "Of 8 past campaigns, 5 would have been flagged — 2 with blockers."
┌──────────────────────┬────────────┬──────────────────┬───┬───┬──────────────────────────────┐
│ Campaign             │ Sent       │ Evaluated as of  │ ✖ │ ⚠ │ Top finding                  │
├──────────────────────┼────────────┼──────────────────┼───┼───┼──────────────────────────────┤
│ Jul top-up blast     │ 3 Jul 19:50│ 3 Jul 19:50      │ 1 │ 2 │ A-RBI-001 sent at 19:50     │
│ Jun EMI reminders    │ 5 Jun 09:00│ 5 Jun 09:00      │ 0 │ 1 │ A-RBI-003 language          │
└──────────────────────┴────────────┴──────────────────┴───┴───┴──────────────────────────────┘
 Rejected rows (2): row 4 "sentAt not ISO" · row 7 "audienceUploadId not found"
```

## S-70 Settings — business rules (admin)
```
Business rules                                                     rule packs: [india-layer-a ✓] [preflight-hygiene ✓] [generic-commerce  ]
 Lender name            [Example Finance      ]
 Entity type            [Bank ▾]     ℹ "2027 RBI rules are verified for banks; NBFC equivalent unverified (O8)."
 Frequency cap / week   [ 2 ]  ℹ "RBI requires a cap to exist but sets no number."
 Quiet hours            [21:00] – [08:00]  (stricter than statute only)
 Banned phrases         [guaranteed approval] [zero risk] [+]
 Romanised acceptable   [hindi] [marathi] [+]
 Blast-radius threshold [10000]
 Reason codes (extra)   [duplicate-intended] [+]
 Schedule lead (min)    [5]     Exception max days [90]
                                                                     [Save]
 ✓ Saved. ℹ "3 evaluated versions were checked under the previous rules — they show a drift notice."
```

## S-71 Settings — connectors
```
Connectors                                                                          [ + Add connector ]
┌─ WATI ────────────────── ACTIVE ─┐ ┌─ Meta Graph ─────── DEGRADED ─┐ ┌─ CSV presets ───────────┐
│ templates · history · quality    │ │ quality · tier · templates    │ │ 2 mapping presets       │
│ last sync 11:05 · cursor ok      │ │ ■ auth failed 09:12           │ │ [Manage]                │
│ suppress push: [x] opted in      │ │ [Fix credentials] [Sync]      │ │                         │
│ [Sync ▾] [Disable]               │ └───────────────────────────────┘ └─────────────────────────┘
└──────────────────────────────────┘
 Not yet supported — history not available via public API: Gupshup · AiSensy · Interakt · Zoko
--- M-08 add: kind ▾ → credential fields for that kind (write-only) → [Probe] → "ok · capabilities: templates, history" → [Save]
```

## S-62 Admin — chain incident
```
Evidence integrity — FROZEN                        first broken seq 0012 · detected 14 Sep 03:00 (nightly verify)
 "Sealing is paused for this tenant. Approved versions will wait. Do not modify evidence rows."
 Attestation (≥ 20 chars)
 [Restore from backup 13 Sep 22:00 introduced a gap at seq 0012; records 0012–0014 were re-derived … ]
                                                     [ Record attestation and resume sealing ]
```

## Brief blocks (structure only)

- **S-11 Campaign detail:** header (name · mode) · version tabs `v1 v2 v3` → S-20 body · `[+ New version]`.
- **S-24 Affected rows:** S-22 table filtered to the finding, paged.
- **S-25 Diff:** three stacked panels — message inline diff · schedule before→after · audience `+n −m` with sample.
- **S-31 Rulebook browse:** filter row (pack · layer · tier · category) · table (id · title · tier · severity · effective · confidence) · header shows rulebook hash + pack versions · `[View whole graph]`.
- **S-52 Hand-off modal:** target radio (export / webhook / wati:suppress†) · confirm · progress `n/m` · partial: `[Retry 200 failed]`. † hidden unless connector active and opted in.
- **S-72 Users:** table (name · email · roles chips) · `[+ Add]` · inline role editor · guards: "at least one admin", warning "only one reviewer — add a second".
- **S-73 Webhook:** URL · secret (write-only, `[Rotate]`) · deliveries table (event · status · attempts · `[Retry now]`).
- **S-74 Advisory:** two toggles, each with the sentence "Judgement features record both opinions and can only tighten a finding." · provider/model read-only.
- **S-75 API keys:** table (label · user · created · `[Revoke]`) · create → one-time plaintext panel with `[Copy]`.
- **S-60 Audit:** filters (entity · action · actor · dates) · rows expandable to before/after JSON.
- **S-61 Jobs:** table (kind · state · payload summary · retries · error) · `[Retry]`.
- **S-02/S-03:** centered message · requestId · `[Go to Campaigns]`.
- **M-02/M-03/M-04/M-05/M-07/M-09/M-10:** single-purpose forms per `19`; every one ends in *Cancel* / one primary action, and the primary action's label says what it creates ("Create v3", "Record attestation").

## Reading-order and density checks (what drawing settled)

1. Coverage line sits above the tabs, so it is visible on every tab and never scrolls away. ✔ D21 justified.
2. Finding card is ~9 lines collapsed-to-essentials; three cards fit above the fold at 800 px with the scorecard. Blocker cards render first. ✔
3. Review screen: sign-off column is the reading start; version column is reference. Approve is bottom-right, disabled until four radios set. ✔ D22 justified.
4. The as-of control and the "sealing uses scheduled time" note sit on the same line — the one place time-travel could mislead. ✔
5. No screen has a green tick except S-50/S-51 verify. ✔
6. Every disabled primary action carries its reason as visible text or tooltip (blockers outstanding; reviewer-only; self-authored; not in review). ✔
