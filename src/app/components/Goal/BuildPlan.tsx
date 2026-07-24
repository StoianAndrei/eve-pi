"use client";

import { useContext, useMemo, useState, ReactNode } from "react";
import Image from "next/image";
import { Box, Paper, Typography, Select, MenuItem, TextField, Button, Chip } from "@mui/material";
import { SessionContext, CharacterContext } from "@/app/context/Context";
import { EVE_IMAGE_URL } from "@/const";
import { TIER_COLORS, nameOf } from "@/pi-tiers";
import { GOALS, goalBuild, iskShort } from "@/pi-goal-build";
import { planetCombination, PLANET_COLORS } from "@/pi-investigate";
import { goalAnalysis, ColonyRef } from "@/pi-goal";
import { componentTree, ComponentTree, P1_PER_PLANET } from "@/pi-plan";
import { PlanetType } from "@/pi-planets";
import { buildChain } from "@/pi-chain";
import { ProductionMatrix } from "./ProductionMatrix";
import { PlanetBadge } from "../common/PlanetBadge";

/**
 * Guided "Build plan" — the post-login journey. Start at the item, end at a
 * planet-by-planet, character-paired plan:
 *   1. what to build   2. per-month target   3. PI needed (plan 2x)
 *   4. planets needed   5. across your characters, 2 logged in at a time
 *   6. complementary pairs so you only import ~3 things.
 * Numbers are auto-derived from the chain engine + your live colonies.
 */
