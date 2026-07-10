import { PlanetWithInfo, Pin } from "@/types";
import { EvePraisalResult } from "@/eve-praisal";
import { STORAGE_IDS, PI_PRODUCT_VOLUMES, LAUNCHPAD_IDS } from "@/const";
import { planetFlows } from "@/planet-flows";

/**
 * P2 (value/hr) + P3 (uptime) + P4 (import buffer) — pure derivations.
 *
 * The EvePraisalResult shape only carries prices.sell.min, so "buy" cost here
 * uses the same figure; swap to a real buy price if you add one to the appraisal.
 * Internal transfers between your own bases are free — call planetEconomics with
 * countImportsAsCost:false (default) for the empire model, or true to cost them
 * at market.
 */
export const priceOf = (
  piPrices: EvePraisalResult | undefined,
  typeId: number,
): number =>
  piPrices?.appraisal.items.find((a) => a.typeID === typeId)?.prices.sell.min ?? 0;

export interface PlanetEconomics {
  iskPerHourGross: number; // millions ISK/h from P2 exports
  iskPerHourNet: number; // millions, after import cost (if counted)
  uptimePct: number; // 0..100 estimate over visitHours
  worstCoverHours: number; // hours the tightest import buffer lasts
  health: "ok" | "warn" | "loss";
  missingPrice: boolean;
}

export interface EconomicsOptions {
  visitHours?: number; // cadence window, default 48
  countImportsAsCost?: boolean; // default false (internal transfers are free)
}

export const planetEconomics = (
  planet: PlanetWithInfo,
  piPrices: EvePraisalResult | undefined,
  { visitHours = 48, countImportsAsCost = false }: EconomicsOptions = {},
): PlanetEconomics => {
  const { importedIn, exportedOut } = planetFlows(planet);

  let missingPrice = false;
  const grossPerHour = exportedOut.reduce((sum, l) => {
    const price = priceOf(piPrices, l.typeId);
    if (price === 0) missingPrice = true;
    return sum + price * l.perHour;
  }, 0);

  const importCostPerHour = countImportsAsCost
    ? importedIn.reduce((sum, l) => sum + priceOf(piPrices, l.typeId) * l.perHour, 0)
    : 0;

  // Buffer coverage from launchpad + storage contents.
  const storagePins = planet.info.pins.filter((p: Pin) =>
    STORAGE_IDS().some((s) => s.type_id === p.type_id),
  );
  const stockOf = (typeId: number) =>
    storagePins.reduce(
      (sum, p) => sum + (p.contents?.find((c) => c.type_id === typeId)?.amount ?? 0),
      0,
    );

  const coverHours = importedIn.map((l) =>
    l.perHour > 0 ? stockOf(l.typeId) / l.perHour : Infinity,
  );
  const worstCoverHours = coverHours.length ? Math.min(...coverHours) : Infinity;
  const uptimePct =
    importedIn.length === 0
      ? 100
      : Math.max(0, Math.min(100, Math.round((worstCoverHours / visitHours) * 100)));

  const iskPerHourGross = grossPerHour / 1_000_000;
  const iskPerHourNet = (grossPerHour - importCostPerHour) / 1_000_000;

  const health: PlanetEconomics["health"] =
    iskPerHourNet <= 0 ? "loss" : uptimePct < 100 ? "warn" : "ok";

  return {
    iskPerHourGross,
    iskPerHourNet,
    uptimePct,
    worstCoverHours,
    health,
    missingPrice,
  };
};

/**
 * P4 — recommended import quantity for one launchpad.
 * bring = bufferMultiple x consumptionPerPeriod, capped by launchpad m³ capacity.
 */
export interface BufferPlan {
  typeId: number;
  consumptionPerPeriod: number;
  recommendedUnits: number;
  recommendedVolume: number; // m³
  periodsOfCover: number;
  overCapacity: boolean;
}

export const LAUNCHPAD_CAPACITY_M3 = 10_000;

export const importBufferPlan = (
  planet: PlanetWithInfo,
  { visitHours = 48, bufferMultiple = 4 }: { visitHours?: number; bufferMultiple?: number } = {},
): BufferPlan[] => {
  const { importedIn } = planetFlows(planet);
  return importedIn.map((l) => {
    const consumptionPerPeriod = l.perHour * visitHours;
    const recommendedUnits = Math.round(consumptionPerPeriod * bufferMultiple);
    const vol = PI_PRODUCT_VOLUMES[l.typeId] ?? 0;
    const recommendedVolume = recommendedUnits * vol;
    return {
      typeId: l.typeId,
      consumptionPerPeriod,
      recommendedUnits,
      recommendedVolume,
      periodsOfCover: consumptionPerPeriod > 0 ? recommendedUnits / consumptionPerPeriod : 0,
      overCapacity: recommendedVolume > LAUNCHPAD_CAPACITY_M3,
    };
  });
};

export const isLaunchpad = (typeId: number) => LAUNCHPAD_IDS.includes(typeId);
