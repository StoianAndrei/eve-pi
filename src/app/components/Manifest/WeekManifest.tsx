"use client";

import { useContext, useState } from "react";
import Image from "next/image";
import { Box, Paper, Typography, Button, LinearProgress, Chip } from "@mui/material";
import { AccessToken } from "@/types";
import { SessionContext } from "@/app/context/Context";
import { EVE_IMAGE_URL } from "@/const";
import { nameOf, TIER_COLORS } from "@/pi-tiers";
import { fmtIsk } from "@/pi-chain";
import { characterManifests, estateManifest, ManifestLine } from "./manifest";

/**
 * P5 — "Your week — what to fly." Estate haul manifest.
 * The three assumption chips (cadence, buffer, hauler) should ultimately bind to
 * the shared Assumptions store; here they are local state so the view is live.
 */
const ICON = (typeId: number, size = 32) =>
  `${EVE_IMAGE_URL}/types/${typeId}/icon?size=${size}`;

const m3 = (n: number) => Math.round(n).toLocaleString() + " m³";
const u = (n: number) => Math.round(n).toLocaleString();

function Row({ line, side }: { line: ManifestLine; side: "in" | "out" }) {
  const color = side === "in" ? "#7cb6f2" : "#f5cf74";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.75, py: 1.1, borderBottom: "1px solid rgba(255,255,255,.05)" }}>
      <Image src={ICON(line.typeId)} alt="" width={26} height={26} unoptimized />
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: ".84rem" }}>{nameOf(line.typeId)}</Typography>
        <Typography sx={{ fontSize: ".68rem", color: "text.secondary" }}>
          {side === "in" ? (line.internal ? "internal · from your bases" : "market buy · Jita") : m3(line.volume)}
        </Typography>
      </Box>
      <Box sx={{ textAlign: "right" }}>
        <Typography sx={{ fontSize: ".92rem", fontWeight: 500, color }}>
          {u(line.units)}
          {side === "out" && <Typography component="span" sx={{ fontSize: ".66rem", color: "text.secondary", fontWeight: 400 }}> u</Typography>}
        </Typography>
        <Typography sx={{ fontSize: side === "in" ? ".66rem" : ".72rem", color: side === "in" ? "text.secondary" : "success.main" }}>
          {side === "in" ? m3(line.volume) : line.isk.toFixed(0) + "M ISK"}
        </Typography>
      </Box>
    </Box>
  );
}

