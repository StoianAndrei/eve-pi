"use client";

import { useContext } from "react";
import Image from "next/image";
import { Box, Paper, Typography, Button, Divider } from "@mui/material";
import { AccessToken } from "@/types";
import { SessionContext } from "@/app/context/Context";
import { EVE_IMAGE_URL } from "@/const";
import { nameOf } from "@/pi-tiers";
import { findSwaps, PlanetSwapSide } from "./rebalance";

/**
 * P6 — Rebalance tab. "Don't relocate, re-assign." Shows before/after math.
 */
const ICON = (typeId: number, size = 32) =>
  `${EVE_IMAGE_URL}/types/${typeId}/icon?size=${size}`;

const names = (ids: number[]) => ids.map(nameOf).join(" + ");

function Side({ s }: { s: PlanetSwapSide }) {
  return (
    <Box sx={{ flex: 1, minWidth: 300, p: 2.25, borderRight: "1px solid rgba(255,255,255,.06)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
        <Image src={`/${s.planetType}.png`} alt="" width={30} height={30} style={{ borderRadius: 6 }} />
        <Typography sx={{ fontWeight: 500 }}>{s.name}</Typography>
        <Box sx={{ fontSize: ".68rem", color: "primary.main", border: "1px solid rgba(144,202,249,.4)", borderRadius: "5px", px: 0.9, whiteSpace: "nowrap" }}>
          CC L{s.cc}
        </Box>
      </Box>
      <Typography sx={{ fontSize: ".72rem", color: "text.secondary", mb: 0.5 }}>
        Extracts locally → refines
      </Typography>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, bgcolor: "#242424", borderLeft: "3px solid #8a8f98", borderRadius: "5px", px: 1.1, py: 0.6, mb: 1.75 }}>
        <Image src={ICON(s.localP1)} alt="" width={20} height={20} unoptimized />
        <Typography sx={{ fontSize: ".78rem" }}>{nameOf(s.localP1)}</Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: "error.main", mb: 0.6 }}>
            Now (loss)
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, bgcolor: "rgba(244,67,54,.08)", border: "1px solid rgba(244,67,54,.3)", borderRadius: "5px", px: 1.1, py: 0.75 }}>
            <Image src={ICON(s.nowProduct)} alt="" width={20} height={20} unoptimized />
            <Typography sx={{ fontSize: ".76rem" }}>{nameOf(s.nowProduct)}</Typography>
          </Box>
          <Typography sx={{ fontSize: ".68rem", color: "#f28b82", mt: 0.6 }}>
            imports {names(s.nowImports)}
          </Typography>
          <Typography sx={{ fontSize: ".9rem", fontWeight: 600, color: "error.main", mt: 0.5 }}>
            {s.nowIsk.toFixed(2)} ISK/h
          </Typography>
        </Box>
        <Box sx={{ color: "success.main", fontSize: "1.3rem", fontWeight: 700 }}>→</Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: "success.main", mb: 0.6 }}>
            After swap
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, bgcolor: "rgba(102,187,106,.1)", border: "1px solid rgba(102,187,106,.35)", borderRadius: "5px", px: 1.1, py: 0.75 }}>
            <Image src={ICON(s.newProduct)} alt="" width={20} height={20} unoptimized />
            <Typography sx={{ fontSize: ".76rem", fontWeight: 500 }}>{nameOf(s.newProduct)}</Typography>
          </Box>
          <Typography sx={{ fontSize: ".68rem", color: "#8bbf8e", mt: 0.6 }}>
            uses local {nameOf(s.localP1)} · imports {names(s.newImports)}
          </Typography>
          <Typography sx={{ fontSize: ".9rem", fontWeight: 600, color: "success.main", mt: 0.5 }}>
            +{s.newIsk.toFixed(2)} ISK/h
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export function RebalancePanel({ characters }: { characters: AccessToken[] }) {
  const { piPrices } = useContext(SessionContext);
  const recs = findSwaps(characters, piPrices);

  if (recs.length === 0) {
    return (
      <Typography sx={{ color: "text.secondary", py: 4 }}>
        No planets are running at a loss. Nothing to rebalance. 🎉
      </Typography>
    );
  }

  return (
    <Box>
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 500, mb: 0.5 }}>
        Rebalance — don&apos;t relocate, re-assign
      </Typography>
      <Typography sx={{ fontSize: ".85rem", color: "text.secondary", mb: 2.25, maxWidth: 820 }}>
        These planets are producing at a loss. Each already extracts a P0 that refines into
        exactly the P1 another is hauling in. Swap what they produce and both stop cross-hauling
        and go green — no planet moves.
      </Typography>

      {recs.map((rec, idx) => (
        <Paper key={idx} elevation={2} sx={{ borderRadius: "10px", overflow: "hidden", bgcolor: "#1e1e1e", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 2, py: 1.5, bgcolor: "rgba(102,187,106,.08)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <Box sx={{ fontSize: ".7rem", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "success.main", bgcolor: "rgba(102,187,106,.16)", borderRadius: "5px", px: 1.1, py: 0.4 }}>
              {rec.sides.length === 2 ? "Recommended swap" : "Reassign"}
            </Box>
            <Typography sx={{ fontSize: ".85rem", color: "text.primary" }}>
              {rec.sides.length === 2
                ? "Trade advanced schematics between the two planets below"
                : "Switch this planet's advanced schematic"}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: ".85rem", fontWeight: 600, color: "success.main" }}>
              Empire +{rec.empireDeltaIsk.toFixed(2)} ISK/h
            </Typography>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap" }}>
            {rec.sides.map((s) => (
              <Side key={s.name} s={s} />
            ))}
          </Box>
          <Box sx={{ display: "flex", gap: 1.25, px: 2, py: 1.5, bgcolor: "#191919", borderTop: "1px solid rgba(255,255,255,.06)" }}>
            <Button variant="contained" color="success" sx={{ fontWeight: 600 }}>
              Apply swap plan
            </Button>
            <Button variant="outlined" color="inherit">
              Dismiss
            </Button>
          </Box>
        </Paper>
      ))}
    </Box>
  );
}
