"use client";

import { useContext, useMemo, useState, ReactNode } from "react";
import Image from "next/image";
import { Box, Paper, Typography, Select, MenuItem, TextField, Button, Chip } from "@mui/material";
import { SessionContext, CharacterContext } from "@/app/context/Context";
import { EVE_IMAGE_URL } from "@/const";
import { TIER_COLORS, nameOf } from "@/pi-tiers";
import { GOALS, goalBuild, iskShort } from "@/pi-goal-build";
import { planetCombination, PLANET_COLORS } from "@/pi-investigate";

/**
 * Guided "Build plan" — the post-login journey. Start at the item, end at a
 * planet-by-planet, character-paired plan:
 *   1. what to build   2. per-month target   3. PI needed (plan 2x)
 *   4. planets needed   5. across your characters, 2 logged in at a time
 *   6. complementary pairs so you only import ~3 things.
 * Numbers are auto-derived from the chain engine + your live colonies.
 */
const ICON = (id: number, size = 32) => `${EVE_IMAGE_URL}/types/${id}/icon?size=${size}`;
const DAYS_PER_MONTH = 30;
const PLANETS_PER_CHAR = 6; // EVE max with skills
const BUFFER = 2; // "always plan for double"

function StepCard({ n, title, sub, children }: { n: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <Paper elevation={0} sx={{ bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "12px", p: 2.25 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
        <Box sx={{ width: 26, height: 26, borderRadius: "50%", bgcolor: "rgba(144,202,249,.16)", color: "primary.main", fontWeight: 700, fontSize: ".8rem", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          {n}
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: ".95rem" }}>{title}</Typography>
        {sub && <Typography sx={{ fontSize: ".76rem", color: "text.disabled" }}>{sub}</Typography>}
      </Box>
      {children}
    </Paper>
  );
}

export function BuildPlan({ onOpenAnalyzer, onTrace }: { onOpenAnalyzer: (id: number) => void; onTrace: (id: number) => void }) {
  const { piPrices } = useContext(SessionContext);
  const { characters } = useContext(CharacterContext);
  const [goalId, setGoalId] = useState<number>(GOALS[0].id);
  const goal = GOALS.find((g) => g.id === goalId) ?? GOALS[0];
  const [monthly, setMonthly] = useState<number>(goal.runsDefault * goal.outPerRun);

  const runs = Math.max(1, Math.round(monthly / goal.outPerRun));
  const a = useMemo(() => goalBuild(goalId, runs, piPrices), [goalId, runs, piPrices]);

  // PI lines with planets-needed (parallel factories to finish the month, x2 buffer).
  const piLines = a.footprint.map((f) => {
    const row = a.rows.find((r) => r.id === f.id);
    return {
      ...f,
      need: row?.qtyTotal ?? 0,
      planets: Math.max(1, Math.ceil((f.days * BUFFER) / DAYS_PER_MONTH)),
    };
  });
  const totalPlanets = piLines.reduce((s, l) => s + l.planets, 0);

  // Allocate across characters, flown two at a time.
  const charCount = characters.length;
  const planetTotal = characters.reduce((s, c) => s + c.planets.length, 0);
  const charsNeeded = Math.ceil(totalPlanets / PLANETS_PER_CHAR);
  const sessions = Math.ceil(charsNeeded / 2);

  // Complementary pairing for the heaviest PI product (hub & spoke).
  const primary = piLines[0];
  const combo = useMemo(
    () => (primary ? planetCombination(primary.id, piPrices) : null),
    [primary, piPrices],
  );

  return (
    <Box sx={{ maxWidth: 1080, mx: "auto", display: "flex", flexDirection: "column", gap: 1.75 }}>
      <Box sx={{ textAlign: "center", pt: 1, pb: 0.5 }}>
        <Typography sx={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-.01em" }}>
          What do you want to build?
        </Typography>
        <Typography sx={{ fontSize: ".85rem", color: "text.secondary", mt: 0.5 }}>
          Pick the item — the whole PI plan derives backward from it.
        </Typography>
      </Box>

      {/* 1 + 2 */}
      <StepCard n="1" title="The item & your monthly target" sub="demand comes from what gets destroyed">
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "flex-end" }}>
          <Box>
            <Typography sx={{ fontSize: ".66rem", textTransform: "uppercase", letterSpacing: ".05em", color: "text.secondary", mb: 0.5 }}>
              I want to build
            </Typography>
            <Select
              size="small"
              value={goalId}
              onChange={(e) => {
                const id = Number(e.target.value);
                setGoalId(id);
                const g = GOALS.find((x) => x.id === id);
                if (g) setMonthly(g.runsDefault * g.outPerRun);
              }}
              sx={{ minWidth: 240, bgcolor: "#242424", fontSize: ".9rem" }}
            >
              {GOALS.map((g) => (
                <MenuItem key={g.id} value={g.id} sx={{ fontSize: ".9rem" }}>{g.name}</MenuItem>
              ))}
            </Select>
          </Box>
          <Box>
            <Typography sx={{ fontSize: ".66rem", textTransform: "uppercase", letterSpacing: ".05em", color: "text.secondary", mb: 0.5 }}>
              Units per month
            </Typography>
            <TextField
              size="small"
              type="number"
              value={monthly}
              onChange={(e) => setMonthly(Math.max(1, parseInt(e.target.value) || 1))}
              sx={{ width: 130, bgcolor: "#242424", "& input": { fontSize: ".9rem" } }}
            />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, bgcolor: "#191919", border: "1px solid rgba(255,255,255,.08)", borderRadius: "8px", px: 1.5, py: 1 }}>
            <Image src={ICON(goal.id, 40)} alt="" width={36} height={36} unoptimized />
            <Box>
              <Typography sx={{ fontSize: ".9rem", fontWeight: 500 }}>{goal.name}</Typography>
              <Typography sx={{ fontSize: ".68rem", color: "text.disabled" }}>
                {monthly.toLocaleString()} / month · sells ≈ {iskShort(a.revenue)}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant="outlined" onClick={() => onOpenAnalyzer(goal.id)} sx={{ textTransform: "none" }}>
            Full economics →
          </Button>
        </Box>
      </StepCard>

      {/* 3 */}
      <StepCard n="2" title="The PI those units need — plan for 2×" sub="so factories never starve">
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {piLines.map((l) => (
            <Box key={l.id} sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 0.5, borderLeft: `3px solid ${l.tier ? TIER_COLORS[l.tier] : "#7d8a9c"}`, pl: 1.25 }}>
              <Image src={ICON(l.id, 28)} alt="" width={26} height={26} unoptimized />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: ".85rem" }}>{l.name}</Typography>
                <Typography sx={{ fontSize: ".64rem", color: "text.disabled" }}>{l.tier}</Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography sx={{ fontSize: ".8rem" }}>{Math.round(l.need).toLocaleString()} / mo</Typography>
                <Typography sx={{ fontSize: ".72rem", color: "#f5cf74" }}>
                  build {Math.round(l.need * BUFFER).toLocaleString()} (2×)
                </Typography>
              </Box>
            </Box>
          ))}
          {piLines.length === 0 && (
            <Typography sx={{ fontSize: ".8rem", color: "text.disabled" }}>No PI in this build.</Typography>
          )}
        </Box>
      </StepCard>

      {/* 4 */}
      <StepCard n="3" title="Planets to produce it" sub={`${BUFFER}× buffer · one factory finishes in ~${DAYS_PER_MONTH} days`}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {piLines.map((l) => (
            <Paper key={l.id} elevation={0} sx={{ bgcolor: "#242424", borderRadius: "8px", px: 1.5, py: 1, minWidth: 120, borderTop: `2px solid ${l.tier ? TIER_COLORS[l.tier] : "#7d8a9c"}` }}>
              <Typography sx={{ fontSize: ".74rem", color: "text.secondary" }}>{l.name}</Typography>
              <Typography sx={{ fontSize: "1.15rem", fontWeight: 600 }}>{l.planets} <Typography component="span" sx={{ fontSize: ".7rem", color: "text.disabled" }}>planets</Typography></Typography>
            </Paper>
          ))}
        </Box>
        <Typography sx={{ fontSize: ".9rem", mt: 1.5 }}>
          Total ≈ <b style={{ color: "#90caf9" }}>{totalPlanets} planets</b> dedicated to this build (already at 2× buffer).
        </Typography>
      </StepCard>

      {/* 5 */}
      <StepCard n="4" title="Across your characters — two logged in at a time" sub={charCount ? `you have ${charCount} characters · ${planetTotal} planets` : "log in to map to your characters"}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
          <Metric label="Planets for the build" value={String(totalPlanets)} />
          <Arrow />
          <Metric label={`÷ ${PLANETS_PER_CHAR} per character`} value={String(charsNeeded)} sub="characters" />
          <Arrow />
          <Metric label="÷ 2 flown together" value={String(sessions)} sub={sessions === 1 ? "session" : "sessions"} accent="#66bb6a" />
        </Box>
        <Typography sx={{ fontSize: ".8rem", color: "text.secondary", mt: 1.5 }}>
          You dual-box, so plan in pairs: {charsNeeded} character{charsNeeded === 1 ? "" : "s"} covering {totalPlanets} planets, flown{" "}
          two at a time = <b style={{ color: "#66bb6a" }}>{sessions} play session{sessions === 1 ? "" : "s"}</b> to service the whole build.
          {charCount > 0 && ` Your estate: ${planetTotal} planets ÷ 2 = ${Math.round(planetTotal / 2)} per dual-box pass.`}
        </Typography>
      </StepCard>

      {/* 6 */}
      <StepCard n="5" title="Complementary pairs — import only ~3 things" sub={primary ? `for ${primary.name}` : undefined}>
        {combo ? (
          <>
            <Typography sx={{ fontSize: ".82rem", color: "text.secondary", mb: 1.5 }}>
              Pair each extractor planet with the factory hub so its P0 flows straight in. You carry the
              output between the paired planets — no market run — so the only things you ever haul in are the
              P1 counterparts.
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "stretch" }}>
              {/* hub */}
              <Paper elevation={0} sx={{ bgcolor: "#191919", border: `1px solid ${PLANET_COLORS[combo.hub.type]}`, borderRadius: "10px", px: 1.75, py: 1.25, minWidth: 180 }}>
                <Typography sx={{ fontSize: ".66rem", textTransform: "uppercase", letterSpacing: ".05em", color: PLANET_COLORS[combo.hub.type] }}>
                  Factory hub
                </Typography>
                <Typography sx={{ fontSize: ".9rem", fontWeight: 600, textTransform: "capitalize" }}>{combo.hub.type} planet</Typography>
                <Typography sx={{ fontSize: ".7rem", color: "text.disabled" }}>
                  makes {primary?.name} · also extracts {combo.hub.extracts.length} of its P0s
                </Typography>
              </Paper>
              <Box sx={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,.3)", fontSize: "1.4rem" }}>←</Box>
              {/* spokes */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {combo.spokes.map((s, i) => (
                  <Paper key={`${s.type}-${s.p0}-${i}`} elevation={0} sx={{ bgcolor: "#242424", border: `1px solid ${PLANET_COLORS[s.type]}55`, borderLeft: `3px solid ${PLANET_COLORS[s.type]}`, borderRadius: "8px", px: 1.25, py: 0.9, minWidth: 150 }}>
                    <Typography sx={{ fontSize: ".78rem", textTransform: "capitalize" }}>{s.type} planet</Typography>
                    <Typography sx={{ fontSize: ".68rem", color: "text.secondary" }}>extracts {nameOf(s.p0)}</Typography>
                  </Paper>
                ))}
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mt: 1.75, flexWrap: "wrap" }}>
              <Chip label={`${combo.covered}/${combo.required} P0s covered on-site`} size="small" sx={{ bgcolor: "rgba(102,187,106,.16)", color: "#8bbf8e" }} />
              <Typography sx={{ fontSize: ".78rem", color: "text.secondary" }}>
                Only import the P1 counterparts — about {Math.min(3, combo.required)} things per planet.
              </Typography>
              {primary && (
                <Button size="small" variant="outlined" onClick={() => onTrace(primary.id)} sx={{ textTransform: "none", ml: "auto" }}>
                  Trace {primary.name} chain →
                </Button>
              )}
            </Box>
          </>
        ) : (
          <Typography sx={{ fontSize: ".8rem", color: "text.disabled" }}>Pick a build with PI components to see the pairing.</Typography>
        )}
      </StepCard>
    </Box>
  );
}

const Arrow = () => (
  <Typography sx={{ color: "rgba(255,255,255,.3)", fontSize: "1.3rem", fontWeight: 700 }}>→</Typography>
);

const Metric = ({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) => (
  <Box>
    <Typography sx={{ fontSize: ".66rem", textTransform: "uppercase", letterSpacing: ".05em", color: "text.secondary" }}>{label}</Typography>
    <Typography sx={{ fontSize: "1.5rem", fontWeight: 600, color: accent ?? "text.primary", lineHeight: 1.1 }}>
      {value} {sub && <Typography component="span" sx={{ fontSize: ".72rem", color: "text.disabled", fontWeight: 400 }}>{sub}</Typography>}
    </Typography>
  </Box>
);
