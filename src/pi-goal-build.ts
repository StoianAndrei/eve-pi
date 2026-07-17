import { PI_SCHEMATICS } from "@/const";
import { Tier, tierOf, nameOf } from "@/pi-tiers";
import { EvePraisalResult } from "@/eve-praisal";
import { priceOf } from "@/planet-economics";

/**
 * Goal (design v3) — "start at the item you want to build, the PI plan derives
 * from it." A build-cost / profit analyzer: pick a blueprint, set runs, and see
 * the bill of materials (PI rows highlighted + traceable to P0), the econ strip
 * (revenue, material cost, SCC fee, net profit, margin), the PI footprint in
 * factory-days, and a buy-all vs self-built-PI comparison.
 *
 * Sample blueprints & prices, exactly as the design frames it — a real impl
 * would search every blueprint from the SDE. PI material unit prices are live
 * (from our price source) with a sample fallback; non-PI mats use sample prices.
 */
export interface GoalMat {
  id: number;
  qty: number; // per run
  /** true = Planetary Industry product (name/tier/price come from our PI data) */
  pi?: boolean;
  /** non-PI display name */
  name?: string;
  /** sample unit price (ISK); PI mats fall back to this when no live price */
  price?: number;
}

export interface Goal {
  id: number;
  name: string;
  note: string;
  outPerRun: number;
  sell: number; // ISK per output unit (sample)
  runsDefault: number;
  mats: GoalMat[];
}

// Shared fuel-block PI sink (per 40 blocks) + market mats; isotope varies by type.
const FB_PI: GoalMat[] = [
  { id: 44, qty: 4, pi: true, price: 1200 }, // Enriched Uranium (P2)
  { id: 3689, qty: 4, pi: true, price: 1100 }, // Mechanical Parts (P2)
  { id: 9832, qty: 9, pi: true, price: 1150 }, // Coolant (P2)
  { id: 9848, qty: 1, pi: true, price: 6500 }, // Robotics (P2)
  { id: 3683, qty: 22, pi: true, price: 450 }, // Oxygen (P1)
];
const fbMarket = (isoId: number, isoName: string): GoalMat[] => [
  { id: isoId, name: isoName, qty: 415, price: 900 },
  { id: 16272, name: "Heavy Water", qty: 170, price: 120 },
  { id: 16273, name: "Liquid Ozone", qty: 350, price: 340 },
];
const fuelBlock = (
  id: number,
  name: string,
  isoId: number,
  isoName: string,
): Goal => ({
  id,
  name,
  note: "fuel block · 40 / run",
  outPerRun: 40,
  sell: 14_500,
  runsDefault: 800,
  mats: [...FB_PI, ...fbMarket(isoId, isoName)],
});

export const GOALS: Goal[] = [
  fuelBlock(4051, "Nitrogen Fuel Block", 17888, "Nitrogen Isotopes"),
  fuelBlock(4247, "Helium Fuel Block", 16274, "Helium Isotopes"),
  fuelBlock(4246, "Hydrogen Fuel Block", 17889, "Hydrogen Isotopes"),
  fuelBlock(4312, "Oxygen Fuel Block", 17887, "Oxygen Isotopes"),
];

const SCC_RATE = 0.04; // Secure Commerce Commission build fee

const BY_OUTPUT = new Map(
  PI_SCHEMATICS.map((s) => [s.outputs[0].type_id, s]),
);

/** Factory-days for one factory to make `units` of a PI product. */
const factoryDays = (id: number, units: number): number => {
  const sch = BY_OUTPUT.get(id);
  if (!sch) return 0;
  const perHour = sch.outputs[0].quantity / (sch.cycle_time / 3600);
  const perDay = perHour * 24;
  return perDay > 0 ? units / perDay : 0;
};

export interface GoalMatRow {
  id: number;
  name: string;
  isPi: boolean;
  tier: Tier | undefined;
  qtyRun: number;
  qtyTotal: number;
  unit: number;
  cost: number;
  traceable: boolean;
  srcLabel: string;
}

export interface GoalFootprint {
  id: number;
  name: string;
  tier: Tier | undefined;
  days: number;
}

export interface GoalAnalysis {
  goal: Goal;
  runs: number;
  outUnits: number;
  rows: GoalMatRow[];
  revenue: number;
  matCost: number;
  piCost: number;
  scc: number;
  profit: number;
  margin: number;
  footprint: GoalFootprint[];
  totalDays: number;
  fullBuy: number;
  selfBuild: number;
  saved: number;
}

export const goalBuild = (
  goalId: number,
  runs: number,
  piPrices: EvePraisalResult | undefined,
): GoalAnalysis => {
  const goal = GOALS.find((g) => g.id === goalId) ?? GOALS[0];
  const safeRuns = Math.max(1, Math.floor(runs) || 1);

  const rows: GoalMatRow[] = goal.mats.map((m) => {
    const tier = m.pi ? tierOf(m.id) : undefined;
    const live = m.pi ? priceOf(piPrices, m.id) : 0;
    const unit = live > 0 ? live : (m.price ?? 0);
    const qtyTotal = m.qty * safeRuns;
    const traceable = !!m.pi && (tier === "P2" || tier === "P3" || tier === "P4");
    return {
      id: m.id,
      name: m.pi ? nameOf(m.id) : (m.name ?? nameOf(m.id)),
      isPi: !!m.pi,
      tier,
      qtyRun: m.qty,
      qtyTotal,
      unit,
      cost: qtyTotal * unit,
      traceable,
      srcLabel: m.pi ? "your PI empire" : "market",
    };
  });

  const matCost = rows.reduce((s, r) => s + r.cost, 0);
  const piCost = rows.reduce((s, r) => s + (r.isPi ? r.cost : 0), 0);
  const revenue = safeRuns * goal.outPerRun * goal.sell;
  const scc = revenue * SCC_RATE;
  const profit = revenue - matCost - scc;
  const margin = revenue > 0 ? profit / revenue : 0;

  const footprint: GoalFootprint[] = rows
    .filter((r) => r.isPi)
    .map((r) => ({
      id: r.id,
      name: r.name,
      tier: r.tier,
      days: factoryDays(r.id, r.qtyTotal),
    }))
    .sort((a, b) => b.days - a.days);
  const totalDays = footprint.reduce((s, f) => s + f.days, 0);

  return {
    goal,
    runs: safeRuns,
    outUnits: safeRuns * goal.outPerRun,
    rows,
    revenue,
    matCost,
    piCost,
    scc,
    profit,
    margin,
    footprint,
    totalDays,
    fullBuy: matCost,
    selfBuild: matCost - piCost,
    saved: piCost,
  };
};

/** Compact ISK formatter (B / M / thousands). */
export const iskShort = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return Math.round(n).toLocaleString();
  return Math.round(n).toString();
};
