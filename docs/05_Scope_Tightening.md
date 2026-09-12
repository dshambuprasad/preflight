# Scope tightening — from "a checker" to something testable

**Status: exploration.** Written 2026-09-05 after V1–V3 research. This narrows the concept and sets out how to kill it cheaply. It does not recommend building anything.

Sources: `research/V1_Lending_Comms_Rules.md` · `V2_Insurance_Healthcare.md` · `V3_BSP_API_Capability.md`, on top of `04_Market_Deep_Dive.md`.

---

## The finding that reorganises everything

There is a second deadline, it is nearer than DPDP, it is specifically about **marketing communications consent**, and it belongs to a regulator that is already fining people for exactly this.

**RBI Responsible Business Conduct (Second Amendment) Directions, 2026** — notification RBI/2026-27/115, DOR.MCS.REC.No.94/01-01-032/…
- Released **15 June 2026** · effective **1 January 2027** — **118 days from today** **[fact, corroborated across 4 independent secondary sources]**
- Applies to **banks, NBFCs, payments banks, housing finance companies and cooperative banks** **[fact]**
- Requires: **explicit consent before any promotional communication**; **per-product consent** (cannot be bundled); **no pre-ticked boxes / default-yes**; a **separate marketing opt-in**; **unsubscribe as easy as subscribe**; a **dedicated link where the customer can view every commercial communication they're subscribed to**; **one-year record retention**; and a **ban on dark patterns** **[fact]**

⚠️ **Verification gap:** the primary RBI PDF is behind a bot check and I did not retrieve the clause text. Everything above is from consistent secondary reporting (medianama, CorpLawUpdates, C4S, kotakneo, consent.in). **Clause-level language must be read before any of this is relied on.** Flagged in the rulebook as `SOURCE: SECONDARY`.

Compare the two deadlines:

| | DPDP Act | RBI RBC 2nd Amendment |
|---|---|---|
| Effective for the target | 13 May 2027 (**250 days**) | **1 Jan 2027 (118 days)** |
| Enforcer seated and active? | **No** — Board unseated as of Jun 2026, zero penalties ever | **Yes** — 79 enforcement actions FY24-25, ₹33 cr |
| Precedent on communications specifically? | None | **Yes — HDFC Bank penalised for contacting customers outside the permitted calling window** |
| Requires a retained record? | Consent records generally | **Explicit: one-year retention** |
| Scope | Everyone | Banks, NBFCs, PBs, HFCs, co-ops |

**[inference]** DPDP was the wrong deadline to watch. It's later, vaguer, and has nobody behind it. The RBI one is nearer, narrower, backed by a regulator with a live enforcement record, and it mandates *retention* — which is the evidence-record thesis written into law rather than argued for.

---

## Vertical selection — lending vs insurance vs healthcare

Scored on what actually matters for a pre-send check.

| | **Lending (banks/NBFCs)** | **Insurance** | **Healthcare** |
|---|---|---|---|
| Principal liable for agent | **Yes** — RE liable for LSP conduct (circular 12 Aug 2022, never repealed) | **Yes, statutory** — Insurance Act s.42, "the insurer shall be responsible for all the acts and omissions of its agents", up to ₹1 cr | **No equivalent** |
| Enforcement on communications | **Yes, named** — HDFC (calling window), Hero FinCorp (vernacular language), Shaha Finlease ₹10k (failure to review own FPC) | **Yes** — Policybazaar ₹5 cr (Aug 2025), Reliance General ₹1 cr (Dec 2025), ~14 orders in 2024 | **Weak** — NMC's 2023 hospital-ad rule **in abeyance** pending a Supreme Court PIL; DMR Act penalties near-nominal |
| Dated near-term mandate | **Yes — 1 Jan 2027** | No | No |
| Mandatory pre-approval gate already exists | No | **Yes** — Board-level Advertisement Committee (2 KMPs + 3 senior officials, quorum 3) | No |
| Obligation type | **Timing, sequence, who-contacted-whom, consent state** | Ad content vs policy provisions | Prohibited-claim lists |
| The artifact being judged | **Messages — digital, logged, high volume** | Ads + **verbal point-of-sale conversations** (largely unlogged) | Ads |
| Machine-checkable share | **High** | Medium — the misselling that generates complaints is mostly spoken | Medium |

