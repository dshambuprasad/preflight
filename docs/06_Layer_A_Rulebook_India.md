# Layer-A rulebook — India

The substantive asset flagged in `03_Open_Questions.md` ("until this is done, the product is a shape without a spine"). Written 2026-09-05.

**What this is:** actual Indian obligations on outbound commercial messaging, expressed in the rule-object shape agreed earlier, with an honest grade for how much of each is machine-checkable and what data it needs.

**Rule object:** `id · layer · severity · data dependencies · evaluation logic · explanation template · citation`
**Added here:** `tier` (0 = no integration needed) and `checkable` (full / partial / judgement / not-a-send-check).

**Confidence marks:**
`SOURCE: PRIMARY` — traced to the regulator's own text · `SOURCE: SECONDARY` — consistent reporting, primary text not read · `SOURCE: DERIVED` — inferred from an enforcement action rather than a stated clause.

**Standing caveat:** this is a research artifact, not legal advice. The product's job is to surface gaps for human review, never to certify compliance.

---

## Index

| ID | Rule | Tier | Severity | Checkable |
|---|---|---|---|---|
| **A-RBI-001** | Recovery/collection contact only 08:00–19:00 borrower local time | **0** | block | **full** |
| **A-RBI-002** | Microfinance collection contact only 09:00–18:00 | **0** | block | **full** |
| **A-RBI-003** | Communication in the borrower's understood/vernacular language | **0** | warn | **full** |
| **A-RBI-004** | Recovery agent identity sent to borrower before first contact | 1 | block | partial |
| **A-RBI-005** | A contact-frequency cap must exist (RBI sets no number) | **0** | info | **full** (of existence) |
| **A-RBI-006** | Explicit consent before any promotional communication *(1 Jan 2027)* | 0/1 | warn→block | full **if** consent data present |
| **A-RBI-007** | Per-product consent — promotional consent not bundled *(1 Jan 2027)* | 1 | warn→block | partial |
| **A-RBI-008** | Unsubscribe present and as easy as subscribe *(1 Jan 2027)* | **0** | warn→block | **full** |
| **A-RBI-009** | One-year retention of consent + communication records *(1 Jan 2027)* | — | info | not-a-send-check |
| **A-RBI-010** | No dark patterns in consent capture *(1 Jan 2027)* | — | — | not-a-send-check |
| **A-RBI-011** | LSP/agent identity disclosed in the message | **0** | warn | partial |
| **A-IN-001** | Promotional SMS on a registered DLT header + registered template | 1 | block | full (with DLT data) |
| **A-IN-002** | DND/NCPR scrubbing for promotional SMS and voice | 1 | block | full (with DND access) |
| **A-IN-003** | Message correctly classified promotional vs service | **0** | info (gate) | judgement |
| **A-IN-004** | Purpose-bound consent for promotional messages *(13 May 2027)* | 0/1 | warn→block | full if data present |
| **A-IN-005** | Withdrawal honoured across all channels | 1 | block | full if data present |
| **A-IN-006** | Notice at point of consent collection | — | — | not-a-send-check |
| **A-WA-001** | Outside the 24-hour window, only an approved template | 1 | block | full (needs history) |
| **A-WA-002** | Template is APPROVED and in the correct category | 1 | block | full |
| **A-WA-003** | Template variables match the approved template's shape | **0** | block | **full** |
| **A-WA-004** | Audience size within the number's current messaging tier | 1 | warn | full |
| **A-WA-005** | Quality-rating gate before a large marketing send | 1 | warn | full |

**Tier-0 count: 9** (A-RBI-001, -002, -003, -005, -008, -011; A-IN-003; A-WA-003; plus A-RBI-006/A-IN-004 when the audience file carries consent columns).

---

## A-RBI — Lending sector (banks, NBFCs, PBs, HFCs, co-operatives)

### A-RBI-001 · Collection contact window
- **Layer** A (statutory, sector) · **Severity** block · **Tier 0** · **Checkable: full**
- **Obligation:** Recovery/collection contact with borrowers only between **08:00 and 19:00** borrower local time.
- **Data:** scheduled send time · recipient state/timezone · message purpose (`collections`)
- **Logic:** `if purpose == collections and not (08:00 <= local_send_time < 19:00): BLOCK`
- **Explanation:** *"{n} recipients would be contacted at {time} local — outside the 08:00–19:00 window RBI permits for recovery communications. HDFC Bank was penalised for this."*
- **Citation:** **RBI/2022-23/108, DOR.ORG.REC.65/21.04.158/2022-23, 12 Aug 2022** — *Outsourcing of Financial Services – Responsibilities of REs employing Recovery Agents.* Not repealed; footnote-referenced by the Digital Lending Directions 2025. `SOURCE: SECONDARY`
- **✅ Scope confirmed (2026-09-05):** the restriction applies to **every form of contact — phone calls, WhatsApp, SMS and email** — not calls alone. Secondary sources specifically cite an automated message at 22:00 as a chargeable violation. This was the biggest open risk to the rule and it resolved favourably. Still `SOURCE: SECONDARY`; confirm against the circular text.
- **Note:** the strongest rule in the set. Enforced precedent (HDFC), zero data dependencies, unambiguous threshold, and it explicitly covers automated messaging. **This is the demo.**

