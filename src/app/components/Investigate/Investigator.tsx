"use client";

import {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { Box, Typography, Switch, Chip } from "@mui/material";
import { SessionContext } from "@/app/context/Context";
import { EVE_IMAGE_URL } from "@/const";
import { TIER_COLORS, nameOf, tierOf } from "@/pi-tiers";
import { fmtIsk, buildChain } from "@/pi-chain";
import { PlanetType } from "@/pi-planets";
import {
  COLUMNS,
  investigate,
  planetCombination,
  PLANET_TYPES,
} from "@/pi-investigate";

/**
 * R9 — the Investigator: the whole production graph in six columns
 * (Planets → P0 → P1 → P2 → P3 → P4). Click any product to light up its full
 * ancestry — inputs, the P0 leaves, and the planet types that source them —
 * with connection lines drawn between them (EVE OS-style rotated divs
 * measured from the live DOM). Below: the hub-and-spoke planet combination
 * (R8) with throughput-scaled facility counts.
 */
const ICON = (typeId: number, size = 32) =>
  `${EVE_IMAGE_URL}/types/${typeId}/icon?size=${size}`;

interface Line {
  left: number;
  top: number;
  width: number;
  angle: number;
}

export function Investigator() {
  const { piPrices } = useContext(SessionContext);
  const [target, setTarget] = useState<number>(2872); // Self-Harmonizing Power Core
  const [drawLines, setDrawLines] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());

  const inv = useMemo(() => investigate(target), [target]);
  const combo = useMemo(
    () => planetCombination(target, piPrices),
    [target, piPrices],
  );
  const chain = useMemo(() => buildChain(target, piPrices), [target, piPrices]);

  const setNodeRef = (key: string) => (el: HTMLDivElement | null) => {
    if (el) nodeRefs.current.set(key, el);
    else nodeRefs.current.delete(key);
  };

  const computeLines = useCallback(() => {
    const container = containerRef.current;
    if (!container || !drawLines) {
      setLines([]);
      return;
    }
    const cRect = container.getBoundingClientRect();
    const next: Line[] = [];
    inv.edges.forEach((e) => {
      const a = nodeRefs.current.get(e.from);
      const b = nodeRefs.current.get(e.to);
      if (!a || !b) return;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.right - cRect.left + container.scrollLeft;
      const y1 = ra.top + ra.height / 2 - cRect.top + container.scrollTop;
      const x2 = rb.left - cRect.left + container.scrollLeft;
      const y2 = rb.top + rb.height / 2 - cRect.top + container.scrollTop;
      const width = Math.hypot(x2 - x1, y2 - y1);
      const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      next.push({ left: x1, top: y1, width, angle });
    });
    setLines(next);
  }, [inv, drawLines]);

  useLayoutEffect(() => {
    computeLines();
    window.addEventListener("resize", computeLines);
    return () => window.removeEventListener("resize", computeLines);
  }, [computeLines]);

  const nodeState = (id: number): "selected" | "highlighted" | "dimmed" =>
    id === target ? "selected" : inv.ids.has(id) ? "highlighted" : "dimmed";

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5, mb: 0.5 }}>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 500 }}>
          Investigator{" "}
          <Typography component="span" sx={{ color: "text.disabled", fontSize: ".85rem" }}>
            · click any product to trace it back to planets
          </Typography>
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Switch size="small" checked={drawLines} onChange={(e) => setDrawLines(e.target.checked)} />
          <Typography sx={{ fontSize: ".78rem", color: "text.secondary" }}>Draw connections</Typography>
        </Box>
      </Box>
      <Typography sx={{ fontSize: ".75rem", color: "text.disabled", mb: 1.5 }}>
        Selected:{" "}
        <b style={{ color: TIER_COLORS[tierOf(target) ?? "P2"] }}>
          {nameOf(target)}
        </b>
        {chain && ` · net ${fmtIsk(chain.net)} ISK/h per top-tier factory`}
      </Typography>

      {/* materials grid */}
      <Box
        ref={containerRef}
        onScroll={computeLines}
        sx={{
          position: "relative",
          display: "flex",
          gap: 2,
          overflowX: "auto",
          bgcolor: "#161616",
          border: "1px solid rgba(255,255,255,.07)",
          borderRadius: "10px",
          p: 1.5,
          mb: 2.5,
        }}
      >
        {/* connection lines */}
        {lines.map((l, i) => (
          <Box
            key={i}
            sx={{
              position: "absolute",
              left: l.left,
              top: l.top,
              width: l.width,
              height: "1px",
              bgcolor: "rgba(144,202,249,.28)",
              transform: `rotate(${l.angle}deg)`,
              transformOrigin: "0 0",
              pointerEvents: "none",
            }}
          />
        ))}

        {/* planets column */}
        <Box sx={{ flex: "none", minWidth: 130, zIndex: 1 }}>
          <Typography sx={{ fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".06em", color: "text.secondary", mb: 1 }}>
            Planets
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {PLANET_TYPES.map((t) => {
              const lit = inv.planetTypes.has(t);
              return (
                <Box
                  key={t}
                  ref={setNodeRef(`planet-${t}`)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1,
                    py: 0.5,
                    borderRadius: "6px",
                    bgcolor: lit ? "rgba(144,202,249,.08)" : "transparent",
                    opacity: lit ? 1 : 0.25,
                  }}
                >
                  <Image src={`/${t}.png`} alt="" width={26} height={26} style={{ borderRadius: 13 }} />
                  <Typography sx={{ fontSize: ".8rem" }}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* material columns */}
        {COLUMNS.map((col) => (
          <Box key={col.tier} sx={{ flex: "none", minWidth: 185, zIndex: 1 }}>
            <Typography
              sx={{
                fontSize: ".7rem",
                textTransform: "uppercase",
                letterSpacing: ".06em",
                color: TIER_COLORS[col.tier],
                fontWeight: 600,
                mb: 1,
              }}
            >
              {col.tier} Materials
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {col.ids.map((id) => {
                const state = nodeState(id);
                const selectable = col.tier !== "P0";
                return (
                  <Box
                    key={id}
                    ref={setNodeRef(String(id))}
                    onClick={selectable ? () => setTarget(id) : undefined}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      px: 1,
                      py: 0.5,
                      borderRadius: "6px",
                      cursor: selectable ? "pointer" : "default",
                      border:
                        state === "selected"
                          ? `1px solid ${TIER_COLORS[col.tier]}`
                          : "1px solid transparent",
                      borderLeft:
                        state !== "dimmed"
                          ? `3px solid ${TIER_COLORS[col.tier]}`
                          : "3px solid transparent",
                      bgcolor:
                        state === "selected"
                          ? "rgba(144,202,249,.14)"
                          : state === "highlighted"
                            ? "#1e1e1e"
                            : "transparent",
                      opacity: state === "dimmed" ? 0.25 : 1,
                      "&:hover": selectable ? { bgcolor: "rgba(144,202,249,.10)", opacity: 1 } : {},
                    }}
                  >
                    <Image src={ICON(id, 32)} alt="" width={22} height={22} unoptimized />
                    <Typography sx={{ fontSize: ".76rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {nameOf(id)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>

      {/* manufacturing plan (R8) */}
      {combo && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "flex-start" }}>
          {/* required raw materials */}
          <Box sx={{ flex: 1, minWidth: 320, bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", overflow: "hidden" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.25, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <Image src={ICON(target)} alt="" width={24} height={24} unoptimized />
              <Typography sx={{ fontSize: ".9rem", fontWeight: 500 }}>
                Manufacturing plan: {nameOf(target)}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Chip
                size="small"
                label={`${combo.covered}/${combo.required} resources`}
                sx={{
                  height: 20,
                  fontSize: ".66rem",
                  bgcolor: combo.covered === combo.required ? "rgba(102,187,106,.14)" : "rgba(255,167,38,.14)",
                  color: combo.covered === combo.required ? "success.main" : "warning.main",
                }}
              />
            </Box>
            <Typography sx={{ px: 2, pt: 1.25, pb: 0.5, fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: "text.secondary" }}>
              Required raw materials (P0)
            </Typography>
            {combo.requiredP0.map((r) => (
              <Box key={r.id} sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.6, borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                <Image src={ICON(r.id)} alt="" width={20} height={20} unoptimized />
                <Typography sx={{ fontSize: ".8rem", flex: 1 }}>{r.name}</Typography>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {r.sources.map((t) => (
                    <Box key={t} title={t} sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                      <Image src={`/${t}.png`} alt={t} width={18} height={18} style={{ borderRadius: 9 }} />
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>

          {/* optimal combination */}
          <Box sx={{ flex: 1, minWidth: 320, bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", overflow: "hidden" }}>
            <Box sx={{ px: 2, py: 1.25, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <Typography sx={{ fontSize: ".9rem", fontWeight: 500 }}>
                Optimal planet combination{" "}
                <Typography component="span" sx={{ fontSize: ".72rem", color: "success.main" }}>
                  · hub and spoke
                </Typography>
              </Typography>
              <Typography sx={{ fontSize: ".72rem", color: "text.secondary", mt: 0.25 }}>
                The hub hosts the factories and extracts everything its type can;
                each spoke extracts one P0.
              </Typography>
            </Box>
            <Box sx={{ px: 2, py: 1.25 }}>
              <Typography sx={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: TIER_COLORS.P2, mb: 0.5 }}>
                Factory hub
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <Image src={`/${combo.hub.type}.png`} alt="" width={24} height={24} style={{ borderRadius: 12 }} />
                <Typography sx={{ fontSize: ".82rem" }}>
                  {combo.hub.type[0].toUpperCase() + combo.hub.type.slice(1)}
                </Typography>
                <Typography sx={{ fontSize: ".72rem", color: "text.secondary" }}>
                  makes {nameOf(target)}
                  {combo.hub.extracts.length > 0 &&
                    ` · also extracts ${combo.hub.extracts.map(nameOf).join(", ")}`}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: TIER_COLORS.P0, mb: 0.5 }}>
                Resource spokes
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1.5 }}>
                {combo.spokes.map((s) => (
                  <Box key={s.p0} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Image src={`/${s.type}.png`} alt="" width={20} height={20} style={{ borderRadius: 10 }} />
                    <Typography sx={{ fontSize: ".78rem", minWidth: 84 }}>
                      {s.type[0].toUpperCase() + s.type.slice(1)}
                    </Typography>
                    <Image src={ICON(s.p0)} alt="" width={18} height={18} unoptimized />
                    <Typography sx={{ fontSize: ".76rem", color: "text.secondary" }}>{nameOf(s.p0)}</Typography>
                  </Box>
                ))}
              </Box>
              <Typography sx={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: "text.secondary", mb: 0.5 }}>
                Facilities per top-tier factory (real chain ratios)
              </Typography>
              <Typography sx={{ fontSize: ".78rem", color: "text.primary" }}>
                {combo.facilities.highTech > 0 && `${combo.facilities.highTech} high-tech · `}
                {combo.facilities.advanced} advanced · {combo.facilities.basic} basic ·{" "}
                {combo.facilities.extractorPlanets} extractor planets
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
