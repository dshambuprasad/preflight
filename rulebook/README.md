# Rulebook — the shared metadata table for `rulebook/*.ttl` and `packages/rules-*`

Normative source for rule **meaning and provenance** is the Turtle graph; **logic** is in code (04 §7, D10).
This table is the single list both sides are built from and that `rulegraph.validateAgainst(packs)` checks
(ids, `effectiveFrom`, `severity`, `sendTimeCheck`). Counts per 12 §H D40: India pack **22** send-time rules,
graph **25** India nodes (3 `pf:sendTimeCheck false`), hygiene pack **2**.

## Instruments (graph node id → reference · title · confidence · regulator)

| node | `pf:reference` (= `citation.instrument`) | `dcterms:title` (= `citation.title`) | confidence | regulator |
|---|---|---|---|---|
| `inst:RBI-2022-23-108` | `RBI/2022-23/108, DOR.ORG.REC.65/21.04.158/2022-23 (12 Aug 2022)` | `Outsourcing of Financial Services – Responsibilities of REs employing Recovery Agents` | SECONDARY | RBI |
| `inst:RBI-2026-27-115` | `RBI/2026-27/115, DOR.MCS.REC.No.94/01-01-032/2026-27 (15 Jun 2026)` | `RBI (Commercial Banks – Responsible Business Conduct) Second Amendment Directions, 2026 — effective 1 Jan 2027` | PRIMARY (banks; NBFC sibling UNVERIFIED — O8) | RBI |
| `inst:RBI-NBFC-RBC-2025` | `RBI (NBFC – Responsible Business Conduct) Directions, 2025` | `Fair Practices Code` | DERIVED | RBI |
| `inst:RBI-DLD-2025` | `RBI Digital Lending Directions, 2025` | `Digital Lending Directions` | SECONDARY | RBI |
| `inst:TRAI-TCCCPR-2018` | `TRAI Telecom Commercial Communications Customer Preference Regulations, 2018` | `TCCCPR 2018 (DLT registration, DND/NCPR)` | SECONDARY | TRAI |
| `inst:DPDP-2023` | `Digital Personal Data Protection Act, 2023` | `DPDP Act — purpose limitation and consent (ss. 6–7); ordinary fiduciaries from 13 May 2027` | SECONDARY | MeitY / Data Protection Board of India |
| `inst:META-WA-POLICY` | `WhatsApp Business Platform policy (Meta)` | `Message template specification` | PLATFORM | Meta |
| `inst:FACE-FREQUENCY` | `FACE (Fintech Association for Consumer Empowerment) guidance on contact frequency` | `SRO guidance: set an internal contact-frequency limit` | SECONDARY | FACE (RBI-recognised SRO) |
| `inst:PREFLIGHT-HYGIENE` | `Preflight audience-hygiene rule` | `Product rule — data quality of the audience, not a legal obligation` | DERIVED | Preflight (product) |

Clauses quoted where PRIMARY (from `docs/06` amendment): 85G, 85I, 85K, 85L, 85M, 85N(3), 85N(4), 85N(7), 85O, 85Q, 85R, 85ZA(1), 4(10.1A), Annex IIA.

## Enforcement actions (`pf:EnforcementAction`)

| node | entity | date | amount | summary | evidences |
|---|---|---|---|---|---|
| `enf:HDFC-2024` | HDFC Bank Limited | 2024-09-10 | ₹1,00,00,000 (₹100 lakh, multi-charge order) | "It failed to ensure that customers are not contacted after 7 pm and before 7 am" (RBI press-release wording via FACE) | A-RBI-001 |
| `enf:HERO-FINCORP-2024` | Hero FinCorp Limited | 2024-05-24 | ₹3,10,000 | "The company did not convey the terms and conditions of loans in writing to the borrowers in the vernacular language understood by them." | A-RBI-003 |
| `enf:SHAHA-FINLEASE-2026` | Shaha Finlease Private Limited | 2026-01-05 | ₹10,000 | "The company failed to put in place a system of periodical review of compliance of the 'Fair Practices Code'." — an FPC governance failure, not a messaging act; shows FPC duties are enforced. Source: rbi.org.in PR1853.pdf | A-RBI-005 |

## Rules

`perVariant` = evaluated once per message variant (D28). `appliesTo` returns `'unknown'` where marked (→ cannot_evaluate with the absent `campaign.*` paths).
Fix kinds per 04 §9. `citation.graphNodeId` = the instrument node id. `sendTimeCheck=false` rows are graph-only (D20).

