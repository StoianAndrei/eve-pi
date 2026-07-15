"use client";

import { useContext, ReactNode } from "react";
import Image from "next/image";
import { Box, Paper, Typography, LinearProgress, Chip } from "@mui/material";
import { AccessToken, PlanetWithInfo } from "@/types";
import { SessionContext } from "@/app/context/Context";
import { EVE_IMAGE_URL } from "@/const";
import { nameOf, tierOf, TIER_COLORS } from "@/pi-tiers";
import { planetFlows, factoryCounts, FlowLine } from "@/planet-flows";
import { planetEconomics } from "@/planet-economics";

/**
 * P1+P2+P3 — one planet as a three-lane pipeline card.
 * Extract (P0, stays) → Import (P1, fly in) → Carry out (P2, fly out),
 * plus factory counts, an uptime meter, and ISK/hr.
 *
 * Drop-in for the "Planets (pipeline)" tab. The existing PlanetTableRow stays
 * for the "Classic Table" tab.
 */
const ICON = (typeId: number, size = 32) =>
  `${EVE_IMAGE_URL}/types/${typeId}/icon?size=${size}`;

const fmtIsk = (m: number) => (m >= 0 ? "+" : "") + m.toFixed(2) + "M";

const uptimeColor = (u: number) =>
  u >= 98 ? "success.main" : u >= 85 ? "warning.main" : "error.main";

function ProductChip({
  line,
  caption,
  variant,
}: {
  line: FlowLine;
  caption: string;
  variant: "P0" | "P1" | "P2";
}) {
  const color = TIER_COLORS[variant];
  const bg =
    variant === "P0"
      ? "#242424"
      : variant === "P1"
        ? "rgba(124,182,242,.08)"
        : "rgba(242,193,78,.08)";
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        bgcolor: bg,
        border: `1px solid ${color}59`,
        borderLeft: `3px solid ${color}`,
        borderRadius: "6px",
        px: 1.25,
        py: 0.9,
      }}
    >
      <Image src={ICON(line.typeId)} alt="" width={26} height={26} unoptimized />
      <Box>
        <Typography sx={{ fontSize: ".82rem" }}>{nameOf(line.typeId)}</Typography>
        <Typography sx={{ fontSize: ".68rem", color: "text.secondary" }}>
          {caption}
        </Typography>
      </Box>
    </Box>
  );
}

const HEALTH = {
  ok: { label: "● Healthy", color: "#66bb6a", bg: "rgba(102,187,106,.14)" },
  warn: { label: "▲ Under-supplied", color: "#ffa726", bg: "rgba(255,167,38,.14)" },
  loss: { label: "▼ Producing at a loss", color: "#f44336", bg: "rgba(244,67,54,.16)" },
} as const;

