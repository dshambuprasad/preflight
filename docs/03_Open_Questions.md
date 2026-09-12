# Open questions — what we don't know yet

Honest register of unknowns. Exploration stage; nothing here is settled. Updated 2026-09-04.

---

## Questions that would change the shape of the thing

**1. Is the primary product the pre-flight check or the evidence record?**
Current read: pre-flight *sells*, evidence *renews*. But this is an instinct, not a finding. It changes who the buyer is (marketer vs. owner/compliance), how it's priced, and what gets built first.

**2. How much does a poorly-run SME actually care?**
The check finds most problems in businesses with messy data — but those are also the businesses least likely to feel the risk until something breaks. The well-run ones who'd appreciate it may find little. *This tension is unresolved and matters.*

**3. Does "cannot evaluate" read as honesty or as weakness?**
Graceful degradation is the right engineering choice. Whether a buyer reads *"I checked 11 of 14 rules"* as trustworthy or as useless is a genuine unknown, and it's testable cheaply with a mock report.

**4. Who is the buyer?** Owner-operator (feels the risk), marketing lead (feels the workload), or agency running campaigns for many clients? **The agency case is interesting** — one buyer, many businesses, and agencies carry the risk of their clients' mistakes.

**5. Is blocking a send ever acceptable?**
The most valuable integration is also the most dangerous. A false block breaks a customer's business. Probably never fully automatic — but where's the line?

---

## Technical unknowns

- **Identity resolution** — how far can we get without it? Is "email OR phone exact match" enough for SME v1?
- **How much can be deterministic?** Frequency, consent, template-variable checks are deterministic. Claim detection and tone are judgment. What's the honest split?
- **WhatsApp quality rating** — is current rating actually exposed via the API, and at what granularity? (Needs verification.)
- **Do the BSPs (Gupshup/WATI/AiSensy) expose usable APIs** for template state and send history, or is this gated?
- **False positives** — a checker that cries wolf gets switched off. What's the acceptable rate, and how do we measure it?

---

## Regulatory research needed (the real asset)

The **Layer-A India rulebook, rule by rule** is the substantive work and hasn't been done:

- DPDP Act — what specifically must be true for marketing consent to be valid? What does a compliant consent record contain? What are the withdrawal obligations and timelines?
- Current enforcement reality — are there actual penalties being applied yet, or is this still prospective? *(This materially changes urgency and therefore willingness to pay.)*
- TRAI/DLT — the concrete rules for SMS sender/template registration, and how DND scrubbing is supposed to work.
- WhatsApp Business policy — template categories, session-window rules, quality-rating mechanics and thresholds.
- Which of these are *checkable from data* vs. which need human judgment.

**This is the next real piece of work.** Until it's done, the product is a shape without a spine.

---

## Commercial unknowns (deliberately unexamined for now)

Market size, competition, pricing and whether anyone would pay have **not** been assessed. That's intentional — we're exploring the solution, not validating a business. Flagged here only so it's visible that it's an open question, not an answered one.

---

## Things we decided to be careful about

- **Never silently pass** a rule we couldn't evaluate.
- **Never let a one-time exception become a permanent rule** (reason codes + expiry).
- **Rules come from documents, facts come from APIs** — don't confuse the two.
- Nothing here claims to be legal advice; the product finds *gaps for human review*, it does not certify compliance.
