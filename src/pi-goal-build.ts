import { PI_SCHEMATICS, PI_PRODUCT_VOLUMES } from "@/const";
import { Tier, tierOf, nameOf } from "@/pi-tiers";
import { EvePraisalResult } from "@/eve-praisal";
import { priceOf } from "@/planet-economics";

/**
 * Goal (design v3, extended per eveindustry.app/planetary/factory-planner):
 * "start at the item you want to build — the PI plan derives from it."
 *
 * Pick a blueprint + runs and get the full factory read-out: the bill of
 * materials (Qty / Vol / Buy cost / Build cost, PI rows highlighted and
 * traceable to P0), production time, and the two economics summaries —
 * Full Buy (all mats from market) vs Full Build (buildable components made,
 * ME10) — with SCC fee, net profit, margin and per-unit, exactly as the
 * reference presents them. Our unique layer: the PI components (P1–P4) are
 * what your empire already produces, so "your PI empire keeps ≈ X" of the bill.
 *
 * Sample blueprints + prices (a real impl reads the SDE); PI unit prices are
 * live where available, with a sample fallback.
 */
export interface GoalMat {
  id: number;
  qty: number; // per run (may be fractional to match ME-adjusted totals)
  pi?: boolean;
  name?: string; // non-PI display name
  buy: number; // buy unit price (ISK)
  build?: number; // build unit price if the component is itself buildable
  vol?: number; // m³ per unit; PI mats fall back to PI_PRODUCT_VOLUMES
  buildable?: boolean;
}

export interface Goal {
  id: number;
  name: string;
  note: string;
  outPerRun: number;
  sell: number; // ISK per output unit (sample)
  runsDefault: number;
  perRunSec: number; // production time per run (post-skills)
  mats: GoalMat[];
}

const SCC_RATE = 0.04; // Secure Commerce Commission job fee (on output value)

// --- Sample blueprints -----------------------------------------------------

// Fuel block (per 40 blocks); isotope varies by type. PI sink: Enriched
// Uranium, Mechanical Parts, Coolant, Robotics (P2) + Oxygen (P1).
const FB_PI: GoalMat[] = [
  { id: 44, qty: 4, pi: true, buy: 1200 },
  { id: 3689, qty: 4, pi: true, buy: 1100 },
  { id: 9832, qty: 9, pi: true, buy: 1150 },
  { id: 9848, qty: 1, pi: true, buy: 6500 },
  { id: 3683, qty: 22, pi: true, buy: 450 },
];
const fbMarket = (isoId: number, isoName: string): GoalMat[] => [
  { id: isoId, name: isoName, qty: 415, buy: 900, vol: 0.15 },
  { id: 16272, name: "Heavy Water", qty: 170, buy: 120, vol: 0.4 },
  { id: 16273, name: "Liquid Ozone", qty: 350, buy: 340, vol: 0.4 },
];
const fuelBlock = (id: number, name: string, isoId: number, isoName: string): Goal => ({
  id,
  name,
  note: "fuel block · 40 / run",
  outPerRun: 40,
  sell: 14_500,
  runsDefault: 800,
  perRunSec: 1200,
  mats: [...FB_PI, ...fbMarket(isoId, isoName)],
});

// Mobile Tractor Unit — reproduces the eveindustry factory-planner read-out the
// user shared. 1 unit / run. PI components (Wetware Mainframe P4, Ukomi
// Superconductors P3, Organic Mortar Applicators P4) are self-suppliable.
const MOBILE_TRACTOR_UNIT: Goal = {
  id: 33475,
  name: "Mobile Tractor Unit",
  note: "deployable · 1 / run",
  outPerRun: 1,
  sell: 8_820_000,
  runsDefault: 800,
  perRunSec: 3264, // 54m 24s
  mats: [
    { id: 39, name: "Zydrine", qty: 853.2, buy: 1453.7, vol: 0.01 },
    { id: 2876, qty: 1, pi: true, buy: 2_087_500, vol: 50 }, // Wetware Mainframe (P4)
    { id: 17136, qty: 1.8, pi: true, buy: 73_472, vol: 3 }, // Ukomi Superconductors (P3)
    { id: 2870, qty: 1.8, pi: true, buy: 1_000_000, vol: 50 }, // Organic Mortar Applicators (P4)
    {
      id: 24348,
      name: "Small Tractor Beam I",
      qty: 1,
      buy: 2_325_000,
      build: 1_912_500,
      buildable: true,
      vol: 50,
    },
  ],
};

export const GOALS: Goal[] = [
  MOBILE_TRACTOR_UNIT,
  fuelBlock(4051, "Nitrogen Fuel Block", 17888, "Nitrogen Isotopes"),
  fuelBlock(4247, "Helium Fuel Block", 16274, "Helium Isotopes"),
  fuelBlock(4246, "Hydrogen Fuel Block", 17889, "Hydrogen Isotopes"),
  fuelBlock(4312, "Oxygen Fuel Block", 17887, "Oxygen Isotopes"),
];

