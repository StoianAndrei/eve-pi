import { PI_SCHEMATICS } from "@/const";
import { Tier, tierOf, nameOf } from "@/pi-tiers";
import { buildChain } from "@/pi-chain";
import { EvePraisalResult } from "@/eve-praisal";
import { PLANET_P0, PlanetType } from "@/pi-planets";

/**
 * R8 + R9 — the "investigator": whole-graph ancestry model + hub-and-spoke
 * planet-combination recommender, per the EVE OS teardown in REQUIREMENTS.md.
 *
 * Pure logic; the Investigator component renders columns from COLUMNS, asks
 * investigate() which nodes/edges light up for a selection, and shows the
 * planetCombination() plan. Facility counts come from the chain engine's real
 * throughput ratios (our improvement over EVE OS's static template).
 */

const BY_OUTPUT = new Map(PI_SCHEMATICS.map((s) => [s.outputs[0].type_id, s]));

export const PLANET_TYPES: PlanetType[] = [
  "barren",
  "gas",
  "ice",
  "lava",
  "oceanic",
  "plasma",
  "storm",
  "temperate",
];

/** Planet-type accent colors (design v3 TYPEC). */
export const PLANET_COLORS: Record<PlanetType, string> = {
  temperate: "#4a9c6d",
  barren: "#b08d57",
  gas: "#5fb0c9",
  ice: "#a9c7e0",
  oceanic: "#3f7fa6",
  lava: "#d1583b",
  plasma: "#a367c9",
  storm: "#7d8a9c",
};

/** Planet types that can extract a given P0. */
export const planetTypesForP0 = (p0: number): PlanetType[] =>
  PLANET_TYPES.filter((t) => PLANET_P0[t].includes(p0));

// Reverse recipe map: input type_id -> the outputs that consume it.
const CONSUMERS = new Map<number, number[]>();
PI_SCHEMATICS.forEach((s) => {
  const out = s.outputs[0].type_id;
  s.inputs.forEach((i) => {
    const arr = CONSUMERS.get(i.type_id) ?? [];
    arr.push(out);
    CONSUMERS.set(i.type_id, arr);
  });
});

/** Everything that (transitively) consumes `id` — its forward descendants. */
export const descendantsOf = (id: number): Set<number> => {
  const out = new Set<number>();
  const walk = (x: number) =>
    (CONSUMERS.get(x) ?? []).forEach((o) => {
      if (!out.has(o)) {
        out.add(o);
        walk(o);
      }
    });
  walk(id);
  return out;
};

const byName = (a: number, b: number) => nameOf(a).localeCompare(nameOf(b));

const ALL_P0 = Array.from(new Set(Object.values(PLANET_P0).flat())).sort(byName);
const outputsOfTier = (tier: Tier) =>
  Array.from(BY_OUTPUT.keys())
    .filter((id) => tierOf(id) === tier)
    .sort(byName);

/** The six materials-grid columns (P1..P4 = every schematic output). */
export const COLUMNS: { tier: Tier; ids: number[] }[] = [
  { tier: "P0", ids: ALL_P0 },
  { tier: "P1", ids: outputsOfTier("P1") },
  { tier: "P2", ids: outputsOfTier("P2") },
  { tier: "P3", ids: outputsOfTier("P3") },
  { tier: "P4", ids: outputsOfTier("P4") },
];

export interface InvestigateEdge {
  /** node keys: material nodes are String(type_id), planets are `planet-<type>` */
  from: string;
  to: string;
}

export interface Investigation {
  targetId: number;
  /** every material in the target's full ancestry, incl. the target */
  ids: Set<number>;
  /** planet types that source at least one required P0 */
  planetTypes: Set<PlanetType>;
  /** recipe edges (input -> output) + planet -> P0 edges */
  edges: InvestigateEdge[];
  requiredP0: number[];
}