### A-RBI-002 · Microfinance contact window
- Same shape, narrower: **09:00–18:00** for microfinance borrowers. Severity block · Tier 0 · full. `SOURCE: SECONDARY`
- **Design note:** two windows for two borrower classes means the rule needs a `borrower_segment` field. First place the product needs business context, not just data.

### A-RBI-003 · Vernacular language
- **Layer** A · **Severity** warn · **Tier 0** · **Checkable: full**
- **Obligation:** communications must be in a language the borrower understands.
- **Data:** borrower language preference (or state as proxy) · detected message language
- **Logic:** `detect_language(message) != contact.preferred_language → WARN`
- **Citation:** Fair Practices Code, now in **RBI (NBFC – Responsible Business Conduct) Directions, 2025** (the 28 Nov 2025 rulebook restructure replaced the 2023 Master Direction with 35 topical Directions). Enforcement: **Hero FinCorp penalised for not conveying loan terms in the borrower's vernacular language.** `SOURCE: DERIVED`
- **Note:** language detection is solved and cheap. State-as-proxy is crude and will produce false positives in metros — flag the inference in the finding rather than hiding it.

### A-RBI-004 · Agent identity before first contact
- **Layer** A · **Severity** block · **Tier 1** · **Checkable: partial**
- **Obligation:** the recovery agent's details must be communicated to the borrower **before** the agent first contacts them.
- **Data:** prior communication log per borrower · agent assignment record
- **Logic:** `first_contact_by(agent, borrower) and no prior notification event → BLOCK`
- **Citation:** RBI Digital Lending Directions 2025, **para 8(v)**. `SOURCE: SECONDARY`
- **Note:** a **sequence** rule, so it needs history — subject to the cold-start problem (`05`, §engineering constraint). Cannot be evaluated for any borrower whose history predates integration. Must report "cannot evaluate", never pass.

### A-RBI-005 · A frequency cap must exist
- **Layer** A (obligation) → **Layer C** (the number) · **Severity** info · **Tier 0** · **Checkable: full, of existence only**
- **Obligation:** REs must not "resort to undue harassment, viz., persistently bothering the borrowers at odd hours." **RBI sets no numeric cap.** FACE (the RBI-recognised SRO) recommends firms set their own internal limit.
- **Logic:** `if no frequency cap configured in Layer C → INFO: "no cap set; the obligation exists but the number is yours"`. Once set, evaluate against it (needs history → Tier 1).
- **Citation:** Fair Practices Code / RBC Directions 2025; FACE guidance. `SOURCE: SECONDARY`
- **Note:** **the cleanest illustration of the A→C handoff in the whole rulebook.** The law creates the duty; the business supplies the threshold; the product makes the implicit explicit. Exactly the Layer-C value proposition, and here it is mandated rather than nice-to-have.

### A-RBI-006 · Explicit consent before promotional communication *(effective 1 Jan 2027)*
- **Layer** A · **Severity** warn today → **block** from 1 Jan 2027 · **Tier 0 or 1** · **Checkable: full if consent data present, else "cannot evaluate"**
- **Obligation:** promotional communications only to customers who have explicitly consented. Consent must be specific, informed, unambiguous, and recorded.
- **Data:** per-contact consent record (purpose, timestamp, source) · message classification (from A-IN-003)
- **Logic:** `purpose == promotional and (no consent record or consent.purpose != promotional) → BLOCK`
- **Citation:** **RBI Responsible Business Conduct (Second Amendment) Directions, 2026** — RBI/2026-27/115, DOR.MCS.REC.No.94/01-01-032/…, issued 15 Jun 2026, effective 1 Jan 2027. ⚠️ `SOURCE: SECONDARY` — **primary PDF not read; verify clause text before relying on this.**
- **Note:** the rule the whole tightened thesis rests on. Its severity is date-switched, which means the rule engine needs an `effective_from` field and a notion of "today" — worth building in from the start rather than retrofitting.

