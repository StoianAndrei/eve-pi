import { AccessToken, PlanetWithInfo } from "@/types";
import { EvePraisalResult } from "@/eve-praisal";
import { PI_SCHEMATICS } from "@/const";
import { tierOf } from "@/pi-tiers";
import { planetFlows, factoryCounts } from "@/planet-flows";
import { planetEconomics, priceOf } from "@/planet-economics";

/**
 * P6 — Red-planet swap advisor. Recommendations only; the user applies them in-game.
 *
 * Core idea: a planet is red when its net ISK/hr <= 0. Often it refines a P1
 * locally that it is NOT consuming while importing a different P1. Reassign its
 * advanced schematic to the P2 whose recipe uses its LOCAL P1, so it imports only
 * the shared input. When two red planets mirror each other (A makes what B imports
 * and vice-versa) it's a clean "swap A<->B" — no planet moves.
 *
 * NOTE (pi-chain migration): replace the projection math with chainEconomics()
 * for exact figures once pi-chain.ts is on main. Values below are estimates.
 */
export interface PlanetRef {
  character: AccessToken;
  planet: PlanetWithInfo;
}

export interface PlanetSwapSide {
  name: string;
  planetType: string;
  cc: number;
  localP1: number; // typeId refined locally
  nowProduct: number; // current P2 typeId
  nowImports: number[]; // typeIds currently imported
  nowIsk: number; // millions/hr (net, current)
  newProduct: number; // recommended P2 typeId
  newImports: number[]; // typeIds imported after swap
  newIsk: number; // millions/hr (projected)
}

export interface SwapRecommendation {
  sides: PlanetSwapSide[]; // 2 for a paired swap, 1 for a single reassignment
  empireDeltaIsk: number; // millions/hr improvement
}

/** P2 schematics whose recipe consumes a given P1 typeId. */
const p2SchematicsUsing = (p1TypeId: number) =>
  PI_SCHEMATICS.filter(
    (s) =>
      tierOf(s.outputs[0]?.type_id) === "P2" &&
      s.inputs.some((i) => i.type_id === p1TypeId),
  );

const localP1Of = (planet: PlanetWithInfo): number | undefined => {
  const { producedLocal, extracted } = planetFlows(planet);
  const fromProduced = producedLocal.find((l) => l.tier === "P1");
  if (fromProduced) return fromProduced.typeId;
  // fall back: a P1 that this planet can refine from what it extracts
  for (const ex of extracted) {
    const refiner = PI_SCHEMATICS.find(
      (s) => tierOf(s.outputs[0]?.type_id) === "P1" && s.inputs.some((i) => i.type_id === ex.typeId),
    );
    if (refiner) return refiner.outputs[0].type_id;
  }
  return undefined;
};

const projectSide = (
  ref: PlanetRef,
  piPrices: EvePraisalResult | undefined,
): PlanetSwapSide | undefined => {
  const { planet } = ref;
  const flows = planetFlows(planet);
  const econ = planetEconomics(planet, piPrices);
  const localP1 = localP1Of(planet);
  const nowProduct = flows.exportedOut[0]?.typeId;
  if (localP1 === undefined || nowProduct === undefined) return undefined;

  // Best P2 that uses our local P1 (highest output sell value), other than the current one.
  const candidates = p2SchematicsUsing(localP1)
    .filter((s) => s.outputs[0].type_id !== nowProduct)
    .sort((a, b) => priceOf(piPrices, b.outputs[0].type_id) - priceOf(piPrices, a.outputs[0].type_id));
  const target = candidates[0];
  if (!target) return undefined;

  const { advanced } = factoryCounts(planet);
  const out = target.outputs[0];
  const perHour = advanced * out.quantity * (3600 / target.cycle_time);
  const grossNew = perHour * priceOf(piPrices, out.type_id);
  // after swap the planet imports only the recipe input(s) that are NOT its local P1
  const newImports = target.inputs.map((i) => i.type_id).filter((id) => id !== localP1);

  return {
    name: planet.infoUniverse?.name ?? String(planet.planet_id),
    planetType: planet.planet_type,
    cc: planet.upgrade_level,
    localP1,
    nowProduct,
    nowImports: flows.importedIn.map((l) => l.typeId),
    nowIsk: econ.iskPerHourNet,
    newProduct: out.type_id,
    newImports,
    newIsk: grossNew / 1_000_000,
  };
};

export const findSwaps = (
  characters: AccessToken[],
  piPrices: EvePraisalResult | undefined,
): SwapRecommendation[] => {
  const refs: PlanetRef[] = characters.flatMap((c) =>
    c.planets.map((planet) => ({ character: c, planet })),
  );
  const losers = refs.filter(
    (r) => planetEconomics(r.planet, piPrices).health === "loss",
  );

  const recs: SwapRecommendation[] = [];
  const used = new Set<number>();

  // paired swaps first (A's local P1 is imported by B and vice-versa)
  for (let i = 0; i < losers.length; i++) {
    if (used.has(losers[i].planet.planet_id)) continue;
    const a = projectSide(losers[i], piPrices);
    if (!a) continue;
    for (let j = i + 1; j < losers.length; j++) {
      if (used.has(losers[j].planet.planet_id)) continue;
      const b = projectSide(losers[j], piPrices);
      if (!b) continue;
      const mirror =
        b.nowImports.includes(a.localP1) && a.nowImports.includes(b.localP1);
      if (mirror) {
        used.add(losers[i].planet.planet_id);
        used.add(losers[j].planet.planet_id);
        recs.push({
          sides: [a, b],
          empireDeltaIsk: a.newIsk - a.nowIsk + (b.newIsk - b.nowIsk),
        });
        break;
      }
    }
  }

  // remaining single reassignments
  for (const l of losers) {
    if (used.has(l.planet.planet_id)) continue;
    const side = projectSide(l, piPrices);
    if (!side) continue;
    used.add(l.planet.planet_id);
    recs.push({ sides: [side], empireDeltaIsk: side.newIsk - side.nowIsk });
  }

  return recs;
};
