import { Api } from "@/esi-api";
import { PI_SCHEMATICS } from "@/const";
import { EvePraisalResult } from "@/eve-praisal";
import { nameOf } from "@/pi-tiers";
import { unitPrice } from "@/pi-chain";

/**
 * R6 — System Planner data layer. Planet-type → extractable-P0 matrix
 * (canonical EVE), whole-system plan for a P2 target (ported from the design
 * handoff's pi-data.js planSystem), and live system lookup via ESI /universe/
 * instead of the prototype's sample systems.
 */

export type PlanetType =
  | "temperate"
  | "ice"
  | "gas"
  | "oceanic"
  | "lava"
  | "barren"
  | "storm"
  | "plasma";

const PLANET_TYPE_BY_TYPE_ID: Record<number, PlanetType> = {
  11: "temperate",
  12: "ice",
  13: "gas",
  2014: "oceanic",
  2015: "lava",
  2016: "barren",
  2017: "storm",
  2063: "plasma",
};

/** Canonical planet-type → extractable P0 type_ids. */
export const PLANET_P0: Record<PlanetType, number[]> = {
  barren: [2268, 2267, 2288, 2073, 2270],
  gas: [2268, 2267, 2309, 2310, 2311],
  ice: [2268, 2272, 2073, 2310, 2286],
  lava: [2267, 2307, 2272, 2306, 2308],
  oceanic: [2268, 2305, 2287, 2073, 2286],
  plasma: [2267, 2272, 2270, 2311, 2308],
  storm: [2268, 2267, 2309, 2310, 2308],
  temperate: [2268, 2305, 2288, 2287, 2073],
};

const BY_OUTPUT = new Map(PI_SCHEMATICS.map((s) => [s.outputs[0].type_id, s]));

export interface PlanRequirement {
  p1: number;
  p1Name: string;
  p0: number | undefined;
  p0Name: string;
}

export interface PlanPlanet {
  type: PlanetType;
  count: number;
  kind: "refinery" | "factory";
  role: string;
  yields: string[];
}

export interface SystemPlan {
  targetId: number;
  targetName: string;
  planets: PlanPlanet[];
  req: PlanRequirement[];
  missing: string[];
  selfSource: boolean;
  extractorPlanets: number;
  factoryPlanets: number;
  estPerHour: number;
  estIskPerHour: number; // millions
}

/** Hypothetical whole-system PI plan for a P2 target: assign planet types to roles. */
export const planSystem = (
  planetCounts: Partial<Record<PlanetType, number>>,
  targetId: number,
  piPrices: EvePraisalResult | undefined,
): SystemPlan | null => {
  const target = BY_OUTPUT.get(targetId);
  if (!target) return null;

  const req: PlanRequirement[] = target.inputs.map((i) => {
    const p1Schematic = BY_OUTPUT.get(i.type_id);
    const p0 = p1Schematic?.inputs[0]?.type_id;
    return {
      p1: i.type_id,
      p1Name: nameOf(i.type_id),
      p0,
      p0Name: p0 !== undefined ? nameOf(p0) : "—",
    };
  });

  const typesInSystem = Object.keys(planetCounts) as PlanetType[];
  const refineryFor: Partial<Record<PlanetType, string>> = {};
  req.forEach((r) => {
    if (r.p0 === undefined) return;
    const pt = typesInSystem.find(
      (t) => PLANET_P0[t].includes(r.p0 as number) && !refineryFor[t],
    );
    if (pt) refineryFor[pt] = r.p1Name;
  });

  const planets: PlanPlanet[] = typesInSystem.map((t) => ({
    type: t,
    count: planetCounts[t] ?? 0,
    kind: refineryFor[t] ? "refinery" : "factory",
    role: refineryFor[t]
      ? `Extract → ${refineryFor[t]}`
      : `${nameOf(targetId)} factory`,
    yields: PLANET_P0[t].map(nameOf),
  }));

  const missing = req
    .filter((r) => !Object.values(refineryFor).includes(r.p1Name))
    .map((r) => r.p1Name);

  let extractorPlanets = 0;
  let factoryPlanets = 0;
  planets.forEach((p) =>
    p.kind === "refinery"
      ? (extractorPlanets += p.count)
      : (factoryPlanets += p.count),
  );

  // ~6 advanced factories per factory planet, at the schematic's real rate.
  const perFactoryHour =
    target.outputs[0].quantity * (3600 / target.cycle_time);
  const estPerHour = factoryPlanets * 6 * perFactoryHour;
  const estIskPerHour =
    (estPerHour * unitPrice(piPrices, targetId, "sell")) / 1_000_000;

  return {
    targetId,
    targetName: nameOf(targetId),
    planets,
    req,
    missing,
    selfSource: missing.length === 0,
    extractorPlanets,
    factoryPlanets,
    estPerHour,
    estIskPerHour,
  };
};

// ---------------------------------------------------------------------------
// Live system lookup via ESI. Universe data is static, so cache forever.
// ---------------------------------------------------------------------------

export interface NearbySystem {
  name: string;
  jumps: 1 | 2;
}

