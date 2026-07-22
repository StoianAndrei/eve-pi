import { buildChain } from "@/pi-chain";
import { nameOf, tierOf, Tier } from "@/pi-tiers";
import { PI_SCHEMATICS } from "@/const";
import { planetTypesForP0 } from "@/pi-investigate";
import { PlanetType } from "@/pi-planets";
import { EvePraisalResult } from "@/eve-praisal";

/**
 * Planet sizing from the chain, the way the community reads Adam4EVE:
 * take each P1 the chain needs and its units/hour, and one dedicated planet
 * exports ~160 u/h of a P1 — so planets = ceil(perHour / 160). The P1s are
 * NOT united into a single tally; each P1 line is its own planet(s), and we
 * carry the P0 it refines from plus which planet types can extract it ("where
 * it's found") so it feeds straight into the System Planner.
 */
const BY_OUTPUT = new Map(PI_SCHEMATICS.map((s) => [s.outputs[0].type_id, s]));

/** Empirical: one dedicated planet sustainably exports ~160 units/hr of a P1. */
export const P1_PER_PLANET = 160;

export interface P1Line {
  id: number;
  name: string;
  perHour: number;
  planets: number;
  /** the P0 raws this P1 refines from, with the planet types that yield them */
  p0: { id: number; name: string; types: PlanetType[] }[];
}

export interface ComponentPlan {
  id: number;
  name: string;
  tier: Tier | undefined;
  p1: P1Line[];
  planets: number;
}

export const componentPlan = (
  componentId: number,
  piPrices: EvePraisalResult | undefined,
  perPlanet: number = P1_PER_PLANET,
): ComponentPlan | null => {
  const chain = buildChain(componentId, piPrices);
  if (!chain) return null;

  const p1: P1Line[] = chain.nodes
    .filter((n) => n.tier === "P1")
    .map((n) => {
      const sch = BY_OUTPUT.get(n.id);
      const p0 = (sch?.inputs ?? []).map((i) => ({
        id: i.type_id,
        name: nameOf(i.type_id),
        types: planetTypesForP0(i.type_id),
      }));
      return {
        id: n.id,
        name: n.name,
        perHour: n.perHour,
        planets: Math.max(1, Math.ceil(n.perHour / perPlanet)),
        p0,
      };
    })
    .sort((a, b) => b.perHour - a.perHour);

  return {
    id: componentId,
    name: nameOf(componentId),
    tier: tierOf(componentId),
    p1,
    planets: p1.reduce((s, l) => s + l.planets, 0),
  };
};
