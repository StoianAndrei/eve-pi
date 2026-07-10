import { AccessToken } from "@/types";
import { EvePraisalResult } from "@/eve-praisal";
import { PI_PRODUCT_VOLUMES } from "@/const";
import { Tier, tierOf } from "@/pi-tiers";
import { planetFlows } from "@/planet-flows";
import { priceOf } from "@/planet-economics";

/**
 * P5 — "Your week — what to fly." Rolls the whole estate's net balance into a
 * flight plan: what to fly IN (net-deficit imports) and carry OUT (P2 exports),
 * grouped into hauler-sized trips. No in-game automation — a manifest to execute
 * by hand.
 *
 * INPUT to confirm (prompt pack): the fly-in/out column meaning is
 * [units this period] + [volume m³] (+ ISK for exports). Adjust if your haul
 * table means something else.
 */
export interface ManifestLine {
  typeId: number;
  tier: Tier | undefined;
  units: number; // this period
  volume: number; // m³
  isk: number; // millions (exports only)
  internal: boolean; // produced somewhere in the estate (no market cost)
}

export interface EstateManifest {
  flyIn: ManifestLine[]; // ordered by deficit desc
  flyOut: ManifestLine[]; // P2 to sell
  inUnits: number;
  inVolume: number;
  outUnits: number;
  outVolume: number;
  outValue: number; // millions
  inTrips: number;
  outTrips: number;
}

export interface ManifestOptions {
  visitHours?: number; // cadence window, default 48
  haulerCapacityM3?: number; // Epithal PI hold, default 45000
}

export const estateManifest = (
  characters: AccessToken[],
  piPrices: EvePraisalResult | undefined,
  { visitHours = 48, haulerCapacityM3 = 45_000 }: ManifestOptions = {},
): EstateManifest => {
  const exported: Record<number, number> = {};
  const imported: Record<number, number> = {};

  characters.forEach((c) =>
    c.planets.forEach((planet) => {
      const flows = planetFlows(planet);
      flows.exportedOut.forEach((l) => {
        exported[l.typeId] = (exported[l.typeId] ?? 0) + l.perHour * visitHours;
      });
      flows.importedIn.forEach((l) => {
        imported[l.typeId] = (imported[l.typeId] ?? 0) + l.perHour * visitHours;
      });
    }),
  );

  const typeIds = Array.from(
    new Set([...Object.keys(exported), ...Object.keys(imported)].map(Number)),
  );

  const flyIn: ManifestLine[] = [];
  const flyOut: ManifestLine[] = [];
  const vol = (id: number) => PI_PRODUCT_VOLUMES[id] ?? 0;

  typeIds.forEach((id) => {
    const net = (exported[id] ?? 0) - (imported[id] ?? 0);
    const producedSomewhere = (exported[id] ?? 0) > 0;
    if (net < 0) {
      const units = -net;
      flyIn.push({
        typeId: id,
        tier: tierOf(id),
        units,
        volume: units * vol(id),
        isk: 0,
        internal: producedSomewhere,
      });
    } else if (net > 0 && tierOf(id) === "P2") {
      flyOut.push({
        typeId: id,
        tier: tierOf(id),
        units: net,
        volume: net * vol(id),
        isk: (net * priceOf(piPrices, id)) / 1_000_000,
        internal: false,
      });
    }
  });

  flyIn.sort((a, b) => b.units - a.units);
  flyOut.sort((a, b) => b.isk - a.isk);

  const inUnits = flyIn.reduce((s, l) => s + l.units, 0);
  const inVolume = flyIn.reduce((s, l) => s + l.volume, 0);
  const outUnits = flyOut.reduce((s, l) => s + l.units, 0);
  const outVolume = flyOut.reduce((s, l) => s + l.volume, 0);
  const outValue = flyOut.reduce((s, l) => s + l.isk, 0);

  return {
    flyIn,
    flyOut,
    inUnits,
    inVolume,
    outUnits,
    outVolume,
    outValue,
    inTrips: Math.max(1, Math.ceil(inVolume / haulerCapacityM3)),
    outTrips: Math.max(1, Math.ceil(outVolume / haulerCapacityM3)),
  };
};