export interface SystemInventory {
  systemId: number;
  name: string;
  region: string;
  sec: number;
  planets: Partial<Record<PlanetType, number>>;
  planetTotal: number;
}

interface UniverseCache {
  ids: Record<string, number>; // lower-cased system name -> id
  systems: Record<
    number,
    { name: string; sec: number; planetIds: number[]; stargates: number[]; constellationId: number }
  >;
  planetTypes: Record<number, number>; // planet_id -> type_id
  gateDest: Record<number, number>; // stargate_id -> destination system_id
  regions: Record<number, string>; // constellation_id -> region name
}

const CACHE_KEY = "esiUniverseCache_v1";

const loadCache = (): UniverseCache => {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
    // best-effort: ignore storage/delivery failures
  }
  }
  return { ids: {}, systems: {}, planetTypes: {}, gateDest: {}, regions: {} };
};

const cache = loadCache();

const persistCache = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // best-effort: ignore storage/delivery failures
  }
};

type EsiApi = Api<unknown>;

const getSystemRaw = async (api: EsiApi, systemId: number) => {
  if (!cache.systems[systemId]) {
    const s = (await api.v4.getUniverseSystemsSystemId(systemId)).data;
    cache.systems[systemId] = {
      name: s.name,
      sec: s.security_status,
      planetIds: (s.planets ?? []).map((p: { planet_id: number }) => p.planet_id),
      stargates: s.stargates ?? [],
      constellationId: s.constellation_id,
    };
    persistCache();
  }
  return cache.systems[systemId];
};

export const resolveSystemId = async (name: string): Promise<number | undefined> => {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  if (cache.ids[key]) return cache.ids[key];
  const api = new Api();
  const res = (await api.v1.postUniverseIds([name.trim()])).data;
  const id = res.systems?.[0]?.id;
  if (id) {
    cache.ids[key] = id;
    persistCache();
  }
  return id;
};

/** Planet-type inventory + region + sec for one system. */
export const fetchSystemInventory = async (
  systemId: number,
): Promise<SystemInventory> => {
  const api = new Api();
  const sys = await getSystemRaw(api, systemId);

  if (!cache.regions[sys.constellationId]) {
    const constellation = (
      await api.v1.getUniverseConstellationsConstellationId(sys.constellationId)
    ).data;
    const region = (
      await api.v1.getUniverseRegionsRegionId(constellation.region_id)
    ).data;
    cache.regions[sys.constellationId] = region.name;
    persistCache();
  }

  const missingPlanets = sys.planetIds.filter((id) => !cache.planetTypes[id]);
  if (missingPlanets.length) {
    const infos = await Promise.all(
      missingPlanets.map((id) => api.v1.getUniversePlanetsPlanetId(id)),
    );
    infos.forEach((r) => (cache.planetTypes[r.data.planet_id] = r.data.type_id));
    persistCache();
  }

  const planets: Partial<Record<PlanetType, number>> = {};
  sys.planetIds.forEach((id) => {
    const t = PLANET_TYPE_BY_TYPE_ID[cache.planetTypes[id]];
    if (t) planets[t] = (planets[t] ?? 0) + 1;
  });

  return {
    systemId,
    name: sys.name,
    region: cache.regions[sys.constellationId] ?? "",
    sec: sys.sec,
    planets,
    planetTotal: sys.planetIds.length,
  };
};

const neighborIdsOf = async (api: EsiApi, systemId: number): Promise<number[]> => {
  const sys = await getSystemRaw(api, systemId);
  const missing = sys.stargates.filter((g) => !cache.gateDest[g]);
  if (missing.length) {
    const gates = await Promise.all(
      missing.map((g) => api.v1.getUniverseStargatesStargateId(g)),
    );
    gates.forEach((r: { data: { stargate_id: number; destination: { system_id: number } } }) => (cache.gateDest[r.data.stargate_id] = r.data.destination.system_id));
    persistCache();
  }
  return sys.stargates.map((g) => cache.gateDest[g]).filter(Boolean);
};

/** Systems within 2 jumps (names + distance), via stargate traversal. */
export const fetchNearbySystems = async (
  systemId: number,
): Promise<NearbySystem[]> => {
  const api = new Api();
  const oneJump = await neighborIdsOf(api, systemId);
  const seen = new Set<number>([systemId, ...oneJump]);

  const twoJump: number[] = [];
  const secondDegree = await Promise.all(
    oneJump.map((id) => neighborIdsOf(api, id)),
  );
  secondDegree.flat().forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id);
      twoJump.push(id);
    }
  });

  const named = await Promise.all(
    [...oneJump, ...twoJump].map(async (id) => ({
      id,
      name: (await getSystemRaw(api, id)).name,
    })),
  );
  const nameById = new Map(named.map((n) => [n.id, n.name]));

  return [
    ...oneJump.map((id) => ({ name: nameById.get(id) ?? "?", jumps: 1 as const })),
    ...twoJump.map((id) => ({ name: nameById.get(id) ?? "?", jumps: 2 as const })),
  ];
};