**[inference] Lending wins, and for a specific reason, not a general one.**

The gap identified in `04_Market_Deep_Dive.md` was: *every compliance tool reviews the message; nobody reviews the list.* Lending's obligations **are list-and-log obligations** — what time did you contact them, in what language, in what sequence, with what consent, how often. Insurance's obligations are content obligations, which is the crowded side (MLR tools already do content). Healthcare's central rule is legally suspended.

**Insurance's Advertisement Committee is worth noting separately.** A statutorily mandatory pre-publication approval gate, run by a five-person committee, is *simultaneously* proof that people will accept a pre-flight gate and evidence that an incumbent process already occupies the slot. That's a workflow product for a committee, not a data product. Different business. Park it, don't discard it.

**Healthcare: drop it.** The NMC regulation being in abeyance removes the spine.

---

## The engineering constraint that shapes v1

From V3, and it's the most consequential technical finding so far:

**Per-contact send history is not retrievable from most providers.** **[fact]**
- **WATI** — documented, paginated, on the entry Growth plan: `GET /api/ext/v3/conversations/{target}/messages`
- **DoubleTick** — documented: `GET /chat-messages?wabaNumber=&customerNumber=&startDate=&endDate=`
- **Meta Cloud API direct** — **no history endpoint at all.** Push-only via webhooks. **Zero backfill.**
- **Gupshup, AiSensy, Interakt, Zoko** — no publicly documented history endpoint

Also: **no provider anywhere exposes a "user blocked or reported you" event.** Quality-rating decay is the only proxy, and it is delayed and non-specific. **[fact]**

Quality rating itself *is* obtainable — but from **Meta's Graph API** (`quality_rating`, `whatsapp_business_manager_messaging_limit`), as a property of the WABA, if the customer grants partner access. Gupshup's Partner API passes it through natively. **[fact]**

**→ Three consequences:**

1. **Every frequency rule has a cold start.** On day one the product knows nothing about past contact. It must become its own system of record from integration date forward. Any demo implying otherwise is dishonest.
2. **Therefore the first rules must be the ones that need no history.**
3. **Quality rating and history come from different places** — rating from Meta, history from the BSP. The integration is two-legged, not one.

---

## What is checkable with NO integration at all

Counting from the rulebook (`06_Layer_A_Rulebook_India.md`), given only: an audience file, the message, the channel, the scheduled send time, and a short business config —

**Nine rules evaluate at Tier 0.** Including the strongest lending rule in the whole set:

> **A-RBI-001 — recovery/collection contact only between 08:00 and 19:00 borrower local time.**
> Data needed: scheduled send time, recipient state/timezone, message purpose. **No history. No API. No integration.**
> Precedent: **HDFC Bank was penalised for exactly this.**

That is a real, enforced, named-precedent rule that a spreadsheet upload can check. **[inference]** It means a paste-and-check demo is not a toy — it can evaluate genuine obligations on day one, which is unusual for a compliance product and is the strongest argument for this shape.

---

## The tightened thesis

Each clause is defended by a named finding. If a clause can't name one, it doesn't belong.

