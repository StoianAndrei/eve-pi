"use client";

import { useContext, useMemo, useState } from "react";
import Image from "next/image";
import { Box, Paper, Typography, Select, MenuItem, TextField, Button, Chip } from "@mui/material";
import { SessionContext } from "@/app/context/Context";
import { EVE_IMAGE_URL } from "@/const";
import { TIER_COLORS } from "@/pi-tiers";
import { GOALS, goalBuild, iskShort, dur, GoalSummary } from "@/pi-goal-build";

/**
 * Goal / Build analyzer (design v3 + eveindustry factory-planner depth).
 * Start at the item you want to build; the bill of materials, production time
 * and Full-Buy vs Full-Build economics derive from it. PI rows are highlighted
 * and traceable to P0 — your empire supplies them.
 */
// images.evetech.net only serves these icon sizes; anything else 400s. Snap up
// to the nearest valid size and let width/height control the on-screen px.
const EVE_ICON_SIZES = [32, 64, 128, 256, 512];
const ICON = (id: number, size = 32) => {
  const s = EVE_ICON_SIZES.find((v) => v >= size) ?? 512;
  return `${EVE_IMAGE_URL}/types/${id}/icon?size=${s}`;
};
const m3 = (n: number) => Math.round(n).toLocaleString() + " m³";

