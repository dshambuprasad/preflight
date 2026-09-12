# R2 — Vendor Landscape: Governance, Consent & Campaign Safety in India Marketing Stacks

**Purpose:** Exploration only — map what currently ships, with sources, so we can answer "these tools already have all this, right?" with evidence rather than assumption. This is NOT a build/no-build verdict.

**Method:** ~29 targeted web searches against vendor docs, help centers, changelogs, pricing pages, Meta's own developer docs, and third-party comparison sources (used only where primary docs were unavailable, and flagged as such). Every cell in the matrix is backed by a numbered source in the References section. Claims are labeled **[fact]** (stated in a primary source — vendor docs/Meta docs/legal terms) or **[inference]** (reasonable conclusion from secondary/aggregator sources, or absence-of-evidence reasoning). Where nothing could be found either way, the cell is marked **Unknown** and the gap is repeated in "COULD NOT ESTABLISH."

Legend: **Yes** = confirmed native feature · **Partial** = exists but limited/adjacent/manual · **No** = confirmed absent or explicitly described as a gap · **Unknown** = no evidence found either way · **N/A** = capability doesn't apply to this product category.

---

## GROUP 1 — India/APAC Engagement Platforms

| Capability | MoEngage | WebEngage | CleverTap | Netcore Cloud |
|---|---|---|---|---|
| Frequency capping / global control | **Yes** — channel-level FC (push/email/in-app/SMS-MMS-RCS), "ignore FC" toggle per flow [1][2] | **Yes** — day/week/month caps, cross-channel [7] | **Yes** — Global Frequency Caps (cross-campaign, per-channel) + message-level caps [12] | **Partial** — role-based access + "campaign approval workflows" referenced on agentic platform page; no dedicated FC doc found [18] |
| Quiet hours (DND) | **Yes** — DND for SMS/MMS/RCS flows (e.g., no sends before 11am/after 8pm ET); discard-or-delay choice [2][3] | **Yes** — per-user, timezone-aware DND windows [7] | **Yes** — DND & cut-off times per campaign/journey, per-user timezone, discard-or-delay [13][14] | Unknown — not found in available docs |
| Consent & preference mgmt (purpose-level) | **Partial** — "Preference Management" landing pages let users pick categories (Newsletter/Promotional/Product recs) and auto-exclude opted-out users from future campaigns; separate "Opt-in Management" for email consent [4][5][6] | Unknown — no preference-center/purpose-level consent doc found (only DND + FC) | Unknown — no preference-center/consent doc found (only DND + FC + approval + audit) | **Partial** — Netcore's own support docs cover DLT "Digital Consent Acquisition" (DCA) FAQs, which is regulatory SMS consent, not a marketing preference center [19] |
| Suppression lists | **Partial/inference** — "automatically exclude users who have opted out... from all future campaigns" implies suppression, but no dedicated "suppression list" doc found [5] | Unknown | Unknown — not explicitly named in docs found | Unknown |
| Campaign approval workflows | **Yes** — maker-checker: creator sends to assigned approvers, approval flow toggle in Members settings [8] | Unknown — not found | **Yes** — dedicated Approver role, Settings > Security > Campaign Approval [9] | **Partial** — "role-based access and campaign approval workflows" mentioned on marketing page; no dedicated doc surfaced [18] |
| Audit trails / evidence export | **Yes** — Audit Logs under Settings > Account [8] | **Partial/inference** — secondary source claims "native audit logging and granular PII masking" for enterprise tier; not confirmed via primary docs [11] | **Yes** — detailed Audit Logs (who/what/when/IP), CSV export, automated export to S3/GCS/Azure Blob for SIEM [15][16] | Unknown |
| Content / claim checking | Unknown — no evidence found | Unknown | Unknown | Unknown |
| DND-DLT scrubbing (India SMS) | **Yes** — messaging-regulations doc references DND compliance for SMS/MMS/RCS [3] | **Yes** — dedicated TRAI/DLT regulations doc [10] | N/A/Unknown — CleverTap is a CDP orchestrating sends via carriers/gateways, not itself a telecom SMS aggregator; no DLT-scrubbing doc found | **Yes** — Netcore's own support folder is dedicated to "DLT - TRAI Regulation," including DCA consent FAQs [17][19] |
| Cross-campaign collision detection | **Partial** — "Minimum delay between campaigns" doc + FC-for-Flows suggests cross-campaign spacing control [1][2] | **Partial** — Queueing feature delays (not blocks) sends once FC/DND is hit, implying cross-campaign awareness [7] | **Yes** — Global (cross-campaign) Frequency Caps are explicitly cross-campaign by design [12] | Unknown |
| Pre-send QA | Unknown — no rendering-preview/spam-check/link-check doc found | Unknown | Unknown | Unknown |
| Enterprise-gated? | **Yes** — Audit logs, RBAC, PII encryption, firewall are Enterprise-tier only per pricing pages; Approval Workflow pitched as "for Large Marketing Teams" [8][20] | **Yes** — Enterprise-tier ("Orchestra," >100k MAU) called out for audit/PII features per secondary source [11] | Likely — Campaign Approval sits under Settings > **Security**, and CleverTap's Enterprise plan is required above 100k MAU [9][21] | Unknown |

---

## GROUP 2 — SME Tools

