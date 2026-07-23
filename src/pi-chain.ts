import { PI_SCHEMATICS, PI_TYPES_MAP, PI_PRODUCT_VOLUMES } from "@/const";
import { EvePraisalResult } from "@/eve-praisal";
import { Tier, tierOf, nameOf } from "@/pi-tiers";

/**
 * R3/R4 — chain engine ported from the design handoff's pi-data.js prototype,
 * driven by the repo's real PI_SCHEMATICS + PI_TYPES_MAP and live market prices
 * instead of the prototype's sample dataset.
 *
 * buildChain(): back-trace any P2/P3/P4 to its P0 leaves — facility, cycle,
 * units/hr and factory count per node — with a tax-aware econ summary per one
 * top-tier factory (customs estimate + market tax). rankChains(): every target
 * ranked by net ISK/hr.
 *
 * Prices are Jita (SessionContext.piPrices). The prototype's hub multipliers
 * and 1mo/6mo price bases were sample data — a real multi-hub source is R2.
 */

type Schematic = (typeof PI_SCHEMATICS)[number];

const BY_OUTPUT = new Map<number, Schematic>(
  PI_SCHEMATICS.map((s) => [s.outputs[0].type_id, s]),
);

const TIER_ORDER: Tier[] = ["P0", "P1", "P2", "P3", "P4"];

export const volOf = (typeId: number): number =>
  PI_PRODUCT_VOLUMES[typeId] ?? 0;

export const facilityOf = (typeId: number): string => {
  const t = tierOf(typeId);
  if (t === "P0") return "Extractor";
  if (t === "P1") return "Basic Industry Facility";
  if (t === "P4") return "High-Tech Production Plant";
  return "Advanced Industry Facility";
};

export type OrderSide = "sell" | "buy";

/** Unit price from the live appraisal. sell = lowest sell order; buy = highest buy order. */
export const unitPrice = (
  piPrices: EvePraisalResult | undefined,
  typeId: number,
  side: OrderSide = "sell",
): number => {
  const prices = piPrices?.appraisal.items.find(
    (a) => a.typeID === typeId,
  )?.prices;
  if (!prices) return 0;
  if (side === "buy") return prices.buy.max || prices.sell.min || 0;
  return prices.sell.min || 0;
};

export interface ChainOptions {
  /** POCO customs tax %, applied once per tier crossed (P0 customs excluded). */
  customsPct?: number;
  /** Market tax % (broker + sales) on the sold output. */
  marketPct?: number;
  /** How the output is sold: to sell orders (patient) or buy orders (instant). */
  sellSide?: OrderSide;
  /** Price basis used for non-target nodes (informational). */
  buySide?: OrderSide;
}

export interface ChainNode {
  id: number;
  name: string;
  tier: Tier | undefined;
  facility: string;
  cycleTime: number;
  outQty: number;
  perHour: number;
  volume: number;
  unitPrice: number;
  factories: number;
  inputs: { id: number; name: string; qty: number }[];
}

export interface ChainTierGroup {
  tier: Tier;
  nodes: ChainNode[];
}

export interface ChainResult {
  targetId: number;
  targetPerHour: number;
  nodes: ChainNode[];
  byTier: ChainTierGroup[];
  gross: number; // ISK/hr before tax
  marketTax: number; // ISK/hr
  customsTax: number; // ISK/hr (estimate: once per tier crossed)
  net: number; // ISK/hr
  margin: number; // 0..1
  perUnit: number; // net ISK per output unit
  missingPrice: boolean;
}

export const buildChain = (
  targetId: number,
  piPrices: EvePraisalResult | undefined,
  {
    customsPct = 5,
    marketPct = 3.6,
    sellSide = "sell",
    buySide = "sell",
  }: ChainOptions = {},
): ChainResult | null => {
  const root = BY_OUTPUT.get(targetId);
  if (!root) return null;

  const rates = new Map<number, number>();
  const add = (id: number, perHour: number) => {
    rates.set(id, (rates.get(id) ?? 0) + perHour);
    const s = BY_OUTPUT.get(id);
    if (!s) return; // P0 leaf
    const cyclesPerHour = perHour / s.outputs[0].quantity;
    s.inputs.forEach((i) => add(i.type_id, i.quantity * cyclesPerHour));
  };
  const targetPerHour = root.outputs[0].quantity * (3600 / root.cycle_time);
  add(targetId, targetPerHour);

  const nodes: ChainNode[] = Array.from(rates.entries())
    .map(([id, perHour]) => {
      const s = BY_OUTPUT.get(id);
      const outQty = s?.outputs[0].quantity ?? 0;
      return {
        id,
        name: nameOf(id),
        tier: tierOf(id),
        facility: facilityOf(id),
        cycleTime: s?.cycle_time ?? 0,
        outQty,
        perHour,
        volume: volOf(id),
        unitPrice: unitPrice(piPrices, id, id === targetId ? sellSide : buySide),
        factories: s
          ? Math.max(1, Math.round(perHour / (outQty * (3600 / s.cycle_time))))
          : 0,
        inputs:
          s?.inputs.map((i) => ({
            id: i.type_id,
            name: nameOf(i.type_id),
            qty: i.quantity,
          })) ?? [],
      };
    })
    .sort(
      (a, b) =>
        TIER_ORDER.indexOf(a.tier ?? "P0") - TIER_ORDER.indexOf(b.tier ?? "P0") ||
        b.perHour - a.perHour,
    );

  const sellPrice = unitPrice(piPrices, targetId, sellSide);
  const gross = targetPerHour * sellPrice;
  const marketTax = gross * (marketPct / 100);
  // Customs applies once per POCO transfer as goods climb tiers; P0 customs
  // excluded. tiersCrossed: P2 = 2, P3 = 3, P4 = 4 (estimate, per prototype).
  const tiersCrossed = TIER_ORDER.indexOf(tierOf(targetId) ?? "P0");
  const customsTax = (customsPct / 100) * gross * tiersCrossed;
  const net = gross - marketTax - customsTax;

  const byTier = TIER_ORDER.map((tier) => ({
    tier,
    nodes: nodes.filter((n) => n.tier === tier),
  })).filter((g) => g.nodes.length > 0);

  return {
    targetId,
    targetPerHour,
    nodes,
    byTier,
    gross,
    marketTax,
    customsTax,
    net,
    margin: gross > 0 ? net / gross : 0,
    perUnit: targetPerHour > 0 ? net / targetPerHour : 0,
    missingPrice: sellPrice === 0,
  };
};