### A-RBI-007 · Per-product consent, not bundled *(1 Jan 2027)*
- Severity warn→block · Tier 1 · **partial**. Consent for one product does not extend to another; no pre-ticked boxes.
- **Data:** consent records scoped by product · campaign's product
- **Logic:** `consent.product != campaign.product → BLOCK`
- Same citation and same ⚠️. **Note:** requires the customer's consent store to be product-scoped. Many will not be — which is itself the finding worth surfacing to them.

### A-RBI-008 · Unsubscribe present and symmetric *(1 Jan 2027)*
- **Severity** warn→block · **Tier 0** · **Checkable: full**
- **Obligation:** unsubscribing must be as easy as subscribing; customers must be able to view all subscribed commercial communications via a dedicated link.
- **Logic:** `purpose == promotional and no opt-out affordance in message body → BLOCK`. Presence check on the text — trivially deterministic.
- Same citation, same ⚠️. **Note:** the "as easy as" and "dedicated link" halves are product-design obligations, not message checks. Only the presence half is a send-time rule. Say so; don't overclaim coverage.

### A-RBI-009 · One-year record retention *(1 Jan 2027)*
- **Not a send-time check.** It is the reason the evidence record exists. `SOURCE: SECONDARY`
- **Note:** this is the clause that converts "you should keep a record" from a sales argument into a regulatory requirement. Architecturally: retention ≥ 1 year, immutable, exportable, per-campaign, bound to the approved version.

### A-RBI-010 · No dark patterns in consent capture *(1 Jan 2027)*
- **Not a send-time check** — it governs the bank's own UI (default-yes boxes, forced redirects, pre-selected add-ons, manipulative decline-button text).
- **Listed deliberately** so the boundary is explicit: a meaningful share of the 1 Jan 2027 obligations are consent-UI work inside the lender's app, which a pre-send checker does not touch. Named as a scope risk in `05`.

