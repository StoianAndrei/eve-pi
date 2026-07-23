"use client";

import Image from "next/image";
import { Box, Typography, Tooltip } from "@mui/material";
import { AccessToken, PlanetWithInfo } from "@/types";
import { EVE_IMAGE_URL } from "@/const";
import { tierOf, nameOf, TIER_COLORS } from "@/pi-tiers";
import { PlanetType } from "@/pi-planets";
import { PLANET_COLORS } from "@/pi-investigate";
import { planetFlows } from "@/planet-flows";

/**
 * Production matrix (cross-tab) — the decision board. Planet TYPES down the
 * left, CHARACTERS across the top; each intersection is that character's
 * planet(s) of that type. Every planet cell is split in half: left = what it
 * extracts (blue) + imports (grey), right = what it exports. Cells whose output
 * feeds the selected build glow green; off-plan planets glow red.
 */
const SIZES = [32, 64, 128, 256, 512];
const ICON = (id: number, size = 24) => {
  const s = SIZES.find((v) => v >= size) ?? 512;
  return `${EVE_IMAGE_URL}/types/${id}/icon?size=${s}`;
};
const initials = (name: string) =>
  (name.match(/[A-Z0-9]/g)?.join("").slice(0, 3) ?? name.slice(0, 2)).toUpperCase();
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// fixed display order
const TYPE_ORDER: PlanetType[] = ["temperate", "barren", "oceanic", "ice", "gas", "lava", "storm", "plasma"];

function IconDot({ id, ring }: { id: number; ring: string }) {
  return (
    <Tooltip title={nameOf(id)}>
      <Box sx={{ width: 20, height: 20, borderRadius: "4px", border: `1.5px solid ${ring}`, overflow: "hidden", flex: "none", lineHeight: 0 }}>
        <Image src={ICON(id)} alt="" width={18} height={18} unoptimized />
      </Box>
    </Tooltip>
  );
}

function PlanetCell({
  planet,
  requiredIds,
  onSelect,
}: {
  planet: PlanetWithInfo;
  requiredIds: Set<number>;
  onSelect?: (id: number) => void;
}) {
  const f = planetFlows(planet);
  const exp = f.exportedOut[0];
  const expTier = exp ? tierOf(exp.typeId) : undefined;
  const aligned = exp ? requiredIds.has(exp.typeId) : null;
  const bc = aligned === null ? "rgba(255,255,255,.12)" : aligned ? "#66bb6a" : "#f44336";
  const clickable = !!exp && (expTier === "P2" || expTier === "P3" || expTier === "P4");
  return (
    <Box
      onClick={clickable && onSelect ? () => onSelect(exp!.typeId) : undefined}
      sx={{
        display: "flex",
        border: `1px solid ${bc}`,
        borderRadius: "6px",
        overflow: "hidden",
        bgcolor: aligned === false ? "rgba(244,67,54,.06)" : aligned ? "rgba(102,187,106,.06)" : "#1e1e1e",
        cursor: clickable && onSelect ? "pointer" : "default",
        minHeight: 52,
      }}
    >
      {/* left: extract (blue) + import (grey) */}
      <Box sx={{ flex: 1, p: 0.5, borderRight: "1px solid rgba(255,255,255,.06)", minWidth: 0 }}>
        <Typography sx={{ fontSize: ".5rem", textTransform: "uppercase", color: "#7cb6f2", mb: 0.3 }}>in</Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.3 }}>
          {f.extracted.map((l) => <IconDot key={`e${l.typeId}`} id={l.typeId} ring="#7cb6f2" />)}
          {f.importedIn.map((l) => <IconDot key={`i${l.typeId}`} id={l.typeId} ring="#8a8f98" />)}
          {f.extracted.length === 0 && f.importedIn.length === 0 && (
            <Typography sx={{ fontSize: ".55rem", color: "text.disabled" }}>—</Typography>
          )}
        </Box>
      </Box>
      {/* right: export */}
      <Box sx={{ flex: 1, p: 0.5, minWidth: 0, bgcolor: exp ? `${TIER_COLORS[expTier ?? "P2"]}12` : "transparent" }}>
        <Typography sx={{ fontSize: ".5rem", textTransform: "uppercase", color: exp ? TIER_COLORS[expTier ?? "P2"] : "text.disabled", mb: 0.3 }}>out</Typography>
        {exp ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
            <IconDot id={exp.typeId} ring={TIER_COLORS[expTier ?? "P2"]} />
            <Typography sx={{ fontSize: ".56rem", lineHeight: 1.05 }}>{nameOf(exp.typeId)}</Typography>
          </Box>
        ) : (
          <Typography sx={{ fontSize: ".55rem", color: "text.disabled" }}>idle</Typography>
        )}
      </Box>
    </Box>
  );
}

export function ProductionMatrix({
  characters,
  requiredIds,
  onSelect,
}: {
  characters: AccessToken[];
  requiredIds: Set<number>;
  onSelect?: (id: number) => void;
}) {
  if (characters.length === 0) {
    return (
      <Typography sx={{ fontSize: ".82rem", color: "text.disabled" }}>
        Log in your characters to see the production board.
      </Typography>
    );
  }

  // planet types actually present, in fixed order
  const present = TYPE_ORDER.filter((t) =>
    characters.some((c) => c.planets.some((p) => p.planet_type === t)),
  );
  const cell = (c: AccessToken, t: PlanetType) => c.planets.filter((p) => p.planet_type === t);

  const cols = `104px repeat(${characters.length}, minmax(150px, 1fr))`;
  const minW = 104 + characters.length * 150;

  return (
    <Box sx={{ overflowX: "auto", pb: 1 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 0.75, minWidth: minW }}>
        {/* header row */}
        <Box sx={{ position: "sticky", left: 0, zIndex: 2, bgcolor: "#1e1e1e" }} />
        {characters.map((c) => (
          <Tooltip key={c.character.characterId} title={`${c.character.name} · ${c.planets.length} planets`}>
            <Box sx={{ textAlign: "center", py: 0.5, bgcolor: "#242424", borderRadius: "6px", border: "1px solid rgba(255,255,255,.08)" }}>
              <Typography sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: ".85rem", letterSpacing: ".05em" }}>
                {initials(c.character.name)}
              </Typography>
            </Box>
          </Tooltip>
        ))}

        {/* type rows */}
        {present.map((t) => (
          <Box key={t} sx={{ display: "contents" }}>
            {/* row label (sticky) */}
            <Box sx={{ position: "sticky", left: 0, zIndex: 1, display: "flex", alignItems: "center", gap: 0.75, px: 0.75, bgcolor: "#161616", borderRadius: "6px", border: "1px solid rgba(255,255,255,.06)" }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: PLANET_COLORS[t], flex: "none" }} />
              <Typography sx={{ fontSize: ".72rem", fontWeight: 500 }}>{cap(t)}</Typography>
            </Box>
            {/* one cell per character */}
            {characters.map((c) => {
              const planets = cell(c, t);
              return (
                <Box key={c.character.characterId} sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
                  {planets.map((p) => (
                    <PlanetCell key={p.planet_id} planet={p} requiredIds={requiredIds} onSelect={onSelect} />
                  ))}
                  {planets.length === 0 && (
                    <Box sx={{ minHeight: 52, borderRadius: "6px", border: "1px dashed rgba(255,255,255,.05)" }} />
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
