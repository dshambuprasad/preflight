# Preflight — concept note

**Status: exploration.** Nothing is being built. This is a thinking artifact — a solution sketch we can argue with, revise, or throw away.
Working name: *Preflight*. Started 2026-09-04.

---

## The one-line idea

Before a business sends a marketing campaign, check it against the rules — legal, platform, industry and their own — and produce both a **list of problems to fix** and a **record proving the check happened**.

## The demo that explains it in ten seconds

> You paste in a campaign about to go out. The screen says:
> *"This goes to 340 people. 62 were messaged 4 days ago — breaches your own 7-day frequency rule. 18 have no recorded consent for promotional messages. Your WhatsApp template uses an unapproved variable and will be rejected. 9 are in a region observing a festival on your send date."*

The point is not that it generates a campaign. It's that it catches what a busy person misses, and gives them a record they can keep.

---

## Why anyone would care (three separable values)

1. **Prevent loss** — protect the WhatsApp number's quality rating (getting throttled means losing your main channel), avoid regulatory breach, avoid burning the list with over-messaging.
2. **Automate the checks that live in one person's head** — the informal QA a good marketer does and a busy one skips.
3. **Produce evidence** — an auditable record that consent existed and rules were applied.

**Strategic read:** value 1 sells the deal (visceral, immediate). Value 3 renews it (recurring, budgeted obligation). Design the evidence layer in from day one; don't bolt it on.

---

## Inputs — three tiers, because data reality varies enormously

| Tier | What's connected | Who it suits |
|---|---|---|
| **0 — paste/upload** | Audience CSV + the message + channel + send time | A business whose "CRM" is a spreadsheet. Also the demo. |
| **1 — read-only connectors** | WhatsApp Business API (templates, quality rating, send history), email tool (unsubscribes, history), Shopify/WooCommerce (customers, orders, consent flags), Google Sheets | Most SMEs |
| **2 — sync + write-back** | Suppression lists pushed back, scheduling, continuous monitoring | Committed customers |

**Key design rule — graceful degradation.** Every rule declares which data it needs. If the data is missing, the report says **"cannot evaluate"** — never a silent pass. So the output includes a coverage line: *"checked 11 of 14 applicable rules; 3 could not be evaluated — no consent timestamps."*

This turns uneven data quality from a blocker into a product mechanic: a visible **readiness score** that rises as more is connected.

---

## The core data model — honest version

A *conceptual* core of five ideas (**Contact · ConsentRecord · ContactEvent · Campaign · Message**) that rules are written against, with adapters absorbing each customer's mess.

**But this is a simplification.** A real implementation is more like 15–20 tables, and the genuinely hard parts are:

- **Identity resolution.** One human = a phone number + email + WhatsApp ID + app install + possibly duplicate records. Deciding "these are one person" is its own hard problem, and *every frequency rule depends on it*. Easy for a Shopify store (email is the key), a dedicated system for a telecom.
- **Consent is not one column.** It has purpose, channel, timestamp, source, jurisdiction, and a withdrawal state.
- **Templates** have versions, locales and approval states.

---

## The rulebook — four layers

**Layer A — Statutory & platform.** Ships with the product, vendor-maintained, non-negotiable. India: DPDP consent/purpose/withdrawal, TRAI-DLT + DND for SMS, WhatsApp Business policy (template approval, 24-hour session window, quality rating). *Rules come from published law and policy documents — a human encodes them. APIs supply **state** (e.g. current quality rating), not rules.* This layer changes a few times a year — which is exactly why the product is a subscription, not a one-off tool.

**Layer B — Industry pack.** Selectable. A plain-language definition: **things you're not allowed to say, and things you must say.**
- Food (FSSAI): no "cures diabetes", no "boosts immunity" without basis, no "no preservatives" if there are.
- Coaching/education: no "100% selection", no misleading topper claims.
- Financial services: no guaranteed returns; mandatory risk disclaimers.
- Healthcare: Drugs & Magic Remedies Act — cannot claim to cure listed conditions.

