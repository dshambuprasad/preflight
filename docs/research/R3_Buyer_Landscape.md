# R3 — Buyer Landscape: Who Runs Marketing Campaigns in India, at What Scale, With What Tooling

**Status:** Exploration only. This document maps the terrain with the numbers and evidence available in a time-boxed search pass. It does **not** render a verdict on market size, addressable segment, or product direction. Every claim is labeled `[fact]`, `[inference]`, or `[hypothesis]`; unresolved items are marked `COULD NOT ESTABLISH`.

**Methodology note (read before using any number below):** Most figures were retrieved via web search snippets and secondary aggregator sites (vendor blogs, market-research press pages, news summaries) rather than by opening and verifying primary source documents (TRAI orders, RBI circulars, IRDAI annual reports, Meta's own disclosures) line by line. Where a number traces to a primary regulator/company source, that is noted. Where it traces only to a vendor blog or SEO content farm restating an unnamed "report," that is flagged explicitly — these should be treated as directional, not citable in a deck without independent verification. Market-size estimates for the same metric frequently disagree by 3-10x across sources, which is itself a data point about how immature/uncertain sizing of this space is.

---

## 1. Numbers table

| Metric | Value | Source | Date |
|---|---|---|---|
| WhatsApp active users, India | ~500-535 million | Multiple vendor blogs (Hyperleap, AiSensy) citing Meta-adjacent figures; not a direct Meta citation | 2025-2026 |
| Indian SMEs (total) | ~65 million | Meta + Bain & Company joint report | May 2024 |
| Indian SMEs selling online | ~5 million (of the 65M above) | Meta + Bain & Company joint report | May 2024 |
| WhatsApp Business API BSP scale example (single vendor, global) | AiSensy: 210,000+ businesses across 68+ countries | AiSensy company blog (vendor self-report, not India-specific, not independently verified) | 2026 |
| India martech market size | USD 30.1 billion (2025), projected USD 186.2 billion by 2033, 25.5% CAGR | Grand View Research horizon page | 2025 |
| India CPaaS market size | Three divergent estimates: $1.03B, $1.12B, and $1.40B for 2025 (same year, different firms) | Mordor Intelligence / TechSci / Expert Market Research | 2025 |
| India marketing automation software market | ~$0.38B by 2026; ~$948M by 2035 (6.9% CAGR 2025-2035) | Market Research Future | 2025 |
| India digital ad spend | Divergent: $4.2B (2025)/$5B (2026) in USD; ₹71,621 crore (2025, +19% YoY) to ₹98,034 crore (2027) in INR; Madison's 2026 report puts the "expanded" digital universe (incl. MSME + quick commerce) above ₹1 lakh crore | Sensortower / Madison World / Statista (conflicting methodologies) | 2025-2026 |
| Indian marketers using AI (NOT the same as "marketing automation adoption" — see caveat below) | 81% of India marketing decision-makers report AI adoption; 92% say customers expect two-way conversation; 71% say they lack full customer context/data despite AI adoption | Salesforce "State of Marketing," 10th edition, India cut (n=250 of 4,450 global respondents) | Survey fielded Oct-Nov 2025, published July 2026 |
| Gartner martech stack utilization (global, not India-specific) | Marketers use 33% of their martech stack's capability (down from 42% in 2022, 58% in 2020); only 49% of tools are actively used; 15% of orgs are "high performers" | Gartner Marketing Technology Survey, cited by CMSWire/MarTech.org/Chief Marketer | 2023-2024 survey wave |
| TRAI: complaints against unregistered telemarketers, H1 2024 | 0.79 million (7.9 lakh) | TRAI, cited by Medianama | 2024 |
| TRAI: connections/resources disconnected after Aug 2024 direction | 2.75+ lakh SIP DID/mobile numbers disconnected; 50+ entities blacklisted (initial wave); later reporting cites 18.8 lakh spammer connections disconnected and 1,150+ entities blacklisted by Sept 2024 | TRAI press releases, cited by Storyboard18/Medianama/Tribune | Aug-Sept 2024 |
| TRAI penalty on telecom operators for failing to curb spam | ₹150 crore, covering 2020-2023 (currently under legal challenge by telcos) | Business Standard, Tribune, Millennium Post | Reported Jan 2026 |
| TCCCPR fine escalation for unregistered senders | Access providers: ₹2 lakh (1st)/₹5 lakh (2nd)/₹10 lakh (subsequent) violations; telemarketers: ₹25,000 (1st) up to ₹2.5 lakh (6th) + blacklist | TRAI regulation summaries (secondary) | 2018 regulation, various updates |
| TRAI DLT registered Principal Entities (total count) | **COULD NOT ESTABLISH** — no source found with a current aggregate figure | — | — |
| Digital marketing agencies in India (headcount of firms) | Divergent: "10,000+" (broad claim, unsourced methodology) vs. 3,257 (one directory's listing count) vs. AAAI ~100+ member agencies representing ~80% of ad spend placed | PWSkills / TechBehemoths / AAAI | 2025-2026 |
| India GCC (Global Capability Centre) scale, all sectors | 2,117 GCCs across 3,728 units, 2.36 million employees, $98.4B revenue | Industry reports cited by Storyboard18 | FY26/March 2026 |
| India advertising/marketing GCC headcount (examples) | Omnicom: 7,000+ India employees across media/tech/healthcare/marketing ops; WPP Global Delivery Centre: 10,000+ professionals (vs. an original 4,000 target) | Storyboard18/Exchange4media reporting | 2025-2026 |
| HDFC Bank Adobe Campaign deployment | Serves ~37 million customers; described as "one of the biggest implementations of Adobe Campaign globally," spanning email, SMS, social, and mobile app channels | Adobe/PRNewswire press release, DQIndia | Legacy deal, still referenced |
| Campaign Analyst salary, India | Average ₹6.18L/yr (25th pct ₹4.62L, 75th pct ₹8.42L, 90th pct ₹12.5L) | Glassdoor India | 2025-2026 |
| Campaign Management Analyst salary, India | Average ₹8.25L/yr (25th-75th pct: ₹7.35L-₹9.39L) | Glassdoor India | 2025-2026 |
| IRDAI mis-selling complaints, FY25 | 26,667 complaints, +14% YoY | IRDAI data cited by industry commentary | FY 2024-25 (Apr 2024-Mar 2025) |
| RBI aggregate FPC (Fair Practices Code) penalties on NBFCs for collections violations | ₹48 crore, FY 2024-25; individual penalties ₹5 lakh-₹2 crore per instance | RBI enforcement data cited by industry analysis (iTuring.ai) | FY 2024-25 |
| Bajaj Finance recovery-agent-harassment fine | ₹2.5 crore | Cited in RBI digital lending commentary | Undated within FY24-25 window |
| ASCI complaints, FY25 | 9,599 complaints processed; 7,199 ads scrutinized; education sector the single most non-compliant category | ASCI Annual Complaints Report 2024-25 (primary document exists; not opened directly, cited via search summary) | Apr 2024-Mar 2025 |
| CCPA action on coaching/edtech ads, 2024 | 45 notices; ₹61.6 lakh cumulative penalty across 19 institutes | News aggregation of CCPA action | 2024 |
| Vision IAS penalty | ₹11 lakh for repeat offence; underlying claim was that only 3 of 119 showcased "toppers" had actually enrolled in the flagship course | News coverage | December 2025 |
| DPDP Act maximum penalty | Up to ₹250 crore per instance for significant violations (data fiduciary obligations, including invalid consent for marketing use of data collected for another purpose) | DPDP Act 2023, cited via compliance-vendor explainers (not the Act text itself) | Act in force; DPB now operational per these sources |

---

## 2. THE KEY HYPOTHESIS — "big enough to have real risk, but still runs it manually"

**This is a `[hypothesis]` under test, not a conclusion.** The evidence below is suggestive, not dispositive — it comes largely from job-description language, vendor case-study framing (which has an incentive to make the "before" state look manual and painful), and general martech-underutilization stats that are not India-specific. Treat accordingly.

### 2.1 Job description language — what campaign/marketing-ops analysts in India actually do

Multiple current Indian job postings for "Campaign Management Analyst" / "Campaign Analyst" roles (Accenture, Media.net, and others, aggregated via Glassdoor/LinkedIn/Naukri listings) describe day-to-day work in explicitly manual, human-in-the-loop terms `[fact — direct JD language, sourced via search snippets rather than a verified primary posting screenshot]`:

- "Assisting in building audience segments based on business rules, customer behavior, demographic attributes, and campaign requirements"
- "Validating audience counts, suppression lists, exclusions, and targeting criteria before campaign deployment"
- "Supporting implementation of segmentation and personalization requirements, and performing data quality checks to identify missing data, duplicates, inconsistencies, and audience-related issues"
- "Setting up, monitoring, and optimizing digital ad campaigns across various platforms, and ensuring proper targeting, scheduling, and creative deployment"
- From adjacent campaign-analyst postings: "Conduct QA on creative assets, tags, and campaign setups to ensure accuracy" and "pull and analyze reports to track delivery and performance against KPIs"; one listing frames the role as "taking ownership of data scrubbing in excel"

Required-skills language repeatedly asks for: "strong understanding of campaign lifecycle, audience selection, segmentation, suppression, and customer contact strategies," the "ability to investigate data issues, perform root cause analysis, validate outputs," and (separately) "proficiency in Excel (pivot tables, formulas)."

`[inference]` Read together, this is a role defined around manual validation and QA of segmentation/suppression logic that a properly-utilized enterprise platform (Unica, Adobe Campaign, Salesforce Marketing Cloud) is nominally supposed to automate. The JD language suggests these Indian analyst seats exist specifically to catch what the platform doesn't catch — i.e., humans doing pre-send verification, not platform-driven verification. This is consistent with, but does not prove, the "big but manual" hypothesis; it's equally consistent with normal QA staffing that any org (small or large, well-tooled or not) would run.

I could not find a single job posting or case study that explicitly states "we own Unica/SFMC/Adobe but do X manually" in those words — that specific smoking-gun framing was not located in this pass. `COULD NOT ESTABLISH` a direct first-person admission from an Indian enterprise of this exact pattern.

### 2.2 Martech shelfware / underutilization

The clearest quantitative evidence for "big but manual" comes from Gartner's global martech utilization survey, not from India-specific data `[fact, but explicitly NOT India-localized — applying it to India is [inference]]`:

- Marketers report using only **33%** of their martech stack's capability, down from 42% in 2022 and 58% in 2020 (a declining trend, not an improving one)
- Only 49% of licensed tools are "actively used" at all
- Only 15% of organizations qualify as "high performers" in stack utilization
- Estimated cost of underutilization for a $250M-revenue company: up to $4 million/year

`[inference]` If this pattern holds in India (no India-specific replication of this survey was found), it implies that enterprises which have already bought Unica/Adobe/SFMC licenses are, structurally, likely to be running the bulk of planning/segmentation/QA work outside the platform's automated capability — which is exactly the "big but manual" pattern, but this is an extrapolation from a global stat, not a direct finding about Indian buyers. `COULD NOT ESTABLISH` an India-specific martech-utilization percentage.

### 2.3 GCC and IT-services evidence (mixed relevance)

- India's advertising/marketing GCC sector is large and growing: Omnicom has 7,000+ India employees spanning media, tech, healthcare, and marketing operations; WPP's Global Delivery Centre has exceeded 10,000 professionals against an original 4,000 target `[fact]`. Coverage frames the evolution as GCCs moving "from being execution arms running campaign operations to teams owning product roadmaps for identity resolution, clean rooms, and programmatic bidding logic" `[fact, quoting industry press framing]` — implying that campaign-operations execution (the manual layer) is/was the historical baseline function of these centres before the shift toward higher-value engineering work now being reported.
- A Wipro case study describes building a "Digital Marketing & Media Factory" to localize campaigns across global teams, using "unified governance models" and "process automation to reduce time to website" `[fact]` — vague on baseline manual-effort quantification; does not give a before/after percentage specific to campaign planning or QA.
- Genpact case studies show 90-96% manual-effort reduction from automation, but in adjacent domains (competitive intelligence "golden record," background-check processing) — not campaign operations specifically `[fact, but not directly on-topic]`. Cited here only as evidence that BPO/GCC providers routinely find extremely high manual-effort baselines (90%+) in comparable back-office analyst work; extending this to campaign ops specifically is `[inference]`.

**Net assessment on Section 2:** the hypothesis is plausible and consistent with available JD language and global martech-utilization data, but this pass did **not** find a named Indian enterprise (bank, telco, insurer, retailer) publicly stating "we own [Platform X] and still do segmentation/QA/reporting manually." That would need either (a) primary interviews, (b) a deeper dive into IT-services (Wipro/TCS/Infosys/HCL) case-study libraries with named clients, or (c) analyst reports (Gartner/Forrester India-specific, likely paywalled) not accessed in this pass.

---

## 3. Agencies and BSPs as risk-carriers

- **Digital marketing agency count in India**: estimates range wildly — "10,000+" (broad, unsourced methodology) down to a 3,257-listing directory count, with the Advertising Agencies Association of India (AAAI) having only ~100+ member agencies but claiming those members place ~80% of the country's ad spend `[fact, divergent estimates — treat headline "10,000+" as low-confidence]`. This implies a long tail of small/unregistered shops plus a concentrated core of ~100 agencies handling the bulk of spend.
- **Agency contractual liability**: Search turned up US/FTC framing (brand is liable even when an agency sends the message; the client as "data controller" carries primary liability, but the agency as "processor" can face consequences for breach of contract) rather than India-specific case law or contract-clause data `[fact — non-India source, applied as an analogous framework, not a confirmed India finding]`. `COULD NOT ESTABLISH` India-specific evidence on standard agency-liability clauses or documented cases of an agency being sued/penalized for a client's compliance failure.
- **BSP penalties from Meta**: Meta/WhatsApp's stated enforcement model is escalating message-sending restrictions on the *business account* found sending spam — 1-3 day blocks, 5-7 day blocks, then permanent bans (reversible only via appeal) `[fact]`. Businesses must use an authorized BSP; unofficial API use "may lead to restrictions, permanent bans, or even legal action" `[fact]`. However, I could **not find public evidence of Meta penalizing a BSP itself** (as opposed to the end-business account) for its customers' spam — this remains `COULD NOT ESTABLISH`. The mechanism as documented targets the sending business's WhatsApp Business Account, not the BSP's platform access, though BSPs do carry reputational/commercial risk if their client base gets banned en masse (an `[inference]`, not directly evidenced here).
- **Agency margins and tooling appetite**: `COULD NOT ESTABLISH`. No data found in this pass on typical Indian performance-marketing agency margins or willingness-to-pay for compliance/QA tooling.

---

## 4. Marketing-ops labour picture

| Role | Avg. annual salary (India) | Range | Source |
|---|---|---|---|
| Campaign Analyst | ₹6.18L | ₹4.62L (25th pct) - ₹12.5L (90th pct) | Glassdoor India |
| Campaign Management Analyst | ₹8.25L | ₹7.35L - ₹9.39L (25th-75th) | Glassdoor India |
| Business Analyst, Campaign Management | ₹7.38L | — | Glassdoor India |

`[fact]` These are junior-to-mid analyst bands (roughly $7,500-$15,000/year), consistent with the profile of GCC/BPO-style execution seats rather than strategic marketing roles.

`COULD NOT ESTABLISH`: typical team sizes for campaign-ops functions at large Indian enterprises, or a quantified split of analyst time between manual QA vs. other work. The JD quotes in Section 2.1 are the best available proxy — they show QA/validation/segmentation-support as a named, recurring job function, but no source quantified "X% of time spent on manual QA."

---

## 5. Sectors with sharpest exposure

**Insurance** — regulated and already being penalized on communications:
- IRDAI recorded 26,667 mis-selling complaints in FY25, up 14% YoY `[fact]`
- Policybazaar was penalized (reported as ₹24 lakh in one source) for SMS violations tied to duration of circulation `[fact, single source]`
- IRDAI issued a ₹1 crore penalty for disguised commissions booked as "advertising spend" `[fact]`
- Framework distinguishes solicited (customer-initiated) vs. unsolicited commercial communication for NCPR/NDNC purposes — meaning insurers must track consent state per contact, a segmentation/data problem `[fact]`

**NBFC / lending** — regulated and penalized, with 2025 rules tightening further:
- RBI's Digital Lending Directions (May 8, 2025) extended regulatory scope from loan origination through to recovery `[fact]`
- Aggregate FPC penalties on NBFCs: ₹48 crore in FY 2024-25 alone; per-instance penalties ₹5 lakh-₹2 crore `[fact]`
- Bajaj Finance fined ₹2.5 crore specifically for recovery-agent-harassment violations `[fact]`
- New rules restrict collection communications (calls, SMS, digital messages, including AI-initiated) to 8am-7pm local time, and make the NBFC/bank fully responsible for third-party Loan Service Provider (LSP) conduct — meaning campaign/communication timing and vendor-chain tracking becomes a direct compliance surface `[fact]`

**Edtech/coaching** — the single most-penalized advertising category in India by volume:
- ASCI: 9,599 complaints processed, 7,199 ads scrutinized in FY25; education named the most non-compliant category, topping violation charts `[fact]`
- CCPA: 45 notices, ₹61.6 lakh cumulative penalty across 19 institutes in 2024 `[fact]`
- Vision IAS: ₹11 lakh penalty (Dec 2025) for a repeat offence; underlying claim was that only 3 of 119 advertised "toppers" had actually enrolled in the flagship course being advertised `[fact]` — a segmentation/claims-substantiation failure, not a channel-compliance failure, but relevant to the broader "marketing claims get made faster than they get verified" pattern
- 45% of flagged ads were voluntarily withdrawn after ASCI intervention `[fact]`

**Healthcare/diagnostics** — regulatory exposure is emerging (DPDP) rather than established via penalty history in this search pass:
- DPDP Act requires separate, explicit consent for marketing use of data collected for a different (e.g., clinical/diagnostic) purpose; secondary use of patient data for marketing without fresh consent is a named compliance risk `[fact, per compliance-vendor explainers — not verified against the Act text or a DPB enforcement action directly]`
- Maximum penalty under DPDP: ₹250 crore per instance for serious violations `[fact — statutory ceiling, not a realized penalty against a healthcare/diagnostics company found in this pass]`
- `COULD NOT ESTABLISH` any specific diagnostics/healthcare company already penalized for marketing-related data misuse in India — this sector's exposure looks prospective/regulatory-design-stage rather than already-enforced, based on what this pass found.

**D2C** — compliance obligations are clearly stated by vendors/compliance blogs but enforcement evidence is thin:
- DPDP requires marketing consent to be separately captured from service/support consent (a customer messaging for support has not thereby consented to promotional broadcasts) `[fact, per compliance-vendor sources]`
- ASCI Code, Consumer Protection Act, FSSAI (food), and Drugs & Cosmetics Act (beauty/skincare) claims rules all apply to D2C marketing claims `[fact]`
- `COULD NOT ESTABLISH` a named D2C brand penalty case for WhatsApp/SMS spam or DPDP marketing-consent violations in this pass — likely because DPDP enforcement is still early-stage.

---

## Summary of "COULD NOT ESTABLISH" items (explicit gaps)

- Exact current count of TRAI DLT-registered Principal Entities (the requested proxy for "businesses that send bulk messages") — no aggregate figure found.
- India-specific martech utilization percentage (only global Gartner data found).
- A named large Indian enterprise publicly stating it owns an enterprise execution platform but runs planning/segmentation/QA manually, in those terms.
- India-specific data on agency contractual liability clauses or a documented case of an agency being penalized for a client's compliance failure.
- Public evidence of Meta restricting/penalizing a BSP's platform access (as distinct from an individual business account) due to customer spam.
- Agency margins and willingness-to-pay for compliance/QA tooling.
- Quantified team sizes or time-allocation-to-manual-QA data for Indian campaign-ops functions.
- Any realized (non-prospective) healthcare/diagnostics or D2C penalty case tied specifically to marketing-communications misuse in India.
- A reliable, single-source figure for "number of businesses on WhatsApp Business API via BSPs in India" (only global/vendor-specific numbers found, e.g., AiSensy's 210,000+ across 68+ countries, not India-isolated).

---

*Compiled via a time-boxed web research pass (~26 queries). No primary regulatory documents (TRAI orders, RBI circulars, IRDAI annual report, DPDP Act text, ASCI report PDF) were opened and read in full — all figures trace to search-engine snippets of secondary/vendor sources unless otherwise noted. Recommend verifying any number used in an external-facing document against the primary source before citing.*