// images.evetech.net only serves these icon sizes; anything else 400s. Snap up
// to the nearest valid size and let width/height control the on-screen px.
const EVE_ICON_SIZES = [32, 64, 128, 256, 512];
const ICON = (id: number, size = 32) => {
  const s = EVE_ICON_SIZES.find((v) => v >= size) ?? 512;
  return `${EVE_IMAGE_URL}/types/${id}/icon?size=${s}`;
};
const PLANETS_PER_CHAR = 6; // EVE max with skills
const BUFFER = 2; // "always plan for double"
const BOX_W = 128; // P0 and P1 boxes share one width

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

  // PI components this build consumes + units/month (×2 to build).
  const piNeed = a.rows
    .filter((r) => r.isPi)
    .map((r) => ({ id: r.id, name: r.name, tier: r.tier, need: r.qtyTotal }));

  // Planet sizing from the chain: each component → its P1 lines, one planet per
  // ~160 u/h of a P1 (Adam4EVE-style, un-united). ×2 for redundancy.
  const compPlans = useMemo(
    () =>
      a.rows
        .filter((r) => r.isPi)
        .map((r) => componentTree(r.id, piPrices))
        .filter((c): c is ComponentTree => c !== null),
    [a, piPrices],
  );
  const baseTotal = compPlans.reduce((s, c) => s + c.planets, 0);
  const totalPlanets = baseTotal * BUFFER;

  // Allocate across characters, flown two at a time.
  const charCount = characters.length;
  const planetTotal = characters.reduce((s, c) => s + c.planets.length, 0);
  const charsNeeded = Math.ceil(totalPlanets / PLANETS_PER_CHAR);
  const sessions = Math.ceil(charsNeeded / 2);

  // Complementary pairing for the heaviest PI product (hub & spoke).
  const primary = compPlans[0];

  // Production board: highlight every planet that feeds the active target.
  // Clicking a factory cell re-targets; goal change resets to the primary.
  const [boardTarget, setBoardTarget] = useState(0);
  const bt = boardTarget || primary?.id || 0;
  const requiredIds = useMemo(() => {
    const s = new Set<number>();
    if (!bt) return s;
    buildChain(bt, piPrices)?.nodes.forEach((n) => s.add(n.id));
    return s;
  }, [bt, piPrices]);
  const combo = useMemo(
    () => (primary ? planetCombination(primary.id, piPrices) : null),
    [primary, piPrices],
  );

  // Reconcile against live colonies: what you already make vs the gap, and the
  // per-planet keep / repurpose / rebuild verdict for a chosen component.
  const colonies: ColonyRef[] = useMemo(
    () => characters.flatMap((c) => c.planets.map((planet) => ({ character: c, planet }))),
    [characters],
  );
  const [reconcileTarget, setReconcileTarget] = useState<number>(0);
  const recTarget = compPlans.some((c) => c.id === reconcileTarget)
    ? reconcileTarget
    : primary?.id ?? 0;
  const recPlants = compPlans.find((c) => c.id === recTarget)?.planets ?? 1;
  const analysis = useMemo(
    () => (recTarget ? goalAnalysis(colonies, recTarget, recPlants, piPrices) : null),
    [colonies, recTarget, recPlants, piPrices],
  );
  const VERDICT = {
    keep: { label: "KEEP", color: "#66bb6a", bg: "rgba(102,187,106,.14)" },
    repurpose: { label: "REPURPOSE", color: "#ffa726", bg: "rgba(255,167,38,.14)" },
    rebuild: { label: "REBUILD", color: "#f44336", bg: "rgba(244,67,54,.16)" },
  } as const;

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
                setBoardTarget(0);
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

      {/* Production board — the decision panel */}
      {charCount > 0 && (
        <Paper elevation={0} sx={{ bgcolor: "#1e1e1e", border: "1px solid rgba(144,202,249,.25)", borderRadius: "12px", p: 2.25 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
            <Typography sx={{ fontWeight: 600, fontSize: "1rem" }}>Production board</Typography>
            <Typography sx={{ fontSize: ".76rem", color: "text.disabled" }}>
              characters × planets · green feeds <b style={{ color: "#8bbf8e" }}>{nameOf(bt)}</b>, red is off-plan
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, fontSize: ".68rem" }}>
              <Legend color="#7cb6f2" label="extract" />
              <Legend color="#8a8f98" label="import" />
              <Legend color="#66bb6a" label="on-plan" />
              <Legend color="#f44336" label="repurpose" />
            </Box>
          </Box>
          <ProductionMatrix characters={characters} requiredIds={requiredIds} onSelect={setBoardTarget} />
          <Typography sx={{ fontSize: ".7rem", color: "text.disabled", mt: 1 }}>
            Left half of each planet = what it extracts (blue) &amp; imports (grey); right half = what it
            exports. Click a factory planet to re-light the board around it.
          </Typography>
        </Paper>
      )}

      {/* 3 */}
      <StepCard n="2" title="The PI those units need — plan for 2×" sub="so factories never starve">
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {piNeed.map((l) => (
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
          {piNeed.length === 0 && (
            <Typography sx={{ fontSize: ".8rem", color: "text.disabled" }}>No PI in this build.</Typography>
          )}
        </Box>
      </StepCard>

      {/* 3 — the chain grouped as it's used: each P2 contains its 2 planets */}
      <StepCard n="3" title="Planets to produce it" sub={`~${P1_PER_PLANET} u/h = 1 planet · each P2 is made by 2 planets — one refined on-site, one imported`}>
        {compPlans.map((c) => (
          <Box key={c.id} sx={{ mb: 1.75 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Image src={ICON(c.id, 24)} alt="" width={22} height={22} unoptimized />
              <Typography sx={{ fontSize: ".85rem", fontWeight: 600 }}>{c.name}</Typography>
              <Typography sx={{ fontSize: ".7rem", color: "text.disabled" }}>{c.tier}</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: ".82rem", color: "#90caf9", fontWeight: 600 }}>{c.planets} planets</Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 1 }}>
              {c.p2.map((g) => (
                <Box key={g.id} sx={{ bgcolor: "#191919", border: `1px solid ${TIER_COLORS.P2}55`, borderRadius: "10px", p: 1 }}>
                  {/* P2 header */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75, px: 0.5 }}>
                    <Image src={ICON(g.id, 24)} alt="" width={20} height={20} unoptimized />
                    <Typography sx={{ fontSize: ".8rem", fontWeight: 600, color: TIER_COLORS.P2 }}>{g.name}</Typography>
                    <Box sx={{ flex: 1 }} />
                    <Typography sx={{ fontSize: ".66rem", color: "text.disabled" }}>{g.planets} planets</Typography>
                  </Box>
                  {/* the 2 planets that feed it — each on one row */}
                  {g.inputs.map((p1) => (
                    <Box key={p1.id} sx={{ display: "flex", alignItems: "center", gap: 0.75, py: 0.4 }}>
                      {p1.p0 ? <PBox id={p1.p0.id} name={p1.p0.name} tier="P0" types={p1.p0.types} /> : <Box sx={{ width: BOX_W }} />}
                      <Typography sx={{ color: "rgba(255,255,255,.3)", fontSize: ".9rem" }}>→</Typography>
                      <PBox id={p1.id} name={p1.name} tier="P1" />
                      <Box sx={{ flex: 1 }} />
                      <Box sx={{ fontSize: ".58rem", fontWeight: 700, color: p1.role === "produce" ? "#66bb6a" : "#7cb6f2", bgcolor: p1.role === "produce" ? "rgba(102,187,106,.14)" : "rgba(124,182,242,.14)", borderRadius: "4px", px: 0.6, py: 0.2, flex: "none" }}>
                        {p1.role === "produce" ? "MAKE" : "IMPORT"}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        ))}
        <Box sx={{ borderTop: "1px solid rgba(255,255,255,.08)", pt: 1.25, mt: 0.5 }}>
          <Typography sx={{ fontSize: ".95rem" }}>
            <b style={{ color: "#90caf9" }}>{baseTotal} planets</b> for one line ·{" "}
            <b style={{ color: "#f5cf74" }}>{totalPlanets} at {BUFFER}×</b> (plan double)
            {charCount > 0 && ` — your ${planetTotal} planets = ${Math.round(planetTotal / PLANETS_PER_CHAR)} characters × ${PLANETS_PER_CHAR}`}
            .
          </Typography>
          <Typography sx={{ fontSize: ".7rem", color: "text.disabled", mt: 0.5 }}>
            Each row is one planet: extract the P0 → refine the P1. The two rows in a box are the
            complementary pair for that P2 — colored squares show which planet types yield the P0.
          </Typography>
        </Box>
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

      {/* 6 — reconcile with what you already produce */}
      {charCount > 0 && (
        <StepCard n="6" title="Reconcile with your colonies — keep, stop, repurpose" sub="you make some of it already; close the rest">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", mb: 1.5 }}>
            <Typography sx={{ fontSize: ".72rem", color: "text.secondary" }}>Reconcile for</Typography>
            <Select
              size="small"
              value={recTarget}
              onChange={(e) => setReconcileTarget(Number(e.target.value))}
              sx={{ minWidth: 200, bgcolor: "#242424", fontSize: ".82rem" }}
            >
              {compPlans.map((c) => (
                <MenuItem key={c.id} value={c.id} sx={{ fontSize: ".82rem" }}>{c.name}</MenuItem>
              ))}
            </Select>
            {analysis && (
              <>
                <Chip size="small" label={`${analysis.keepCount} keep`} sx={{ bgcolor: "rgba(102,187,106,.16)", color: "#8bbf8e" }} />
                <Chip size="small" label={`${analysis.changeCount} to change`} sx={{ bgcolor: "rgba(255,167,38,.16)", color: "#ffa726" }} />
              </>
            )}
          </Box>

          {analysis ? (
            <>
              {/* what you make vs need */}
              <Box sx={{ overflowX: "auto", mb: 1.5 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1.6fr .8fr .8fr .8fr", gap: 1, px: 0.5, py: 0.5, minWidth: 420, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                  {["Component", "Want", "Have", "Gap"].map((h, i) => (
                    <Typography key={h} sx={{ fontSize: ".62rem", textTransform: "uppercase", letterSpacing: ".04em", color: "text.secondary", textAlign: i === 0 ? "left" : "right" }}>{h}</Typography>
                  ))}
                </Box>
                {analysis.stages.map((s) => (
                  <Box key={s.id} sx={{ display: "grid", gridTemplateColumns: "1.6fr .8fr .8fr .8fr", gap: 1, px: 0.5, py: 0.6, minWidth: 420, alignItems: "center", borderLeft: `3px solid ${s.tier ? TIER_COLORS[s.tier] : "#7d8a9c"}`, bgcolor: s.need > 0 ? "rgba(255,167,38,.06)" : "transparent" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                      <Image src={ICON(s.id, 24)} alt="" width={22} height={22} unoptimized />
                      <Typography sx={{ fontSize: ".8rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: ".78rem", textAlign: "right", color: "text.secondary" }}>{s.want}</Typography>
                    <Typography sx={{ fontSize: ".78rem", textAlign: "right" }}>{s.have}</Typography>
                    <Typography sx={{ fontSize: ".8rem", textAlign: "right", fontWeight: 600, color: s.need > 0 ? "#ffa726" : "#66bb6a" }}>
                      {s.need > 0 ? `−${s.need}` : "✓"}
                    </Typography>
                  </Box>
                ))}
                <Typography sx={{ fontSize: ".64rem", color: "text.disabled", mt: 0.5 }}>
                  Want = factories to make {nameOf(recTarget)} at {recPlants} planet{recPlants === 1 ? "" : "s"}. Have = factories your colonies already run for it.
                </Typography>
              </Box>

              {/* per-planet verdicts */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {analysis.verdicts.map((v, i) => {
                  const vd = VERDICT[v.verdict];
                  return (
                    <Box key={`${v.characterName}-${v.planetName}-${i}`} sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.25, py: 0.9, bgcolor: "#191919", borderRadius: "8px", borderLeft: `3px solid ${vd.color}`, flexWrap: "wrap" }}>
                      <Box sx={{ fontSize: ".62rem", fontWeight: 700, color: vd.color, bgcolor: vd.bg, borderRadius: "5px", px: 0.9, py: 0.3, flex: "none" }}>{vd.label}</Box>
                      <Typography sx={{ fontSize: ".8rem", minWidth: 200, flex: "none" }}>
                        {v.planetName}
                        <Typography component="span" sx={{ fontSize: ".68rem", color: "text.disabled" }}> · {v.characterName} · {v.planetType}</Typography>
                      </Typography>
                      <Typography sx={{ fontSize: ".72rem", color: "text.secondary", flex: 1, minWidth: 200 }}>
                        {v.suggestion ?? (v.makes.length ? `Making ${v.makes.join(", ")} — on plan.` : v.extracts.length ? `Extracting ${v.extracts.join(", ")} — on plan.` : "On plan.")}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </>
          ) : (
            <Typography sx={{ fontSize: ".8rem", color: "text.disabled" }}>
              This component has no live chain to reconcile.
            </Typography>
          )}
        </StepCard>
      )}
    </Box>
  );
}

const Arrow = () => (
  <Typography sx={{ color: "rgba(255,255,255,.3)", fontSize: "1.3rem", fontWeight: 700 }}>→</Typography>
);

const Legend = ({ color, label }: { color: string; label: string }) => (
  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
    <Box sx={{ width: 9, height: 9, borderRadius: "2px", bgcolor: color }} />
    <Typography sx={{ fontSize: ".66rem", color: "text.secondary" }}>{label}</Typography>
  </Box>
);

/** Equal-size P0 / P1 chip used in the chain tree. */
const PBox = ({ id, name, tier, types }: { id: number; name: string; tier: "P0" | "P1"; types?: PlanetType[] }) => (
  <Box sx={{ width: BOX_W, flex: "none", display: "flex", alignItems: "center", gap: 0.6, bgcolor: "#242424", border: `1px solid ${TIER_COLORS[tier]}55`, borderLeft: `3px solid ${TIER_COLORS[tier]}`, borderRadius: "6px", px: 0.75, py: 0.5 }}>
    <Image src={ICON(id, 24)} alt="" width={18} height={18} unoptimized />
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography sx={{ fontSize: ".68rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</Typography>
      {types && types.length > 0 && (
        <Box sx={{ display: "flex", gap: 0.3, mt: 0.2 }}>
          {types.slice(0, 6).map((t) => (
            <PlanetBadge key={t} type={t} size={13} />
          ))}
        </Box>
      )}
    </Box>
  </Box>
);

const Metric = ({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) => (
  <Box>
    <Typography sx={{ fontSize: ".66rem", textTransform: "uppercase", letterSpacing: ".05em", color: "text.secondary" }}>{label}</Typography>
    <Typography sx={{ fontSize: "1.5rem", fontWeight: 600, color: accent ?? "text.primary", lineHeight: 1.1 }}>
      {value} {sub && <Typography component="span" sx={{ fontSize: ".72rem", color: "text.disabled", fontWeight: 400 }}>{sub}</Typography>}
    </Typography>
  </Box>
);