export const investigate = (targetId: number): Investigation => {
  const ids = new Set<number>();
  const edges: InvestigateEdge[] = [];

  const walk = (id: number) => {
    if (ids.has(id)) return;
    ids.add(id);
    const s = BY_OUTPUT.get(id);
    if (!s) return;
    s.inputs.forEach((i) => {
      edges.push({ from: String(i.type_id), to: String(id) });
      walk(i.type_id);
    });
  };
  walk(targetId);

  const requiredP0 = Array.from(ids).filter((id) => tierOf(id) === "P0").sort(byName);
  const planetTypes = new Set<PlanetType>();
  requiredP0.forEach((p0) =>
    planetTypesForP0(p0).forEach((t) => {
      planetTypes.add(t);
      edges.push({ from: `planet-${t}`, to: String(p0) });
    }),
  );

  return { targetId, ids, planetTypes, edges, requiredP0 };
};

// ---------------------------------------------------------------------------
// R8 — hub-and-spoke planet combination
// ---------------------------------------------------------------------------

export interface ComboSpoke {
  type: PlanetType;
  p0: number;
}

export interface PlanetCombination {
  requiredP0: { id: number; name: string; sources: PlanetType[] }[];
  /** the factory hub planet; it also extracts every required P0 its type can */
  hub: { type: PlanetType; extracts: number[] };
  /** one extractor planet per remaining P0 */
  spokes: ComboSpoke[];
  covered: number;
  required: number;
  /** throughput-scaled per one top-tier factory (chain ratios, not a template) */
  facilities: {
    highTech: number;
    advanced: number;
    basic: number;
    extractorPlanets: number;
  };
}

export const planetCombination = (
  targetId: number,
  piPrices: EvePraisalResult | undefined,
): PlanetCombination | null => {
  const inv = investigate(targetId);
  if (inv.requiredP0.length === 0) return null;

  const requiredP0 = inv.requiredP0.map((id) => ({
    id,
    name: nameOf(id),
    sources: planetTypesForP0(id),
  }));

  // Hub = the planet type covering the most required P0s (EVE OS's Gas rule).
  let hubType: PlanetType = PLANET_TYPES[0];
  let best = -1;
  PLANET_TYPES.forEach((t) => {
    const covers = inv.requiredP0.filter((p0) => PLANET_P0[t].includes(p0)).length;
    if (covers > best) {
      best = covers;
      hubType = t;
    }
  });
  const hubExtracts = inv.requiredP0.filter((p0) =>
    PLANET_P0[hubType].includes(p0),
  );

  // One spoke per remaining P0; prefer the least-loaded source type for variety.
  const load = new Map<PlanetType, number>();
  const spokes: ComboSpoke[] = inv.requiredP0
    .filter((p0) => !hubExtracts.includes(p0))
    .map((p0) => {
      const sources = planetTypesForP0(p0);
      const type =
        sources.sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0))[0] ??
        PLANET_TYPES[0];
      load.set(type, (load.get(type) ?? 0) + 1);
      return { type, p0 };
    });

  const covered = hubExtracts.length + spokes.length;

  // Real chain ratios per one top-tier factory.
  const chain = buildChain(targetId, piPrices);
  let highTech = 0;
  let advanced = 0;
  let basic = 0;
  chain?.nodes.forEach((n) => {
    if (n.tier === "P4") highTech += n.factories;
    else if (n.tier === "P2" || n.tier === "P3") advanced += n.factories;
    else if (n.tier === "P1") basic += n.factories;
  });
  // A P4 target's own plant counts as high-tech; for P2/P3 targets the top
  // node is already in `advanced`.

  return {
    requiredP0,
    hub: { type: hubType, extracts: hubExtracts },
    spokes,
    covered,
    required: inv.requiredP0.length,
    facilities: {
      highTech,
      advanced,
      basic,
      extractorPlanets: spokes.length + (hubExtracts.length > 0 ? 1 : 0),
    },
  };
};
