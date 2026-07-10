"use client";

import { useContext, useMemo, useState } from "react";
import Image from "next/image";
import {
  Box,
  Typography,
  MenuItem,
  Select,
  TextField,
  Button,
  Chip,
  CircularProgress,
} from "@mui/material";
import { SessionContext } from "@/app/context/Context";
import { TIER_COLORS } from "@/pi-tiers";
import { CHAIN_TARGETS, fmtIsk } from "@/pi-chain";
import {
  fetchNearbySystems,
  fetchSystemInventory,
  NearbySystem,
  planSystem,
  resolveSystemId,
  SystemInventory,
} from "@/pi-planets";

/**
 * R6 — System Planner. Pick a system (live ESI universe data), see its
 * planet-type inventory + neighbors <=2 jumps, and get an auto-assigned
 * refinery/factory plan for a chosen P2 with a self-sufficiency check.
 */
const P2_TARGETS = CHAIN_TARGETS.filter((t) => t.tier === "P2");

const secColor = (sec: number) =>
  sec >= 0.45 ? "#66bb6a" : sec > 0 ? "#ffa726" : "#f44336";

const controlLabel = {
  fontSize: ".68rem",
  color: "text.secondary",
  textTransform: "uppercase",
  letterSpacing: ".05em",
} as const;