**Layer C — Business config.** What the customer sets: frequency caps, quiet hours, brand voice and banned words, offer guardrails (never discount below X), segment rules, own suppression lists.
*Today this mostly exists **implicitly** — in the owner's head or a WhatsApp instruction, and it leaves when that person leaves.* The value is making it explicit: **"the rules your best marketer keeps in her head, written down once, applied every time."**

**Layer D — Learned. NOT machine learning.** Rule *proposals* from operator corrections, always human-approved.
*Failure mode to design against (a one-time exception hardening into a permanent rule):*
- every override requires a **reason code** — `one-time exception` / `rule is wrong` / `data was wrong`
- only `rule is wrong` counts toward learning
- exceptions are **scoped and expire**
- learning produces a proposal, never a silent change

**Rule object shape:** `id · layer · severity (block/warn/info) · data dependencies · evaluation logic · explanation template · citation`.
Deterministic wherever possible; LLM only where judgment is genuinely needed (tone, claim detection, cultural fit).

---

## Output

Blockers / warnings / info — each with *why* and a *citation* · the coverage statement · one-click remediations (drop those 62, fix the template variable) · an **exportable evidence record**.

## Interfaces

Four, but only one matters at first: **the pre-flight screen** (upload → report). Then connector settings, the Layer-C rulebook editor, and an API/webhook for the integrated tier.

## Integration with execution tools — a risk ladder

**read-only** (start here) → **write suppression back** → **block the send** (most valuable, most dangerous — wrongly blocking a campaign breaks their business).

Landscape: SME India — WhatsApp via Gupshup / WATI / AiSensy / Interakt; email via Zoho Campaigns / Brevo / Mailchimp; SMS via DLT aggregators (MSG91, Kaleyra); commerce on Shopify/WooCommerce. Mid-market — **MoEngage, WebEngage, CleverTap** (the Indian/APAC engagement platforms). Enterprise — Unica, Adobe Campaign, Salesforce Marketing Cloud, Braze.

---

## SME vs enterprise — how the mechanism changes

| | SME | Enterprise (e.g. a large operator) |
|---|---|---|
| **Core problem** | Lookup: "did I message this person recently?" | **Collision**: many BUs independently target overlapping audiences the same week |
| **Timing** | Point-in-time check before one send | Continuous monitoring across a campaign pipeline |
| **Governance** | Owner sets their own caps | Caps negotiated between business units; needs approval/exception/escalation workflow |
| **Identity** | Usually one key (email/phone) | Dedicated identity-resolution system |
| **Consent** | A column, or nothing | A consent master system, millions of records |
| **Interesting extra** | — | *Given all queued campaigns, what's the total contact load per customer and where do they collide?* — a constrained-allocation problem |

---

## Region-agnosticism

The architecture is region-neutral; **Layer A is the region cartridge.** India = DPDP + TRAI + WhatsApp. Japan = APPI + LINE. EU = GDPR. Everything else — model, engine, Layers B/C/D, interfaces — unchanged.

## Industry fit

The **engine is agnostic; go-to-market cannot be.** Best-fit profile: high message volume × expensive mistakes × too small for enterprise MarTech. Candidates: D2C e-commerce (highest WhatsApp dependence, easiest data via Shopify), clinics/diagnostics (heaviest DPDP exposure), financial-services agents (DND bites hardest), coaching/education (volume + claims rules).

---

# Revision — 2026-09-04 (after Shambu's incentive challenge)

Shambu asked the question that reshapes the product: *"what's the business's incentive? Don't they love the grey area?"* He was right, and the answer changes the spine.

## The motivation reframe: this is not a compliance product

**Nobody buys compliance because they like rules. They buy when breaking rules costs more than following them.** Three possible forces, very unequal in today's India:

