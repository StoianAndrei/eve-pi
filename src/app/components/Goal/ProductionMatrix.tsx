"use client";

import Image from "next/image";
import { Box, Typography, Tooltip } from "@mui/material";
import { AccessToken, PlanetWithInfo } from "@/types";
import { EVE_IMAGE_URL } from "@/const";
import { tierOf, nameOf, TIER_COLORS } from "@/pi-tiers";
import { PlanetType } from "@/pi-planets";
import { planetFlows } from "@/planet-flows";
import { PlanetBadge } from "../common/PlanetBadge";

/**
 * Production matrix (cross-tab) — the decision board. Planet TYPES down the
 * left, CHARACTERS across the top; each intersection is that character's
 * planet(s) of that type. Every planet cell is two stacked rows: IN (what it
 * extracts — blue — and imports — grey) on top, OUT (what it exports /
 * produces) below. Cells whose output feeds the selected build glow green;
 * off-plan planets glow red.
 */
const SIZES = [32, 64, 128, 256, 512];
const ICON = (id: number, size = 24) => {
  const s = SIZES.find((v) => v >= size) ?? 512;
  return `${EVE_IMAGE_URL}/types/${id}/icon?size=${s}`;
};
const PORTRAIT = (characterId: number) => `${EVE_IMAGE_URL}/characters/${characterId}/portrait?size=64`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

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
        border: `1px solid ${bc}`,
        borderRadius: "6px",
        overflow: "hidden",
        bgcolor: aligned === false ? "rgba(244,67,54,.06)" : aligned ? "rgba(102,187,106,.06)" : "#1e1e1e",
        cursor: clickable && onSelect ? "pointer" : "default",
      }}
    >
      {/* IN row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 0.6, py: 0.45, borderBottom: "1px solid rgba(255,255,255,.06)", bgcolor: "rgba(124,182,242,.05)" }}>
        <Typography sx={{ fontSize: ".5rem", fontWeight: 700, color: "#7cb6f2", width: 20, flex: "none" }}>IN</Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.3 }}>
          {f.extracted.map((l) => <IconDot key={`e${l.typeId}`} id={l.typeId} ring="#7cb6f2" />)}
          {f.importedIn.map((l) => <IconDot key={`i${l.typeId}`} id={l.typeId} ring="#8a8f98" />)}
          {f.extracted.length === 0 && f.importedIn.length === 0 && (
            <Typography sx={{ fontSize: ".55rem", color: "text.disabled" }}>—</Typography>
          )}
        </Box>
      </Box>
      {/* OUT row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 0.6, py: 0.45, bgcolor: exp ? `${TIER_COLORS[expTier ?? "P2"]}12` : "transparent" }}>
        <Typography sx={{ fontSize: ".5rem", fontWeight: 700, color: exp ? TIER_COLORS[expTier ?? "P2"] : "text.disabled", width: 20, flex: "none" }}>OUT</Typography>
        {exp ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, minWidth: 0 }}>
            <IconDot id={exp.typeId} ring={TIER_COLORS[expTier ?? "P2"]} />
            <Typography sx={{ fontSize: ".58rem", lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {nameOf(exp.typeId)}
            </Typography>
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

  const present = TYPE_ORDER.filter((t) =>
    characters.some((c) => c.planets.some((p) => p.planet_type === t)),
  );
  const cell = (c: AccessToken, t: PlanetType) => c.planets.filter((p) => p.planet_type === t);

  const cols = `104px repeat(${characters.length}, minmax(158px, 1fr))`;
  const minW = 104 + characters.length * 158;

  return (
    <Box sx={{ overflowX: "auto", pb: 1 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: cols, gap: 0.75, minWidth: minW }}>
        {/* header row: who the characters are */}
        <Box sx={{ position: "sticky", left: 0, zIndex: 2, bgcolor: "#161616" }} />
        {characters.map((c) => (
          <Box key={c.character.characterId} sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 0.75, py: 0.5, bgcolor: "#242424", borderRadius: "6px", border: "1px solid rgba(255,255,255,.08)", minWidth: 0 }}>
            <Box sx={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", flex: "none", lineHeight: 0 }}>
              <Image src={PORTRAIT(c.character.characterId)} alt="" width={26} height={26} unoptimized />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: ".74rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.character.name}
              </Typography>
              <Typography sx={{ fontSize: ".58rem", color: "text.disabled" }}>{c.planets.length} planets</Typography>
            </Box>
          </Box>
        ))}

        {/* type rows */}
        {present.map((t) => (
          <Box key={t} sx={{ display: "contents" }}>
            <Box sx={{ position: "sticky", left: 0, zIndex: 1, display: "flex", alignItems: "center", gap: 0.75, px: 0.75, bgcolor: "#161616", borderRadius: "6px", border: "1px solid rgba(255,255,255,.06)" }}>
              <PlanetBadge type={t} size={18} />
              <Typography sx={{ fontSize: ".72rem", fontWeight: 500 }}>{cap(t)}</Typography>
            </Box>
            {characters.map((c) => {
              const planets = cell(c, t);
              return (
                <Box key={c.character.characterId} sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
                  {planets.map((p) => (
                    <PlanetCell key={p.planet_id} planet={p} requiredIds={requiredIds} onSelect={onSelect} />
                  ))}
                  {planets.length === 0 && (
                    <Box sx={{ minHeight: 48, borderRadius: "6px", border: "1px dashed rgba(255,255,255,.05)" }} />
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