// ---------------------------------------------------------------------------
// Proportional flow tree (un-united): the target at the root, each input a
// child sized by its units/hr, recursively down to P0. Renders as an icicle —
// a parent card spans exactly the combined width of its children.
// ---------------------------------------------------------------------------

export interface FlowNode {
  id: number;
  name: string;
  tier: Tier | undefined;
  facility: string;
  perHour: number;
  factories: number;
  unitPrice: number;
  inQty: number; // units consumed per one unit of the parent (recipe ratio)
  children: FlowNode[];
}

export const chainFlow = (
  targetId: number,
  piPrices: EvePraisalResult | undefined,
  { buySide = "sell" }: Pick<ChainOptions, "buySide"> = {},
): FlowNode | null => {
  const root = BY_OUTPUT.get(targetId);
  if (!root) return null;

  const build = (id: number, perHour: number, inQty: number): FlowNode => {
    const s = BY_OUTPUT.get(id);
    const outQty = s?.outputs[0].quantity ?? 0;
    const cyclesPerHour = s && outQty > 0 ? perHour / outQty : 0;
    return {
      id,
      name: nameOf(id),
      tier: tierOf(id),
      facility: facilityOf(id),
      perHour,
      factories: s ? Math.max(1, Math.round(perHour / (outQty * (3600 / s.cycle_time)))) : 0,
      unitPrice: unitPrice(piPrices, id, buySide),
      inQty,
      children: s ? s.inputs.map((i) => build(i.type_id, i.quantity * cyclesPerHour, i.quantity)) : [],
    };
  };

  const targetPerHour = root.outputs[0].quantity * (3600 / root.cycle_time);
  return build(targetId, targetPerHour, 1);
};

export interface ChainTarget {
  id: number;
  name: string;
  tier: Tier;
}

/** Selectable targets (every P2/P3/P4 with a schematic), sorted tier then name. */
export const CHAIN_TARGETS: ChainTarget[] = Array.from(BY_OUTPUT.keys())
  .filter((id) => {
    const t = tierOf(id);
    return t === "P2" || t === "P3" || t === "P4";
  })
  .map((id) => ({ id, name: nameOf(id), tier: tierOf(id) as Tier }))
  .sort((a, b) =>
    a.tier === b.tier
      ? a.name.localeCompare(b.name)
      : a.tier.localeCompare(b.tier),
  );

export interface RankRow {
  id: number;
  name: string;
  tier: Tier;
  net: number;
  gross: number;
  perUnit: number;
  nodeCount: number;
}

/** R4 — every P2/P3/P4 ranked by net ISK/hr per top-tier factory (full build). */
export const rankChains = (
  piPrices: EvePraisalResult | undefined,
  opts: ChainOptions = {},
): RankRow[] =>
  CHAIN_TARGETS.map(({ id, name, tier }) => {
    const c = buildChain(id, piPrices, opts);
    return {
      id,
      name,
      tier,
      net: c?.net ?? 0,
      gross: c?.gross ?? 0,
      perUnit: c?.perUnit ?? 0,
      nodeCount: c?.nodes.length ?? 0,
    };
  }).sort((a, b) => b.net - a.net);

/** Compact ISK formatter: 1.25B / 12.4M / 950k / 42. */
export const fmtIsk = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}k`;
  return `${sign}${abs.toFixed(0)}`;
};

/** Plain-text build plan for the clipboard ("copy build plan" in the prototype). */
export const buildPlanText = (chain: ChainResult): string => {
  const lines: string[] = [
    `PI build plan — ${nameOf(chain.targetId)} (${chain.targetPerHour.toFixed(0)} u/h per top-tier factory)`,
    `Net ${fmtIsk(chain.net)} ISK/h · gross ${fmtIsk(chain.gross)} · customs -${fmtIsk(chain.customsTax)} · market -${fmtIsk(chain.marketTax)} · margin ${(chain.margin * 100).toFixed(1)}%`,
    ``,
  ];
  chain.byTier.forEach((g) => {
    lines.push(`${g.tier}:`);
    g.nodes.forEach((n) => {
      const fac =
        n.tier === "P0" ? "extract" : `${n.factories}× ${n.facility}`;
      lines.push(
        `  ${n.name} — ${n.perHour.toFixed(0)} u/h · ${fac}${
          n.inputs.length
            ? ` · in: ${n.inputs.map((i) => i.name).join(" + ")}`
            : ""
        }`,
      );
    });
  });
  return lines.join("\n");
};
