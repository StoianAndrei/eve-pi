import { Api } from "@/esi-api";

// Resolves a solar system id to its full spatial location (system -> constellation
// -> region) using public ESI universe endpoints. System/constellation/region
// names never change, so results are cached in localStorage with no TTL.

export interface SystemLocation {
  systemId: number;
  systemName: string;
  security: number; // rounded to 1 decimal, EVE-style
  securityRaw: number;
  constellationId: number;
  constellationName: string;
  regionId: number;
  regionName: string;
}

type SystemCacheEntry = {
  name: string;
  security_status: number;
  constellation_id: number;
};

const CACHE_KEY = "universe_cache_v1";

interface UniverseCache {
  systems: Record<number, SystemCacheEntry>;
  constellations: Record<number, { name: string; region_id: number }>;
  regions: Record<number, { name: string }>;
}

const emptyCache = (): UniverseCache => ({
  systems: {},
  constellations: {},
  regions: {},
});

const loadCache = (): UniverseCache => {
  if (typeof window === "undefined") return emptyCache();
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return emptyCache();
    return { ...emptyCache(), ...JSON.parse(stored) };
  } catch {
    return emptyCache();
  }
};

let cache: UniverseCache = loadCache();

const persist = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error("Failed to persist universe cache", e);
  }
};

const api = new Api();

const getSystem = async (systemId: number): Promise<SystemCacheEntry> => {
  const cached = cache.systems[systemId];
  if (cached) return cached;
  const data = (await api.v4.getUniverseSystemsSystemId(systemId)).data;
  const entry: SystemCacheEntry = {
    name: data.name,
    security_status: data.security_status,
    constellation_id: data.constellation_id,
  };
  cache.systems[systemId] = entry;
  return entry;
};

const getConstellation = async (
  constellationId: number,
): Promise<{ name: string; region_id: number }> => {
  const cached = cache.constellations[constellationId];
  if (cached) return cached;
  const data = (
    await api.v1.getUniverseConstellationsConstellationId(constellationId)
  ).data;
  const entry = { name: data.name, region_id: data.region_id };
  cache.constellations[constellationId] = entry;
  return entry;
};

const getRegion = async (regionId: number): Promise<{ name: string }> => {
  const cached = cache.regions[regionId];
  if (cached) return cached;
  const data = (await api.v1.getUniverseRegionsRegionId(regionId)).data;
  const entry = { name: data.name };
  cache.regions[regionId] = entry;
  return entry;
};

// EVE rounds security to 1 decimal, but any positive value below 0.05 is
// displayed as 0.1 (so a 0.4-truncated system never reads as 0.0 highsec-ish).
export const roundSecurity = (raw: number): number => {
  if (raw > 0 && raw < 0.05) return 0.1;
  return Math.round(raw * 10) / 10;
};

export const securityColor = (sec: number): string => {
  if (sec >= 0.5) return "#4caf50"; // highsec
  if (sec > 0.0) return "#ff9800"; // lowsec
  return "#f44336"; // null/negative
};

export const securityBand = (sec: number): "high" | "low" | "null" => {
  if (sec >= 0.5) return "high";
  if (sec > 0.0) return "low";
  return "null";
};

export const resolveSystemLocation = async (
  systemId: number,
): Promise<SystemLocation> => {
  const system = await getSystem(systemId);
  const constellation = await getConstellation(system.constellation_id);
  const region = await getRegion(constellation.region_id);
  return {
    systemId,
    systemName: system.name,
    security: roundSecurity(system.security_status),
    securityRaw: system.security_status,
    constellationId: system.constellation_id,
    constellationName: constellation.name,
    regionId: constellation.region_id,
    regionName: region.name,
  };
};

// Resolve many systems with light batching to avoid hammering ESI. Returns a
// map of systemId -> location; failed lookups are omitted.
export const resolveSystemLocations = async (
  systemIds: number[],
  batchSize = 5,
): Promise<Map<number, SystemLocation>> => {
  const unique = Array.from(new Set(systemIds));
  const result = new Map<number, SystemLocation>();
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const resolved = await Promise.all(
      batch.map(async (id) => {
        try {
          return await resolveSystemLocation(id);
        } catch (e) {
          console.error(`Failed to resolve system ${id}`, e);
          return undefined;
        }
      }),
    );
    resolved.forEach((loc) => {
      if (loc) result.set(loc.systemId, loc);
    });
  }
  persist();
  return result;
};