export function SystemPlanner() {
  const { piPrices } = useContext(SessionContext);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<number>(P2_TARGETS[0]?.id ?? 0);
  const [inventory, setInventory] = useState<SystemInventory | undefined>();
  const [nearby, setNearby] = useState<NearbySystem[] | undefined>();
  const [loading, setLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [error, setError] = useState("");

  const lookup = async (name: string) => {
    if (!name.trim() || loading) return;
    setLoading(true);
    setError("");
    setNearby(undefined);
    try {
      const id = await resolveSystemId(name);
      if (!id) {
        setError(`No system named "${name.trim()}" found.`);
        setInventory(undefined);
        return;
      }
      const inv = await fetchSystemInventory(id);
      setInventory(inv);
      setQuery(inv.name);
      setNearbyLoading(true);
      fetchNearbySystems(id)
        .then(setNearby)
        .catch(() => setNearby([]))
        .finally(() => setNearbyLoading(false));
    } catch {
      setError("System lookup failed — ESI may be unavailable.");
      setInventory(undefined);
    } finally {
      setLoading(false);
    }
  };

  const plan = useMemo(
    () =>
      inventory && Object.keys(inventory.planets).length
        ? planSystem(inventory.planets, target, piPrices)
        : null,
    [inventory, target, piPrices],
  );

  return (
    <Box>
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 500 }}>
        System Planner{" "}
        <Typography component="span" sx={{ color: "text.disabled", fontSize: ".85rem" }}>
          · pick a system, plan the whole colony set
        </Typography>
      </Typography>
      <Typography sx={{ fontSize: ".75rem", color: "text.disabled", mb: 1.75 }}>
        Live ESI universe data — planet counts, security and neighbors within 2 jumps.
      </Typography>

      {/* controls */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "flex-end", mb: 2 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography sx={controlLabel}>System</Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              size="small"
              placeholder="e.g. Osmon"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup(query)}
              sx={{ bgcolor: "#242424", minWidth: 180 }}
            />
            <Button
              variant="contained"
              size="small"
              disabled={loading || !query.trim()}
              onClick={() => lookup(query)}
            >
              {loading ? <CircularProgress size={18} /> : "Look up"}
            </Button>
          </Box>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography sx={controlLabel}>Build for</Typography>
          <Select
            size="small"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            sx={{ bgcolor: "#242424", minWidth: 210, fontSize: ".85rem" }}
          >
            {P2_TARGETS.map((t) => (
              <MenuItem key={t.id} value={t.id} sx={{ fontSize: ".85rem" }}>
                {t.name}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      {error && (
        <Typography sx={{ fontSize: ".85rem", color: "error.main", mb: 2 }}>{error}</Typography>
      )}
      {!inventory && !error && (
        <Typography sx={{ fontSize: ".85rem", color: "text.secondary", py: 2 }}>
          Enter a system name to see its planet inventory and a colony plan.
        </Typography>
      )}

      {inventory && (
        <>
          {/* system header */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 2,
              bgcolor: "#1e1e1e",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: "10px",
              px: 2,
              py: 1.75,
              mb: 1.5,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: "1.2rem", fontWeight: 500 }}>
                {inventory.name}{" "}
                <Typography
                  component="span"
                  sx={{ fontSize: ".85rem", fontWeight: 600, color: secColor(inventory.sec) }}
                >
                  {inventory.sec.toFixed(1)}
                </Typography>
              </Typography>
              <Typography sx={{ fontSize: ".74rem", color: "text.secondary" }}>
                {inventory.region} · {inventory.planetTotal} planets
              </Typography>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {(Object.entries(inventory.planets) as [string, number][]).map(([t, n]) => (
                <Chip
                  key={t}
                  size="small"
                  avatar={
                    <Image src={`/${t}.png`} alt="" width={18} height={18} style={{ borderRadius: 9 }} />
                  }
                  label={`${t[0].toUpperCase()}${t.slice(1)} × ${n}`}
                  sx={{ bgcolor: "#242424", border: "1px solid rgba(255,255,255,.12)", fontSize: ".72rem" }}
                />
              ))}
            </Box>
          </Box>

          {/* nearby */}
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mb: 2 }}>
            <Typography sx={{ ...controlLabel, mr: 0.5 }}>Nearby</Typography>
            {nearbyLoading && <CircularProgress size={14} />}
            {nearby?.length === 0 && !nearbyLoading && (
              <Typography sx={{ fontSize: ".74rem", color: "text.disabled" }}>
                no stargate connections (wormhole space)
              </Typography>
            )}
            {nearby?.map((n) => (
              <Chip
                key={n.name}
                size="small"
                label={`${n.name} · ${n.jumps}j`}
                onClick={() => lookup(n.name)}
                sx={{
                  bgcolor: "#242424",
                  border: "1px solid rgba(255,255,255,.12)",
                  fontSize: ".7rem",
                  opacity: n.jumps === 1 ? 1 : 0.7,
                }}
              />
            ))}
          </Box>

          {plan && (
            <>
              {/* self-sufficiency banner */}
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 1.5,
                  bgcolor: plan.selfSource ? "rgba(102,187,106,.08)" : "rgba(255,167,38,.08)",
                  border: `1px solid ${plan.selfSource ? "rgba(102,187,106,.3)" : "rgba(255,167,38,.3)"}`,
                  borderRadius: "8px",
                  px: 2,
                  py: 1.25,
                  mb: 1.5,
                }}
              >
                <Typography
                  sx={{
                    fontSize: ".85rem",
                    fontWeight: 600,
                    color: plan.selfSource ? "success.main" : "warning.main",
                  }}
                >
                  {plan.selfSource
                    ? `✓ Self-sufficient for ${plan.targetName}`
                    : `▲ Not fully self-sufficient for ${plan.targetName}`}
                </Typography>
                <Typography sx={{ fontSize: ".76rem", color: "text.secondary" }}>
                  {plan.selfSource
                    ? "Every required P1 can be refined from a planet in this system."
                    : `Haul in: ${plan.missing.join(", ")}`}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: ".8rem", color: "text.secondary" }}>
                  {plan.extractorPlanets} refinery · {plan.factoryPlanets} factory planets ·{" "}
                  <Typography component="span" sx={{ color: "success.main", fontWeight: 600, fontSize: ".8rem" }}>
                    ~{plan.estPerHour.toFixed(0)} u/h · {fmtIsk(plan.estIskPerHour * 1_000_000)} ISK/h
                  </Typography>
                </Typography>
              </Box>

              {/* required inputs */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
                {plan.req.map((r) => (
                  <Box
                    key={r.p1}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.75,
                      bgcolor: "#242424",
                      borderLeft: `3px solid ${TIER_COLORS.P1}`,
                      borderRadius: "5px",
                      px: 1.25,
                      py: 0.6,
                    }}
                  >
                    <Typography sx={{ fontSize: ".78rem" }}>{r.p1Name}</Typography>
                    <Typography sx={{ fontSize: ".68rem", color: "text.disabled" }}>
                      ← {r.p0Name}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* role cards */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25 }}>
                {plan.planets.map((p) => (
                  <Box
                    key={p.type}
                    sx={{
                      flex: 1,
                      minWidth: 220,
                      maxWidth: 320,
                      bgcolor: "#1e1e1e",
                      border: "1px solid rgba(255,255,255,.08)",
                      borderLeft: `3px solid ${p.kind === "refinery" ? TIER_COLORS.P0 : TIER_COLORS.P2}`,
                      borderRadius: "8px",
                      px: 1.75,
                      py: 1.5,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                      <Image src={`/${p.type}.png`} alt="" width={26} height={26} style={{ borderRadius: 6 }} />
                      <Typography sx={{ fontSize: ".88rem", fontWeight: 500 }}>
                        {p.type[0].toUpperCase() + p.type.slice(1)} × {p.count}
                      </Typography>
                      <Box sx={{ flex: 1 }} />
                      <Typography
                        sx={{
                          fontSize: ".64rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: ".05em",
                          color: p.kind === "refinery" ? TIER_COLORS.P0 : TIER_COLORS.P2,
                        }}
                      >
                        {p.kind}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: ".8rem", color: "text.primary", mb: 0.5 }}>
                      {p.role}
                    </Typography>
                    <Typography sx={{ fontSize: ".68rem", color: "text.disabled" }}>
                      yields {p.yields.join(", ")}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </>
      )}
    </Box>
  );
}
