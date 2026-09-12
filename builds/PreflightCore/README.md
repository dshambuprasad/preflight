# Preflight Core — Tier 0

Deterministic pre-send check for an Indian lender's outbound borrower communications.
**Tier 0** means every rule here works with no integration at all: an audience file, the message, the channel, a scheduled time, a little config.

This is falsification test #4 from `../../docs/05_Scope_Tightening.md` — built to find out whether a paste-and-check tool finds anything a human wouldn't, not to ship.

---

## Run it

```bash
node --test                                                    # 14 tests
node cli.js sample/collections_campaign.json sample/contacts.csv
node cli.js sample/promotional_campaign.json sample/contacts.csv 2027-02-01T10:00:00+05:30
```

The browser version needs a server (ES modules don't load over `file://`):

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

---

## The nine rules

| ID | Check | Severity |
|---|---|---|
| A-RBI-001 | Recovery contact only 08:00–19:00 IST | block |
| A-RBI-002 | Microfinance recovery only 09:00–18:00 IST | block |
| A-RBI-012 | Sales/promotional contact only 09:00–19:00 IST | warn → **block 1 Jan 2027** |
| A-RBI-003 | Message in the borrower's stated language | warn |
| A-RBI-005 | A frequency cap exists at all | info |
| A-RBI-006 | Explicit consent before promotional contact | warn → **block 1 Jan 2027** |
| A-RBI-008 | Promotional message carries an opt-out | warn → **block 1 Jan 2027** |
| A-RBI-011 | Lender identity appears in the message | warn |
| A-WA-003 | WhatsApp template variables match the body | block |

Citations, source-confidence marks and the full 22-rule book: `../../docs/06_Layer_A_Rulebook_India.md`.

---

## Design commitments

- **Pure core, DOM-free.** `src/engine.js` has no I/O. `cli.js` and `index.html` are shells.
- **`now` is injected, never read.** Same input → byte-identical output, asserted in the tests. Three obligations commence 1 Jan 2027, so "what does this look like in January" is a parameter, not a rebuild.
- **A rule that could not be evaluated is never a pass.** It lands in `coverage.cannotEvaluate` and is counted separately. This is the single invariant most worth keeping.
- **No verdict.** `summary.verdict` is permanently `null`. The tool finds gaps for human review; it does not certify compliance. There's a test that enforces this.
- **Ambiguity resolves strict.** A message with both service and promotional language is evaluated as promotional, and says so.
- **Absence of a consent record is not consent.** Blank fields count as not-consented once *any* contact states consent; if *no* contact does, the rule is unevaluable rather than passing.

---

## What running it actually showed

On the 12-contact sample, the collections campaign produced **2 blockers, 2 warnings, 1 info** — and two of those are things a human would plausibly miss: the 20:15 send time (a reasonable-sounding "catch them after work" choice that breaches the recovery window) and a template with three placeholders but two variables supplied.

**But A-RBI-003 flagged 6 of 12 recipients**, because they have a non-English stated language and the message is in Latin script. In real Indian lending, romanised Hindi is normal and perfectly acceptable. **That is a cry-wolf rate high enough to get the tool switched off** — the exact failure mode named in `03_Open_Questions.md`. It is the first thing to tune, and it is an argument for the rule needing a "romanised is acceptable" flag per lender rather than a global assumption.

Finding that by running it, rather than reasoning about it, is the point of building this.

---

## Honest limits

- **Not legal advice.** Several rules are marked `SOURCE: SECONDARY` — the primary RBI text for the 1 Jan 2027 obligations has not been read. Falsification test #1.
- **No history, so no real frequency check.** A-RBI-005 only checks that a cap *exists*. Enforcing it needs send history, which is Tier 1 — and which most Indian BSPs do not expose (`../../docs/research/V3_BSP_API_Capability.md`).
- **Script detection, not language detection.** Devanagari cannot distinguish Hindi from Marathi. The finding says so.
- **Classification is a keyword heuristic.** It will miss novel phrasing. An LLM belongs here eventually; the deterministic core does not.
- **The browser page has not been visually verified** — it can't be reached from where this was built. Logic and imports are checked; the layout is not.
- **This checks a file, not a send.** Whether the campaign that was checked is the campaign that went out is unverifiable from here. The concept note commits to never overclaiming this.