### A-RBI-011 · LSP / agent identity disclosed in the message
- Severity warn · Tier 0 · **partial** (presence of an identifying string; whether it's the *right* entity needs config). Digital Lending Directions. `SOURCE: SECONDARY`

---

## A-IN — Cross-sector India

### A-IN-001 · DLT header + template registration (SMS)
- **Layer** A · **Severity** block · **Tier 1** · **Checkable: full given DLT data**
- Promotional SMS must go from a registered header using a pre-registered content template. Unregistered messages simply do not deliver.
- **Data:** channel · sender header · template ID · the customer's registered header/template list
- **Enforcement context:** TRAI disconnected **2.1M** connections and blacklisted **100,000+** entities in the past year; **₹150 cr** fined against telcos. `SOURCE: SECONDARY`
- **Note:** the customer's own BSP already enforces most of this at send time. Low product value; included for completeness, and because it explains *why* SMS is the cleanest channel and WhatsApp the messiest.

### A-IN-002 · DND / NCPR scrubbing
- Severity block · Tier 1 · full given DND list access. Numbers on the National Customer Preference Register must not receive promotional SMS or voice.
- **⚠️ Critical scope fact:** **DND and DLT do not apply to WhatsApp.** TRAI has twice explicitly declined to regulate OTT communications (2018 and June 2024). `SOURCE: SECONDARY`
- **Note:** this asymmetry is the single most misunderstood thing in the domain and it is the structural reason nobody has a unified "can we contact this person" record — the regulatory gap creates the data gap.

### A-IN-003 · Promotional vs service classification
- **Severity** info, but it is a **gate**: it decides whether A-IN-001, -002, A-RBI-006, -008 apply at all. **Tier 0** · **Checkable: judgement**
- An EMI reminder is service; a top-up loan offer is promotional; "your EMI is due, and you pre-qualify for ₹2L more" is both, and that is where businesses get caught.
- **Logic:** LLM classification + keyword heuristics, returning a confidence. Below threshold → ask the human. Never silently classify a mixed message as service.
- **Note:** the one place in the core where judgement is unavoidable, and the highest-value place for an LLM in the whole design. Also the highest-risk: misclassify as "service" and every consent rule silently switches off. **Design rule: on low confidence, evaluate under BOTH classifications and report the stricter.**

### A-IN-004 · Purpose-bound consent *(DPDP, 13 May 2027)*
- Severity warn → block from 13 May 2027 · Tier 0/1 · full if consent data present.
- Consent to order/service updates does not extend to promotional messages.
- **Enforcement reality:** Data Protection Board **not seated** as of Jun 2026; **zero penalties ever levied**. `SOURCE: SECONDARY`
- **Note:** for a lender, **A-RBI-006 subsumes this and lands 250 days earlier**. DPDP is the general case; RBI is the sharp one.

### A-IN-005 · Withdrawal propagates across channels
- Severity block · Tier 1 · full if withdrawal events are available. Opting out on SMS must stop WhatsApp and email too.
- **Note:** requires identity resolution across phone/email/WhatsApp ID — the hard problem named in `01_Concept.md`. Honest position for v1: exact-match on phone **or** email, and say so in the coverage statement.

### A-IN-006 · Notice at point of consent collection
- **Not a send-time check.** Listed to keep the boundary honest.

---

## A-WA — WhatsApp platform policy (not law — Meta's rules)

Meta is the only governor of WhatsApp marketing in India (see A-IN-002). These are enforced by an algorithm, immediately, which is why they bite harder than the statutes.

### A-WA-001 · 24-hour session window
- Severity block · Tier 1 · **full, but needs history**. Outside 24h from the customer's last inbound message, only an approved template may be sent.
- **Data:** last inbound message timestamp per contact — **available from WATI and DoubleTick; not publicly documented for Gupshup, AiSensy, Interakt, Zoko; unavailable from Meta Cloud API (no history endpoint).**
- **Note:** cold-start applies. Report "cannot evaluate" for contacts with no known inbound.

### A-WA-002 · Template approved and correctly categorised
- Severity block · Tier 1 · full. Template must be APPROVED, and MARKETING vs UTILITY vs AUTHENTICATION must match actual content — miscategorisation is a common and punished failure.
- **Data:** template list with status/category via BSP or Meta Graph API.

### A-WA-003 · Template variable shape
- **Severity** block · **Tier 0** · **Checkable: full, purely deterministic.** Variable count, ordering and format must match the approved template. Mismatch → the send just fails.
- **Note:** the most boring rule here and possibly the most immediately useful. Catches a real, frequent, self-inflicted failure with a string comparison.

### A-WA-004 · Audience size vs messaging tier
- Severity warn · Tier 1 · full. If the audience exceeds the number's current 24-hour messaging limit (250 / 1k / 10k / 100k / unlimited), part of the send will fail.
- **Data:** `whatsapp_business_manager_messaging_limit` from Meta Graph API · audience count. Pure arithmetic.

### A-WA-005 · Quality-rating gate
- Severity warn · Tier 1 · full. If `quality_rating` is YELLOW or RED, warn before a large marketing blast — sending into a degraded rating accelerates throttling.
- **Data:** `quality_rating` from Meta Graph API (a property of the WABA, obtainable with partner access regardless of BSP); Gupshup's Partner API passes it through at `GET /partner/app/{appId}/ratings`.
- **Note:** block/report rates above ~1–2% can flip a rating within 24 hours. **No provider exposes a block/report event**, so this rating is the only available signal — and it is lagging. Never imply the product can see complaints.

---

## Layers B, C, D — pointers, not yet written

**Layer B (industry claim packs)** — for lending: RBI/SEBI financial-advertising restrictions, no guaranteed-return language, mandatory risk disclosures, APR/KFS disclosure. This is content-checking, i.e. the crowded MLR side. Lower priority than A for this vertical.

**Layer C (business config)** — the frequency cap number (A-RBI-005 *requires* one and RBI declines to specify it), quiet hours beyond statute, banned words, offer floors, suppression lists, per-segment caps.

**Layer D (learned proposals)** — unchanged from `01_Concept.md`: reason codes, expiring scoped exceptions, proposals never silent changes.

---

## What this rulebook establishes

1. **Nine rules evaluate with no integration at all** — including the strongest, most-enforced one (A-RBI-001). A paste-and-check tool is not a toy.
2. **The rule engine needs `effective_from` from day one.** Three rules switch severity on 1 Jan 2027 and two on 13 May 2027. Date-aware severity is core, not a feature.
3. **A-IN-003 is a gate, not a rule**, and misclassifying it silently disables four other rules. It needs the strictest failure mode in the system.
4. **A-RBI-005 proves the Layer-A → Layer-C handoff is real** and legally mandated, not a product invention.
5. **Four items are honestly not send-time checks** (A-RBI-009, -010; A-IN-006; parts of -008). Naming them is what stops the product overclaiming — the discipline `01_Concept.md` §gap-5 committed to.

## To verify before relying on any of this

- ⚠️ **RBI RBC 2nd Amendment clause text** — every 1 Jan 2027 rule is `SOURCE: SECONDARY`. Highest priority.
- RBI/2022-23/108's exact wording and current status after the 28 Nov 2025 rulebook restructure.
- ~~Whether the 08:00–19:00 window covers messages or only calls~~ — **resolved 2026-09-05: it covers all contact forms including WhatsApp, SMS and email.** Confirm against primary text.
- Digital Lending Directions 2025 para 8(v) exact text.
- Whether "borrower local time" is defined anywhere, or whether IST is the operative standard.

---

# Amendment 2026-09-11 — primary text read: RBI/2026-27/115

Shambu retrieved the PDF (`research/sources/RBI_2026-27_115_RBC_Second_Amendment.PDF`, 15 pp). Clause text read directly. Changes to the rules above:

## Scope correction (material)
The notification is **RBI (Commercial Banks – Responsible Business Conduct) Second Amendment Directions, 2026**, issued under s.35A of the Banking Regulation Act. It applies to **commercial banks other than SFBs, Payments Banks, RRBs and LABs.** It does **not** itself cover NBFCs. Secondary reporting's "banks, NBFCs, PBs, HFCs, co-ops" was a claim about a family of parallel notifications; **only the commercial-bank one has been verified.** → New open item O8: confirm the NBFC sibling direction exists and mirrors these clauses. Until then, the 2027 rules are PRIMARY for banks and UNVERIFIED for NBFCs.

## Rule-by-rule
| Rule | Clause | Change |
|---|---|---|
| **A-RBI-006** | **85L** — "send promotional communication / alerts about promotional offers … only if he / she has given explicit consent" | ✅ `SOURCE: PRIMARY`. Confirmed as written. |
| **A-RBI-007** | **85G** — on a single form "each product / service shall be clearly enumerated and the customer shall have the option to choose only the desired product(s)"; **85Q** — "obtain explicit consent for each product / service" | ✅ `PRIMARY`. Per-product consent confirmed. |
| **A-RBI-008** | **85M** — "process for unsubscribing from any kind of services or promotional communication is easy and simple" | ✅ `PRIMARY` for the presence half. **Correction:** the text says *easy and simple*; the secondary claims "as easy as subscribing" and "a dedicated link to view all subscriptions" **do not appear** in this instrument. Removed from the rule's note. |
| **A-RBI-009** | **85G** — "store or preserve consent and related records … till **one year from the date of cessation of the contractual agreement**" | ⚠️ **Correction:** retention is not a flat one year — it is one year *after the contract ends*, i.e. contract life + 1 year. Longer than reported. `PRIMARY`. |
| **A-RBI-010** | **4(10.1A)** dark-pattern definition; **85I** — "default choice for the customer to give consent shall be 'No'"; Annex IIA lists 13 dark patterns incl. *"false urgency"*, *"basket sneaking"*, *"nagging"* | ✅ `PRIMARY`. Still not a send-time check. |
| **A-RBI-012** | **85N(4)** — "make **telephonic contacts and / or visits** to customers normally between 09:00 hours and 19:00 hours" | ⚠️ **Correction:** this is a **calls-and-visits** window for employees/DSAs, **not a messaging window.** Secondary reporting overstated it. Rule re-scoped to `channel ∈ {voice, visit}` — inert for WhatsApp/SMS/email in v1. Demo step 5 now flips **two** warnings to blockers, not three. |
| **A-RBI-003** | **85R** — sale documents "also available in the language of the region or in a language understood by the customer" | Adds a `PRIMARY` bank-side basis for the vernacular obligation (documents; messaging by extension). |
| **A-RBI-011** | **85N(3)** — agents "send any communication to the customer only in the mode and format approved by the bank"; **85O** — no misrepresentation of organisation name | Adds `PRIMARY` basis for approved-template and sender-identity checks on DSA communications. |
| **A-IN-001/002** | **85ZA(1)** — banks must also comply with DoT/TRAI TCCCPR 2018 | Explicit statutory bridge from RBI to the DLT/DND regime. `PRIMARY`. |
| *(new, Tier 1)* **A-RBI-013** | **85N(7)** — agents must pass customers' "Do Not Disturb for promotional communication" requests to the bank | A bank-internal promotional-DND list must exist and be honoured; checkable once `consent_records` carries `denied` for `promotional`. Add to pack in M1. |

## Net effect on the build
- 2027 rules: **PRIMARY for commercial banks.** Amber chip stays until O8 (NBFC sibling) is resolved.
- `spec/01 §5` step 5 and `spec/10` M2 "done when": three → **two** blockers after time-travel on the promotional sample.
- Retention default in `spec/12 F7` stays ≥ 7y (already exceeds contract + 1y).
