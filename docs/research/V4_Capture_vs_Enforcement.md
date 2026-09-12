# V4 — Capture vs. Enforcement: Does a Pre-Send Compliance Checker Own a Thin Slice of RBI RBC (Second Amendment) Directions 2026?

**Purpose:** Exploration only — test a specific scope worry: that most of the RBI Responsible Business Conduct (Second Amendment) Directions, 2026 (effective 1 Jan 2027) is consent-**capture** work inside the lender's own app/journey (preference centres, no pre-ticked boxes, dark-pattern removal), leaving a pre-send checker with only a thin downstream slice. This is evidence-gathering, not a build/no-build verdict.

**Method:** ~35 web searches/fetches against RBI-adjacent secondary sources (law-firm/company-secretary client alerts, regulatory-intelligence sites, consent-vendor blogs, collections-tech vendor sites) plus one internal cross-reference to prior research (`R2_Vendor_Landscape.md`). The primary source — RBI/2026-27/115, DOR.MCS.REC.No.94/01-01-032/2026-27, and the 16 companion entity-specific notifications — is blocked to direct fetch (confirmed again this round: rbidocs.rbi.org.in and rbi.org.in did not return readable content). All obligation-level detail below is therefore **[fact, via secondary reconstruction]** — two independent secondary sources (a company-secretary/CS-audience regulatory-intelligence site, corplawupdates.in, and a corporate law firm's client note on the NBFC-specific directions, corporateprofessionals.com) independently reproduce the same paragraph numbers, definitions, and structure, which is the strongest corroboration available without the primary PDF. Where only one source exists, or sources conflict, this is flagged. Labels: **[fact]** / **[inference]** / **[hypothesis]**.

---

## 0. What the directions actually are (scope-setting)

**[fact]** On 15 June 2026, RBI issued a package of **17 separate notifications** amending two families of Master Directions — the *Responsible Business Conduct (RBC)* Directions (customer-facing conduct: advertising, marketing, sale, consent, mis-selling) and the *Undertaking of Financial Services* Directions (structural: what agency/referral arrangements an entity may run) — across every category of regulated entity (Commercial Banks, SFBs, Payments Banks, RRBs, UCBs, RCBs, LABs, AIFIs, NBFCs, HFCs) [2][4]. All take effect **1 January 2027** [2][3][4][5].

**[fact]** For NBFCs specifically, the amendment inserts a new **Chapter IIIA** into the principal NBFC-RBC Directions (paragraphs 101A–101Z); for banks, the equivalent block is paragraphs **85A–85ZA** plus **Annex IIA** (11 named dark patterns) [2][3]. The two numbering schemes describe the same obligations under different paragraph labels — one source (corplawupdates.in, reading the Commercial Banks notification) and one source (Corporate Professionals, reading the NBFC notification, citation RBI/2026-27/123 DOR.MCS.REC.No.102/01-01-039/2026-27) independently confirm the same structure and even the same worked example (a mis-sold insurance policy), which is why this report treats the reconstruction as reliable [2][3].

**[fact]** Separately, and running on the **same 1 January 2027 effective date**, RBI has also revised loan-recovery/recovery-agent instructions (draft notifications for RRBs, LABs, UCBs, NBFCs, etc., explicitly titled "...revising instructions relating to recovery of loans and engagement of recovery agents") [1]. A August 2026 Business Standard explainer describes the resulting recovery-specific framework in operational terms: mandatory **call recording with 6-month retention**, an **8 AM–7 PM contact window** for recovery calls/visits/WhatsApp, **prior notice before first field visit**, mandatory **agent ID/authorisation disclosure**, and new **mobile-device-locking limits** (device-financing loans only, essential functions like SOS/incoming calls always available, **1-hour unlock SLA** after dues are cleared with **₹250/hour compensation** for lender-caused delay) [6]. This is a **materially different, narrower rulebook than the marketing/sales-conduct chapter**, and the two are frequently conflated in casual commentary. This report treats them as two separate obligation sets throughout, because they matter differently for a pre-send checker (Section 5).

---

## 1. Obligation classification — four buckets

Reconstructing the ~40 discrete sub-obligations visible across both secondary sources [2][3] and sorting each into (a) consent **CAPTURE** (UI/UX inside the lender's own journey), (b) send-time **ENFORCEMENT** (a check on a specific outbound message/audience before it goes), (c) **RECORD-KEEPING** (retention/audit/proof), (d) **PROCESS/GOVERNANCE** (policy/training/board):

| # | Obligation (bank para / NBFC para) | Bucket | Notes |
|---|---|---|---|
| 1 | Board-approved policy on advertising/marketing/sale, own + TPPS (85A/101A) | Governance | |
| 2 | Additional DSA/DMA policy elements — eligibility, due diligence, training, audit (85B/101A) | Governance | |
| 3 | Public DSA/DMA list on website, updated within 7 days (85C/101C) | Record-keeping | Publication is process; the underlying list is a record |
| 4 | Mandatory DSA/DMA/employee product certifications (85D/101D) | Governance | |
| 5 | On-person ID for DSA/DMA sub-agents / TPPS reps distinguishable from staff (85E/101E) | Governance / physical-world capture | Not digital; out of scope for any software checker |
| 6 | Code of Conduct + signed undertakings + penal clauses (85F/101F) | Governance | |
| 7 | Explicit consent — 4 accepted modes, per-product enumeration (85G/101G) | **Capture** | The in-journey consent UI itself |
| 8 | Consent records retained 1 year post-contract-end (85G/101G) | Record-keeping | |
| 9 | Mandatory pre-consent disclosure of fees/risks/lock-in/exit, KFS/MITC format (85H/101H) | **Capture** | Disclosure-before-consent is a journey step, though a checker *could* verify a KFS/MITC artifact exists before a sale confirmation fires — see Section 1a |
| 10 | Default "No", T&C walkthrough mandatory before consent (85I/101I) | **Capture** | Classic dark-pattern/pre-ticked-box fix — pure in-app UX |
| 11 | No advertising TPPS as own product; role clarity (85J/101J-analog) | Governance / content | Borderline — could be enforced as a content check on ad copy |
| 12 | Ads/promo material must be clear, factual, disclose rate/fees (85K) | **Enforcement-adjacent** | Requires checking the actual creative/copy before it runs — a genuine send-time content check |
| 13 | Promotional comms only with **explicit opt-in** (85L/101L) | **Enforcement** | This is precisely "check the audience has valid consent before the campaign fires" |
| 14 | Easy unsubscribe, no subscription traps (85M/101M) | **Capture** (mechanism) + **Enforcement** (does an unsubscribe request actually suppress the next send) | Split obligation |
| 15 | 10-point sales conduct code: upfront disclosure, approved channel/mode only, **calling hours 09:00–19:00**, privacy, DND-list respect, no unauthorised commitments, no coercion (85N/101N) | **Enforcement** | Several of the 10 points are literally "check before you contact this person" |
| 16 | No false representation as bank employee (85O/101O) | Governance / physical-world | |
| 17 | Suitability & appropriateness assessment before sale (85P/101P) | Governance / **enforcement-adjacent** | The assessment itself is a process; a checker could gate a specific offer/campaign send on "does this segment meet the suitability profile for this product" |
| 18 | Product-specific application forms, per-product digital modules (85Q/101Q) | **Capture** | |
| 19 | Regional-language documents (85R/101R) | Capture / content | |
| 20 | Application acknowledgement via message/email within defined channel (85S/101S) | **Enforcement** (it is itself a triggered, rule-bound outbound message) | |
| 21 | Signed T&C delivered securely post-sale (85T/101T) | Record-keeping / delivery | |
| 22 | No mis-selling incentive structures; no TPPS-to-staff commissions (85U/101U) | Governance | |
| 23 | No compulsory bundling; free choice of TPPS provider for risk-mitigant products (85V/101V) | Governance / product design | |
| 24 | No loan-proceeds funding of a purchase without explicit consent (85W/101W) | Capture / transaction control | |
| 25 | Dark-pattern prohibition, UI user-testing + periodic internal audit, 11 named patterns (85X/101X, Annex IIA) | **Capture** (the UI itself) + **Enforcement-adjacent** (an audit function could scan live creatives/flows for the 11 patterns on a schedule or pre-publish) | |
| 26 | 30-day post-sale feedback mechanism, independent of sales, half-yearly report (85Y/101Y) | Governance / Record-keeping | |
| 27 | Mis-selling complaint window + full refund/compensation (85Z/101Z) | Governance | |
| 28 | Cross-regulatory adherence — TCCCPR/DND, SEBI/IRDAI/PFRDA, other RBI outsourcing rules (85ZA) | **Enforcement** | This paragraph explicitly folds "Do Not Call" registry compliance into the RBC framework — a textbook pre-send check |
| 29 | *(Recovery-specific, separate notification)* Call recording, 6-month retention (see §0) | Record-keeping | |
| 30 | *(Recovery-specific)* 8 AM–7 PM contact window, prior notice before first visit | **Enforcement** | |
| 31 | *(Recovery-specific)* Device-lock limits, 1-hour unlock SLA, compensation | **Enforcement** (a runtime gate on lender/agent action) + Record-keeping | |

### Rough weight estimate

Counting each row once (31 rows above, collapsing sub-bullets):

| Bucket | Count | Share |
|---|---|---|
| Consent CAPTURE (pure UI/UX) | ~9 | ~29% |
| Send-time ENFORCEMENT (or enforcement-adjacent) | ~9 | ~29% |
| RECORD-KEEPING | ~6 | ~19% |
| PROCESS/GOVERNANCE | ~10 (some rows double-counted across buckets) | ~29% (rows sum >31 because several are split obligations) |

**[inference]** The scope worry is **half right, not fully right**. Pure in-app consent-capture UX (default-No toggles, per-product consent screens, T&C walkthroughs, application forms) is a real and large bucket — roughly a third of the discrete obligations — and a pre-send checker has no natural claim on it; that work belongs inside the lender's own origination/servicing journeys, which is exactly the ground consent.in/Leegality, Privy/IDfy, and OneTrust are already occupying (Section 2). But **send-time enforcement is not a thin residual** — paragraphs 85L (opt-in before promo comms), 85M (unsubscribe must actually suppress), 85N (calling-hour window, approved-channel-only, DND-list respect, no unauthorised commitments), 85S (rule-bound triggered acknowledgement messages), and 85ZA (TCCCPR/DND cross-reference) are, on their face, checks that must run **against a specific outbound message or call to a specific audience at the moment of send** — which is precisely the pre-send-checker problem statement. Layered on top, the **separate recovery-communication framework** (calling window, agent ID, device-lock SLA) is *entirely* send/contact-time in nature and is new, not yet-commoditised territory (Section 5).

### 1a. What a pre-send checker could plausibly gate, even on "capture" rows

**[hypothesis]** Some capture-bucket rows have an enforcement-shaped shadow: a checker cannot build the KFS/MITC disclosure screen (row 9) or the default-No consent toggle (row 10), but it *could* refuse to let a "sale confirmation" or "policy issued" message fire unless a KFS/MITC artifact ID and a consent-record ID are attached to that customer/product pair — i.e., enforcement as a downstream gate on capture's *output*, not a replacement for capture itself. No vendor evidence found either confirms or rules this pattern out as a marketed feature (see Section 2); it is asserted here as a plausible product shape, not an observed one.

---

## 2. Vendor landscape — capture vs. enforcement

### 2.1 consent.in (Leegality/Consentin) — investigated in depth

**[fact]** consent.in is the DPDP-focused product line of **Leegality**, an Indian document-infrastructure company (e-sign, digital stamping, NeSL, deal collaboration) [5][9]. Its blog on the RBC Second Amendment frames the regulation explicitly as a **consent-capture deadline pull-forward**: "9 Changes to Make Before Jan 1, 2027," structured entirely as a UI/journey checklist — rebuild multi-product forms, default every toggle to "No," lock T&Cs before the consent button activates, split marketing opt-in from product consent, make unsubscribing easy, retain records a year [5]. Nothing in the piece describes checking an outbound campaign or message before it sends; the entire framing is "build this into your consent journeys ... in less than 2 weeks with Consentin" [5]. This is a direct, primary-source confirmation that Consentin's own positioning on this exact regulation is **capture, not enforcement**.

**[fact]** Client evidence: **Union Bank of India** engaged Leegality/Consentin for DPDP compliance (announced July 2026), described as "one of the more significant DPDP compliance rollouts in India's public sector banking space" [14]. **[inference, low confidence]** Revenue/funding figures found (a $5M Series A from IIFL Fintech Fund years ago; a third-party estimate of ~$24M ARR from a data-aggregator site) are not independently verifiable and are flagged as low-confidence secondary figures, not confirmed by Leegality itself [9].

**[fact, third-party corroboration]** An independent competitor blog (Fyno, a communication-orchestration vendor — see 2.4) explicitly lists Leegality/Consentin's gaps as: **"No real-time consent enforcement in campaigns. No CPaaS vendor management. No delivery audit trails,"** describing it as strong on "document infrastructure meets consent management" but not on send-time execution [8]. This is a competitor's characterization (self-interested — Fyno sells the layer it says Consentin lacks) but it is **consistent with Consentin's own blog content having zero mention of pre-send validation**, and it matches the same gap independently found for OneTrust in prior research (`R2_Vendor_Landscape.md`, §Group 5: "OneTrust has no pre-send validation capabilities for marketing campaigns" per a different comparison source) [16]. Two independent vendor-comparison sources, months apart, describing the same structural gap in the same product category, is reasonably strong corroboration that **capture-and-audit vendors as a class do not do send-time enforcement**, not just a one-off claim.

### 2.2 Other Indian/India-serving consent & privacy vendors

| Vendor | Positioning found | Pre-send enforcement? | Source |
|---|---|---|---|
| **Privy by IDfy** | DPDP full-stack (consent, DSAR, PII discovery, cookie governance); BFSI clients incl. Axis Bank (evaluating) | **No** — explicitly named as lacking pre-send validation, alongside Consentin and OneTrust, in the same third-party comparison | [8] |
| **OneTrust** | Global privacy/governance leader, 14,000+ customers, India DPDPA solution page | **No** — "no real-time promotional message blocking," "no India-specific CPaaS integrations," "no TRAI DLT compliance handling" per comparison; independently corroborated in prior research | [8][16] |
| **Securiti** | "Data Command Center" — consent module inside broader data-discovery/PrivacyOps suite; positions RBC as raising the bar alongside DPDP | Not found either way | [12] |
| **OneConsent (Easyrewardz)** | CDP-embedded consent platform (built on Easyrewardz's "Zence" CDP); explicit BFSI vertical page citing "RBI SAR and DPDP-ready audit trails" | **Claims yes** — "real-time API enforcement that validates consent before every outbound campaign," "Enforcement at Source," "Instant enforcement: Opt-out enforced across all channels instantly" | [10] |
| **Tsaaro, Seclore** | No RBC-2026-specific or BFSI-consent-enforcement material found in this search round | Unknown | — |

**[fact]** OneConsent is the one consent-governance vendor found making an explicit, self-described **pre-send enforcement** claim rather than a pure capture/audit claim — but its scope is narrowly **consent-status gating** (does this customer have a valid opt-in for this channel/purpose), delivered because it is architecturally fused to a CDP rather than being a standalone consent ledger [10]. It does not claim to check message content, disclosure completeness, suitability, or dark patterns.

### 2.3 The one vendor that names the enforcement gap directly: Fyno

**[fact]** Fyno, a communication-orchestration/"notification infrastructure" vendor, published a comparison piece in 2026 titled *"Which DPDP Consent Platform Actually Enforces Compliance?"* whose thesis is exactly this report's Section 1a distinction: **"Consent Management Platforms solve governance... consent governance isn't consent enforcement"** [8]. Fyno's pitch is to sit as middleware between a CMP (Privy/Leegality/OneTrust) and 8–12+ CPaaS send vendors (Gupshup, Kaleyra, Twilio, SendGrid, etc.), querying the CMP's consent API **before every send**, blocking non-consented sends, routing by channel-specific consent, and propagating withdrawals in real time — explicitly citing "RBI expects real-time consent validation" as one driver alongside DPDP and TRAI DLT [8]. Its own capability table admits this is **consent-status enforcement only** — "Pre-Send Validation," "Consent Enforcement," "Real-Time Withdrawal," "TRAI DLT Compliance" — not content, disclosure, suitability, or dark-pattern checking [8].

### 2.4 Does anyone sell full-scope RBC send-time enforcement?

**[inference]** No. Across all vendors found — capture-only (Consentin, Privy, OneTrust, Securiti), consent-status-enforcement (Fyno, OneConsent) — **none check the substantive content of an outbound message or campaign against the RBC ruleset**: no vendor was found verifying disclosure completeness (KFS/MITC attached), suitability match for the specific offer, dark-pattern absence in the actual creative, DSA/agent-identity disclosure in the message, bundling-consent status, or the 09:00–19:00 sales-conduct calling window, as a single integrated gate. The market is **split by narrow rule-subset and by channel**: consent-status gating for digital messaging (Fyno/OneConsent), and — in an entirely separate vertical — calling-window/script/DND enforcement for voice-only collections calls (Section 4). **This is the gap a pre-send compliance checker, scoped correctly, could occupy** — but "correctly scoped" means explicitly NOT re-building consent capture (crowded, occupied ground) and instead building the cross-channel, cross-rule content/context gate nobody has assembled yet.

---

## 3. What Indian lenders do today for outbound-communications governance

**[fact]** The baseline process found is narrower and older than RBC 2026: TRAI's DLT (Distributed Ledger Technology) regime requires **Principal Entity registration, sender-header approval, and content-template pre-registration** before any commercial SMS can be sent, with templates checked for match-to-purpose at registration time (typically 24–48 hours turnaround, longer if flagged) [general SMS-compliance sources, corroborated across multiple vendor blogs]. This is a **template-time gate, not a per-send/per-audience gate** — once a template is approved, sends against it are not re-checked message-by-message for RBC-specific things like suitability or disclosure completeness.

**[inference]** Beyond DLT template registration and DND-list scrubbing (also TRAI-driven, not RBC-specific), the evidence found describes **manual, cross-functional sign-off** as the norm: "regulatory compliance involves marketing, customer support, legal, and management, with training provided to marketing teams... and a compliance officer or team to audit messaging practices periodically" — i.e., a periodic/retrospective audit function, not a real-time pre-send gate, is the state of the art described in generic SMS-compliance guidance aimed at Indian businesses.

**[fact]** Job-market evidence: RBI/NBFC compliance roles found on Naukri/LinkedIn cluster around **"RBI Compliance," "Lending Compliance," and "Regulatory Compliance (RBI-NBFC)"** — nodal-point-of-contact-with-regulator, filings/returns, policy drafting — rather than a distinct "marketing/campaign compliance" job family. One example found: an "Assistant Manager/Manager – Lending Compliance" role for RBI compliance across partnered banks/NBFCs covering compliance testing, review, and policy drafting. A separate NBFC brand role ("Chief Manager – Brand Strategy & Communication") covers campaign creation and "brand guideline adherence" for customer-facing collateral — **[inference]** these read as adjacent-but-separate job families (regulatory compliance vs. brand/marketing), with no single found job description combining "pre-send regulatory check" as a named, dedicated function.

**[could not establish]** No RFP/tender specifically for "campaign compliance software" or "communication compliance workflow" was found on GeM or bank procurement pages in this round; the RFPs found (IFCI's compliance-tool tender, Indian Bank's ECL-model tender) are for adjacent categories (legal-support tooling, credit-risk modelling), not outbound-communication pre-send checking specifically. This is genuine absence of evidence, not evidence of absence — bank RFPs are not comprehensively indexed by public search.

---

## 4. Collections-tech incumbent analysis

### 4.1 Credgenics — hard look

**[fact]** Credgenics (legal entity: Analog Legalhub Technology Solutions Pvt. Ltd.) is a full-stack collections platform: digital communications, field-collections app, litigation management, an AI dialer ("DialNext"), a GenAI voicebot ("Swara"), payments, and collections analytics, serving banks/NBFCs/fintechs/ARCs in India and Indonesia [12].

**[fact]** Credgenics' own public marketing on compliance is **general and largely process-language, not architecture-specific**. Its DialNext page states the dialer "ensures regulatory compliance, avoiding repetitive contact with borrowers who've already repaid or resolved the matters" and references "calling guidelines for permitted specific time periods of the day" as an example of what must be complied with — but does not itself describe hard system-level time-zone-aware blocking, a specific DND-scrub cadence, or script-lock/deviation-detection, the way newer entrants do (below) [12]. Its digital-communications page (per search-snippet only, not fetched in full) similarly describes "pre-approved templates and in-built controls designed to align with compliance," again general rather than architecturally specific. **[inference]** This does not mean Credgenics lacks these controls internally — enterprise sales conversations plausibly cover detail that public marketing pages don't — but on the evidence available, **Credgenics markets compliance in noticeably less technical, less falsifiable detail than CarmaOne or Exotel do** (Section 4.2), which is itself informative about how the market currently talks about this feature set.

**[fact]** Credgenics' credentials claims (calling users/month, calls on dialer, minutes talked, compliance-to-industry-standards) are presented as blurred/obscured stat tiles on the public page — the actual numbers were not rendered in the fetched content, so scale claims are **[could not establish]**.

### 4.2 Spocto (a Yubi company)

**[fact]** Spocto X runs "Collect CoLabs," an invite-only industry forum (6th edition, September 2025) co-hosted with **FACE** (RBI-recognised Self-Regulatory Organisation for FinTech), themed "Building Tomorrow's Collections: AI Technology with Compliant Foundations" [13]. Reported outcomes: a call from industry leaders for a **"centralized, regulator-validated repository to ensure consistent interpretation of RBI guidelines across banks, NBFCs, and fintechs"** — i.e., even the incumbents in this space describe RBI-guideline interpretation as **unresolved and inconsistent across the industry**, not a solved/commoditised problem [13]. Spocto is separately described (secondary source, not independently verified) as having "gold standard compliance protocols" that "track borrower interactions, transcribe calls, and flag potential compliance breaches instantly" — this is **detection/flagging language, not blocking/enforcement language** (i.e., it sounds like post-hoc monitoring with alerting, not a pre-send/pre-dial hard gate).

**[inference]** A direct competitor, CarmaOne, published comparison posts titled "CarmaOne vs Spocto: Moving Beyond Basic Big Data to True Autonomous AI Resolution" and "CarmaOne vs Provana (IPACS): Why Enterprise Lenders Are Pivoting Off Legacy Compliance Platforms," explicitly positioning Spocto and Provana as "legacy compliance platforms" it is trying to displace [10]. This is self-interested competitor marketing and should be discounted accordingly, but it is a second, independent signal (alongside Credgenics' vaguer public claims) that **newer, AI-voice-native entrants perceive an opening on the compliance-automation axis specifically against the established collections platforms.**

### 4.3 The newer entrants that DO make hard, specific enforcement claims: CarmaOne and Exotel

**[fact]** CarmaOne (Stride Fintree Pvt. Ltd.) publishes detailed, falsifiable architecture claims for AI-voice collections: **"time-zone-aware hard limits"** on calling hours that make off-window calls "physically impossible" (vs. a self-reported 3–7% violation rate for human call centres, its own comparison figure), **hardcoded banned-phrase lists**, **pre-approved/version-controlled scripts**, **centralized cross-channel contact-frequency tracking** with automatic exclusion once a limit is hit, **TRAI DND API integration for pre-dial scrubbing**, and an **immutable, searchable audit trail** (recording + transcript + compliance-checkpoint log) exportable "within seconds" for an RBI inspection [10].

**[fact]** Exotel (a CPaaS/contact-centre vendor, not collections-specific) published a detailed operational playbook for the same problem, converging on nearly identical controls: **account-level (not just campaign-level) calling-hour enforcement with suppressed-attempt logging**, **caller-ID/number-reputation hygiene**, **continuous (not just campaign-build-time) DND scrubbing**, **locked/non-skippable compliance disclosures inside dynamic scripts**, **right-party verification gates**, and **mandatory human-escalation paths** — explicitly citing RBI digital-lending guidelines, TRAI TCCCPR, and DPDP as the three frameworks its architecture maps to [11]. Exotel separately notes TRAI's calling-hours rule for commercial communications as **8 AM–9 PM**, distinct from the Fair-Practices-Code collections-specific 8 AM–7 PM window CarmaOne cites [11] — a real, sourced discrepancy between adjacent-but-different regulatory windows, discussed further in Section 5.

**[inference]** Both CarmaOne and Exotel are **marketing content, not audited claims** — "100% compliance," "0% violations," and "99.97% compliance rates vs. 87-92% for human agents" are vendor-asserted statistics without a disclosed methodology or independent audit cited. They should be read as **evidence that this feature set is being actively sold and differentiated on in 2026**, not as verified performance data.

### 4.4 FinBox, Lentra

**[could not establish]** No evidence found of either vendor positioning on outbound-communication compliance guardrails specifically. Both appear (per a third-party digital-lending-infrastructure taxonomy) to sit in adjacent layers — credit decisioning, origination, underwriting/BRE — rather than in collections-communications compliance. **[inference]** Absence of evidence is not strong evidence of absence here; both are large enough platforms that a search round focused on other topics could simply have missed relevant pages.

---

## 5. The calling-window question in practice — solved, or not?

**[fact]** There are **at least two distinct calling-window regimes**, frequently conflated in commentary:

1. **Collections/recovery calls** — RBI's Fair Practices Code has restricted recovery-agent contact hours for years (predating 2026); sources converge on **roughly 8 AM–7 PM**, reinforced and extended by the new 2026 recovery-specific framework (Section 0) with added call-recording, agent-ID, and device-lock rules [1][6].
2. **Sales/marketing/DSA-DMA conduct calls** — the new 2026 RBC amendment's 10-point conduct code sets a *different* window, **09:00–19:00**, for "telephonic contacts and visits" during product marketing/sale (para 85N item 4) [2][3]. TRAI's own TCCCPR commercial-communication window is different again — **8 AM–9 PM** per Exotel's summary [11].

**[inference]** This is genuinely confusing even to specialists — three adjacent-but-different windows (7PM collections cutoff vs. 7PM sales cutoff with a later 9AM start vs. 9PM TRAI cutoff) governing different call *purposes* from the same institution, likely to the same customer. A pre-send/pre-dial checker that only enforces "8-to-7" without distinguishing *why* the contact is happening (collections vs. sales vs. generic commercial) would be **wrong for at least one of the three regimes** — which is itself an argument that this is not a commodity feature a lender can just buy off the shelf and trust blindly; purpose-classification has to be correct first.

**[fact]** Is calling-window enforcement automated in collections platforms today? The evidence is **mixed by vendor tier**:
- **CarmaOne and Exotel** (both post-2025, AI-voice-native) make explicit, detailed, hard-architecture enforcement claims (time-zone-aware system-level blocking, suppressed-attempt logging) [10][11].
- **Credgenics and Spocto** (established incumbents) make **general, non-architectural compliance claims** in public marketing — "ensures regulatory compliance," "gold standard compliance protocols" — without the same level of falsifiable technical detail [12][13].
- Industry forum commentary (Spocto/FACE, September 2025) explicitly calls for **standardising RBI-guideline interpretation across the industry**, which would be an odd ask if calling-window enforcement were already a fully solved, commoditised, uniformly-implemented feature [13].

**[inference]** The most defensible read: **the underlying rule (don't call outside a window) is old and well-known; automatic, hard, system-level enforcement of it — as opposed to policy/training/manual-dialer-configuration — is being marketed as a 2025–2026 differentiator by newer AI-voice entrants, which suggests it was NOT uniformly automated across the incumbent base before now.** Whether Credgenics/Spocto have equivalent hard controls that they simply don't advertise as prominently is **[could not establish]** from public sources.

**[fact]** The **09:00–19:00 sales/marketing calling window** under the new RBC amendment (as distinct from the older collections window) and the **new device-lock/6-month-recording recovery rules** are, on the evidence gathered, **not yet addressed by any vendor found** — CarmaOne and Exotel's marketing is framed entirely around the *collections* window and the *digital lending guidelines*, not the RBC sales-conduct chapter's calling-hour rule or the new device-lock SLA. This is new-enough regulation (finalised June 2026, effective Jan 2027) that vendor marketing catch-up may simply not have happened yet by the time of this research (Sept 2026) — a timing point, not necessarily a durable gap.

---

## 6. Bottom line — answer to the scope worry

**[inference, synthesis of the above]** The worry is **partially correct but overstated**. Pure consent-**capture** UX (per-product consent screens, default-No toggles, T&C walkthroughs, application-form redesign) is a large, real bucket — and it is squarely occupied by consent.in/Leegality, Privy/IDfy, and OneTrust, none of whom claim to do send-time enforcement, with consent.in's own blog on this exact regulation confirming that self-framing directly. But **send-time enforcement is not a thin residual** — by this report's obligation count it is roughly as large a bucket as capture (~29% each of ~31 discrete obligations), and it includes some of the most operationally binding provisions (promotional opt-in gating, calling-hour windows, DND-list respect, unauthorised-commitment prevention, the new recovery-call/device-lock rules).

**No incumbent fully owns this slice yet.** The market has split it into narrow, non-overlapping pieces: consent-*status* gating for digital messaging (Fyno, OneConsent — check if the customer opted in, not whether the message itself is compliant), and calling-window/script/DND enforcement for voice-only *collections* calls specifically (CarmaOne, Exotel — narrowly scoped to one channel and one obligation family, with the established collections incumbents Credgenics and Spocto making comparatively vague, unverifiable claims about the same feature set). Nobody found checks the fuller RBC content stack — disclosure completeness, suitability match, dark-pattern absence in the actual creative, DSA-identity disclosure, the 09:00–19:00 *sales* window specifically, or the new device-lock SLA — as one integrated pre-send gate across channels. That is a real, evidenced gap, not an assumption — but it is a narrower, more channel-and-rule-specific gap than "own the whole downstream slice," and a credible entrant would need to be explicit about *not* re-fighting the crowded consent-capture ground while building the part nobody has assembled.

---

## 7. COULD NOT ESTABLISH

- The primary RBI notification text (RBI/2026-27/115 and companions) — could not be fetched directly; all paragraph-level detail rests on two independently-corroborating secondary reconstructions, not the primary document.
- Whether any of the major law firms (Cyril Amarchand Mangaldas, Khaitan & Co, Trilegal, AZB & Partners, Shardul Amarchand Mangaldas) has published a client alert specifically on the RBC Second Amendment — searches (including site-restricted queries) did not surface one in this round; a Corporate Professionals (a CS/company-secretarial firm, not a Tier-1 law firm) client note was the closest law-firm-style analysis found and is used throughout Section 1.
- Credgenics' and Spocto's actual internal technical architecture for calling-window/DND/script enforcement — public marketing does not describe it in falsifiable detail either way; enterprise sales collateral (brochures behind a "Book a Demo" gate) was not accessible.
- Any RFP/tender explicitly seeking "outbound communication compliance" or "campaign pre-send checking" software from an Indian bank or NBFC.
- A real, quoted job description for a role titled specifically "marketing compliance" or "campaign compliance" at an Indian lender (as opposed to general "RBI/Lending Compliance" or separate "Brand/Marketing" roles) — the two job families found appear organizationally separate, but no single JD combining them was located.
- Consent.in/Leegality's and Privy/IDfy's actual revenue, funding, and customer-count figures — only low-confidence third-party estimates were found, not company-disclosed figures.
- Whether the "09:00–19:00" sales-conduct calling window and the new recovery-specific device-lock/6-month-recording rules have been addressed by any vendor's product roadmap since the June 2026 finalisation — the ~3-month gap between finalisation and this research (Sept 2026) may simply be too short for vendor marketing to have caught up, so absence of evidence here is weaker than the capture/enforcement finding in Section 2.

---

## Sources

[1] TaxGuru — "Revised Draft RBI (Regional Rural Banks – Responsible Business Conduct) Second Amendment Directions, 2026" and sibling draft-directions pages (LABs, UCBs, NBFCs, Payments Banks, Commercial Banks), https://taxguru.in/rbi/ — used for the "recovery of loans and engagement of recovery agents" framing distinct from the marketing-conduct chapter.

[2] CorpLawUpdates.in — "RBI Tightens Rules on Advertising, Marketing and Sale of Financial Products by Regulated Entities," https://www.corplawupdates.in/updates/rbi-tightens-rules-advertising-marketing-sale-financial-products-regulated-entities — primary secondary-source reconstruction of paragraphs 85A–85ZA, Annex IIA, and the 17-notification structure (Commercial Banks lens).

[3] Corporate Professionals — "When a Signature Is Not Consent: Mis-selling, Suitability and the New RBI Responsible Business Conduct Regime for NBFCs," https://www.corporateprofessionals.com/articles/when-a-signature-is-not-consent-mis-selling-suitability-and-the-new-rbi-responsible-business-conduct-regime-for-nbfcs/ — independent reconstruction of paragraphs 101A–101Z (NBFC lens), citing RBI/2026-27/123 DOR.MCS.REC.No.102/01-01-039/2026-27.

[4] C4S Courses — "RBI's Responsible Business Conduct Second Amendment Directions, 2026," https://c4scourses.in/banking-finance/rbis-responsible-business-conduct-second-amendment-directions-2026/ — exam-prep summary, corroborates dates, scope, and the 11-dark-pattern / DSA-DMA-expansion framing; sourced to Business Standard.

[5] Consent.in (Leegality) — "RBI Moved Your DPDP Deadline: 9 Changes to Make Before Jan 1, 2027," https://www.consent.in/blog/rbi-rbc-amendments — primary evidence for Consentin's own capture-only framing of this regulation.

[6] Business Standard — "Recovery calls, agent visits, phone locks: Experts explain RBI's new rules," https://www.business-standard.com/finance/personal-finance/recovery-calls-agent-visits-phone-locks-experts-explain-rbi-s-new-rules-126081001164_1.html (10 Aug 2026) — the separate recovery-specific framework (call recording, 8am-7pm window, device-lock SLA).

[8] Fyno — "Which DPDP Consent Platform Actually Enforces Compliance? (Privy, Leegality, OneTrust comparison)," https://www.fyno.io/blog/dpdp-consent-platform-enforcement-comparison — key source for the capture-vs-enforcement gap across the three named CMPs, and for Fyno's own consent-status-enforcement positioning.

[9] Business Standard (ANI press release) — "Union Bank of India Selects Leegality's Consentin Platform for DPDP Compliance," https://www.business-standard.com/amp/content/press-releases-ani/union-bank-of-india-selects-leegality-s-consentin-platform-for-dpdp-compliance-126071400535_1.html.

[10] CarmaOne — "RBI Compliant AI Collections: The Complete Guide for NBFCs & Banks in India (2026)," https://www.carmaone.ai/blog/rbi-compliant-ai-collections-guide-india-2026 — also referenced its competitor-comparison posts ("CarmaOne vs Spocto," "CarmaOne vs Provana (IPACS)") for competitive framing.

[11] Exotel — "RBI-Compliant AI Call Flow for Debt Collections: Complete Guide," https://exotel.com/blog/rbi-compliant-ai-collections/ — detailed operational compliance-control mapping (RBI digital lending guidelines / TRAI TCCCPR / DPDP three-layer stack).

[12] Credgenics — DialNext dialer product page, https://credgenics.com/dialnext-dialer — the primary evidence for Credgenics' general (non-architectural) public compliance claims.

[13] The Tribune (PTI/NewsVoir) — "Spocto X and FACE Pioneer AI-Driven Compliance Framework for Collections at 6th Collect CoLabs," https://www.tribuneindia.com/news/business/spocto-x-and-face-pioneer-ai-driven-compliance-framework-for-collections-at-6th-collect-colabs-2/ (10 Sep 2025).

[14] (duplicate of [9], Union Bank/Consentin.)

[16] Internal — `R2_Vendor_Landscape.md` (prior research in this project), Group 5 table entry on OneTrust: "OneTrust has no pre-send validation capabilities for marketing campaigns" per a comparison source — cited here as independent corroboration of the same gap Fyno describes months later for the same vendor.

[Search-snippet-only, not independently fetched in full: Privy by IDfy DPDP-for-banks blog and Axis Bank evaluation mention; OneConsent.ai homepage (https://oneconsent.ai/) fetched directly for its enforcement claims; general TRAI-DLT/SMS-compliance vendor blogs used only to corroborate the template-registration baseline in Section 3, not quoted individually as they were interchangeable in content.]