// --- Engine ----------------------------------------------------------------

const BY_OUTPUT = new Map(PI_SCHEMATICS.map((s) => [s.outputs[0].type_id, s]));

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
  buildable: boolean;
  tier: Tier | undefined;
  qtyRun: number;
  qtyTotal: number;
  vol: number; // total m³
  buyUnit: number;
  buyCost: number;
  buildCost: number; // uses build price if buildable, else buy
  traceable: boolean;
  srcLabel: string;
}

export interface GoalFootprint {
  id: number;
  name: string;
  tier: Tier | undefined;
  days: number;
}

/** One economics summary (Full Buy or Full Build). */
export interface GoalSummary {
  matCost: number;
  scc: number;
  totalCost: number;
  revenue: number;
  net: number;
  margin: number; // net / matCost (matches the reference)
  perUnit: number; // net / output units
}

export interface GoalAnalysis {
  goal: Goal;
  runs: number;
  outUnits: number;
  rows: GoalMatRow[];
  totalVol: number;
  matBuy: number;
  matBuild: number;
  piCost: number;
  revenue: number;
  scc: number;
  buy: GoalSummary;
  build: GoalSummary;
  buildIsCheaper: boolean;
  footprint: GoalFootprint[];
  totalDays: number;
  perRunSec: number;
  totalSec: number;
}

const summarize = (matCost: number, revenue: number, outUnits: number): GoalSummary => {
  const scc = revenue * SCC_RATE;
  const totalCost = matCost + scc;
  const net = revenue - totalCost;
  return {
    matCost,
    scc,
    totalCost,
    revenue,
    net,
    margin: matCost > 0 ? net / matCost : 0,
    perUnit: outUnits > 0 ? net / outUnits : 0,
  };
};

export const goalBuild = (
  goalId: number,
  runs: number,
  piPrices: EvePraisalResult | undefined,
): GoalAnalysis => {
  const goal = GOALS.find((g) => g.id === goalId) ?? GOALS[0];
  const safeRuns = Math.max(1, Math.floor(runs) || 1);
  const outUnits = safeRuns * goal.outPerRun;

  const rows: GoalMatRow[] = goal.mats.map((m) => {
    const tier = m.pi ? tierOf(m.id) : undefined;
    const live = m.pi ? priceOf(piPrices, m.id) : 0;
    const buyUnit = live > 0 ? live : m.buy;
    const buildUnit = m.buildable && m.build ? m.build : buyUnit;
    const qtyTotal = m.qty * safeRuns;
    const volUnit = m.vol ?? (m.pi ? PI_PRODUCT_VOLUMES[m.id] ?? 0 : 0);
    const traceable = !!m.pi && (tier === "P2" || tier === "P3" || tier === "P4");
    return {
      id: m.id,
      name: m.pi ? nameOf(m.id) : m.name ?? nameOf(m.id),
      isPi: !!m.pi,
      buildable: !!m.buildable,
      tier,
      qtyRun: m.qty,
      qtyTotal,
      vol: qtyTotal * volUnit,
      buyUnit,
      buyCost: qtyTotal * buyUnit,
      buildCost: qtyTotal * buildUnit,
      traceable,
      srcLabel: m.pi ? "your PI empire" : m.buildable ? "buildable component" : "market",
    };
  });

  const matBuy = rows.reduce((s, r) => s + r.buyCost, 0);
  const matBuild = rows.reduce((s, r) => s + r.buildCost, 0);
  const piCost = rows.reduce((s, r) => s + (r.isPi ? r.buyCost : 0), 0);
  const totalVol = rows.reduce((s, r) => s + r.vol, 0);
  const revenue = outUnits * goal.sell;

  const footprint: GoalFootprint[] = rows
    .filter((r) => r.isPi)
    .map((r) => ({ id: r.id, name: r.name, tier: r.tier, days: factoryDays(r.id, r.qtyTotal) }))
    .sort((a, b) => b.days - a.days);

  return {
    goal,
    runs: safeRuns,
    outUnits,
    rows,
    totalVol,
    matBuy,
    matBuild,
    piCost,
    revenue,
    scc: revenue * SCC_RATE,
    buy: summarize(matBuy, revenue, outUnits),
    build: summarize(matBuild, revenue, outUnits),
    buildIsCheaper: matBuild < matBuy,
    footprint,
    totalDays: footprint.reduce((s, f) => s + f.days, 0),
    perRunSec: goal.perRunSec,
    totalSec: goal.perRunSec * safeRuns,
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

/** Duration formatter: 2,611,200s -> "30d 5h 20m"; 3264s -> "54m 24s". */
export const dur = (sec: number): string => {
  const s = Math.round(sec);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
};
