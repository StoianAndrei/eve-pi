import { AccessToken, PlanetWithInfo, Pin } from "@/types";
import { PI_SCHEMATICS, STORAGE_IDS } from "@/const";
import { EvePraisalResult } from "@/eve-praisal";
import { Tier, tierOf, nameOf } from "@/pi-tiers";
import { buildChain } from "@/pi-chain";
import { PLANET_P0, PlanetType } from "@/pi-planets";

/**
 * Goal Planner engine — "I want to build N plants of X in this system;
 * what do I have, what's missing, and what should each planet do?"
 *
 * Everything derives from live ESI colony data: factory pins (schematics),
 * extractor head rates (extractor_details), and on-planet storage. Wanted
 * quantities come from the chain engine (buildChain) scaled by plant count.
 */

const SCH_BY_ID = new Map(PI_SCHEMATICS.map((s) => [s.schematic_id, s]));
const SCH_BY_OUTPUT = new Map(
  PI_SCHEMATICS.map((s) => [s.outputs[0].type_id, s]),
);

export interface ColonyRef {
  character: AccessToken;
  planet: PlanetWithInfo;
}

export interface SystemGroup {
  systemId: number;
  label: string;
  colonies: ColonyRef[];
}

/** Strip the trailing planet numeral: "Q-R3GP IV" -> "Q-R3GP". */
const systemLabelOf = (planet: PlanetWithInfo): string => {
  const name = planet.infoUniverse?.name ?? "";
  return name.replace(/\s+[IVXLC]+$/, "") || String(planet.solar_system_id);
};

export const groupBySystem = (characters: AccessToken[]): SystemGroup[] => {
  const groups = new Map<number, SystemGroup>();
  characters.forEach((character) =>
    character.planets.forEach((planet) => {
      let g = groups.get(planet.solar_system_id);
      if (!g) {
        g = {
          systemId: planet.solar_system_id,
          label: systemLabelOf(planet),
          colonies: [],
        };
        groups.set(planet.solar_system_id, g);
      }
      g.colonies.push({ character, planet });
    }),
  );
  return Array.from(groups.values()).sort(
    (a, b) => b.colonies.length - a.colonies.length,
  );
};

/** Units/hr an extractor pin currently pulls. */
export const extractorRate = (pin: Pin): number => {
  const d = pin.extractor_details;
  if (!d?.qty_per_cycle || !d.cycle_time) return 0;
  return d.qty_per_cycle * (3600 / d.cycle_time);
};

const isRunning = (pin: Pin): boolean =>
  !!pin.expiry_time && new Date(pin.expiry_time).getTime() > Date.now();

const factoryPins = (planet: PlanetWithInfo): Pin[] =>
  planet.info.pins.filter((p) => p.schematic_id && SCH_BY_ID.has(p.schematic_id));

const extractorPins = (planet: PlanetWithInfo): Pin[] =>
  planet.info.pins.filter((p) => p.extractor_details);

const storageStock = (colonies: ColonyRef[]): Map<number, number> => {
  const stock = new Map<number, number>();
  colonies.forEach(({ planet }) =>
    planet.info.pins
      .filter((p) => STORAGE_IDS().some((s) => s.type_id === p.type_id))
      .forEach((p) =>
        (p.contents ?? []).forEach((c) =>
          stock.set(c.type_id, (stock.get(c.type_id) ?? 0) + c.amount),
        ),
      ),
  );
  return stock;
};

export interface StageRow {
  id: number;
  name: string;
  tier: Tier | undefined;
  want: number;
  have: number;
  need: number;
  stockpile: number;
}

export interface RawRow {
  id: number;
  name: string;
  wantPerHour: number;
  havePerHour: number;
  needPerHour: number;
  stockpile: number;
  extractableHere: boolean;
}

export interface PlanetVerdict {
  characterName: string;
  planetName: string;
  planetType: PlanetType;
  verdict: "keep" | "repurpose" | "rebuild";
  extracts: string[];
  makes: string[];
  suggestion?: string;
}

export interface StockVerdict {
  id: number;
  name: string;
  tier: Tier | undefined;
  stock: number;
  makingPerHour: number;
  coverDays: number;
  keep: boolean;
}

export interface CharacterHealth {
  name: string;
  extractorsRunning: number;
  extractorsTotal: number;
  p0PerPeriod: number;
  pulling: string[];
  healthy: boolean;
}

