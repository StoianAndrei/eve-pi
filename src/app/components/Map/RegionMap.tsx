import { useContext, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { AccessToken } from "@/types";
import { SessionContext } from "../../context/Context";
import {
  SystemLocation,
  resolveSystemLocations,
  securityColor,
} from "@/universe";

interface PlanetEntry {
  planetId: number;
  systemId: number;
  planetType: string;
  characterName: string;
  characterId: number;
  upgradeLevel: number;
}

interface SystemGroup {
  location: SystemLocation;
  planets: PlanetEntry[];
}

interface RegionGroup {
  regionId: number;
  regionName: string;
  systems: SystemGroup[];
  planetCount: number;
}

const collectPlanets = (characters: AccessToken[]): PlanetEntry[] =>
  characters.flatMap((c) =>
    (c.planets ?? []).map((p) => ({
      planetId: p.planet_id,
      systemId: p.solar_system_id,
      planetType: p.planet_type,
      characterName: c.character?.name ?? "Unknown",
      characterId: c.character?.characterId ?? 0,
      upgradeLevel: p.upgrade_level,
    })),
  );

const buildRegionGroups = (
  planets: PlanetEntry[],
  locations: Map<number, SystemLocation>,
): RegionGroup[] => {
  const bySystem = new Map<number, SystemGroup>();

  planets.forEach((planet) => {
    const location = locations.get(planet.systemId);
    if (!location) return; // not resolved yet
    const existing = bySystem.get(planet.systemId);
    if (existing) {
      existing.planets.push(planet);
    } else {
      bySystem.set(planet.systemId, { location, planets: [planet] });
    }
  });

  const byRegion = new Map<number, RegionGroup>();
  Array.from(bySystem.values()).forEach((systemGroup) => {
    const { regionId, regionName } = systemGroup.location;
    const region =
      byRegion.get(regionId) ??
      ({ regionId, regionName, systems: [], planetCount: 0 } as RegionGroup);
    region.systems.push(systemGroup);
    region.planetCount += systemGroup.planets.length;
    byRegion.set(regionId, region);
  });

  const regions = Array.from(byRegion.values());
  regions.forEach((region) =>
    region.systems.sort(
      (a, b) =>
        b.location.security - a.location.security ||
        a.location.systemName.localeCompare(b.location.systemName),
    ),
  );
  regions.sort((a, b) => a.regionName.localeCompare(b.regionName));
  return regions;
};

const PlanetTypeIcons = ({ planets }: { planets: PlanetEntry[] }) => {
  const counts = planets.reduce<Record<string, number>>((acc, p) => {
    acc[p.planetType] = (acc[p.planetType] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {Object.entries(counts).map(([type, count]) => (
        <Tooltip key={type} title={`${count} × ${type}`}>
          <Chip
            size="small"
            avatar={<Avatar src={`/${type}.png`} alt={type} />}
            label={count}
            variant="outlined"
          />
        </Tooltip>
      ))}
    </Stack>
  );
};

const SystemRow = ({ system }: { system: SystemGroup }) => {
  const { location, planets } = system;
  const owners = Array.from(
    new Set(planets.map((p) => p.characterName)),
  ).sort();
  return (
    <Box sx={{ py: 1 }}>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        <Chip
          size="small"
          label={location.security.toFixed(1)}
          sx={{
            backgroundColor: securityColor(location.security),
            color: "#000",
            fontWeight: 700,
            minWidth: 44,
          }}
        />
        <Typography sx={{ fontWeight: 600, minWidth: 120 }}>
          {location.systemName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {location.constellationName}
        </Typography>
        <PlanetTypeIcons planets={planets} />
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {owners.join(", ")}
        </Typography>
      </Stack>
    </Box>
  );
};

export const RegionMap = ({
  characters,
}: {
  characters: AccessToken[];
}) => {
  const { sessionReady } = useContext(SessionContext);
  const [locations, setLocations] = useState<Map<number, SystemLocation>>(
    new Map(),
  );
  const [loading, setLoading] = useState(false);

  const planets = useMemo(() => collectPlanets(characters), [characters]);
  const systemIds = useMemo(
    () => Array.from(new Set(planets.map((p) => p.systemId))),
    [planets],
  );

  useEffect(() => {
    if (systemIds.length === 0) return;
    let cancelled = false;
    setLoading(true);
    resolveSystemLocations(systemIds)
      .then((resolved) => {
        if (!cancelled) setLocations(resolved);
      })
      .catch((e) => console.error("Failed to resolve locations", e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [systemIds]);

  const regions = useMemo(
    () => buildRegionGroups(planets, locations),
    [planets, locations],
  );

  const totalSystems = regions.reduce((n, r) => n + r.systems.length, 0);

  if (!sessionReady) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (planets.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">
          No planets found. Log in with characters that have Planetary
          Interaction colonies.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        sx={{ mb: 2 }}
        flexWrap="wrap"
        useFlexGap
      >
        <Typography variant="h6">Where is my PI?</Typography>
        <Typography variant="body2" color="text.secondary">
          {planets.length} planets · {totalSystems} systems · {regions.length}{" "}
          regions
        </Typography>
        {loading && <CircularProgress size={18} />}
      </Stack>

      <Stack spacing={2}>
        {regions.map((region) => (
          <Paper key={region.regionId} sx={{ p: 2 }} elevation={2}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="baseline"
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {region.regionName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {region.systems.length} systems · {region.planetCount} planets
              </Typography>
            </Stack>
            <Divider />
            {region.systems.map((system) => (
              <SystemRow key={system.location.systemId} system={system} />
            ))}
          </Paper>
        ))}
      </Stack>
    </Box>
  );
};