| Capability | Zoho Campaigns / Marketing Automation | Brevo | Mailchimp | MSG91 | Kaleyra (Tata Comm) |
|---|---|---|---|---|---|
| Frequency capping / global control | **Yes** — "Email frequency policy" (daily/weekly/bi-weekly/monthly limits) [22] | Unknown — no native cross-campaign cap found | **Partial** — Mailchimp's own docs discuss the *concept* of frequency capping alongside Send Time Optimization, but no confirmed native automated cap feature [26] | N/A (SMS/WhatsApp API vendor, not a campaign frequency-cap product) | N/A |
| Quiet hours | Unknown | Unknown | Unknown | Unknown | Unknown |
| Consent & preference mgmt (purpose-level) | **Yes** — "Manage Consent" module tracks explicit/implicit consent per topic; contacts excluded from a campaign if they lack valid consent for that topic; recommends re-consent after 6 months' inactivity [23][24] | **Partial** — GDPR consent logs (timestamp + method) per contact, double opt-in, but this is list/channel-level, not clearly purpose-linked like Zoho's topic model [27][28] | **Partial/inference** — generic regulatory-compliance messaging (CAN-SPAM/GDPR/CASL/CCPA); no purpose-level consent object found [29] | **Partial** — DLT "consent template" registration is a regulatory (TRAI) consent record, not a marketing purpose-level preference [31] | **Partial** — same DLT consent-template mechanism; consent overrides DND once registered [34][35] |
| Suppression lists | **Yes** — dedicated suppression-list concept documented (unsubscribes, invalid/bounced, non-consented) [22][25] | Unknown/Partial — standard unsubscribed/bounced contact handling implied, not confirmed as a named feature | **Yes** — explicit "suppression list" as the do-not-contact master database (unsubscribes, hard bounces, spam complaints, manual exclusions) [26] | N/A | N/A |
| Campaign approval workflows | Unknown — not found | Unknown — not found | Unknown — not found | N/A | N/A |
| Audit trails / evidence export | Unknown — not found for Campaigns specifically | Unknown | Unknown | Unknown | Unknown |
| Content / claim checking | Unknown | Unknown | Unknown | Unknown | Unknown |
| DND-DLT scrubbing (India SMS) | Unknown / likely N/A (Zoho Campaigns is primarily email; SMS via partner gateways) | N/A (EU-centric ESP) | N/A | **Yes** — core product: DND (NCPR) scrubbing + DLT template scrubbing/filtering rules; 2–4 business day template approval on the DLT platform [30][32][33] | **Yes** — consent-scrubbing since Sept 2021; DND overridden only by registered DLT consent; own "Consent Template Registration Process" doc [34][35][36] |
| Cross-campaign collision detection | Unknown | Unknown | Unknown | N/A | N/A |
| Pre-send QA | Unknown | Unknown | Unknown | N/A | N/A |
| Typical customer / pricing note | SME/mid-market, self-serve pricing | SME/mid-market, self-serve pricing, GDPR-first (EU vendor) | SME, self-serve; Send Time Optimization is a **paid add-on** [26] | India SME/mid-market bulk-messaging; per-message pricing | **Could not establish** — no public pricing found; Tata Communications' enterprise scale (300 Fortune 500 customers) is a *parent-company* stat, not confirmed Kaleyra-specific [37] |

---

## GROUP 3 — WhatsApp BSPs in India

