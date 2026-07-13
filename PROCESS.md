# The Profit Process — how we run PI to maximise ISK

Living doc. This is the operating doctrine the tool encodes: every tab exists to
answer one step of this process. REQUIREMENTS.md tracks the backlog; this file
tracks *why* the tool makes the recommendations it makes.

---

## The core model: value concentrates as it climbs tiers

**P0 stays. P1 flows. P2+ leaves.**

- **P0 (raw)** is nearly worthless per unit and bulky per ISK. It is *never*
  hauled off-planet. Hauling P0 is the single most common way PI empires
  quietly lose money.
- **P1 (refined)** is the currency of the empire. One basic factory turns
  3,000 P0 into 20 P1 per cycle — a massive compression in both units and
  volume. P1 moves *between our own planets and characters* (internal
  transfers are free — no market is involved), never to market unless it's
  genuine surplus.
- **P2/P3/P4 (export tiers)** are the only things that leave for market.
  Value is realised at the sale of the export tier; everything below it is
  internal plumbing.

Every profit decision follows from this: extract where the planet is rich,
refine on the spot, cross-feed P1 between our own colonies, and carry out only
the highest tier we can sustainably build.

## The loop

The empire runs on a repeating loop. Each step has a tab.

### 1. Extract at full health — *Planets tab, Alts extraction health*

Extraction is the free input to everything; an idle or under-performing
extractor is pure opportunity cost.

- Every alt should have all extractors running (6/6), pulling P0 the current
  goal actually consumes.
- We flag any character below a P0-per-2-days floor (default 1.6M units).
  Head rates decay across an extraction program, so we leave headroom on
  anything we depend on rather than planning at peak rate.
- Notifications exist so an expired extractor costs hours, not days.

### 2. Refine locally, cross-feed internally — *Planets (pipeline) view*

Each extractor planet refines its own P0 → P1 and runs advanced factories fed
by its local P1 plus the *counterpart* P1 flown in from a sibling colony. The
pipeline card makes the three lanes explicit: **extract (stays) → import
(comes in) → export (goes out)**. A planet importing two P1s while refining
one it doesn't use is mis-assigned — that's a swap, not a relocation.

Internal transfers between our own characters in the same system are free.
The manifest marks a deficit "same system: <alt>" when a sibling produces it —
that line should never be a market buy.

### 3. Pick what to build with live prices — *Ranking + Chain Explorer*

"What is most profitable right now" is a market question, answered with live
data, not habit:

- **Ranking** orders every P2/P3/P4 by net ISK/hr per top-tier factory, full
  build from P0, tax- and price-aware. This is the shortlist.
- **Chain Explorer** back-traces a candidate to its P0 leaves: which planets
  it needs, how many factories per stage, what taxes take out of it.
  Controls that change the answer: **hub** (Jita/Amarr/Dodixie/Rens),
  **sell to buy orders vs. sell orders**, **customs %** (taxed once per tier
  crossed, P0 excluded) and **market %**.
- Higher tiers concentrate value per m³ enormously (a P4 chain runs ~76%
  margin on gross at 5% customs / 3.6% market) — but they also multiply the
  factory and logistics footprint. The ranking tells us when the premium is
  real.

### 4. Commit to a goal and gap it — *Goal Planner ("I want to build")*

Once a target is chosen (e.g. **Broadcast Node × 4 plants**), the decision is
mechanical — the data makes it:

- **Factories want vs. have** per stage: the chain fixes exact ratios
  (per P4 plant: 2 factories per P3 kind, 4 per P2 kind, 4 per P1 kind —
  doubled where two recipes share a P1). We build the *need* column, nothing
  more.
- **Raw materials want vs. have** in units/hr against live head rates, with
  "extract here" vs "haul in" sourcing per P0.
- **Planet verdicts** — the cheapest change wins, in order:
  1. **Keep** — already pulling a P0 the chain needs.
  2. **Repurpose in place** — same planet, move extractor heads to a deficit
     P0 the planet type can yield, retask factories to the P1 it feeds.
     Nearly free.
  3. **Destroy & rebuild** — only when the planet type yields nothing the
     chain needs.
  Relocation is the last resort; schematics are cheap to change, colonies are
  expensive to move.
- **Stop making more** — a stockpile larger than days of demand is dead ISK
  and a planet making the wrong thing. If the target chain doesn't consume
  it, the verdict is stop & repurpose; if it does, the stock is a buffer, not
  a problem.

### 5. Haul on a cadence, not on panic — *Your Week (per character)*

Logistics is scheduled, batched, and exact:

- Per character, per trip: **carry OUT** the export-tier surplus, **bring IN**
  the listed inputs — exact units, computed from factory draw × cadence.
- Import buffers are sized at ~4× the visit-interval draw so a late trip
  never idles a factory. A launchpad (10,000 m³) holds ≈ 52.6k P1 — about
  4.5× a 48h draw. Uptime is a straight profit multiplier: a factory at 89%
  uptime earns 89% of its ISK.
- One Epithal, planned loads, minimum trips. Internal cross-feeds before any
  market buy; market buys are the exception, listed explicitly.

### 6. Fix the red, then re-rank — *Rebalance + Notifications*

- A planet producing at a loss is almost always **mis-assigned, not
  mis-located**: it refines a P1 it doesn't consume while importing a
  different one. The fix is to swap advanced schematics (often pairwise
  between two planets) so each consumes its *local* P1 and imports only the
  shared input. No colony moves.
- Notifications (extractor expiry, storage fill, buffer coverage) keep the
  loop closed without logging in: the empire tells us when it needs a visit.
- Prices move. Re-check Ranking periodically; when the leader changes by
  enough to cover the switching cost (schematic changes + a few days of
  ramp), re-run the Goal Planner at the new target.

## The rules of thumb the tool enforces

| Rule | Where |
|---|---|
| Never haul P0; refine it where it lands | Pipeline lanes |
| Internal P1 transfers are free; market buys are last resort | Manifest source hints |
| Only the export tier leaves the planet | Pipeline / Manifest |
| Taxes are real: customs once per tier crossed + market tax at sale | Chain Explorer, Ranking |
| Build exactly the factory ratios the chain fixes — no more | Goal Planner stages |
| Repurpose > rebuild > relocate | Goal Planner verdicts |
| A big stockpile of a non-target commodity = a planet doing the wrong job | Stop-making-more table |
| Buffer imports ~4× the visit cadence; uptime is a profit multiplier | Buffer coverage, uptime meter |
| Extraction decays — plan with headroom, flag under-performing alts | Alts health |
| Decide from live prices, re-decide on cadence | Ranking + Fuzzwork prices |

## Known gaps (kept honest)

- Per-planet ISK/hr doesn't yet subtract customs/market tax (R1) — the Chain
  Explorer and Ranking do; the planet cards show gross-based net.
- Price basis is current orders only; 1-month/6-month averages need a history
  source (R2).
- Extraction "have/hr" uses current head rates and doesn't model program
  decay curves — hence the headroom rule.
- The repurpose allocator estimates each reassigned planet at the system's
  average head rate; treat assignment order as guidance.
