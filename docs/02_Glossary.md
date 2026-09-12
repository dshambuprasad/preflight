# Glossary — plain language

Domain terms that come up constantly in this space, explained simply. Written because the marketing-compliance world assumes you already know all of this.

---

## Consent & regulation (India)

**DPDP Act (Digital Personal Data Protection Act, 2023)** — India's personal-data law. For marketing, the practical points: you need **consent**, consent is tied to a **specific purpose**, and a person can **withdraw** it at any time and you must honour that.

**Purpose-bound consent** — the idea that agreeing to one thing isn't agreeing to everything. Someone who consented to *"send me my order updates"* has **not** consented to *"send me promotional offers."* Probably the most common real-world breach.

**Consent record** — evidence of *how and when* someone agreed. Not just "they haven't objected." A phone number written down at a shop counter is not a consent record.

**Withdrawal** — the person says stop. Must propagate across *all* channels, not just the one they said it on.

**DND (Do Not Disturb) registry** — India's telecom opt-out list. Registered numbers must not receive promotional calls/SMS.

**TRAI / DLT** — TRAI is the telecom regulator. **DLT** (Distributed Ledger Technology registration) is the system where Indian businesses must pre-register their sender IDs and SMS message templates before they're allowed to send. Unregistered SMS simply doesn't deliver.

**APPI** — Japan's equivalent personal-data law. Same *shape* as DPDP, different specifics.

**GDPR** — the EU's version. The original that most others echo.

---

## WhatsApp / channel mechanics

**WhatsApp Business API** — the programmatic way businesses send WhatsApp at scale (as opposed to the free WhatsApp Business *app* on a phone). Accessed through Meta directly or via a **BSP**.

**BSP (Business Solution Provider)** — a reseller/middleman for WhatsApp Business API. In India: Gupshup, WATI, AiSensy, Interakt, Zoko. Most SMEs go through one of these rather than Meta directly.

**Template (message template)** — for business-initiated messages, WhatsApp requires a **pre-approved** message format with placeholder variables. You can't just send free text to someone who hasn't messaged you first. Templates get **approved or rejected** by Meta.

**24-hour session window** — if a customer messages *you*, you can reply freely for 24 hours. Outside that window, you may only send an approved template. Getting this wrong means the message just fails.

**Quality rating** — Meta grades each business number (green/yellow/red) based on how recipients react — blocks, reports, ignores. A poor rating brings **throttling** (lower daily message limits) and eventually restriction. **This is the existential risk:** for a business whose customers live on WhatsApp, losing the number is losing the channel.

---

## Marketing operations

**Campaign** — one planned send: an audience, a message, a channel, a time.

**Segment / audience** — the subset of contacts a campaign targets.

**Suppression list** — people to exclude: opted out, complained, bounced, or messaged too recently.

**Frequency cap** — a self-imposed limit, e.g. "no more than 2 promotional messages per person per week."

**Control group / holdout** — a slice of the audience deliberately *not* messaged, so you can compare and see whether the campaign actually did anything.

**Pre-flight check** — inspecting a campaign *before* it sends. (Borrowed from aviation: the checklist run before takeoff.)

**Deliverability** — whether messages actually arrive, versus being blocked, filtered or spam-foldered.

**Attribution** — deciding which campaign gets credit for a sale. Famously contested.

**MarTech** — "marketing technology"; the umbrella term for these tools.

---

## Claims (the Layer-B concept)

**Claim** — a promise a business makes about its product. Regulators restrict claims that mislead.

**FSSAI** — India's food regulator. Restricts health claims on food ("cures diabetes", "immunity booster", "no preservatives" when there are).

**ASCI** — Advertising Standards Council of India; self-regulatory body that rules on misleading ads.

**CCPA (India)** — Central Consumer Protection Authority; can penalise misleading advertising. Has acted against coaching institutes over inflated success claims.

**Drugs & Magic Remedies Act** — old Indian law forbidding advertisements claiming to cure a listed set of diseases.

**RERA** — real-estate regulator; mandates specific disclosures in property advertising.

---

## Systems

**CRM** — where customer records live (for many SMEs: a spreadsheet).

**Engagement platform** — software that sends campaigns across channels and tracks response. Indian/APAC mid-market: **MoEngage, WebEngage, CleverTap**. Enterprise: Unica, Adobe Campaign, Salesforce Marketing Cloud, Braze.

**Identity resolution** — working out that a phone number, an email, a WhatsApp ID and an app install all belong to *one person*. Sounds trivial; is not. Every frequency rule depends on it.

**Adapter / connector** — the code that translates one customer's messy data into the shape our rules expect.

**Audit trail** — a tamper-evident record of what was checked, when, and what was decided.
