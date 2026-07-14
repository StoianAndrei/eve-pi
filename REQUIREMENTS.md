# eve-pi / albi — Requirements & Competitive Landscape

Living doc. Consolidates what we've built, what the reference tools do well, and a
prioritized backlog. Nothing here is committed to the app — it's the roadmap the
design work feeds.

---

## What we've built (design references in this bundle)
`Albi PI.dc.html` + the `src/` files implement:
- **Planets (pipeline)** — P0 extract → P1 import → P2 export, per planet, tier-colored.
- **Your Week** — estate haul manifest (fly-in / fly-out, Epithal loads).
- **Rebalance** — red-planet product-swap advisor.
- **Empire summary strip** — value/hr, P2 to carry out, uptime, losing planets.
- **Classic Table** — faithful recreation of today's view.

These cover prompt-pack **P1, P2, P3, P5, P6, P9**.

---

## Competitive landscape

| Tool | What it's for | Does well | We should… |
|---|---|---|---|
| **eve-pi / albi** (baseline) | Track extractors across characters | Multi-char SSO, extractor timers, alerts, 3D planet behind a click, browser-local | this is our base — extend it |
| **Industrial EVE** (industrialeve.com) | PI + **Discord notifications** | Push/Discord timer alerts, auto SSO data refresh, PI System Explorer (chain ladder + planet-by-region search), Colony Builder w/ community templates | steal **notifications** & **chain explorer**; its `/planets/` hero-planet view is *too loud* — avoid |
| **Adam4EVE** (`pi_chain.php`, `pi_rank.php`) | PI **economics** reference | Whole-chain back-trace flow diagram to P0 leaves; **customs + market tax model**; hub + buy/sell + current/1mo/6mo pricing; profitability ranking; tooltips w/ formulas | adopt its **tax model** and **pricing controls**; mirror **profitability ranking** |
| **EVE-Webtools** (Planetary) | Layout **setup builder** | Drag facilities/links, skill + CC + planet-radius aware, "will it fit" check | reference for a future Colony Builder |
| **EVE OS** | Manufacturing chains | Build-vs-buy "Idiot Index", real-time hub data, 1-click buy orders | reference for P7 build-vs-buy |

