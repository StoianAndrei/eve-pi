"use client";

import Image from "next/image";
import { Box, Typography, Tooltip } from "@mui/material";
import { AccessToken } from "@/types";
import { EVE_IMAGE_URL } from "@/const";
import { tierOf, nameOf, TIER_COLORS } from "@/pi-tiers";
import { planetFlows } from "@/planet-flows";

/**
 * Production matrix — the decision board. Columns are your characters; each
 * column stacks that character's planets. Every cell is a planet split in half:
 * left = what it EXTRACTS (blue) + IMPORTS (neutral); right = what it EXPORTS
 * (its P2 / factory output). Cells whose output feeds the selected build glow
 * green; off-plan planets glow red — the ones to repurpose.
 */
const SIZES = [32, 64, 128, 256, 512];
const ICON = (id: number, size = 24) => {
  const s = SIZES.find((v) => v >= size) ?? 512;
  return `${EVE_IMAGE_URL}/types/${id}/icon?size=${s}`;
};
const initials = (name: string) => (name.match(/[A-Z0-9]/g)?.join("").slice(0, 3) ?? name.slice(0, 2)).toUpperCase();
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function IconDot({ id, ring }: { id: number; ring: string }) {
  return (
    <Tooltip title={nameOf(id)}>
      <Box sx={{ width: 22, height: 22, borderRadius: "4px", border: `1.5px solid ${ring}`, overflow: "hidden", flex: "none", lineHeight: 0 }}>
        <Image src={ICON(id)} alt="" width={20} height={20} unoptimized />
      </Box>
    </Tooltip>
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
  const maxRows = Math.max(...characters.map((c) => c.planets.length), 0);

  return (
    <Box sx={{ overflowX: "auto", pb: 1 }}>
      <Box sx={{ display: "flex", gap: 1, minWidth: "min-content" }}>
        {characters.map((c) => (
          <Box key={c.character.characterId} sx={{ display: "flex", flexDirection: "column", gap: 0.75, width: 168, flex: "none" }}>
            {/* column header — character initials */}
            <Tooltip title={`${c.character.name} · ${c.planets.length} planets`}>
              <Box sx={{ textAlign: "center", py: 0.5, bgcolor: "#242424", borderRadius: "6px", border: "1px solid rgba(255,255,255,.08)" }}>
                <Typography sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: ".9rem", letterSpacing: ".05em" }}>
                  {initials(c.character.name)}
                </Typography>
              </Box>
            </Tooltip>
            {c.planets.map((planet) => {
              const f = planetFlows(planet);
              const exp = f.exportedOut[0];
              const expTier = exp ? tierOf(exp.typeId) : undefined;
              const role = !exp
                ? "Idle"
                : expTier === "P4" || expTier === "P3"
                  ? "Factory"
                  : expTier === "P2"
                    ? "P2 planet"
                    : expTier === "P1"
                      ? "Refiner"
                      : "Extractor";
              const aligned = exp ? requiredIds.has(exp.typeId) : null;
              const bc = aligned === null ? "rgba(255,255,255,.12)" : aligned ? "#66bb6a" : "#f44336";
              const clickable = !!exp && (expTier === "P2" || expTier === "P3" || expTier === "P4");
              return (
                <Box
                  key={planet.planet_id}
                  onClick={clickable && onSelect ? () => onSelect(exp!.typeId) : undefined}
                  sx={{
                    border: `1px solid ${bc}`,
                    borderRadius: "8px",
                    overflow: "hidden",
                    bgcolor: "#1e1e1e",
                    cursor: clickable && onSelect ? "pointer" : "default",
                    boxShadow: aligned === false ? "inset 0 0 0 100px rgba(244,67,54,.05)" : aligned ? "inset 0 0 0 100px rgba(102,187,106,.05)" : "none",
                  }}
                >
                  {/* role + planet type */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 0.75, py: 0.4, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: bc, flex: "none" }} />
                    <Typography sx={{ fontSize: ".66rem", fontWeight: 600 }}>{role}</Typography>
                    <Box sx={{ flex: 1 }} />
                    <Typography sx={{ fontSize: ".6rem", color: "text.disabled" }}>{cap(planet.planet_type)}</Typography>
                  </Box>
                  {/* half / half */}
                  <Box sx={{ display: "flex", minHeight: 58 }}>
                    {/* left: extract (blue) + import (neutral) */}
                    <Box sx={{ flex: 1, p: 0.6, borderRight: "1px solid rgba(255,255,255,.06)", bgcolor: "rgba(124,182,242,.05)" }}>
                      <Typography sx={{ fontSize: ".54rem", textTransform: "uppercase", letterSpacing: ".04em", color: "#7cb6f2", mb: 0.3 }}>in</Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4 }}>
                        {f.extracted.map((l) => <IconDot key={`e${l.typeId}`} id={l.typeId} ring="#7cb6f2" />)}
                        {f.importedIn.map((l) => <IconDot key={`i${l.typeId}`} id={l.typeId} ring="#8a8f98" />)}
                        {f.extracted.length === 0 && f.importedIn.length === 0 && (
                          <Typography sx={{ fontSize: ".58rem", color: "text.disabled" }}>—</Typography>
                        )}
                      </Box>
                    </Box>
                    {/* right: export */}
                    <Box sx={{ flex: 1, p: 0.6, bgcolor: exp ? `${TIER_COLORS[expTier ?? "P2"]}12` : "transparent" }}>
                      <Typography sx={{ fontSize: ".54rem", textTransform: "uppercase", letterSpacing: ".04em", color: exp ? TIER_COLORS[expTier ?? "P2"] : "text.disabled", mb: 0.3 }}>out</Typography>
                      {exp ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <IconDot id={exp.typeId} ring={TIER_COLORS[expTier ?? "P2"]} />
                          <Typography sx={{ fontSize: ".6rem", lineHeight: 1.1 }}>{nameOf(exp.typeId)}</Typography>
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: ".58rem", color: "text.disabled" }}>idle</Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })}
            {/* pad short columns so rows line up */}
            {Array.from({ length: maxRows - c.planets.length }).map((_, i) => (
              <Box key={`pad${i}`} sx={{ minHeight: 84, borderRadius: "8px", border: "1px dashed rgba(255,255,255,.05)" }} />
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
