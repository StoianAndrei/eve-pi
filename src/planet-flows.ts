import { PlanetWithInfo } from "@/types";
import { planetCalculations } from "@/planets";
import { PI_SCHEMATICS } from "@/const";
import { Tier, tierOf } from "@/pi-tiers";

/**
 * P1 — Correct the planet flow model: P0 stays, P1 flows, P2 leaves.
 *
 * Pure wrapper around planetCalculations(). Does NOT change that function.
 * Classifies every commodity on a planet into one of four buckets so the UI can
 * show three separated lanes: Extract (stays) · Import (fly in) · Export (fly out).
 *
 * NOTE (pi-chain migration): once src/pi-chain.ts lands on main, replace the
 * PI_SCHEMATICS cycle-time lookup below with its cycle helper. Nothing else here
 * needs to change.
 */
export interface FlowLine {
  typeId: number;
  tier: Tier | undefined;
  /** units / hour. 0 for extracted lines (head rate is not modelled here). */
  perHour: number;
  factoryCount?: number;
}

export interface PlanetFlows {
  /** P0 pulled by extractors — never hauled off-planet. */
  extracted: FlowLine[];
  /** P1 refined locally AND consumed locally (feeds advanced factories). */
  producedLocal: FlowLine[];
  /** The counterpart P1 brought in from your other bases. */
  importedIn: FlowLine[];
  /** What actually leaves — should be P2 on a true extractor planet. */
  exportedOut: FlowLine[];
  isExtractorPlanet: boolean;
}

export const planetFlows = (planet: PlanetWithInfo): PlanetFlows => {
  const {
    extractors,
    localImports,
    localExports,
    locallyProduced,
    locallyConsumed,
  } = planetCalculations(planet);

  const excavatedIds = Array.from(
    new Set(
      extractors
        .map((e) => e.extractor_details?.product_type_id)
        .filter((x): x is number => !!x),
    ),
  );

  const extracted: FlowLine[] = excavatedIds.map((typeId) => ({
    typeId,
    tier: tierOf(typeId),
    perHour: 0,
  }));

  const exportedIds = new Set(localExports.map((e) => e.typeId));

  const producedLocal: FlowLine[] = Array.from(new Set(locallyProduced))
    .filter((id) => locallyConsumed.includes(id) && !exportedIds.has(id))
    .map((typeId) => ({ typeId, tier: tierOf(typeId), perHour: 0 }));

  const importedIn: FlowLine[] = localImports.map((i) => {
    const cycleTime =
      PI_SCHEMATICS.find((s) => s.schematic_id === i.schematic_id)?.cycle_time ??
      3600;
    const perHour = i.quantity * i.factoryCount * (3600 / cycleTime);
    return {
      typeId: i.type_id,
      tier: tierOf(i.type_id),
      perHour,
      factoryCount: i.factoryCount,
    };
  });

  const exportedOut: FlowLine[] = localExports.map((e) => ({
    typeId: e.typeId,
    tier: tierOf(e.typeId),
    perHour: e.amount, // planetCalculations already returns units/hr
  }));

  const isExtractorPlanet =
    extractors.length > 0 &&
    (producedLocal.length > 0 || excavatedIds.length > 0) &&
    exportedOut.some((l) => l.tier === "P2");

  return { extracted, producedLocal, importedIn, exportedOut, isExtractorPlanet };
};

/** P3 helper — basic (P0->P1) vs advanced (P1->P2+) factory counts. */
export const factoryCounts = (
  planet: PlanetWithInfo,
): { basic: number; advanced: number } => {
  const { localProduction } = planetCalculations(planet);
  let basic = 0;
  let advanced = 0;
  localProduction.forEach((sch) => {
    const count = (sch as { count?: number }).count ?? 1;
    if (tierOf(sch.outputs[0]?.type_id) === "P1") basic += count;
    else advanced += count;
  });
  return { basic, advanced };
};