export interface GoalAnalysis {
  stages: StageRow[];
  raws: RawRow[];
  verdicts: PlanetVerdict[];
  keepCount: number;
  changeCount: number;
  stock: StockVerdict[];
  health: CharacterHealth[];
}

export interface GoalOptions {
  /** Alert threshold for a character's P0 pulled per period. */
  healthFloor?: number;
  /** Period (hours) for the health table. */
  healthPeriodHours?: number;
}

export const goalAnalysis = (
  colonies: ColonyRef[],
  targetId: number,
  plants: number,
  piPrices: EvePraisalResult | undefined,
  { healthFloor = 1_600_000, healthPeriodHours = 48 }: GoalOptions = {},
): GoalAnalysis | null => {
  const chain = buildChain(targetId, piPrices);
  if (!chain || plants <= 0) return null;

  const stock = storageStock(colonies);

  // -- have: factories per output commodity, extraction per P0 -------------
  const factoriesByOutput = new Map<number, number>();
  colonies.forEach(({ planet }) =>
    factoryPins(planet).forEach((p) => {
      const out = SCH_BY_ID.get(p.schematic_id as number)?.outputs[0].type_id;
      if (out !== undefined)
        factoriesByOutput.set(out, (factoriesByOutput.get(out) ?? 0) + 1);
    }),
  );

  const extractionByP0 = new Map<number, number>();
  colonies.forEach(({ planet }) =>
    extractorPins(planet).forEach((p) => {
      const id = p.extractor_details?.product_type_id;
      if (id && isRunning(p))
        extractionByP0.set(id, (extractionByP0.get(id) ?? 0) + extractorRate(p));
    }),
  );

  // -- want vs have per stage ----------------------------------------------
  const TIER_SORT: Record<string, number> = { P4: 0, P3: 1, P2: 2, P1: 3 };
  const stages: StageRow[] = chain.nodes
    .filter((n) => n.tier !== "P0")
    .map((n) => {
      const want = n.factories * plants;
      const have = factoriesByOutput.get(n.id) ?? 0;
      return {
        id: n.id,
        name: n.name,
        tier: n.tier,
        want,
        have,
        need: Math.max(0, want - have),
        stockpile: stock.get(n.id) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        (TIER_SORT[a.tier ?? "P1"] ?? 9) - (TIER_SORT[b.tier ?? "P1"] ?? 9) ||
        a.name.localeCompare(b.name),
    );

  const typesHere = new Set(colonies.map(({ planet }) => planet.planet_type));
  const raws: RawRow[] = chain.nodes
    .filter((n) => n.tier === "P0")
    .map((n) => {
      const wantPerHour = n.perHour * plants;
      const havePerHour = extractionByP0.get(n.id) ?? 0;
      return {
        id: n.id,
        name: n.name,
        wantPerHour,
        havePerHour,
        needPerHour: Math.max(0, wantPerHour - havePerHour),
        stockpile: stock.get(n.id) ?? 0,
        extractableHere: Array.from(typesHere).some((t) =>
          PLANET_P0[t as PlanetType]?.includes(n.id),
        ),
      };
    })
    .sort((a, b) => b.needPerHour - a.needPerHour);

  // -- planet-by-planet verdicts -------------------------------------------
  const chainP0 = new Set(chain.nodes.filter((n) => n.tier === "P0").map((n) => n.id));
  // remaining deficit we still need to cover as we hand out repurposes
  const remainingNeed = new Map(raws.map((r) => [r.id, r.needPerHour]));
  const rates = colonies.flatMap(({ planet }) =>
    extractorPins(planet).map(extractorRate),
  );
  const typicalRate =
    rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 40_000;

  const p1FedBy = (p0: number): string => {
    const refiner = PI_SCHEMATICS.find(
      (s) =>
        tierOf(s.outputs[0].type_id) === "P1" &&
        s.inputs.some((i) => i.type_id === p0),
    );
    return refiner ? nameOf(refiner.outputs[0].type_id) : "?";
  };

  const verdicts: PlanetVerdict[] = colonies.map(({ character, planet }) => {
    const extracts = Array.from(
      new Set(
        extractorPins(planet)
          .map((p) => p.extractor_details?.product_type_id)
          .filter((x): x is number => !!x),
      ),
    );
    const makesCount = new Map<number, number>();
    factoryPins(planet).forEach((p) => {
      const out = SCH_BY_ID.get(p.schematic_id as number)?.outputs[0].type_id;
      if (out !== undefined) makesCount.set(out, (makesCount.get(out) ?? 0) + 1);
    });
    const makes = Array.from(makesCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id]) => nameOf(id));

    const base = {
      characterName: character.character.name,
      planetName: planet.infoUniverse?.name ?? String(planet.planet_id),
      planetType: planet.planet_type as PlanetType,
      extracts: extracts.map(nameOf),
      makes,
    };

    // already pulling a P0 the chain needs -> keep
    if (extracts.some((id) => chainP0.has(id))) {
      return { ...base, verdict: "keep" as const };
    }

    // planet type can extract a P0 we're short on -> repurpose in place
    const options = (PLANET_P0[planet.planet_type as PlanetType] ?? [])
      .filter((id) => chainP0.has(id))
      .sort((a, b) => (remainingNeed.get(b) ?? 0) - (remainingNeed.get(a) ?? 0));
    const pick = options.find((id) => (remainingNeed.get(id) ?? 0) > 0) ?? options[0];
    if (pick !== undefined) {
      remainingNeed.set(pick, Math.max(0, (remainingNeed.get(pick) ?? 0) - typicalRate));
      return {
        ...base,
        verdict: "repurpose" as const,
        suggestion: `Repurpose in place — this ${planet.planet_type} planet can extract ${nameOf(pick)}. Move heads to it (feeds ${p1FedBy(pick)}).`,
      };
    }

    // planet type yields nothing the chain needs -> relocate
    const worst = raws.find((r) => r.needPerHour > 0);
    return {
      ...base,
      verdict: "rebuild" as const,
      suggestion: worst
        ? `Destroy & rebuild — a ${planet.planet_type} planet can't extract anything this chain needs; biggest gap is ${worst.name}.`
        : `This ${planet.planet_type} planet can't feed the chain; consider relocating.`,
    };
  });

  const keepCount = verdicts.filter((v) => v.verdict === "keep").length;

  // -- stockpile verdicts ----------------------------------------------------
  const chainIds = new Set(chain.nodes.map((n) => n.id));
  const producedRate = new Map<number, number>();
  colonies.forEach(({ planet }) =>
    factoryPins(planet).forEach((p) => {
      const s = SCH_BY_ID.get(p.schematic_id as number);
      if (!s) return;
      const out = s.outputs[0];
      const rate = out.quantity * (3600 / s.cycle_time);
      producedRate.set(out.type_id, (producedRate.get(out.type_id) ?? 0) + rate);
    }),
  );
  const stockVerdicts: StockVerdict[] = Array.from(stock.entries())
    .filter(([id, amount]) => amount >= 10_000 && tierOf(id) !== "P0")
    .map(([id, amount]) => {
      const makingPerHour = producedRate.get(id) ?? 0;
      return {
        id,
        name: nameOf(id),
        tier: tierOf(id),
        stock: amount,
        makingPerHour,
        coverDays: makingPerHour > 0 ? amount / makingPerHour / 24 : Infinity,
        keep: chainIds.has(id),
      };
    })
    .sort((a, b) => b.stock - a.stock);

  // -- character extraction health ------------------------------------------
  const byCharacter = new Map<string, ColonyRef[]>();
  colonies.forEach((c) => {
    const key = c.character.character.name;
    byCharacter.set(key, [...(byCharacter.get(key) ?? []), c]);
  });
  const health: CharacterHealth[] = Array.from(byCharacter.entries()).map(
    ([name, refs]) => {
      const pins = refs.flatMap(({ planet }) => extractorPins(planet));
      const running = pins.filter(isRunning);
      const p0PerPeriod = running.reduce(
        (s, p) => s + extractorRate(p) * healthPeriodHours,
        0,
      );
      const pulling = Array.from(
        new Set(
          running
            .map((p) => p.extractor_details?.product_type_id)
            .filter((x): x is number => !!x),
        ),
      ).map(nameOf);
      return {
        name,
        extractorsRunning: running.length,
        extractorsTotal: pins.length,
        p0PerPeriod,
        pulling,
        healthy: p0PerPeriod >= healthFloor,
      };
    },
  );

  return {
    stages,
    raws,
    verdicts,
    keepCount,
    changeCount: verdicts.length - keepCount,
    stock: stockVerdicts,
    health,
  };
};