**Design lesson (from Industrial EVE's `/planets/`):** don't let a big hero planet render crowd out the operational data. Keep the planet a small affordance; the 3D view stays behind a click (as eve-pi already does). Our pipeline cards are correctly data-forward.

**Design lesson (from Adam4EVE):** tooltips with the actual formula on every number; every assumption (tax, hub, price basis, cadence, buffer) is an editable control, not a constant.

---

## Prioritized backlog

### R1 — Tax-aware economics *(HIGH · Adam4EVE · extends P2/P5)*
Add **customs (POCO) tax** and **market/broker tax** to every ISK figure.
- Per-node + global default rates; persist in the Assumptions store.
- **Rule:** import of P(x) and export of P(x+1) are the *same* customs office → taxed once; **P0 customs not counted**.
- Feeds ISK/hr (net), the manifest's per-trip tax, and Rebalance projections.
- Implementation: extend `planet-economics.ts` (`iskPerHourNet` subtracts customs on exported P2 + on imported P1, market tax on sales). Today it ignores tax — biggest accuracy gap.

### R2 — Pricing controls *(HIGH · Adam4EVE · extends P2)*
Replace the single Jita-sell figure with: **hub** (Jita/Amarr/Dodixie/Rens), **buy vs sell orders** (separately for selling output and buying inputs), **price basis** (current / 1-mo / 6-mo avg).
- Blocker: `EvePraisalResult` only carries `prices.sell.min`. Needs a richer price source (Adam4EVE API, ESI market, or Fuzzwork). Scope the data source first.

### R3 — Chain Explorer *(MED · Industrial EVE + Adam4EVE · = prompt-pack "Chain Planner")*
Read-only reference: pick any P1–P4 target → back-trace the full tree to P0 leaves, each node showing facility, cycle time, in/out quantities, volume, and (with R1/R2) ISK. Planet-type filter.
- **All data already in `const.ts`** (`PI_SCHEMATICS`, cycle times, `PI_TYPES_MAP` group_ids). Reuses `pi-tiers.ts`. Low risk; do this next.

### R4 — Profitability ranking *(MED · Adam4EVE `pi_rank` · = prompt-pack E10/E11, P6/P7)*
"Which chain is most profitable right now" — ranked table across all P2/P3/P4, tax- and price-aware. Powers smarter Rebalance suggestions.

### R5 — Notifications *(HIGH · Industrial EVE differentiator)*
Rules → Discord webhook / browser push: extractor expires < Nh, launchpad > N%, import buffer < Nh, off-balance. **Triggers already computed** in the alert model — this is delivery, not new math. A rules panel + webhook config.

### R6 — Planet finder by region/system *(MED/LOW · Industrial EVE)*
"Where can I extract X near Y" / "what does planet Z yield." Needs planet-type↔resource map + ESI universe/region search eve-pi lacks. Larger data task.

### R7 — Colony Builder + community templates *(LOW · large · Industrial EVE, EVE-Webtools)*
Drag-facility layout designer with shareable/community templates. Separate project; eve-pi has `PinsCanvas3D` + `PlanetConfig` as a starting point.

### R8 — Planet-combination recommender *(MED · EVE OS `industry/planetary`)*
Abstract "which planet *types* do I need for X" answer, no concrete system required
(complements our System Planner, which needs one). From the EVE OS teardown:
one resource planet per required P0, except the **factory hub planet also
extracts every required P0 its type can** ("Hub and Spoke"); efficiency badge =
P0s covered / required. Data already in `pi-planets.ts` (`PLANET_P0`) +
`pi-chain.ts` (`buildChain` leaves). Improvement over EVE OS: scale the
facility counts with our chain ratios instead of their static 1 adv / 1 basic /
N extractors template.

### R9 — Materials-grid investigator view *(MED/LOW · EVE OS)*
Whole-graph column view (Planets → P0 → P1 → P2 → P3 → P4) with three-state
ancestry highlighting and edge lines on selection. Mechanism (from their DOM):
static type_id-keyed nodes; on select, walk the recipe tree up and mark
ancestors `highlighted` (+ which side an edge anchors), everything else
`dimmed`; edges are absolutely-positioned rotated divs computed from node DOM
positions, toggleable. All client-side, no backend. Also: source-planet chips
on recipe-tree P0 leaves — cheap add to our Chain Explorer ladder.

---

## Teardown notes — EVE OS Planetary Industry Visualizer (2026-07)

Captured from the rendered DOM of `eveos.space/industry/planetary` with
Self-Harmonizing Power Core selected:

- **Static SPA**: SDE-derived tables baked into the JS bundle; every node has
  `data-item-id` = type_id; icons from `images.evetech.net`; works logged out.
  Same data architecture as our `const.ts` — no server round-trips.
- **Selection model**: `selected` on the target, `highlighted input-left
  output-right` on recipe ancestors + sourcing planet types, `dimmed`
  otherwise.
- **Plan panel**: required P0 leaves (each with all extracting planet types),
  the hub-and-spoke combination (8 spokes + 1 hub for 9 P0s; only the hub
  doubles up on P0s — Lava spokes were NOT merged even though one Lava could
  extract both Felsic Magma and Suspended Plasma), and template facility
  counts (1 advanced / 1 basic / extractors = spoke count) — **not**
  throughput-scaled.
- **Where we're already ahead**: real want-vs-have factory math (Goal
  Planner), live prices + tax model (Chain Explorer/Ranking), live ESI system
  inventories (System Planner), per-character logistics (Your Week).

## Prompt-pack mapping
- Built (design): **P1** pipeline, **P2** value/hr, **P3** factories/uptime, **P5** manifest, **P6** rebalance, **P9** remove Empire.
- Backlog: **R1** deepens P2/P5 (tax), **R2** deepens P2 (pricing), **R3** = Chain Planner, **R4** = P7 reliability/ranking, **R5** = notifications (new), **R6/R7** = later IA (E0/E-series).

## Three inputs still to confirm (from the prompt pack)
1. Haul-manifest column meaning (net-per-period vs prices).
2. Import buffer multiple (~4×) + base units (10k vs 50k) — *resolved in design as 10,000 m³ launchpad ≈ 52.6k P1 units; 4.5× the 48h draw.*
3. Counterpart pairing — *resolved: Construction Blocks = Toxic + Reactive; Enriched Uranium = Toxic + Precious.*