| id | pack | layer | tier | category | severity | before | effectiveFrom | perVariant | appliesTo | requires | instrument | clause(s) | fix |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A-RBI-001 | india-layer-a | A | 0 | timing | block | | | no | purpose missing → unknown; `purpose === 'collections'` | campaign.purpose, campaign.scheduledAt | RBI-2022-23-108 | recovery-agent contact hours 08:00–19:00 | reschedule |
| A-RBI-002 | india-layer-a | A | 0 | timing | block | | | no | segment missing → unknown; collections ∧ microfinance | campaign.purpose, campaign.borrowerSegment, campaign.scheduledAt | RBI-2022-23-108 | microfinance 09:00–18:00 | reschedule |
| A-RBI-003 | india-layer-a | A | 0 | content | warn | | | yes | true | contact.preferredLanguage, campaign.message | RBI-NBFC-RBC-2025 (+85R PRIMARY basis) | FPC vernacular; 85R | drop_rows (alt: set_config romanisedAcceptableLanguages) |
| A-RBI-004 | india-layer-a | A | 1 | identity | block | | | no | purpose missing → unknown; collections | campaign.purpose, history.contactEvents | RBI-DLD-2025 | para 8(v) | — |
| A-RBI-005 | india-layer-a | A→C | 0 | timing | info | | | no | true | config.frequencyCapPerWeek | RBI-NBFC-RBC-2025 (+FACE-FREQUENCY) | FPC "persistently bothering" | set_config frequencyCapPerWeek=2 (labelled default) |
| A-RBI-006 | india-layer-a | A | 0 | consent | block | warn | 2027-01-01 | no | promotional | contact.consentPromotional | RBI-2026-27-115 | 85L | drop_rows |
| A-RBI-007 | india-layer-a | A | 1 | consent | block | warn | 2027-01-01 | no | promotional | campaign.product, consent.productScoped | RBI-2026-27-115 | 85G, 85Q | — |
| A-RBI-008 | india-layer-a | A | 0 | content | block | warn | 2027-01-01 | yes | promotional | campaign.message | RBI-2026-27-115 | 85M | add_disclosure " Reply STOP to opt out." |
| A-RBI-009 | graph only | A | — | — | info | | 2027-01-01 | — | sendTimeCheck=false | — | RBI-2026-27-115 | 85G retention (contract + 1y) | — |
| A-RBI-010 | graph only | A | — | — | info | | 2027-01-01 | — | sendTimeCheck=false | — | RBI-2026-27-115 | 4(10.1A), 85I, Annex IIA | — |
| A-RBI-011 | india-layer-a | A | 0 | identity | warn | | | yes | true | campaign.message, config.lenderName | RBI-DLD-2025 (+85O, 85N(3)) | sender identity | add_disclosure prefix "<lenderName>: " |
| A-RBI-012 | india-layer-a | A | 0 | timing | block | warn | 2027-01-01 | no | channel ∈ {voice, visit} ∧ promotional | campaign.scheduledAt, campaign.channel | RBI-2026-27-115 | 85N(4) | reschedule |
| A-RBI-013 | india-layer-a | A | 1 | consent | block | | | no | promotional | consent.current | RBI-2026-27-115 | 85N(7) | drop_rows |
| A-RBI-014 | india-layer-a | A | 0 | content | warn | | | yes | promotional ∧ credit product (campaign.product or message keywords: loan, credit, emi, top-up, overdraft, card, limit, finance, borrow); else false | campaign.message | RBI-2026-27-115 | 85K | edit_message (null payload; "Add the interest rate and fees") |
| A-IN-001 | india-layer-a | A | 1 | delivery | block | | | no | sms ∧ promotional | campaign.channel, platform.templates | TRAI-TCCCPR-2018 (+85ZA(1)) | DLT header + template | — |
| A-IN-002 | india-layer-a | A | 1 | consent | block | | | no | channel ∈ {sms, voice} ∧ promotional | campaign.channel, consent.dnd | TRAI-TCCCPR-2018 | NCPR/DND | drop_rows |
| A-IN-003 | india-layer-a | A | 0 | content | info | | | yes | true | campaign.message | RBI-2026-27-115 (DERIVED — it is the gate for 85L) | 85L | — |
| A-IN-004 | india-layer-a | A | 0 | consent | block | warn | 2027-05-13 | no | promotional | contact.consentPromotional | DPDP-2023 | s.6 purpose-bound consent | drop_rows |
| A-IN-005 | india-layer-a | A | 1 | consent | block | | | no | promotional | consent.current | DPDP-2023 | s.6(4)/(6) withdrawal | drop_rows |
| A-IN-006 | graph only | A | — | — | info | | | — | sendTimeCheck=false | — | DPDP-2023 | s.5 notice | — |
| A-WA-001 | india-layer-a | A | 1 | delivery | block | | | no | whatsapp | campaign.channel, history.contactEvents | META-WA-POLICY | 24-hour customer service window | — |
| A-WA-002 | india-layer-a | A | 1 | delivery | block | | | yes | whatsapp (no template → not_applicable) | campaign.template.externalId, platform.templates | META-WA-POLICY | template approval + category | — |
| A-WA-003 | india-layer-a | A | 0 | delivery | block | | | yes | whatsapp | campaign.template.body, campaign.template.variables | META-WA-POLICY | template variable shape | edit_message (null payload; "Fix template variables") |
| A-WA-004 | india-layer-a | A | 1 | audience | warn | | | no | whatsapp | platform.messagingLimit | META-WA-POLICY | messaging limit tiers | — |
| A-WA-005 | india-layer-a | A | 1 | delivery | warn | | | no | whatsapp ∧ promotional | platform.qualityRating | META-WA-POLICY | quality rating | — |
| A-PF-001 | preflight-hygiene | C | 0 | audience | warn | | | no | true | audience.duplicates | PREFLIGHT-HYGIENE | duplicates | drop_rows |
| A-PF-002 | preflight-hygiene | C | 0 | consent | warn | | | no | true | contact.consentSource | PREFLIGHT-HYGIENE | conflicting consent | — |

`pf:severityBasis` (22 D1) is a one-line rationale per rule node in the graph.
Titles for the 9 PreflightCore rules are verbatim from `builds/PreflightCore/src/rules.js` (byte-identity, D42).