export function PipelinePlanetCard({
  planet,
  character,
  open = true,
  onToggle,
}: {
  planet: PlanetWithInfo;
  character: AccessToken;
  open?: boolean;
  onToggle?: () => void;
}) {
  const { piPrices } = useContext(SessionContext);
  const flows = planetFlows(planet);
  const econ = planetEconomics(planet, piPrices);
  const { basic, advanced } = factoryCounts(planet);
  const h = HEALTH[econ.health];
  const exp = flows.exportedOut[0];

  return (
    <Paper
      elevation={2}
      sx={{ borderRadius: "10px", overflow: "hidden", bgcolor: "#1e1e1e" }}
    >
      {/* header — click to expand/collapse */}
      <Box
        onClick={onToggle}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderBottom: open ? "1px solid rgba(255,255,255,.06)" : "none",
          cursor: onToggle ? "pointer" : "default",
          userSelect: "none",
        }}
      >
        <Image
          src={`/${planet.planet_type}.png`}
          alt=""
          width={34}
          height={34}
          style={{ borderRadius: 6 }}
        />
        <Box sx={{ minWidth: 150 }}>
          <Typography sx={{ fontWeight: 500, fontSize: ".95rem" }}>
            {planet.infoUniverse?.name}
          </Typography>
          <Typography sx={{ fontSize: ".72rem", color: "text.secondary" }}>
            {planet.planet_type[0].toUpperCase() + planet.planet_type.slice(1)} planet
          </Typography>
        </Box>
        <Chip
          label={`CC L${planet.upgrade_level}`}
          size="small"
          variant="outlined"
          sx={{
            height: 22,
            color: "primary.main",
            borderColor: "rgba(144,202,249,.4)",
            fontSize: ".72rem",
          }}
        />
        <Typography sx={{ fontSize: ".7rem", fontWeight: 600, color: uptimeColor(econ.uptimePct), whiteSpace: "nowrap" }}>
          {econ.uptimePct}% up
        </Typography>
        {exp && (
          <Typography sx={{ fontSize: ".7rem", color: "text.secondary", whiteSpace: "nowrap", display: { xs: "none", sm: "block" } }}>
            {Math.round(exp.perHour * 48).toLocaleString()} u/48h
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <Box
          sx={{
            fontSize: ".72rem",
            fontWeight: 600,
            color: h.color,
            bgcolor: h.bg,
            borderRadius: "20px",
            px: 1.5,
            py: 0.5,
            whiteSpace: "nowrap",
          }}
        >
          {h.label}
        </Box>
        <Box sx={{ textAlign: "right", minWidth: 120 }}>
          <Typography
            sx={{
              fontSize: "1.15rem",
              fontWeight: 500,
              color: econ.iskPerHourNet < 0 ? "error.main" : "success.main",
            }}
          >
            {fmtIsk(econ.iskPerHourNet)}
            <Typography
              component="span"
              sx={{ fontSize: ".72rem", color: "text.secondary" }}
            >
              {" "}
              ISK/h
            </Typography>
          </Typography>
          <Typography sx={{ fontSize: ".72rem", color: "text.secondary" }}>
            {(Math.abs(econ.iskPerHourNet) * 720).toFixed(0)}M / mo
          </Typography>
        </Box>
        <Typography sx={{ color: "text.secondary", fontSize: ".85rem", width: 14, textAlign: "center", flex: "none" }}>
          {open ? "▾" : "▸"}
        </Typography>
      </Box>

      {open && (
      <>
      {/* lanes */}
      <Box sx={{ display: "flex", alignItems: "stretch", px: 2, py: 1.75, flexWrap: "wrap" }}>
        {/* EXTRACT */}
        <Box sx={{ flex: 1, minWidth: 190, pr: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          <LaneLabel color={TIER_COLORS.P0}>Extract · P0</LaneLabel>
          {flows.extracted.map((l) => (
            <ProductChip key={l.typeId} line={l} caption="extracted · 10 heads" variant="P0" />
          ))}
          {flows.producedLocal.map((l) => (
            <ProductChip key={l.typeId} line={l} caption={`refined locally · ${basic} basic`} variant="P0" />
          ))}
        </Box>
        <Arrow />
        {/* IMPORT */}
        <Box sx={{ flex: 1, minWidth: 190, px: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          <LaneLabel color={TIER_COLORS.P1}>Import · P1 ↓</LaneLabel>
          {flows.importedIn.map((l, i) => (
            <ProductChip
              key={l.typeId}
              line={l}
              caption={i === 0 ? "from your bases" : "2nd haul — avoidable"}
              variant="P1"
            />
          ))}
          {flows.importedIn.length === 0 && (
            <Typography sx={{ fontSize: ".72rem", color: "text.secondary" }}>
              No imports
            </Typography>
          )}
          <Typography sx={{ fontSize: ".7rem", color: "text.secondary", mt: 0.5 }}>
            Buffer covers{" "}
            <b style={{ color: econ.worstCoverHours >= 48 ? "#66bb6a" : "#f44336" }}>
              {isFinite(econ.worstCoverHours) ? `~${Math.round(econ.worstCoverHours)} h` : "∞"}
            </b>
          </Typography>
        </Box>
        <Arrow />
        {/* EXPORT */}
        <Box sx={{ flex: 1, minWidth: 190, pl: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          <LaneLabel color={TIER_COLORS.P2}>Carry out · P2 ↑</LaneLabel>
          {flows.exportedOut.map((l) => (
            <ProductChip key={l.typeId} line={l} caption={`${advanced} advanced factories`} variant="P2" />
          ))}
          {exp && (
            <Box sx={{ display: "flex", gap: 2, mt: 0.5 }}>
              <Stat value={Math.round(exp.perHour * 48).toLocaleString()} label="units / 48h" accent="#f5cf74" />
              <Stat value={Math.round(exp.perHour).toLocaleString()} label="units / hr" />
            </Box>
          )}
        </Box>
      </Box>

      {/* footer */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          px: 2,
          py: 1.25,
          bgcolor: "#191919",
          borderTop: "1px solid rgba(255,255,255,.06)",
          flexWrap: "wrap",
        }}
      >
        <Typography sx={{ fontSize: ".74rem", color: "text.secondary" }}>
          Factories{" "}
          <b style={{ color: "#fff", fontWeight: 500 }}>
            {advanced} adv · {basic} basic
          </b>
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 220, maxWidth: 420 }}>
          <Typography sx={{ fontSize: ".72rem", color: "text.secondary", whiteSpace: "nowrap" }}>
            Uptime
          </Typography>
          <LinearProgress
            variant="determinate"
            value={econ.uptimePct}
            sx={{
              flex: 1,
              height: 7,
              borderRadius: 4,
              bgcolor: "rgba(255,255,255,.1)",
              "& .MuiLinearProgress-bar": { bgcolor: uptimeColor(econ.uptimePct) },
            }}
          />
          <Typography sx={{ fontSize: ".74rem", fontWeight: 600, color: uptimeColor(econ.uptimePct), whiteSpace: "nowrap" }}>
            {econ.uptimePct}%
          </Typography>
        </Box>
      </Box>
      </>
      )}
    </Paper>
  );
}

const LaneLabel = ({ color, children }: { color: string; children: ReactNode }) => (
  <Typography
    sx={{
      fontSize: ".66rem",
      letterSpacing: ".08em",
      textTransform: "uppercase",
      color,
      fontWeight: 600,
      mb: 0.5,
    }}
  >
    {children}
  </Typography>
);

const Arrow = () => (
  <Box sx={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,.25)", fontSize: "1.4rem", px: 0.5 }}>
    →
  </Box>
);

const Stat = ({ value, label, accent }: { value: string; label: string; accent?: string }) => (
  <Box>
    <Typography sx={{ fontSize: "1.05rem", fontWeight: 500, color: accent ?? "text.primary" }}>
      {value}
    </Typography>
    <Typography sx={{ fontSize: ".66rem", color: "text.secondary" }}>{label}</Typography>
  </Box>
);