| Force | Strength today | Why |
|---|---|---|
| **Regulatory penalty (DPDP)** | **Weak today — dated, not absent** | ✅ **RESOLVED 2026-09-05, see `04_Market_Deep_Dive.md`.** Rules notified 14 Nov 2025; Data Protection Board **not seated** as of Jun 2026; **zero penalties levied on any business**. But the compliance deadline for ordinary Data Fiduciaries is **13 May 2027** — eight months out. Not "theoretical forever": theoretical *until a date*. |
| **Regulatory penalty (everything else)** | **Strong — and we were wrong to lump it in** | TRAI: 2.1M connections disconnected, 100k+ entities blacklisted, ₹150 cr fined. ASCI: cases +21%, **93% self-initiated**. RBI: ₹48 cr FPC penalties + **lenders liable for their LSPs' conduct** (May 2025). SEBI: ₹546 cr finfluencer order. Sector-specific, present-tense, real. |
| **Platform punishment (WhatsApp quality rating)** | **Strong** | Meta ignores your legal position; it watches block/report rates and *automatically throttles* daily message limits. Not a regulator who might act someday — an algorithm acting this week. Immediate, felt, painful. |
| **Commercial self-interest** | Medium | Over-messaging kills list health and conversion — but businesses rarely connect cause to effect. |

**→ Reposition: "protect your channel," not "achieve compliance."** Compliance becomes a side effect. *"Don't lose your WhatsApp number"* sells to a shop owner; *"comply with DPDP"* does not.

## Who actually has something to lose (buyer reconsidered)

Most SMEs **do** love the grey area and will keep operating in it. Honest segmentation:

- **Weak buyers:** ordinary SMEs with no compliance budget, no DPO, and no one asking them for proof.
- **Real buyers — concrete exposure:** regulated sectors (clinics, financial advisors, pharma), businesses audited by their enterprise customers, anyone already burned once, and large firms with brand/shareholder exposure.
- **⭐ Strongest candidate — agencies and BSPs:** an agency running campaigns for ~40 clients carries **aggregated** risk (one banned number = a lost client + reputation); a WhatsApp provider is punished by Meta when its customers spam. Concentrated pain, existing budget, technical ability to integrate, and *one sale covers many businesses*. **This should be the primary buyer hypothesis, not the individual SME.**

## Report vs evidence record — the distinction, made properly

| | **Report** | **Evidence record** |
|---|---|---|
| Audience | You, now | Someone else, later (auditor, regulator, enterprise procurement) |
| Nature | Working document — "fix these 4 things" | Immutable, timestamped, retained, exportable |
| Contents | Findings + fixes | Campaign, audience, rules applied, findings, **who accepted which exceptions**, consent basis per recipient |
| Lifespan | Discarded after the send | Retained for years |

Same underlying check, different audience and durability. **Honest test:** does anyone actually get *asked* for this? Enterprises yes; shopkeepers almost never — reinforcing the enterprise/agency end.

## Workflow gaps (found by walking Shambu's mental model)

Flow: *inbound data → diagnostics → recommendations → exceptions marked → corrections → outbound.* Correct, with five gaps:

1. **Time drift** — checked Monday, sent Thursday, consent withdrawn Wednesday. Either check at send-time or stamp every result "valid as of T".
2. **Re-check after correction** — the corrected version earns the record, not the original. Needs version tracking.
3. **Authority** — whoever marks an exception may not be entitled to accept that risk. Enterprise needs approval routing.
4. **Partial compliance** — fixing 60 of 62 and sending anyway. The record must show what was *actually sent, including knowingly accepted risks* — never a false clean bill.
5. **⚠️ The big one — if we're not in the send path, we cannot know what was actually sent.** We checked a file; whether that file went out is unverified. **The evidence record proves "a check was run and these were the findings" — NOT "the send complied." The product must never overclaim this.**

## Machine learning — where it helps, where it's over-engineering

**Keep the rule engine deterministic.** Consent present/absent, messaged-within-N-days, template variable valid — these are lookups. ML adds unpredictability and destroys explainability, and *explanation is the product*: a checker that can't say why it flagged something is worthless.

**ML belongs in the advisory layer, heavy-data customers only:**
- **Fatigue / churn-risk modelling** — contacts whose engagement is decaying toward unsubscribe.
- **Anomaly detection** — "this audience is 3× your usual size, 40% never-messaged." Only needs to *flag*, not decide.
- **Claim / tone detection** — LLM judging whether copy makes a health claim. Genuine judgment work.
- **Collision optimisation** (enterprise) — allocating scarce contact slots across competing campaigns. *Note: this is optimisation/OR, not ML.*