| Capability / question | Gupshup | WATI | AiSensy | Interakt | Zoko | DoubleTick |
|---|---|---|---|---|---|---|
| Frequency capping / suppression / DND / approval / audit (as a BSP-native feature) | Unknown — not found; Gupshup is primarily infra/CPaaS, these controls (if any) would sit in its bot-builder layer, not confirmed | Unknown | Unknown | Unknown | Unknown | Unknown |
| Compliance responsibility to Meta | **[fact, applies to all BSPs]** Per Meta's Business Messaging Technology Provider Terms, providers must ensure every customer accepts WhatsApp's ToS, may **not** let customers access the WABA certificate independently, and are **jointly and severally liable** for, and must indemnify Meta for, harm from their customers' acts/omissions [38] | same as above [38] | same [38] | same [38] | same [38] | same [38] |
| Template status exposed to customers | **Yes, at the Meta platform level** — `message_template_status_update` webhook fires on approval/rejection; `template_category_update` fires if Meta reclassifies a template's category post-approval [40][41]. Whether each BSP's own dashboard/API surfaces this cleanly to its own customers: Unknown per-BSP (WATI's docs mention "every template is reviewed and approved" and an AI Template Assistant, implying pass-through, but not confirmed in API form) [43] | pass-through implied [43] | Unknown | Unknown | Unknown | Unknown |
| Quality rating exposed to customers | **Meta itself exposes** a `quality_rating` field (High/Medium/Low, "UNKNOWN" until enough 7-day signal accumulates) at the phone-number level [39][42]. **Could not confirm** that any of the six BSPs surfaces this raw field/value in their own customer-facing dashboard or API — only generic blog mentions that "a low quality rating caps your future send volume," which is a description of the Meta mechanic, not evidence of BSP pass-through | same caveat | same caveat | same caveat | same caveat | same caveat |
| Pricing (own markup + Meta's per-message rate) | ~$0.001 BSP markup + Meta's country rate (₹0.88 marketing / ₹0.125 utility cited, pre-2026 figures) [44] | $59/mo (Growth) or $119/mo (Pro) + ~20% markup on Meta's per-message fee cited by a secondary rate-card analysis [45] | Free / ₹1,500 / ₹3,200 per month + Meta's per-message rate (₹1.09 marketing, ₹0.145 utility/auth, effective Jan 2026) [46][47] | ₹2,799 (Growth) / ₹3,799 (Advanced) / Enterprise-on-request per month, plus per-conversation Meta pass-through (~₹0.97 marketing on Starter) [48] | Flat/no-per-message pricing model cited (Shopify-merchant focus) [48] | ₹3,000 (Starter) / ₹4,200 (Pro) / Custom (Enterprise) per month + 18% GST [48] |
| Typical customer size | Enterprise/high-volume; dominant BSP in India/SEA; positioned for fintech-grade compliance (ISO 27001, SOC 2) [44] | SMB/mid-market | SMB/agencies, D2C lead-gen | D2C brands, SMB-to-mid-market | Shopify SME merchants | SMB sales teams |

**Caveat on Group 3 pricing figures:** most numbers above came from third-party comparison/aggregator blogs (2026 vintage) rather than each vendor's own current pricing page, because vendor pricing pages change frequently and several searches returned aggregator content first. Treat as **[inference, directionally correct but not independently re-verified against each vendor's live pricing page]**.

---

## GROUP 4 — Enterprise Platforms (frequency/contact-policy/governance modules)

| Capability | HCL Unica+ | Salesforce Marketing Cloud | Adobe Journey Optimizer | Braze |
|---|---|---|---|---|
| Frequency capping / global control | **Yes** — described as core to the governance layer: "consent, eligibility, suppression, contact policies, approvals, audit trails, role-based controls" plus a decision-engine capacity/frequency layer; **Unica Optimize** solves "optimal contact strategy... across time, offers, channels and multiple marketing campaigns" — i.e., cross-campaign arbitration [49][50] | **Partial / historically a gap** — SFMC has **no native, out-of-the-box per-subscriber send-frequency limit**; third-party sources explicitly note "management of send frequency is not one of [SFMC's strengths]... no direct possibility to limit number of emails sent to a specific subscriber by default" [52][53]. Salesforce has since added **Communication Capping Rules** in the Data Cloud/C360 Audiences layer, and **Collision Control** (aka saturation control) is a documented pattern, but both typically need custom build-out or a 3rd-party AppExchange tool (e.g., DESelect) [51][53][54] | **Yes** — channel-level and communication-type frequency capping (e.g., Sales vs Promotional), plus **Journey capping** (limit journey entries per profile) and a **Conflict Management & Prioritization** rule-set engine for cross-journey governance [58][59] | **Yes** — global (cross-channel) and channel-specific caps; explicit override toggle to bypass caps for transactional sends [60] |
| Quiet hours | Not directly evidenced in this search round (Unica's "regional preferences" language implies it) [49] | Unknown | Unknown — not found distinctly from frequency capping | Unknown — not found distinctly from frequency/throttling docs |
| Consent & preference mgmt (purpose-level) | **Yes** — explicitly named as part of the governance stack ("consent, eligibility...") [49] | **Partial** — preference centers are described as a best-practice pattern marketing teams build (topics/channels/frequency), not a single out-of-the-box purpose-consent object [53] | Unknown — not found in this search round | **Yes** — Subscription Groups + suppression driven by "opt-downs, category exclusions, or channel preferences captured at subscription" [61] |
| Suppression lists | **Yes** — named explicitly in the governance stack [49] | **Partial/inference** — implied via preference center patterns, not a confirmed single native object | Unknown | **Yes** — explicit, more granular than frequency capping: "removing specific customers from receiving specific messages based on a defined condition" [61] |
| Campaign approval workflows | **Yes** — "approvals" explicitly named in the governance stack [49] | Unknown — not found | Unknown — not found tied to frequency/conflict tooling specifically | Unknown — not found in this search round |
| Audit trails / evidence export | **Yes** — "audit trails" explicitly named [49] | Unknown | Unknown | Unknown — not found in this search round (though Braze is a mature enterprise CDP, so likely exists; not confirmed here) |
| Content / claim checking | Unknown | Unknown | Unknown | Unknown |
| DND-DLT scrubbing | N/A (global platforms, not India-specific telecom compliance layers) | N/A | N/A | N/A |
| Cross-campaign collision detection | **Yes** — Unica Optimize is purpose-built for this (arbitrating which campaign "wins" a contact across multiple concurrent campaigns) [50] | **Yes, named "Collision Control"** — a well-documented SFMC admin pattern, though implementation-heavy [51] | **Yes** — Conflict Management & Prioritization module [59] | **Yes** — global frequency caps function as de facto collision control across simultaneous campaigns [60] |
| Pre-send QA | Unknown | Unknown | Unknown | Unknown |

---

## GROUP 5 — Adjacent Categories

### Consent Management Platforms (general + India/DPDP-specific)

| Vendor | Consent lifecycle (collection/withdrawal/logs) | Pre-send campaign enforcement (hooks into ESP/BSP send pipeline) | India DPDP-specific | Notes |
|---|---|---|---|---|
| OneTrust | **Yes** — dedicated India DPDPA solution page; automates consent + Data Principal rights + governance workflows; 14,000+ global customers [62] | **No, per a comparison source** — "OneTrust has no pre-send validation capabilities for marketing campaigns," described as a real gap requiring separate integration with a comms/orchestration layer [63]. *Source is a competitor-adjacent comparison blog — treat as [inference], directionally plausible but not independently confirmed on OneTrust's own docs* | Partial — global platform retrofitted for DPDPA, not India-native | Enterprise-priced; likely overkill/expensive for India-only companies per same source [63] |
| Securiti | **Yes** — consent management is one module inside a broader "Data Command Center" (also does data discovery, PrivacyOps, DSR automation) [64] | Unknown — not found | Partial — global platform with DPDPA-specific configuration; some reports say India-specific configuration needs more manual customization than India-native tools [64] | |
| India-native DPDP startups (ConsentiQo/KavachOne, Concur, TruConsent, Consently.in, Digital Anumati, OneConsent, etc.) | **Yes** — this is their core product: consent banners, purpose-linked consent ledgers, multilingual support, withdrawal workflows [65][66][67] | **Unknown / likely No** — nothing found describing integration into an ESP/WhatsApp-BSP send pipeline to auto-suppress non-consented contacts at send time; these appear scoped to the consent *record*, not campaign *execution* | **Yes**, this is their whole reason to exist | Regulatory context: DPDP's own statutory "Consent Manager" registration (a formal intermediary role, distinct from these vendor products) opens for registration with the Data Protection Board from **14 November 2026**; requires ₹2 crore minimum net worth, and a Consent Manager cannot simultaneously act as a data fiduciary/processor for the same individual [68] |

### Financial-Services Marketing-Compliance Vendors — do they do pre-send campaign checks?

| Vendor | Pre-send content/claim checking | Scope | Notes |
|---|---|---|---|
| **Saifr** | **Yes — this is its core product.** SaifrReview/SaifrScan use NLP to flag promissory, exaggerated, unwarranted, or misleading language against FINRA 2210, SEC Modernized Marketing Rule, SEC 482; offers a pre-publish MS Word add-in; partnered with Microsoft (Nov 2024) to put 4 compliance models incl. "Retail Marketing Compliance" into Azure AI's model catalog [69][70] | US financial-services regulatory language (FINRA/SEC) — **not India, not DPDP, not WhatsApp/SMS-specific** | Closest real-world analog to "content/claim checking" found anywhere in this research |
| **Hearsay (Systems)** | **Yes** — pre-approval workflows for advisor social content, pre-approved content library, "Universal Supervision" dashboard, real-time alerts, approval audit trails, infraction resolution [71] | US financial-advisor social media compliance | Also not India/DPDP-specific |
| **Proofpoint** (social-media compliance line) | **Yes** — real-time AI scanning of posts *as they're composed*, pre- and post-publish review, integrates with Hootsuite; policy packs for FINRA/SEC/FDA/HIPAA/FCA/FTC [72][73] | Regulated-industry social media (mostly US/UK frameworks) | |
| Smarsh, Global Relay | Not confirmed as pre-send checkers in this search round — publicly positioned as **archiving/e-discovery/surveillance** (retrospective record-keeping), not pre-send content review | — | **[inference]** based on known market positioning; not independently re-confirmed via a dedicated search this round — flagged in Could-Not-Establish |

### India-specific advertising-claims compliance (ASCI)

- ASCI (Advertising Standards Council of India) issued **draft** guidelines (2026) requiring disclosure of AI-generated content in ads on a risk-based basis; public consultation was open until **13 June 2026** — this is not yet a finalized, mandatory framework, and it addresses AI-disclosure, not general misleading-claims pre-screening [74][75].
- One standalone tool, **"Hawky Ad Compliance Checker,"** was found claiming free AI-based ad-compliance checks against ASCI/WCAG/IRDAI/financial-ad guidelines [76]. **Low confidence** — single low-authority source, not cross-verified, no evidence it integrates with any CDP/ESP/BSP send pipeline. Flagged as [inference, unverified vendor claim].

### Adjacent: Email Pre-Send QA (rendering/spam/link testing)

- **Litmus** and **Email on Acid** are the two established point-solutions for pre-send QA: cross-client rendering previews (100+ clients/devices), spam-filter scoring (20–25+ filters), broken-link/tracking checks [77][78].
- Neither MoEngage, WebEngage, CleverTap, nor Netcore's docs (searched in this pass) mention a native equivalent — pre-send QA for creative/rendering issues appears to live in this separate, email-only tooling category, with **no WhatsApp/SMS equivalent found for creative/content mistakes** (as opposed to template-*approval*, which is a Meta/DLT compliance gate, not a QA/rendering check).

---

## WhatsApp Business Platform Mechanics

**Quality rating — is it exposed via the Cloud API, and at what granularity?**
**[fact]** Yes. Meta computes a `quality_rating` per phone number based on a rolling **7-day window** of recipient signals (blocks, reports, read rates, and the reasons users give when blocking), weighted toward recency. New numbers/templates start as `UNKNOWN` until enough signal accumulates [39][42]. Meta also fires webhooks for related events: `message_template_status_update` (approval/rejection), `template_category_update` (Meta can silently reclassify a template's category post-approval, which also resets any custom TTL), and `business_capability_update` (carries `max_daily_conversation_per_phone` when a messaging-tier limit changes) [40][41]. **Note:** as of API **v24.0**, the older `messaging_limit_tier` field on `GET /<PHONE_NUMBER_ID>` was changed to return the **owning Business Portfolio's** limit rather than a single number's limit — i.e., the tier is now portfolio-level, not strictly per-number [42].

**Messaging tier limits and throttling escalation.**
**[fact, current as described by secondary sources synthesizing Meta's changes; verify against Meta's live docs before relying on exact figures]** Unverified numbers start at 250 conversations/day; verified numbers progress 1,000 → 10,000 → 100,000 → Unlimited based on quality rating and sustained volume [42][79]. Since **October 2025**, tier limits apply at the **Business Portfolio level** — every phone number under one Business Manager shares the highest achieved tier, and newly added numbers instantly inherit that tier [80]. Tier re-evaluation now happens roughly **every 6 hours** (down from a prior 24–48 hour cadence) [80]. Sends are dispatched in batches; Meta checks feedback/quality signals mid-flight and can halt the remainder of a batch if risk signals spike; a "Low" quality rating can cap or freeze sending regardless of the account's nominal tier [80][81].

**What changed in Meta's 2025–2026 WhatsApp pricing.**
**[fact]** July 1, 2025: Meta moved from **conversation-based** pricing (a 24-hour session bucket covering unlimited messages) to strict **per-message** billing for template messages — three marketing templates to the same user in one day is now three billable units, not one [82][83]. From July 2025 through September 2026, in-window **service messages** (free-text replies) and **utility templates** sent inside the 24-hour customer-service window were free. **Effective October 1, 2026**, Meta reintroduces charges for those in-window service messages [82]. Marketing-template pricing is set **per recipient country**, ranges roughly **$0.010 (India) to $0.135+ (Germany)**, and — unlike utility/authentication templates — **marketing messages get no volume discount** [83]. A separate **token-based pricing model** applies from **August 1, 2026** for messages sent via "Meta Business Agent" (roughly 20,000–25,000 tokens per message, ≈$0.04–0.05) [83].

**Per-user marketing-message limits.**
**[fact, but numeric cadence should be re-verified — secondary sources differ in phrasing]** Meta's WhatsApp "frequency capping" mechanism limits how many **marketing template** messages any single user can receive **in total, across all businesses combined** — not a per-business allowance. It first rolled out to India (Feb 2024) before going global. Messages that exceed a user's global saturation threshold fail with error code **131049 ("Unhealthy system activity")**. The cap applies only to the marketing template category; it does not affect messages sent inside an already-open conversation window [84][85]. The exact numeric threshold (commonly cited as roughly "~2 marketing messages/day" in secondary sources) was **not found in a current, authoritative Meta document** in this research pass — treat as approximate and re-verify before using as a hard planning number.

**BSP compliance responsibility to Meta.**
**[fact]** Per Meta's own **Business Messaging Technology Provider Terms**, a BSP/Tech Provider must ensure every customer accepts WhatsApp's Terms of Service, may not let a customer access the underlying certificate/API access independently, and is **jointly and severally liable** for — and must indemnify Meta against — harm arising from that customer's acts or omissions [38]. This applies uniformly to all six India BSPs studied (Gupshup, WATI, AiSensy, Interakt, Zoko, DoubleTick); no evidence found that any of them has a materially different or more permissive arrangement.

---

## WHAT IS GENUINELY NOT COVERED BY ANYONE (across all groups searched)

1. **Purpose-level consent enforced at send time, cross-channel, India-specific.** Zoho's topic-based consent model is the closest thing found to genuine purpose-level consent among the engagement platforms, and it's email-only. India-native DPDP consent-manager startups (ConsentiQo, Concur, TruConsent, etc.) build the consent *ledger* but no evidence surfaced of any of them plugging into an ESP/WhatsApp-BSP send pipeline to auto-suppress a contact at send time based on purpose. **[inference from absence of evidence across ~10 searches specifically probing this]**

2. **General (non-financial) marketing content/claim checking for the Indian regulatory context (ASCI, RBI/IRDAI ad rules for BFSI marketing, DPDP-consent-language requirements) integrated into any campaign send pipeline.** The only real content/claim-checking products found anywhere (Saifr, Hearsay, Proofpoint) are scoped to US financial-services disclosure rules (FINRA/SEC), not India/ASCI, and are not integrated with any of the CDP/ESP/BSP platforms in Groups 1–4. ASCI itself has only a **draft** (not final) AI-disclosure guideline as of mid-2026, and the one standalone "ASCI compliance checker" tool found is unverified and not integrated with any send pipeline. **[inference/fact combination]**

3. **Cross-vendor frequency/collision governance.** Every frequency-capping and collision-detection feature found (MoEngage, WebEngage, CleverTap, Unica, SFMC, AJO, Braze) operates **within its own platform only**. No evidence found of any product that de-duplicates or arbitrates send frequency across a brand's *different* vendors simultaneously (e.g., WhatsApp via Gupshup + email via Zoho + SMS via MSG91 for the same brand, same customer). A multi-vendor stack — which is the India SME/mid-market norm — has no shown cross-vendor governance layer.

4. **A single customer-level "can we contact this person, and how" record unifying DLT/DND (telecom), WhatsApp opt-in state, and email/SMS suppression into one view.** DLT/NCPR scrubbing is explicitly a TRAI/telecom mechanism that **does not apply to WhatsApp** [36], so a brand's WhatsApp consent state and its SMS/voice DND-DLT state are structurally separate today. Unica's governance stack claims the closest approximation of a unified layer, but it's a large enterprise-only suite; nothing India-native or SME-accessible was found doing this unification.

5. **Native pre-send QA (rendering/spam/link/personalization checks) for WhatsApp or SMS creative.** This category exists only for email (Litmus, Email on Acid) among everything searched. No equivalent "does this WhatsApp template actually render/personalize correctly before you commit budget to it" tool was found — template *approval* (Meta/DLT) is a compliance gate, not a creative-QA check.

## COULD NOT ESTABLISH

- Whether **WebEngage** or **CleverTap** have a purpose-level consent/preference-center module (both confirmed strong on frequency capping + DND; neither confirmed on consent/preference management).
- Whether **WebEngage**, **Zoho Campaigns/Marketing Automation**, **Brevo**, or **Mailchimp** have a native **campaign approval workflow** or **audit-trail/evidence-export** feature (no confirming or disconfirming evidence found for any of these four).
- Whether **Mailchimp** or **Brevo** have a genuine **native, automated cross-campaign frequency cap** (found only generic/definitional content, not a confirmed shipped feature).
- Whether **Netcore Cloud** has a dedicated purpose-level consent/preference-center product distinct from its DLT/DCA regulatory-consent tooling.
- Whether **MSG91** or **Kaleyra** expose WhatsApp **quality rating** to their own customers via dashboard or API.
- Whether **any of the six WhatsApp BSPs** (Gupshup, WATI, AiSensy, Interakt, Zoko, DoubleTick) surface Meta's `quality_rating` and portfolio `messaging_limit_tier` fields to their own customers through their own dashboards/APIs. Meta exposes these at the platform level; pass-through to end customers was not confirmed for any of the six.
- The **exact current numeric value/cadence** of Meta's global per-user marketing-message frequency cap (secondary sources vary in how they phrase it; no current primary Meta document with the precise number was found in this pass).
- Whether **Braze** or **Adobe Journey Optimizer** have a formal maker-checker **campaign approval workflow** equivalent to CleverTap's/MoEngage's named Approver role (both confirmed strong on frequency/conflict management; approval workflow specifically not confirmed).
- **Kaleyra-specific** (as opposed to parent Tata Communications) pricing and typical customer size — no public figures found.
- Whether **Smarsh** and **Global Relay** offer any pre-send content review capability, or are strictly retrospective archiving/surveillance tools (positioning suggests the latter, not independently re-confirmed this pass).
- The credibility and actual adoption of the standalone "Hawky Ad Compliance Checker" (ASCI/IRDAI checker) — single low-authority source, unverified.

---

## References

1. MoEngage — Frequency capping: https://help.moengage.com/hc/en-us/articles/15919660670356-Frequency-capping
2. MoEngage — Frequency Capping (FC) and Do Not Disturb (DND) for Flows: https://help.moengage.com/hc/en-us/articles/360000127483-Frequency-Capping-FC-and-Do-Not-Disturb-DND-for-Flows
3. MoEngage — Messaging Regulations for US (SMS/MMS/RCS DND window): https://www.moengage.com/docs/user-guide/campaigns-and-channels/sms-mms-and-rcs/compliance-and-deliverability/messaging-regulations-for-us
4. MoEngage — Opt-in Management: https://help.moengage.com/hc/en-us/articles/36186002401940-Opt-in-Management
5. MoEngage — Launching Preference Management: https://productupdates.moengage.com/en/-launching-preference-management-
6. MoEngage — Subscription Preference Center via Landing Pages: https://help.moengage.com/hc/en-us/articles/35933871486740-How-to-Create-a-Subscription-Preference-Center-for-Email-Using-Landing-Pages
7. WebEngage — Frequency Capping / Queueing / Configurations: https://knowledgebase.webengage.com/docs/frequency-capping ; https://knowledgebase.webengage.com/docs/queueing ; https://knowledgebase.webengage.com/docs/campaign-configurations
8. MoEngage — Campaign Approval Workflow: https://help.moengage.com/hc/en-us/articles/360021206931-Campaign-Approval-Workflow ; Audit Logs: https://help.moengage.com/hc/en-us/articles/8770662326548-Audit-Logs ; announcement: https://www.moengage.com/blog/product-announcement-introducing-teams-and-campaign-approval-workflow-for-large-marketing-teams/
9. CleverTap — Campaign Approval Workflow: https://docs.clevertap.com/docs/campaign-approval-workflow
10. WebEngage — TRAI SMS DLT Regulations (India): https://docs.webengage.com/docs/trai-sms-dlt-regulations-india
11. Secondary source on WebEngage enterprise audit/PII features: https://saufter.io/webengage-pricing/
12. CleverTap — Messaging Frequency Caps: https://docs.clevertap.com/docs/messaging-frequency-caps
13. CleverTap — Notification Delivery Options (DND): https://docs.clevertap.com/docs/notification-delivery-options
14. CleverTap — Setting DND & Cut-Off Times: https://clevertap.com/blog/setting-dnd-cut-off-times-for-campaigns/
15. CleverTap — Audit Logs: https://docs.clevertap.com/docs/audit-logs
16. CleverTap — Automated Audit Log Exports for SIEM: https://docs.clevertap.com/docs/automated-audit-log-exports-for-siem
17. Netcore — DLT/TRAI Regulation support folder: https://netcore.freshdesk.com/support/solutions/folders/17000139232
18. Netcore — Agentic Marketing Platform (approval workflows/AI Trust Layer mention): https://www.netcorecloud.com/agentic-marketing-platform/
19. Netcore — DCA (Digital Consent Acquisition) FAQ: https://netcore.freshdesk.com/support/solutions/articles/17000137990-frequently-asked-question-on-dca-digital-consent-acquisition-
20. MoEngage pricing (secondary): https://blog.campaignhq.co/moengage-pricing/
21. CleverTap pricing: https://clevertap.com/pricing/
22. Zoho Campaigns — Mailing list management: https://help.zoho.com/portal/en/kb/campaigns/user-guide/contact-management/list-management/articles/mailing-list-management
23. Zoho Marketing Automation — Manage Consent: https://help.zoho.com/portal/en/kb/marketing-automation/user-guide/list-management/manage-consent/articles/manage-consent
24. Zoho Marketing Automation 2.0 — Consent and Privacy: https://help.zoho.com/portal/en/kb/marketing-automation-2-0/user-guide/settings/consent-and-privacy
25. Zoho Zeptomail — What are suppression lists: https://www.zoho.com/zeptomail/articles/what-are-suppression-lists.html
26. Mailchimp — What Is an Email Suppression List / Send Time Optimization: https://mailchimp.com/resources/email-suppression-list/ ; https://mailchimp.com/help/use-send-time-optimization/
27. Brevo — How does Brevo comply with GDPR: https://help.brevo.com/hc/en-us/articles/360001258744-How-does-Brevo-comply-with-the-GDPR
28. Brevo — GDPR page: https://www.brevo.com/company/gdpr/
29. General regulatory context (secondary aggregator): https://www.sequenzy.com/blog/best-gdpr-compliant-email-marketing-tools
30. MSG91 — DLT Template Scrubbing / Filtering Rules: https://msg91.com/help/dlt-registration-in-india/dlt-template-scrubbing-filtering-rules
31. MSG91 — DLT Content Template FAQs: https://kb.phone91.com/msg91/MSG91/dlt-content-template-faqs
32. MSG91 — Map approved DLT Template Id: https://msg91.com/help/dlt-registration-in-india/map-approved-dlt-template-id-with-respective-flow-id-on-msg91-panel
33. MSG91 — Get Approval for SMS Content on DLT Platform: https://msg91.com/help/MSG91/get-approval-for-your-sms-content-on-dlt-platform
34. Kaleyra — What changes with new consent scrubbing from DLT: https://messaging.kaleyra.com/support/solutions/articles/3000109849-what-changes-can-i-expect-with-the-new-consent-scrubbing-from-dlt-
35. Kaleyra/Tata — Consent Template Registration Process: https://hexasupport.kaleyra.io/support/solutions/articles/3000102290-tata-s-consent-template-registration-process
36. Kaleyra — What happens when consent scrubbing goes live (incl. WhatsApp/DLT non-applicability context): https://messaging.kaleyra.com/support/solutions/articles/3000109812-what-will-happen-when-the-consent-scrubbing-goes-live- ; DLT-does-not-apply-to-WhatsApp: https://richautomate.in/blog/whatsapp-trai-tcccpr-dlt-india-2026
37. Tata Communications — Kaleyra acquisition / enterprise scale: https://www.tatacommunications.com/press-release/tata-communications-completes-acquisition-kaleyra-leading-global-cpaas-platform-player
38. Meta — Business Messaging Technology Provider Terms: https://www.facebook.com/legal/BM-tech-provider-terms
39. Meta for Developers — Capacity, Quality Rating, and Messaging Limits: https://developers.facebook.com/docs/whatsapp/messaging-limits/
40. Meta for Developers — message_template_status_update webhook: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/message_template_status_update
41. Meta for Developers — Template fundamentals (category updates): https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
42. Meta for Developers — Messaging Limits (messaging_limit_tier deprecation to portfolio-level, v24.0): https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits
43. WATI — WhatsApp API Templates Guide: https://www.wati.io/en/blog/whatsapp-api-templates-guide/
44. Gupshup pricing/compliance (secondary): https://codingclave.com/blog/gupshup-whatsapp-pricing-india-2026
45. WATI pricing (secondary): https://www.ycloud.com/blog/wati-pricing
46. AiSensy — Pricing: https://aisensy.com/pricing
47. AiSensy — WhatsApp Business API Fee: https://wiki.aisensy.com/en/articles/11489897-whatsapp-business-api-fee
48. Interakt/Zoko/DoubleTick pricing comparison (secondary): https://richautomate.in/blog/best-whatsapp-business-api-providers-india-2026 ; https://www.zoko.io/post/best-whatsapp-business-api-india
49. HCL Unica+ — governance stack description: https://www.hcl-software.com/unica
50. HCL Unica — Unica Optimize description (secondary but consistent with vendor positioning): via HCL Unica documentation portal https://doc.unica.com/
51. Salesforce Ben — Guide to Collision Control for Marketing Cloud Admins: https://www.salesforceben.com/guide-to-collision-control-for-marketing-cloud-admins/
52. DESelect — Frequency Capping Checklist for Salesforce Marketing Cloud: https://deselect.com/2024/08/frequency-capping-checklist-for-salesforce-marketing-cloud/
53. Marketing Cloud Guru (Medium) — Managing email send frequency in SFMC: https://www.marketingcloud.guru/managing-email-send-frequency-in-sfmc-65b9fe86ba69
54. Salesforce Help — Create Communication Capping Rules: https://help.salesforce.com/s/articleView?id=data.c360_a_create_communication_capping_rules.htm&language=en_US&type=5
58. Adobe — Frequency capping (Decision Management): https://experienceleague.adobe.com/en/docs/journey-optimizer-learn/tutorials/decision-capabilities/decision-management/frequency-capping
59. Adobe — Conflict management & prioritization: https://experienceleague.adobe.com/en/docs/journey-optimizer/using/conflict-prioritization/gs-conflict-prioritization
60. Braze — Rate limiting and frequency capping: https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/frequency_capping
61. Braze — Know before you send: channels (suppression/subscription groups): https://www.braze.com/docs/user_guide/messaging/messaging_fundamentals/know_before_you_send
62. OneTrust — India DPDPA Compliance solution: https://www.onetrust.com/solutions/india-dpdpa-compliance/
63. Fyno — DPDP Consent Platform Enforcement Comparison (OneTrust pre-send gap claim): https://www.fyno.io/blog/dpdp-consent-platform-enforcement-comparison
64. Securiti — Understanding India's DPDPA Consent Manager: https://securiti.ai/india-dpdpa-consent-managers/
65. KavachOne — ConsentiQo DPDP Consent Manager: https://kavachone.com/consentiqo-dpdp-consent-manager
66. TruConsent — Top Consent Management Platforms in India for DPDPA 2026: https://truconsent.io/blog/top-consent-management-platforms-india-dpdpa-2026
67. Consently — Comparison of Indian DPDP consent managers: https://www.consently.in/blog/consently-vs-onetrust-privy-gotrust-comparison
68. Candour Legal — DPDP Consent Manager Framework 2026 (Nov 2026 registration, ₹2cr net worth, cannot be fiduciary/processor simultaneously): https://candourlegal.com/dpdp-consent-manager-framework-2026/
69. Saifr — SaifrReview: https://saifr.ai/saifrreview
70. Saifr — How Contextual AI Is Helping Transform Pre- and Post-Marketing Compliance Review Workflows (incl. Microsoft/Azure partnership): https://saifr.ai/blog/how-contextual-ai-is-helping-transform-pre-and-post-marketing-compliance-review-workflows
71. SIFMA/Hearsay marketing compliance PDF: https://www.sifma.org/wp-content/uploads/2018/01/Hearsay_MarketingPDF_CLA18.pdf
72. Proofpoint — 9 Best Practices for Social Media Compliance in Financial Services: https://www.proofpoint.com/us/corporate-blog/post/9-best-practices-using-social-media-compliantly-financial-services
73. Hootsuite — Proofpoint for social media: https://blog.hootsuite.com/proofpoint-social-media/
74. Mondaq — ASCI Issues Draft Guidelines for Responsible Labelling of AI-Generated Content in Advertising: https://www.mondaq.com/india/advertising-marketing-branding/1792778/asci-issues-draft-guidelines-for-responsible-labelling-of-ai-generated-content-in-advertising
75. Business Standard — AI ads face ASCI test as draft rules target deepfakes, misleading claims: https://www.business-standard.com/industry/news/ai-ads-face-asci-test-as-draft-rules-target-deepfakes-misleading-claims-126051201030_1.html
76. ChatGate — Hawky Ad Compliance Checker: https://chatgate.ai/post/ad-compliance-checker/
77. Email on Acid vs. Litmus: https://www.emailonacid.com/email-on-acid-vs-litmus/
78. Mailtrap — 7 Best Email Preview and Rendering Tools: https://mailtrap.io/blog/email-preview/
79. Uptail — WhatsApp Business Message Limits 2026 (tier progression): https://www.uptail.ai/blog/whatsapp-business-message-limits-2026-broadcast-caps-tier-progression-what-happens-when-you-hit-the-ceiling
80. Sanuker — WhatsApp 2026 Updates: Pacing, Limits & Usernames (portfolio-level tiers since Oct 2025, 6-hour re-evaluation): https://sanuker.com/whatsapp-api-2026_updates-pacing-limits-usernames/
81. Chatarmin — WhatsApp Messaging Limits 2026: https://chatarmin.com/en/blog/whats-app-messaging-limits
82. Hello Charles — WhatsApp Service Message Pricing: What Changes in 2026 (Oct 1 2026 service-message charging): https://www.hello-charles.com/blog/whatsapp-service-message-pricing-what-changes-in-2026
83. Blueticks — WhatsApp Business Per-Message Pricing in 2026 / Marketing Message Pricing in 2026: https://blueticks.co/blog/whatsapp-business-pricing-change-2026-per-message ; https://blueticks.co/blog/whatsapp-business-pricing-marketing-messages-2026
84. AiSensy — Meta's Frequency Capping for WhatsApp Marketing: https://m.aisensy.com/blog/meta-frequency-capping-for-whatsapp-marketing-messages/
85. ValueFirst — Meta's Frequency Capping: What You Need to Know for WhatsApp Marketing: https://www.vfirst.com/post/metas-frequency-capping-what-you-need-to-know-for-whatsapp-marketing