export function WeekManifest({ characters }: { characters: AccessToken[] }) {
  const { piPrices } = useContext(SessionContext);
  const [visitHours, setVisitHours] = useState(168);
  const [haulerCapacityM3] = useState(45_000);
  const [mode, setMode] = useState<"character" | "estate">("character");
  const man = estateManifest(characters, piPrices, { visitHours, haulerCapacityM3 });
  const perCharacter = characterManifests(characters, piPrices, { visitHours });

  const inPct = Math.min(100, Math.round((man.inVolume / haulerCapacityM3) * 100));
  const outPct = Math.min(100, Math.round((man.outVolume / haulerCapacityM3) * 100));
  const days = Math.round(visitHours / 24);
  const cadenceLabel = days >= 7 ? "once a week" : `every ${days} days`;

  return (
    <Box>
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 500, mb: 1 }}>
        Your week — what to fly{" "}
        <Typography component="span" sx={{ color: "text.disabled", fontWeight: 400, fontSize: ".85rem" }}>
          · one import + one export every {days} days
        </Typography>
      </Typography>

      {/* editable assumptions — bind to Assumptions store */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
        <Chip
          label={mode === "character" ? "Per character" : "Estate totals"}
          onClick={() => setMode(mode === "character" ? "estate" : "character")}
          sx={{ bgcolor: "rgba(144,202,249,.16)", border: "1px solid rgba(144,202,249,.4)", color: "primary.main" }}
        />
        <Chip label={`Cadence ${days} days`} onClick={() => setVisitHours(visitHours === 48 ? 72 : visitHours === 72 ? 168 : 48)} sx={{ bgcolor: "#242424", border: "1px solid rgba(255,255,255,.12)" }} />
        <Chip label="Import buffer 4×" sx={{ bgcolor: "#242424", border: "1px solid rgba(255,255,255,.12)" }} />
        <Chip label={`Hauler Epithal · ${haulerCapacityM3.toLocaleString()} m³`} sx={{ bgcolor: "#242424", border: "1px solid rgba(255,255,255,.12)" }} />
        <Chip label="Prices Jita sell" sx={{ bgcolor: "#242424", border: "1px solid rgba(255,255,255,.12)" }} />
      </Box>

      {mode === "character" && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {perCharacter.map((c) => (
            <Paper key={c.name} elevation={2} sx={{ borderRadius: "10px", overflow: "hidden", bgcolor: "#1e1e1e" }}>
              <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.25, px: 2, py: 1.5, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <Typography sx={{ fontWeight: 600, fontSize: ".95rem" }}>{c.name}</Typography>
                {c.systems.map((s) => (
                  <Chip key={s} size="small" label={s} sx={{ height: 20, fontSize: ".66rem", bgcolor: "#242424" }} />
                ))}
                <Typography sx={{ fontSize: ".74rem", color: "text.secondary" }}>
                  {c.planetCount} planets · {c.extractingCount} extracting
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: ".76rem", color: "text.secondary" }}>
                  {cadenceLabel}: carry OUT{" "}
                  <b style={{ color: "#f5cf74" }}>
                    {c.carryOut[0] ? `${fmtIsk(c.carryOut[0].units)} ${nameOf(c.carryOut[0].typeId)}` : "nothing"}
                  </b>
                  , bring IN {c.bringIn.length} input{c.bringIn.length === 1 ? "" : "s"}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap" }}>
                <Box sx={{ flex: 1, minWidth: 280, borderRight: "1px solid rgba(255,255,255,.05)", pb: 1 }}>
                  <Typography sx={{ px: 1.75, pt: 1.25, pb: 0.5, fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".05em", color: "#f5cf74" }}>
                    Carry out ↑
                  </Typography>
                  {c.carryOut.map((l) => (
                    <Box key={l.typeId} sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.75, py: 0.55 }}>
                      <Typography sx={{ fontSize: ".62rem", fontWeight: 700, color: TIER_COLORS[l.tier ?? "P0"], border: `1px solid ${TIER_COLORS[l.tier ?? "P0"]}`, borderRadius: "4px", px: 0.5 }}>
                        {l.tier}
                      </Typography>
                      <Typography sx={{ fontSize: ".84rem", fontWeight: 500, color: "#f5cf74", minWidth: 56, textAlign: "right" }}>
                        {fmtIsk(l.units)}
                      </Typography>
                      <Typography sx={{ fontSize: ".82rem" }}>{nameOf(l.typeId)}</Typography>
                    </Box>
                  ))}
                  {c.carryOut.length === 0 && (
                    <Typography sx={{ px: 1.75, py: 1, fontSize: ".76rem", color: "text.disabled" }}>nothing to export</Typography>
                  )}
                </Box>
                <Box sx={{ flex: 1, minWidth: 300, pb: 1 }}>
                  <Typography sx={{ px: 1.75, pt: 1.25, pb: 0.5, fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".05em", color: "#7cb6f2" }}>
                    Bring in ↓
                  </Typography>
                  {c.bringIn.map((l) => (
                    <Box key={l.typeId} sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.75, py: 0.55 }}>
                      <Typography sx={{ fontSize: ".62rem", fontWeight: 700, color: TIER_COLORS[l.tier ?? "P0"], border: `1px solid ${TIER_COLORS[l.tier ?? "P0"]}`, borderRadius: "4px", px: 0.5 }}>
                        {l.tier}
                      </Typography>
                      <Typography sx={{ fontSize: ".84rem", fontWeight: 500, color: "#7cb6f2", minWidth: 56, textAlign: "right" }}>
                        {fmtIsk(l.units)}
                      </Typography>
                      <Typography sx={{ fontSize: ".82rem", flex: 1 }}>{nameOf(l.typeId)}</Typography>
                      <Typography sx={{ fontSize: ".68rem", color: l.sourceHint ? "success.main" : "text.disabled" }}>
                        {l.sourceHint ?? "buy / haul in"}
                      </Typography>
                    </Box>
                  ))}
                  {c.bringIn.length === 0 && (
                    <Typography sx={{ px: 1.75, py: 1, fontSize: ".76rem", color: "text.disabled" }}>self-sufficient</Typography>
                  )}
                </Box>
              </Box>
              {c.extraction.length > 0 && (
                <Box sx={{ px: 2, py: 1, bgcolor: "#191919", borderTop: "1px solid rgba(255,255,255,.05)" }}>
                  <Typography sx={{ fontSize: ".7rem", color: "text.disabled" }}>
                    Backed by extraction (per {days}d, at current head rates):{" "}
                    {c.extraction.slice(0, 6).map((e) => `${fmtIsk(e.perPeriod)} ${e.name}`).join(" · ")}
                  </Typography>
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      )}

      {mode === "estate" && (
      <>
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* FLY IN */}
        <Paper elevation={2} sx={{ flex: 1, minWidth: 320, borderRadius: "10px", overflow: "hidden", bgcolor: "#1e1e1e" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.75, py: 1.5, bgcolor: "rgba(124,182,242,.08)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <Box sx={{ color: "#7cb6f2", fontSize: "1.1rem", fontWeight: 700 }}>↓</Box>
            <Typography sx={{ fontWeight: 500, fontSize: ".9rem", color: "#a9d1f7" }}>Fly in — P1 counterparts</Typography>
          </Box>
          {man.flyIn.map((l) => <Row key={l.typeId} line={l} side="in" />)}
          <Box sx={{ display: "flex", alignItems: "center", px: 1.75, py: 1.25, bgcolor: "#191919" }}>
            <Typography sx={{ fontSize: ".74rem", color: "text.secondary" }}>Total to haul in</Typography>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: ".9rem", fontWeight: 600, color: "#a9d1f7" }}>{u(man.inUnits)} u · {m3(man.inVolume)}</Typography>
          </Box>
        </Paper>

        {/* FLY OUT */}
        <Paper elevation={2} sx={{ flex: 1, minWidth: 320, borderRadius: "10px", overflow: "hidden", bgcolor: "#1e1e1e" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.75, py: 1.5, bgcolor: "rgba(242,193,78,.08)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <Box sx={{ color: "#f2c14e", fontSize: "1.1rem", fontWeight: 700 }}>↑</Box>
            <Typography sx={{ fontWeight: 500, fontSize: ".9rem", color: "#f5cf74" }}>Carry out — P2 to sell</Typography>
          </Box>
          {man.flyOut.map((l) => <Row key={l.typeId} line={l} side="out" />)}
          <Box sx={{ display: "flex", alignItems: "center", px: 1.75, py: 1.25, bgcolor: "#191919" }}>
            <Typography sx={{ fontSize: ".74rem", color: "text.secondary" }}>Value this run</Typography>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: ".9rem", fontWeight: 600, color: "success.main" }}>{man.outValue.toFixed(0)}M ISK</Typography>
          </Box>
        </Paper>
      </Box>

      {/* trip summary */}
      <Paper elevation={2} sx={{ borderRadius: "10px", bgcolor: "#191919", p: 2.25, mt: 1.75 }}>
        <Typography sx={{ fontWeight: 500, fontSize: ".9rem", mb: 1.75 }}>
          This run — Epithal loads{" "}
          <Typography component="span" sx={{ fontSize: ".72rem", color: "text.disabled" }}>
            planetary commodities hold {haulerCapacityM3.toLocaleString()} m³
          </Typography>
        </Typography>
        {[
          { label: "Fly in", pct: inPct, vol: man.inVolume, trips: man.inTrips, color: "#7cb6f2" },
          { label: "Fly out", pct: outPct, vol: man.outVolume, trips: man.outTrips, color: "#f2c14e" },
        ].map((r) => (
          <Box key={r.label} sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
            <Typography sx={{ fontSize: ".78rem", color: r.color, width: 70, flex: "none" }}>{r.label}</Typography>
            <LinearProgress
              variant="determinate"
              value={r.pct}
              sx={{ flex: 1, height: 12, borderRadius: 6, bgcolor: "rgba(255,255,255,.08)", "& .MuiLinearProgress-bar": { bgcolor: r.color } }}
            />
            <Typography sx={{ fontSize: ".76rem", color: "text.secondary", width: 210, flex: "none", textAlign: "right" }}>
              {m3(r.vol)} / {haulerCapacityM3.toLocaleString()} m³ · {r.trips} trip{r.trips > 1 ? "s" : ""} · {r.pct}%
            </Typography>
          </Box>
        ))}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, mt: 2, pt: 1.75, borderTop: "1px solid rgba(255,255,255,.08)", alignItems: "center" }}>
          <Metric label="P2 value / run" value={`${man.outValue.toFixed(0)}M ISK`} />
          <Metric label="Projected / month" value={`${((man.outValue * (24 / visitHours) * 30) / 1000).toFixed(1)}B ISK`} />
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" sx={{ fontWeight: 600 }}>Copy manifest</Button>
        </Box>
      </Paper>
      </>
      )}
    </Box>
  );
}

const Metric = ({ label, value }: { label: string; value: string }) => (
  <Box>
    <Typography sx={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: "text.secondary" }}>{label}</Typography>
    <Typography sx={{ fontSize: ".95rem", fontWeight: 500, color: "success.main", mt: 0.25 }}>{value}</Typography>
  </Box>
);