export function GoalBuilder({ onTrace }: { onTrace: (id: number) => void }) {
  const { piPrices } = useContext(SessionContext);
  const [goalId, setGoalId] = useState<number>(GOALS[0].id);
  const [runs, setRuns] = useState<number>(GOALS[0].runsDefault);

  const a = useMemo(() => goalBuild(goalId, runs, piPrices), [goalId, runs, piPrices]);
  const maxDays = Math.max(...a.footprint.map((f) => f.days), 1);
  const buyBase = Math.max(a.matBuy, a.matBuild, 1);
  const headlineColor = a.buy.net >= 0 ? "#66bb6a" : "#f44336";

  return (
    <Box>
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 500, mb: 0.25 }}>
        Goal{" "}
        <Typography component="span" sx={{ color: "text.disabled", fontWeight: 400, fontSize: ".85rem" }}>
          · start at the item you want to build — the PI plan &amp; economics derive from it
        </Typography>
      </Typography>
      <Typography sx={{ fontSize: ".75rem", color: "text.disabled", mb: 1.75, maxWidth: 940 }}>
        Demand comes from destruction: ships, structures and deployables that get blown up consume
        PI. Sample blueprints &amp; prices — a real build reads every blueprint (SDE) with live
        prices. Full-Build assumes ME10 components.
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
            sx={{ minWidth: 240, bgcolor: "#242424", fontSize: ".85rem" }}
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, bgcolor: "#191919", border: "1px solid rgba(255,255,255,.08)", borderRadius: "8px", px: 1.75, py: 1 }}>
          <Image src={ICON(a.goal.id, 40)} alt="" width={38} height={38} unoptimized />
          <Box>
            <Typography sx={{ fontSize: ".92rem", fontWeight: 500 }}>{a.goal.name}</Typography>
            <Typography sx={{ fontSize: ".68rem", color: "text.disabled" }}>
              {a.goal.note} · {a.outUnits.toLocaleString()} units out
            </Typography>
          </Box>
          <Chip
            size="small"
            label={`${dur(a.perRunSec)} / run · ${dur(a.totalSec)} total`}
            sx={{ ml: 0.5, height: 22, fontSize: ".66rem", bgcolor: "#242424" }}
          />
        </Box>
      </Box>

      {/* cost & profit headline */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, mb: 2 }}>
        {[
          { label: "Output value", value: iskShort(a.revenue), color: "#66bb6a" },
          { label: "Material cost (buy)", value: iskShort(a.matBuy), color: "#f0a5a0" },
          { label: "Net profit (buy)", value: iskShort(a.buy.net), color: headlineColor },
          { label: "Margin", value: (a.buy.margin * 100).toFixed(1) + "%", color: headlineColor },
          { label: "Per unit", value: iskShort(a.buy.perUnit) + " / u", color: headlineColor },
          { label: "Total volume", value: m3(a.totalVol), color: "#c9ccd1" },
        ].map((m) => (
          <Paper key={m.label} elevation={0} sx={{ flex: 1, minWidth: 130, bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "8px", px: 1.75, py: 1.5 }}>
            <Typography sx={{ fontSize: ".66rem", textTransform: "uppercase", letterSpacing: ".05em", color: "text.secondary" }}>
              {m.label}
            </Typography>
            <Typography sx={{ fontSize: "1.15rem", fontWeight: 500, color: m.color, mt: 0.25 }}>
              {m.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "flex-start" }}>
        {/* materials table */}
        <Paper elevation={0} sx={{ flex: 1.5, minWidth: 360, bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", overflow: "hidden" }}>
          <Box sx={{ display: "flex", alignItems: "center", px: 1.75, py: 1.25, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <Typography sx={{ fontSize: ".85rem", fontWeight: 500 }}>Materials</Typography>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: ".68rem", color: "text.disabled" }}>PI rows highlighted — trace to P0</Typography>
          </Box>
          <Box sx={{ overflowX: "auto" }}>
            {/* header */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1.7fr .8fr .8fr .9fr .9fr", gap: 1, px: 1.75, py: 0.75, minWidth: 560, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              {["Material", "Qty", "Vol", "Buy cost", "Build cost"].map((h, i) => (
                <Typography key={h} sx={{ fontSize: ".64rem", textTransform: "uppercase", letterSpacing: ".04em", color: "text.secondary", textAlign: i === 0 ? "left" : "right" }}>
                  {h}
                </Typography>
              ))}
            </Box>
            {a.rows.map((r) => {
              const tcolor = r.tier ? TIER_COLORS[r.tier] : "rgba(255,255,255,.14)";
              return (
                <Box
                  key={r.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1.7fr .8fr .8fr .9fr .9fr",
                    gap: 1,
                    alignItems: "center",
                    px: 1.75,
                    py: 1,
                    minWidth: 560,
                    borderBottom: "1px solid rgba(255,255,255,.04)",
                    borderLeft: `3px solid ${tcolor}`,
                    bgcolor: r.isPi ? `${tcolor}1f` : "transparent",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                    <Image src={ICON(r.id, 28)} alt="" width={26} height={26} unoptimized />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: ".82rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.name}
                      </Typography>
                      <Typography sx={{ fontSize: ".62rem", color: "text.disabled" }}>
                        {r.tier ? `${r.tier} · ` : ""}{r.srcLabel}
                      </Typography>
                    </Box>
                    {r.traceable && (
                      <Button
                        onClick={() => onTrace(r.id)}
                        size="small"
                        variant="outlined"
                        sx={{ minWidth: 0, fontSize: ".62rem", fontWeight: 600, py: 0, px: 0.75, ml: 0.25, color: "primary.main", borderColor: "rgba(144,202,249,.45)", whiteSpace: "nowrap" }}
                      >
                        Trace →
                      </Button>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: ".78rem", textAlign: "right" }}>{Math.round(r.qtyTotal).toLocaleString()}</Typography>
                  <Typography sx={{ fontSize: ".72rem", textAlign: "right", color: "text.secondary" }}>{Math.round(r.vol).toLocaleString()}</Typography>
                  <Typography sx={{ fontSize: ".78rem", textAlign: "right", color: "#f0a5a0" }}>{iskShort(r.buyCost)}</Typography>
                  <Typography sx={{ fontSize: ".78rem", textAlign: "right", color: r.buildable ? "#8bbf8e" : "text.disabled" }}>
                    {r.buildable ? iskShort(r.buildCost) : "—"}
                  </Typography>
                </Box>
              );
            })}
            {/* totals */}
            <Box sx={{ display: "grid", gridTemplateColumns: "1.7fr .8fr .8fr .9fr .9fr", gap: 1, px: 1.75, py: 1, minWidth: 560, bgcolor: "#191919" }}>
              <Typography sx={{ fontSize: ".74rem", fontWeight: 600 }}>Totals</Typography>
              <Box />
              <Typography sx={{ fontSize: ".72rem", textAlign: "right", color: "text.secondary" }}>{Math.round(a.totalVol).toLocaleString()}</Typography>
              <Typography sx={{ fontSize: ".8rem", textAlign: "right", fontWeight: 600, color: "#f0a5a0" }}>{iskShort(a.matBuy)}</Typography>
              <Typography sx={{ fontSize: ".8rem", textAlign: "right", fontWeight: 600, color: "#8bbf8e" }}>{iskShort(a.matBuild)}</Typography>
            </Box>
          </Box>
        </Paper>

        {/* right column */}
        <Box sx={{ flex: 1, minWidth: 300, display: "flex", flexDirection: "column", gap: 1.5 }}>
          {/* build vs buy */}
          <Paper elevation={0} sx={{ bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", px: 1.75, py: 1.5 }}>
            <Typography sx={{ fontSize: ".85rem", fontWeight: 500, mb: 1.25 }}>Build vs buy</Typography>
            <Box sx={{ display: "flex", alignItems: "flex-end", gap: 3.25, px: 1 }}>
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                <Typography sx={{ fontSize: ".66rem", color: "#f0a5a0" }}>{iskShort(a.matBuy)}</Typography>
                <Box sx={{ width: 40, height: Math.max(6, Math.round((a.matBuy / buyBase) * 90)), bgcolor: "rgba(244,67,54,.75)", borderRadius: "4px 4px 0 0" }} />
                <Typography sx={{ fontSize: ".64rem", color: "text.secondary" }}>full buy</Typography>
              </Box>
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                <Typography sx={{ fontSize: ".66rem", color: "#8bbf8e" }}>{iskShort(a.matBuild)}</Typography>
                <Box sx={{ width: 40, height: Math.max(6, Math.round((a.matBuild / buyBase) * 90)), bgcolor: "rgba(102,187,106,.8)", borderRadius: "4px 4px 0 0" }} />
                <Typography sx={{ fontSize: ".64rem", color: "text.secondary" }}>full build (ME10)</Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: ".72rem", color: a.buildIsCheaper ? "#8bbf8e" : "#f0a5a0", mt: 1, textAlign: "center" }}>
              {a.buildIsCheaper
                ? `✓ Building components saves ${iskShort(a.matBuy - a.matBuild)}`
                : "Buying components is cheaper here"}
            </Typography>
          </Paper>

          {/* the two summaries */}
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            <SummaryCard title="Summary (Full Buy)" s={a.buy} accent="#f0a5a0" />
            <SummaryCard title="Summary (Full Build)" s={a.build} accent="#8bbf8e" />
          </Box>

          {/* PI footprint */}
          <Paper elevation={0} sx={{ bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", px: 1.75, py: 1.5 }}>
            <Typography sx={{ fontSize: ".85rem", fontWeight: 500, mb: 0.25 }}>
              PI footprint{" "}
              <Typography component="span" sx={{ fontSize: ".68rem", color: "text.disabled", fontWeight: 400 }}>
                · factory-days to self-supply (1 top-tier factory)
              </Typography>
            </Typography>
            <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1.25, mt: 1.25, overflowX: "auto" }}>
              {a.footprint.map((f) => (
                <Box key={f.id} sx={{ flex: 1, minWidth: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                  <Typography sx={{ fontSize: ".62rem", color: "#8bbf8e", whiteSpace: "nowrap" }}>
                    {f.days.toFixed(f.days < 10 ? 1 : 0)}d
                  </Typography>
                  <Box sx={{ width: 28, height: Math.max(6, Math.round((f.days / maxDays) * 90)), bgcolor: f.tier ? TIER_COLORS[f.tier] : "#7d8a9c", borderRadius: "4px 4px 0 0" }} />
                  <Image src={ICON(f.id, 32)} alt="" width={28} height={28} unoptimized />
                  <Typography sx={{ fontSize: ".6rem", color: "text.secondary", textAlign: "center", lineHeight: 1.2, maxWidth: 80, height: 22, overflow: "hidden" }}>
                    {f.name}
                  </Typography>
                </Box>
              ))}
              {a.footprint.length === 0 && (
                <Typography sx={{ fontSize: ".74rem", color: "text.disabled", py: 1 }}>No PI in this build.</Typography>
              )}
            </Box>
            <Typography sx={{ fontSize: ".7rem", color: "text.secondary", mt: 1 }}>
              Total ≈ <b style={{ color: "#fff" }}>{a.totalDays.toFixed(0)} factory-days</b> — parallelize across planets to compress
            </Typography>
            {a.piCost > 0 && (
              <Typography sx={{ fontSize: ".72rem", color: "#8bbf8e", mt: 0.75 }}>
                Your PI empire keeps ≈ <b>{iskShort(a.piCost)}</b> of the material bill.
              </Typography>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

function SummaryCard({ title, s, accent }: { title: string; s: GoalSummary; accent: string }) {
  const netColor = s.net >= 0 ? "#66bb6a" : "#f44336";
  const rows: [string, string, string?][] = [
    ["Material cost", iskShort(s.matCost)],
    ["SCC fee (4%)", iskShort(s.scc)],
    ["Total cost", iskShort(s.totalCost)],
    ["Output value", iskShort(s.revenue)],
    ["Net profit", iskShort(s.net), netColor],
    ["Margin", (s.margin * 100).toFixed(1) + "%", netColor],
    ["Per unit", iskShort(s.perUnit) + " / u", netColor],
  ];
  return (
    <Paper elevation={0} sx={{ flex: 1, minWidth: 200, bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", overflow: "hidden" }}>
      <Typography sx={{ fontSize: ".78rem", fontWeight: 600, color: accent, px: 1.5, py: 1, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        {title}
      </Typography>
      <Box sx={{ px: 1.5, py: 1 }}>
        {rows.map(([label, value, color]) => (
          <Box key={label} sx={{ display: "flex", justifyContent: "space-between", py: 0.4 }}>
            <Typography sx={{ fontSize: ".72rem", color: "text.secondary" }}>{label}</Typography>
            <Typography sx={{ fontSize: ".76rem", fontWeight: 500, color: color ?? "text.primary" }}>{value}</Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
