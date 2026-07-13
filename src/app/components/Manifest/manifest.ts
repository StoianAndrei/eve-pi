import { AccessToken } from "@/types";
import { EvePraisalResult } from "@/eve-praisal";
import { PI_PRODUCT_VOLUMES } from "@/const";
import { Tier, tierOf, nameOf } from "@/pi-tiers";
import { planetFlows } from "@/planet-flows";
import { priceOf } from "@/planet-economics";
import { extractorRate, groupBySystem } from "@/pi-goal";

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

// ---------------------------------------------------------------------------
// Per-character manifest — "these are the exact units to carry each trip".
// Net balance per commodity per character; deficits become "bring in" with a
// same-system source hint when another of your characters produces a surplus
// of it in a system this character also lives in.
// ---------------------------------------------------------------------------

export interface CharacterManifestLine extends ManifestLine {
  /** "same system: Name, Name" when your own alts can supply it; else undefined (buy / haul in). */
  sourceHint?: string;
}

export interface CharacterManifest {
  name: string;
  systems: string[];
  planetCount: number;
  extractingCount: number;
  carryOut: ManifestLine[];
  bringIn: CharacterManifestLine[];
  /** Per-period extraction backing the line, at current head rates. */
  extraction: { typeId: number; name: string; perPeriod: number }[];
}

export const characterManifests = (
  characters: AccessToken[],
  piPrices: EvePraisalResult | undefined,
  { visitHours = 168 }: ManifestOptions = {},
): CharacterManifest[] => {
  const vol = (id: number) => PI_PRODUCT_VOLUMES[id] ?? 0;

  // net per commodity per character (+ = surplus to carry out, - = deficit)
  const nets = characters.map((character) => {
    const net: Record<number, number> = {};
    let extractingCount = 0;
    const extraction: Record<number, number> = {};

    character.planets.forEach((planet) => {
      const flows = planetFlows(planet);
      flows.exportedOut.forEach((l) => {
        net[l.typeId] = (net[l.typeId] ?? 0) + l.perHour * visitHours;
      });
      flows.importedIn.forEach((l) => {
        net[l.typeId] = (net[l.typeId] ?? 0) - l.perHour * visitHours;
      });
      const extractors = planet.info.pins.filter((p) => p.extractor_details);
      if (extractors.some((p) => p.expiry_time && new Date(p.expiry_time).getTime() > Date.now())) {
        extractingCount += 1;
      }
      extractors.forEach((p) => {
        const id = p.extractor_details?.product_type_id;
        if (id) extraction[id] = (extraction[id] ?? 0) + extractorRate(p) * visitHours;
      });
    });

    return { character, net, extractingCount, extraction };
  });

  const systemsByCharacter = new Map<string, Set<number>>();
  const labelBySystem = new Map<number, string>();
  groupBySystem(characters).forEach((g) => {
    labelBySystem.set(g.systemId, g.label);
    g.colonies.forEach(({ character }) => {
      const key = character.character.name;
      if (!systemsByCharacter.has(key)) systemsByCharacter.set(key, new Set());
      systemsByCharacter.get(key)!.add(g.systemId);
    });
  });

  return nets.map(({ character, net, extractingCount, extraction }) => {
    const name = character.character.name;
    const mySystems = systemsByCharacter.get(name) ?? new Set<number>();

    const carryOut: ManifestLine[] = [];
    const bringIn: CharacterManifestLine[] = [];

    Object.entries(net).forEach(([idStr, amount]) => {
      const id = Number(idStr);
      if (amount > 1) {
        carryOut.push({
          typeId: id,
          tier: tierOf(id),
          units: amount,
          volume: amount * vol(id),
          isk: (amount * priceOf(piPrices, id)) / 1_000_000,
          internal: false,
        });
      } else if (amount < -1) {
        const units = -amount;
        // can another character supply it from a shared system?
        const suppliers = nets
          .filter((o) => o.character.character.name !== name)
          .filter((o) => (o.net[id] ?? 0) > 1)
          .filter((o) => {
            const theirs = systemsByCharacter.get(o.character.character.name);
            return theirs && Array.from(theirs).some((s) => mySystems.has(s));
          })
          .map((o) => o.character.character.name);
        bringIn.push({
          typeId: id,
          tier: tierOf(id),
          units,
          volume: units * vol(id),
          isk: 0,
          internal: suppliers.length > 0,
          sourceHint: suppliers.length ? `same system: ${suppliers.join(", ")}` : undefined,
        });
      }
    });

    carryOut.sort(
      (a, b) =>
        (TIER_RANK[b.tier ?? "P0"] ?? 0) - (TIER_RANK[a.tier ?? "P0"] ?? 0) ||
        b.units - a.units,
    );
    bringIn.sort((a, b) => b.units - a.units);

    return {
      name,
      systems: Array.from(mySystems).map((s) => labelBySystem.get(s) ?? String(s)),
      planetCount: character.planets.length,
      extractingCount,
      carryOut,
      bringIn,
      extraction: Object.entries(extraction)
        .map(([id, perPeriod]) => ({
          typeId: Number(id),
          name: nameOf(Number(id)),
          perPeriod,
        }))
        .sort((a, b) => b.perPeriod - a.perPeriod),
    };
  });
};

const TIER_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
