"use client";

import { useContext, useMemo, useState } from "react";
import Image from "next/image";
import { Box, Paper, Typography, Select, MenuItem, TextField, Button } from "@mui/material";
import { SessionContext } from "@/app/context/Context";
import { EVE_IMAGE_URL } from "@/const";
import { TIER_COLORS } from "@/pi-tiers";
import { GOALS, goalBuild, iskShort } from "@/pi-goal-build";

/**
 * Goal tab (design v3): start at the item you want to build; the PI plan and
 * economics derive from it. Sample blueprints + live PI prices.
 */
const ICON = (id: number, size = 32) => `${EVE_IMAGE_URL}/types/${id}/icon?size=${size}`;

export function GoalBuilder({ onTrace }: { onTrace: (id: number) => void }) {
  const { piPrices } = useContext(SessionContext);
  const [goalId, setGoalId] = useState<number>(GOALS[0].id);
  const [runs, setRuns] = useState<number>(GOALS[0].runsDefault);

  const a = useMemo(() => goalBuild(goalId, runs, piPrices), [goalId, runs, piPrices]);
  const profitColor = a.profit >= 0 ? "#66bb6a" : "#f44336";
  const maxDays = Math.max(...a.footprint.map((f) => f.days), 1);
  const buyBase = Math.max(a.fullBuy, a.selfBuild, 1);

  return (
    <Box>
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 500, mb: 0.25 }}>
        Goal{" "}
        <Typography component="span" sx={{ color: "text.disabled", fontWeight: 400, fontSize: ".85rem" }}>
          · start at the item you want to build — the PI plan derives from it
        </Typography>
      </Typography>
      <Typography sx={{ fontSize: ".75rem", color: "text.disabled", mb: 1.75, maxWidth: 900 }}>
        Demand comes from destruction: ships, structures and fuel that get blown up consume PI.
        Sample blueprints &amp; prices — a real build searches every blueprint (SDE) with live prices.
      </Typography>

      {/* controls */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "flex-end", mb: 1.75 }}>
        <Box>
          <Typography sx={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: "text.secondary", mb: 0.5 }}>
            I want to build
          </Typography>
          <Select
            size="small"
            value={goalId}
            onChange={(e) => {
              const id = Number(e.target.value);
              setGoalId(id);
              setRuns(GOALS.find((g) => g.id === id)?.runsDefault ?? 100);
            }}
            sx={{ minWidth: 220, bgcolor: "#242424", fontSize: ".85rem" }}
          >
            {GOALS.map((g) => (
              <MenuItem key={g.id} value={g.id} sx={{ fontSize: ".85rem" }}>
                {g.name}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Box>
          <Typography sx={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: "text.secondary", mb: 0.5 }}>
            Runs
          </Typography>
          <TextField
            size="small"
            type="number"
            value={runs}
            onChange={(e) => setRuns(Math.max(1, parseInt(e.target.value) || 1))}
            sx={{ width: 110, bgcolor: "#242424", "& input": { fontSize: ".85rem" } }}
          />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, bgcolor: "#191919", border: "1px solid rgba(255,255,255,.08)", borderRadius: "8px", px: 1.75, py: 1 }}>
          <Image src={ICON(a.goal.id)} alt="" width={30} height={30} unoptimized />
          <Box>
            <Typography sx={{ fontSize: ".9rem", fontWeight: 500 }}>{a.goal.name}</Typography>
            <Typography sx={{ fontSize: ".68rem", color: "text.disabled" }}>
              {a.goal.note} · {a.outUnits.toLocaleString()} units out
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* econ strip */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, mb: 2 }}>
        {[
          { label: "Output value", value: iskShort(a.revenue), color: "#66bb6a" },
          { label: "Material cost", value: iskShort(a.matCost), color: "#f0a5a0" },
          { label: "SCC fee (4%)", value: iskShort(a.scc), color: "#f0a5a0" },
          { label: "Net profit", value: iskShort(a.profit), color: profitColor },
          { label: "Margin", value: (a.margin * 100).toFixed(1) + "%", color: profitColor },
        ].map((m) => (
          <Paper key={m.label} elevation={0} sx={{ flex: 1, minWidth: 120, bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "8px", px: 1.75, py: 1.5 }}>
            <Typography sx={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: "text.secondary" }}>
              {m.label}
            </Typography>
            <Typography sx={{ fontSize: "1.2rem", fontWeight: 500, color: m.color, mt: 0.25 }}>
              {m.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "flex-start" }}>
        {/* bill of materials */}
        <Paper elevation={0} sx={{ flex: 1.4, minWidth: 340, bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", overflow: "hidden" }}>
          <Box sx={{ display: "flex", alignItems: "center", px: 1.75, py: 1.25, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <Typography sx={{ fontSize: ".85rem", fontWeight: 500 }}>Bill of materials</Typography>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: ".68rem", color: "text.disabled" }}>PI rows highlighted — trace them to P0</Typography>
          </Box>
          {a.rows.map((r) => {
            const tcolor = r.tier ? TIER_COLORS[r.tier] : "rgba(255,255,255,.14)";
            return (
              <Box
                key={r.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 1.75,
                  py: 1,
                  borderBottom: "1px solid rgba(255,255,255,.04)",
                  borderLeft: `3px solid ${tcolor}`,
                  bgcolor: r.isPi ? `${tcolor}22` : "transparent",
                }}
              >
                <Image src={ICON(r.id, 24)} alt="" width={24} height={24} unoptimized />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: ".82rem" }}>{r.name}</Typography>
                  <Typography sx={{ fontSize: ".64rem", color: "text.disabled" }}>
                    {r.qtyRun.toLocaleString()} / run · {r.srcLabel}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography sx={{ fontSize: ".82rem", fontWeight: 500 }}>{r.qtyTotal.toLocaleString()}</Typography>
                  <Typography sx={{ fontSize: ".64rem", color: "#8bbf8e" }}>{iskShort(r.cost)}</Typography>
                </Box>
                {r.traceable && (
                  <Button
                    onClick={() => onTrace(r.id)}
                    size="small"
                    variant="outlined"
                    sx={{ minWidth: 0, fontSize: ".66rem", fontWeight: 600, py: 0.25, px: 1, color: "primary.main", borderColor: "rgba(144,202,249,.45)", whiteSpace: "nowrap" }}
                  >
                    Trace →
                  </Button>
                )}
              </Box>
            );
          })}
        </Paper>

        {/* PI footprint + buy vs build */}
        <Box sx={{ flex: 1, minWidth: 300, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Paper elevation={0} sx={{ bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", px: 1.75, py: 1.5 }}>
            <Typography sx={{ fontSize: ".85rem", fontWeight: 500, mb: 0.25 }}>
              PI footprint{" "}
              <Typography component="span" sx={{ fontSize: ".68rem", color: "text.disabled", fontWeight: 400 }}>
                · factory-days to self-supply (1 top-tier factory)
              </Typography>
            </Typography>
            <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1.25, mt: 1.25, overflowX: "auto" }}>
              {a.footprint.map((f) => (
                <Box key={f.id} sx={{ flex: 1, minWidth: 56, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                  <Typography sx={{ fontSize: ".62rem", color: "#8bbf8e", whiteSpace: "nowrap" }}>
                    {f.days.toFixed(f.days < 10 ? 1 : 0)}d
                  </Typography>
                  <Box sx={{ width: 26, height: Math.max(6, Math.round((f.days / maxDays) * 90)), bgcolor: f.tier ? TIER_COLORS[f.tier] : "#7d8a9c", borderRadius: "4px 4px 0 0" }} />
                  <Image src={ICON(f.id, 24)} alt="" width={22} height={22} unoptimized />
                  <Typography sx={{ fontSize: ".6rem", color: "text.secondary", textAlign: "center", lineHeight: 1.2, maxWidth: 76, height: 22, overflow: "hidden" }}>
                    {f.name}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography sx={{ fontSize: ".7rem", color: "text.secondary", mt: 1 }}>
              Total ≈ <b style={{ color: "#fff" }}>{a.totalDays.toFixed(0)} factory-days</b> — parallelize across planets to compress
            </Typography>
          </Paper>

          <Paper elevation={0} sx={{ bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", px: 1.75, py: 1.5 }}>
            <Typography sx={{ fontSize: ".85rem", fontWeight: 500, mb: 1.25 }}>Buy PI vs build it yourself</Typography>
            <Box sx={{ display: "flex", alignItems: "flex-end", gap: 3.25, px: 1 }}>
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                <Typography sx={{ fontSize: ".66rem", color: "#f0a5a0" }}>{iskShort(a.fullBuy)}</Typography>
                <Box sx={{ width: 38, height: Math.max(6, Math.round((a.fullBuy / buyBase) * 90)), bgcolor: "rgba(244,67,54,.75)", borderRadius: "4px 4px 0 0" }} />
                <Typography sx={{ fontSize: ".64rem", color: "text.secondary" }}>buy all mats</Typography>
              </Box>
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                <Typography sx={{ fontSize: ".66rem", color: "#8bbf8e" }}>{iskShort(a.selfBuild)}</Typography>
                <Box sx={{ width: 38, height: Math.max(6, Math.round((a.selfBuild / buyBase) * 90)), bgcolor: "rgba(102,187,106,.8)", borderRadius: "4px 4px 0 0" }} />
                <Typography sx={{ fontSize: ".64rem", color: "text.secondary" }}>self-built PI</Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: ".7rem", color: "#8bbf8e", mt: 1, textAlign: "center" }}>
              Your PI empire keeps ≈ {iskShort(a.saved)} of the material bill
            </Typography>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
