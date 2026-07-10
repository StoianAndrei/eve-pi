"use client";

import { useContext } from "react";
import { Box, Typography } from "@mui/material";
import { AccessToken } from "@/types";
import { SessionContext } from "@/app/context/Context";
import { planetFlows, factoryCounts } from "@/planet-flows";
import { planetEconomics } from "@/planet-economics";

/**
 * P9 — folds the old "Empire" overview into one live KPI strip above the tabs.
 * Every fact it shows is also reachable per-planet, so the Empire tab can be removed.
 */
function Card({
  label,
  value,
  unit,
  sub,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  color?: string;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 150,
        bgcolor: "#1e1e1e",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: "8px",
        p: 2,
      }}
    >
      <Typography
        sx={{ fontSize: ".7rem", letterSpacing: ".06em", textTransform: "uppercase", color: "text.secondary" }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: "1.5rem", fontWeight: 500, mt: 0.5, color: color ?? "text.primary" }}>
        {value}
        {unit && (
          <Typography component="span" sx={{ fontSize: ".85rem", color: "text.secondary", fontWeight: 400 }}>
            {" "}
            {unit}
          </Typography>
        )}
      </Typography>
      <Typography sx={{ fontSize: ".72rem", color: "text.secondary", mt: 0.25 }}>{sub}</Typography>
    </Box>
  );
}

export function EmpireSummaryStrip({ characters }: { characters: AccessToken[] }) {
  const { piPrices } = useContext(SessionContext);

  const planets = characters.flatMap((c) =>
    c.planets
      .filter((p) => !c.planetConfig?.some((pc) => pc.planetId === p.planet_id && pc.excludeFromTotals))
      .map((p) => ({ character: c, planet: p })),
  );

  let iskHrNow = 0;
  let carryOut = 0;
  let uptimeSum = 0;
  let advRunning = 0;
  let advTotal = 0;
  let lossCount = 0;

  planets.forEach(({ planet }) => {
    const econ = planetEconomics(planet, piPrices);
    const flows = planetFlows(planet);
    const { advanced } = factoryCounts(planet);
    iskHrNow += econ.iskPerHourNet;
    uptimeSum += econ.uptimePct;
    advTotal += advanced;
    advRunning += Math.round((advanced * econ.uptimePct) / 100);
    if (econ.health === "loss") lossCount += 1;
    else carryOut += flows.exportedOut.reduce((s, l) => s + l.perHour * 48, 0);
  });

  const uptimeAvg = planets.length ? Math.round(uptimeSum / planets.length) : 100;

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
      <Card
        label="Empire value / hr"
        value={(iskHrNow >= 0 ? "+" : "") + iskHrNow.toFixed(2) + "M"}
        unit="ISK/h"
        sub="P2 exports only · imports counted internal"
        color="#66bb6a"
      />
      <Card
        label="P2 to carry out"
        value={Math.round(carryOut).toLocaleString()}
        unit="u / 48h"
        sub="Only P2 leaves the planet — P0 & P1 stay"
      />
      <Card
        label="Factory uptime"
        value={uptimeAvg + "%"}
        unit="avg"
        sub={`${advRunning} / ${advTotal} advanced factories running`}
        color={uptimeAvg < 100 ? "#ffa726" : "#66bb6a"}
      />
      <Card
        label="Losing planets"
        value={String(lossCount)}
        unit={`of ${planets.length}`}
        sub="Fixable by product swap — see Rebalance"
        color="#f44336"
      />
    </Box>
  );
}