> **A pre-send check for regulated lenders' outbound borrower communications** *(RBI RBC 2nd Amdt, 1 Jan 2027; RE-liable-for-LSP since Aug 2022)*
> **that evaluates the recipient list and the message in one pass** *(the MLR gap — content tools don't read lists)*
> **across the multiple vendors a lender actually sends through** *(no cross-vendor frequency layer exists anywhere)*
> **and retains a per-campaign record** *(one-year retention is mandated, not argued)*
> **for the compliance function, which is separate from the business by regulation** *(the CCO is barred from dual-hatting — a buyer who is structurally independent of the marketer whose campaign is being blocked).*

**That last clause may be the most important commercial fact found in two days of research.** The reason "blocking a send" is normally unsellable is that the buyer is the person being blocked. In a regulated lender, the CCO is *required* to be someone else, with their own mandate and budget. The org chart resolves the objection.

**[hypothesis]** — that's what it is until someone in a lender's compliance function confirms it.

---

## What this drops

Stated plainly, because narrowing is only real if things are actually let go:

- SMEs and D2C — economics don't clear (`04`, §5), and they don't feel the risk
- "Any industry, any region" — the region cartridge idea still holds architecturally, but it is not the v1
- Healthcare and edtech
- Insurance — parked, not killed
- BSPs as primary buyer — demoted in `04`, stays demoted
- Blocking the send — still the far end of the risk ladder, not v1

---

## Falsification plan — the cheapest ways to be wrong, in order

The point is that **you** decide, on evidence, not that I do.

| # | Test | Cost | Kills the idea if… |
|---|---|---|---|
| **1** | **Read the actual RBI RBC 2nd Amendment clause text.** Get the PDF (it's bot-blocked to me — a browser will open it fine, or a bank's compliance newsletter will quote it). | 1 hour, free | The consent/retention obligations are narrower than the secondary reporting implies, or apply only to point-of-sale, not outbound messaging. **This is the load-bearing fact. Test it first.** |
| **2** | **Ask one person in NBFC/bank compliance:** who owns outbound borrower messaging today, what are they doing about 1 Jan 2027, and what do they use now. | 1 conversation | They say "our platform handles it" or "legal reviews the templates once a year, we're fine." |
| **3** | **Open a WATI or AiSensy trial; check whether quality rating and per-contact history are visible.** | ~₹2-3k, an evening | Neither is reachable → tier-1 is not buildable, everything stays at paste-and-upload. |
| **4** | **Build the Tier-0 check for the 9 no-integration rules.** Deterministic, pure core, ~a weekend at the size of POC-1. Run a real campaign file through it. | 1-2 weekends | It finds nothing interesting on a real file, or every finding is one a human would have caught anyway. |
| **5** | **Show the mock report to a compliance person and watch their face.** Specifically: does *"checked 11 of 14 rules; 3 could not be evaluated"* read as honest or as useless? (Open question #3, still unanswered.) | 1 conversation | They read "cannot evaluate" as the product not working. |
| **6** | Only then: pricing, and whether it beats a ₹7L analyst. | — | — |

**Tests 1–3 cost almost nothing and are ordered by how much they'd change the picture.** Test 1 is a reading task. Tests 2 and 5 need a person — that's where your network beats any amount of searching, and it's the thing `Engineering_Learnings.md` says desk research cannot do.

---

## Honest risks, stated once and not repeated

- **Timing is brutal.** 118 days to a deadline is exciting for an incumbent and probably too short for a stranger. Lenders will be solving this now, with consultants and their existing vendors. **[inference]**
- **Regulated buyers don't buy from unknowns.** Selling compliance software to an RBI-regulated entity involves vendor due diligence, security review and procurement. This is the slowest possible customer.
- **The 2027 obligations are substantially a consent-UI problem** (pre-ticked boxes, a preference centre, dark patterns) — which is **product/engineering work inside the bank's own app**, not a pre-send check. A pre-send checker addresses the *downstream* half. That is a genuine scope mismatch and it deserves to be checked in test #2, not assumed away.
- **The primary source is unread.** Everything above rests on secondary reporting.

None of this is a reason not to keep exploring. It is the list of things that would have to be true.

---

## Next natural step

Test 1 is a reading task and I can't do it (bot-blocked). Test 4 — building the Tier-0 deterministic core — is a real weekend of work I *can* do, produces a reusable artifact either way, and follows the house pattern (pure core + tests + UI, per `Atlas/00_Governance/Build_Guidelines.md`). It is also the only test that produces something showable in tests 2 and 5.

The rulebook that would drive it is written: `06_Layer_A_Rulebook_India.md`.
