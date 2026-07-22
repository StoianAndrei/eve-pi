"use client";

import {
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import {
  Box,
  Typography,
  Switch,
  Chip,
  MenuItem,
  Select,
  TextField,
  Button,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { SessionContext } from "@/app/context/Context";
import { EVE_IMAGE_URL, PI_SCHEMATICS } from "@/const";
import { PLANET_P0, PlanetType } from "@/pi-planets";
import {
  EvePraisalResult,
  fetchAllPrices,
  JITA_REGION_ID,
  MARKET_HUBS,
} from "@/eve-praisal";
import { TIER_COLORS, nameOf, tierOf } from "@/pi-tiers";
import {
  buildChain,
  buildPlanText,
  CHAIN_TARGETS,
  fmtIsk,
  OrderSide,
  rankChains,
} from "@/pi-chain";
import {
  COLUMNS,
  investigate,
  planetCombination,
  PLANET_COLORS,
  PLANET_TYPES,
  planetTypesForP0,
} from "@/pi-investigate";

/**
 * The unified Investigator (design v3): compare chains, trace any product to
 * P0, and plan the planets — one tab, four collapsible sections:
 *   1. Compare chains — top-16 bar chart, click a bar to trace it
 *   2. Materials grid — the whole graph with ancestry highlighting + lines
 *   3. Chain economics — taxes, margin & the full build ladder
 *   4. Optimal planet combination — hub & spoke
 * Replaces the previous separate Chain Explorer and Ranking tabs.
 */
const ICON = (typeId: number, size = 32) =>
  `${EVE_IMAGE_URL}/types/${typeId}/icon?size=${size}`;

const controlLabel = {
  fontSize: ".68rem",
  color: "text.secondary",
  textTransform: "uppercase",
  letterSpacing: ".05em",
} as const;

const inputSx = {
  bgcolor: "#242424",
  "& .MuiOutlinedInput-root": { fontSize: ".85rem" },
} as const;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Divider + label between the merged sub-views of the Chain section. */
const SubHead = ({ label, sub }: { label: string; sub?: string }) => (
  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 2.5, mb: 1.25, pt: 1.75, borderTop: "1px solid rgba(255,255,255,.08)" }}>
    <Typography sx={{ fontSize: ".9rem", fontWeight: 600 }}>{label}</Typography>
    {sub && <Typography sx={{ fontSize: ".72rem", color: "text.disabled" }}>{sub}</Typography>}
  </Box>
);

interface Line {
  left: number;
  top: number;
  width: number;
  angle: number;
}

function Section({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: ReactNode;
  hint: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <Box
        onClick={onToggle}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          cursor: "pointer",
          bgcolor: "#191919",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: "8px",
          px: 1.75,
          py: 1.25,
          mb: 1.25,
          userSelect: "none",
        }}
      >
        <Typography sx={{ color: "text.secondary", fontSize: ".85rem", width: 12, flex: "none" }}>
          {open ? "▾" : "▸"}
        </Typography>
        <Typography sx={{ fontSize: ".85rem", fontWeight: 600 }}>{title}</Typography>
        <Typography sx={{ fontSize: ".7rem", color: "text.disabled" }}>{hint}</Typography>
      </Box>
      {open && <Box sx={{ mb: 1.75 }}>{children}</Box>}
    </>
  );
}

function EconCard({
  label,
  value,
  color,
  sub,
  accent,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 130,
        bgcolor: "#1e1e1e",
        border: "1px solid rgba(255,255,255,.08)",
        borderLeft: accent ? `3px solid ${accent}` : undefined,
        borderRadius: "8px",
        px: 1.75,
        py: 1.5,
      }}
    >
      <Typography sx={controlLabel}>{label}</Typography>
      <Typography
        sx={{
          fontSize: accent ? "1.4rem" : "1.15rem",
          fontWeight: 500,
          mt: 0.25,
          color: color ?? "text.primary",
        }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: ".7rem", color: "text.disabled", mt: 0.25 }}>{sub}</Typography>
      )}
    </Box>
  );
}

export function Investigator({
  target,
  onTargetChange,
}: {
  target: number;
  onTargetChange: (id: number) => void;
}) {
  const { piPrices } = useContext(SessionContext);
  const [sellSide, setSellSide] = useState<OrderSide>("sell");
  const [buySide, setBuySide] = useState<OrderSide>("sell");
  const [customsPct, setCustomsPct] = useState(5);
  const [marketPct, setMarketPct] = useState(3.6);
  const [hub, setHub] = useState("Jita");
  const [hubPrices, setHubPrices] = useState<EvePraisalResult | undefined>();
  const [hubLoading, setHubLoading] = useState(false);
  const [copied, setCopied] = useState<"" | "url" | "plan">("");
  const [rankDesc, setRankDesc] = useState(true);
  const [drawLines, setDrawLines] = useState(true);
  // Materials grid: select a planet type to see what it can build; hide the
  // unrelated nodes so the graph doesn't sprawl.
  const [planetFocus, setPlanetFocus] = useState<PlanetType | null>(null);
  const [hideUnrelated, setHideUnrelated] = useState(true);
  const [open, setOpen] = useState({ compare: true, chain: true });
  const hubCache = useRef(new Map<string, EvePraisalResult>());

  const toggle = (key: keyof typeof open) => () =>
    setOpen((o) => ({ ...o, [key]: !o[key] }));

  const regionId =
    MARKET_HUBS.find((h) => h.name === hub)?.regionId ?? JITA_REGION_ID;

  useEffect(() => {
    if (regionId === JITA_REGION_ID) {
      setHubPrices(undefined);
      return;
    }
    const cached = hubCache.current.get(hub);
    if (cached) {
      setHubPrices(cached);
      return;
    }
    let stale = false;
    setHubLoading(true);
    fetchAllPrices(regionId)
      .then((prices) => {
        if (stale) return;
        hubCache.current.set(hub, prices);
        setHubPrices(prices);
      })
      .catch(() => !stale && setHubPrices(undefined))
      .finally(() => !stale && setHubLoading(false));
    return () => {
      stale = true;
    };
  }, [hub, regionId]);

  const activePrices = regionId === JITA_REGION_ID ? piPrices : hubPrices;
  const opts = { customsPct, marketPct, sellSide, buySide };

  const chain = useMemo(
    () => buildChain(target, activePrices, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target, activePrices, customsPct, marketPct, sellSide, buySide],
  );
  const bars = useMemo(() => {
    const top = rankChains(activePrices, opts).slice(0, 16);
    if (!rankDesc) top.reverse();
    return top;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePrices, customsPct, marketPct, sellSide, buySide, rankDesc]);
  const maxNet = Math.max(...bars.map((b) => Math.abs(b.net)), 1);

  const inv = useMemo(() => investigate(target), [target]);
  const combo = useMemo(
    () => planetCombination(target, activePrices),
    [target, activePrices],
  );

  // -- materials-grid connection lines --------------------------------------
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const [lines, setLines] = useState<Line[]>([]);

  const setNodeRef = (key: string) => (el: HTMLDivElement | null) => {
    if (el) nodeRefs.current.set(key, el);
    else nodeRefs.current.delete(key);
  };

  const computeLines = useCallback(() => {
    const container = containerRef.current;
    if (!container || !drawLines || !open.chain) {
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
      next.push({
        left: x1,
        top: y1,
        width: Math.hypot(x2 - x1, y2 - y1),
        angle: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI,
      });
    });
    setLines(next);
  }, [inv, drawLines, open.chain]);

  useLayoutEffect(() => {
    computeLines();
    window.addEventListener("resize", computeLines);
    return () => window.removeEventListener("resize", computeLines);
  }, [computeLines]);

  // What a selected planet type can build: the P0s it extracts + the P1s those
  // refine into.
  const planetBuild = useMemo(() => {
    if (!planetFocus) return null;
    const p0 = new Set(PLANET_P0[planetFocus] ?? []);
    const ids = new Set<number>(p0);
    PI_SCHEMATICS.forEach((s) => {
      const out = s.outputs[0].type_id;
      if (tierOf(out) === "P1" && s.inputs.some((i) => p0.has(i.type_id))) ids.add(out);
    });
    return ids;
  }, [planetFocus]);

  const nodeState = (id: number): "selected" | "highlighted" | "dimmed" => {
    if (planetFocus) return planetBuild?.has(id) ? "highlighted" : "dimmed";
    return id === target ? "selected" : inv.ids.has(id) ? "highlighted" : "dimmed";
  };

  // Selecting an item clears any planet focus.
  const selectItem = (id: number) => {
    setPlanetFocus(null);
    onTargetChange(id);
  };

  // -- state URL -------------------------------------------------------------
  const stateUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams({
      view: "investigate",
      pi: String(target),
      hub,
      sell: sellSide,
      buy: buySide,
      customs: String(customsPct),
      market: String(marketPct),
    });
    return `${window.location.origin}${window.location.pathname}?${params}`;
  }, [target, hub, sellSide, buySide, customsPct, marketPct]);

  const copy = (kind: "url" | "plan") => {
    const text = kind === "url" ? stateUrl : chain ? buildPlanText(chain) : "";
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(""), 1500);
    });
  };

  return (
    <Box>
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 500 }}>
        Investigator{" "}
        <Typography component="span" sx={{ color: "text.disabled", fontSize: ".85rem" }}>
          · compare chains, trace any product to P0, plan the planets
        </Typography>
      </Typography>
      <Typography sx={{ fontSize: ".75rem", color: "text.disabled", mb: 1.75 }}>
        Live {hub} prices{hubLoading && " (loading…)"}. Net is per one top-tier
        factory, full build from P0.
      </Typography>

      {/* controls */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "flex-end", mb: 1.5 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography sx={controlLabel}>Product</Typography>
          <Select
            size="small"
            value={target}
            onChange={(e) => selectItem(Number(e.target.value))}
            sx={{ ...inputSx, minWidth: 230, fontSize: ".85rem" }}
          >
            {CHAIN_TARGETS.map((t) => (
              <MenuItem key={t.id} value={t.id} sx={{ fontSize: ".85rem" }}>
                <Box component="span" sx={{ color: TIER_COLORS[t.tier], fontWeight: 700, mr: 1, fontSize: ".7rem" }}>
                  {t.tier}
                </Box>
                {t.name}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography sx={controlLabel}>Hub</Typography>
          <Select
            size="small"
            value={hub}
            onChange={(e) => setHub(e.target.value)}
            sx={{ ...inputSx, fontSize: ".85rem" }}
          >
            {MARKET_HUBS.map((h) => (
              <MenuItem key={h.name} value={h.name} sx={{ fontSize: ".85rem" }}>
                {h.name}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography sx={controlLabel}>Sell output</Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={sellSide}
            onChange={(_, v: OrderSide | null) => v && setSellSide(v)}
          >
            <ToggleButton value="sell" sx={{ px: 1.5, fontSize: ".78rem" }}>Sell</ToggleButton>
            <ToggleButton value="buy" sx={{ px: 1.5, fontSize: ".78rem" }}>Buy</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography sx={controlLabel}>Buy inputs</Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={buySide}
            onChange={(_, v: OrderSide | null) => v && setBuySide(v)}
          >
            <ToggleButton value="sell" sx={{ px: 1.5, fontSize: ".78rem" }}>Sell</ToggleButton>
            <ToggleButton value="buy" sx={{ px: 1.5, fontSize: ".78rem" }}>Buy</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography sx={controlLabel}>Customs %</Typography>
          <TextField
            size="small"
            type="number"
            value={customsPct}
            onChange={(e) => setCustomsPct(Math.max(0, parseFloat(e.target.value) || 0))}
            sx={{ ...inputSx, width: 90 }}
          />
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography sx={controlLabel}>Market %</Typography>
          <TextField
            size="small"
            type="number"
            value={marketPct}
            onChange={(e) => setMarketPct(Math.max(0, parseFloat(e.target.value) || 0))}
            sx={{ ...inputSx, width: 90 }}
          />
        </Box>
      </Box>

      {/* URL-as-state */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          alignItems: "center",
          bgcolor: "#191919",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: "8px",
          px: 1.5,
          py: 1,
          mb: 2,
        }}
      >
        <Typography sx={{ ...controlLabel, flex: "none" }}>State</Typography>
        <Typography
          component="code"
          sx={{
            flex: 1,
            minWidth: 200,
            fontFamily: "monospace",
            fontSize: ".74rem",
            color: "#a9d1f7",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {stateUrl}
        </Typography>
        <Button size="small" variant="outlined" onClick={() => copy("url")}>
          {copied === "url" ? "Copied!" : "Copy URL"}
        </Button>
        <Button size="small" variant="contained" onClick={() => copy("plan")}>
          {copied === "plan" ? "Copied!" : "Copy build plan"}
        </Button>
      </Box>

      {/* SECTION 1 — compare chains */}
      <Section
        title="Compare chains"
        hint="what earns more vs less — click a bar to trace it"
        open={open.compare}
        onToggle={toggle("compare")}
      >
        <Box sx={{ bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", px: 1.75, py: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1.25 }}>
            <Typography sx={{ fontSize: ".7rem", color: "text.disabled" }}>
              Top 16 chains · net ISK/hr per top-tier factory
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() => setRankDesc((d) => !d)}
              sx={{ fontSize: ".7rem", py: 0.25 }}
            >
              {rankDesc ? "High → low ▼" : "Low → high ▲"}
            </Button>
          </Box>
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.75, overflowX: "auto", pt: 0.5 }}>
            {bars.map((b) => {
              const selected = b.id === target;
              return (
                <Box
                  key={b.id}
                  title={b.name}
                  onClick={() => selectItem(b.id)}
                  sx={{
                    flex: 1,
                    minWidth: 48,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0.5,
                    cursor: "pointer",
                  }}
                >
                  <Typography sx={{ fontSize: ".6rem", color: "#8bbf8e", whiteSpace: "nowrap" }}>
                    {fmtIsk(b.net)}
                  </Typography>
                  <Box
                    sx={{
                      width: 26,
                      height: `${Math.max(4, Math.round((Math.abs(b.net) / maxNet) * 110))}px`,
                      bgcolor: selected ? TIER_COLORS[b.tier] : `${TIER_COLORS[b.tier]}88`,
                      border: selected ? "1px solid #fff" : "1px solid transparent",
                      borderRadius: "4px 4px 0 0",
                    }}
                  />
                  <Image src={ICON(b.id)} alt="" width={20} height={20} unoptimized />
                  <Typography
                    sx={{
                      fontSize: ".6rem",
                      color: selected ? "#fff" : "text.secondary",
                      textAlign: "center",
                      lineHeight: 1.2,
                      maxWidth: 66,
                      height: 23,
                      overflow: "hidden",
                    }}
                  >
                    {b.name}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Section>

      {/* SECTION 2 — materials grid + economics + planet combination (united) */}
      <Section
        title={
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1.5 }}>
            Chain, economics &amp; planets
            <Box
              component="span"
              onClick={(e) => e.stopPropagation()}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
            >
              <Switch size="small" checked={drawLines} onChange={(e) => setDrawLines(e.target.checked)} />
              <Typography component="span" sx={{ fontSize: ".7rem", color: "text.secondary" }}>
                lines
              </Typography>
            </Box>
            <Box
              component="span"
              onClick={(e) => e.stopPropagation()}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
            >
              <Switch size="small" checked={hideUnrelated} onChange={(e) => setHideUnrelated(e.target.checked)} />
              <Typography component="span" sx={{ fontSize: ".7rem", color: "text.secondary" }}>
                hide unrelated
              </Typography>
            </Box>
            {planetFocus && (
              <Chip
                size="small"
                label={`${cap(planetFocus)} builds ▾ · clear`}
                onClick={(e) => {
                  e.stopPropagation();
                  setPlanetFocus(null);
                }}
                sx={{ height: 22, fontSize: ".68rem", bgcolor: `${PLANET_COLORS[planetFocus]}33`, color: PLANET_COLORS[planetFocus] }}
              />
            )}
          </Box>
        }
        hint="the graph, the economics and the planet plan — one view"
        open={open.chain}
        onToggle={toggle("chain")}
      >
        <Box
          ref={containerRef}
          onScroll={computeLines}
          sx={{
            position: "relative",
            display: "flex",
            gap: 1.75,
            overflow: "auto",
            maxHeight: 430,
            bgcolor: "#161616",
            border: "1px solid rgba(255,255,255,.07)",
            borderRadius: "10px",
            p: 1.5,
          }}
        >
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
          <Box sx={{ flex: "none", minWidth: 118, zIndex: 1 }}>
            <Typography sx={{ ...controlLabel, mb: 1 }}>Planets</Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
              {PLANET_TYPES.map((t) => {
                const focused = planetFocus === t;
                const lit = focused || (!planetFocus && inv.planetTypes.has(t));
                return (
                  <Box
                    key={t}
                    ref={setNodeRef(`planet-${t}`)}
                    onClick={() => setPlanetFocus(focused ? null : t)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.9,
                      px: 1,
                      py: 0.5,
                      borderRadius: "6px",
                      cursor: "pointer",
                      border: focused ? `1px solid ${PLANET_COLORS[t]}` : "1px solid transparent",
                      bgcolor: focused ? `${PLANET_COLORS[t]}22` : lit ? "rgba(255,255,255,.05)" : "transparent",
                      opacity: lit ? 1 : 0.35,
                      "&:hover": { opacity: 1, bgcolor: "rgba(255,255,255,.06)" },
                    }}
                  >
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: PLANET_COLORS[t], flex: "none" }} />
                    <Typography sx={{ fontSize: ".76rem" }}>{cap(t)}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
          {COLUMNS.map((col) => (
            <Box key={col.tier} sx={{ flex: "none", minWidth: 178, zIndex: 1 }}>
              <Typography sx={{ ...controlLabel, color: TIER_COLORS[col.tier], fontWeight: 600, mb: 1 }}>
                {col.tier} materials
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
                {col.ids.map((id) => {
                  const state = nodeState(id);
                  const selectable = col.tier !== "P0";
                  if (hideUnrelated && state === "dimmed") return null;
                  return (
                    <Box
                      key={id}
                      ref={setNodeRef(String(id))}
                      onClick={selectable ? () => selectItem(id) : undefined}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.9,
                        px: 0.9,
                        py: 0.4,
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
                      <Image src={ICON(id)} alt="" width={20} height={20} unoptimized />
                      <Typography sx={{ fontSize: ".74rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {nameOf(id)}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Box>

        <SubHead label={`Chain economics — ${nameOf(target)}`} sub="taxes, margin & the full build ladder" />
        {chain && (
          <>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, mb: 2 }}>
              <EconCard
                label="Net ISK / hr · factory"
                value={fmtIsk(chain.net)}
                color={chain.net >= 0 ? "success.main" : "error.main"}
                sub={`${chain.targetPerHour.toFixed(0)} u/h · ${fmtIsk(chain.perUnit)}/u`}
                accent={TIER_COLORS[tierOf(target) ?? "P2"]}
              />
              <EconCard label="Gross sell" value={fmtIsk(chain.gross)} />
              <EconCard label="Customs tax" value={`-${fmtIsk(chain.customsTax)}`} color="#f0a5a0" />
              <EconCard label="Market tax" value={`-${fmtIsk(chain.marketTax)}`} color="#f0a5a0" />
              <EconCard
                label="Margin"
                value={`${(chain.margin * 100).toFixed(1)}%`}
                color={chain.margin >= 0 ? "success.main" : "error.main"}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 1.5, overflowX: "auto", pb: 1 }}>
              {chain.byTier.map((g) => (
                <Box key={g.tier} sx={{ flex: "none", minWidth: 220, maxWidth: 260 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: TIER_COLORS[g.tier] }} />
                    <Typography sx={{ fontSize: ".78rem", fontWeight: 600, color: TIER_COLORS[g.tier] }}>
                      {g.tier}
                    </Typography>
                    <Typography sx={{ fontSize: ".7rem", color: "text.disabled" }}>
                      {g.nodes.length} node{g.nodes.length > 1 ? "s" : ""}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {g.nodes.map((n) => (
                      <Box
                        key={n.id}
                        sx={{
                          bgcolor: "#1e1e1e",
                          border: "1px solid rgba(255,255,255,.08)",
                          borderLeft: `3px solid ${TIER_COLORS[g.tier]}`,
                          borderRadius: "7px",
                          px: 1.25,
                          py: 1,
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Image src={ICON(n.id)} alt="" width={26} height={26} unoptimized />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: ".8rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {n.name}
                            </Typography>
                            <Typography sx={{ fontSize: ".64rem", color: "text.disabled" }}>
                              {n.facility}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.75 }}>
                          <Typography sx={{ fontSize: ".68rem", color: "text.secondary" }}>
                            {n.perHour.toFixed(0)} u/h
                          </Typography>
                          <Typography sx={{ fontSize: ".68rem", color: "text.secondary" }}>
                            {n.tier === "P0" ? "extract" : `${n.factories}× fac`}
                          </Typography>
                          <Typography sx={{ fontSize: ".68rem", color: "#8bbf8e" }}>
                            {fmtIsk(n.unitPrice)} ISK
                          </Typography>
                        </Box>
                        {n.tier === "P0" && (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.6 }}>
                            <Typography sx={{ fontSize: ".62rem", color: "text.disabled" }}>from</Typography>
                            {planetTypesForP0(n.id).map((t) => (
                              <Box
                                key={t}
                                title={t}
                                sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: PLANET_COLORS[t] }}
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          </>
        )}

        <SubHead label="Optimal planet combination" sub={`hub & spoke — which planets to plant for ${nameOf(target)}`} />
        {combo && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "flex-start" }}>
            <Box sx={{ flex: 1, minWidth: 300, bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", overflow: "hidden" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.75, py: 1.25, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <Typography sx={{ fontSize: ".85rem", fontWeight: 500 }}>
                  Required raw materials (P0)
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Chip
                  size="small"
                  label={`${combo.covered}/${combo.required} covered`}
                  sx={{
                    height: 20,
                    fontSize: ".66rem",
                    fontWeight: 600,
                    bgcolor: combo.covered === combo.required ? "rgba(102,187,106,.16)" : "rgba(255,167,38,.16)",
                    color: combo.covered === combo.required ? "success.main" : "warning.main",
                  }}
                />
              </Box>
              {combo.requiredP0.map((r) => (
                <Box key={r.id} sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.75, py: 0.7, borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                  <Image src={ICON(r.id)} alt="" width={20} height={20} unoptimized />
                  <Typography sx={{ fontSize: ".8rem", flex: 1 }}>{r.name}</Typography>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    {r.sources.map((t) => (
                      <Box
                        key={t}
                        title={t}
                        sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: PLANET_COLORS[t], flex: "none" }}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ flex: 1, minWidth: 300, bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", overflow: "hidden" }}>
              <Box sx={{ px: 1.75, py: 1.25, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <Typography sx={{ fontSize: ".85rem", fontWeight: 500 }}>
                  Hub &amp; spokes{" "}
                  <Typography component="span" sx={{ fontSize: ".72rem", color: "success.main" }}>
                    · the hub hosts the factories; each spoke extracts one P0
                  </Typography>
                </Typography>
              </Box>
              <Box sx={{ px: 1.75, py: 1.5 }}>
                <Typography sx={{ ...controlLabel, color: TIER_COLORS.P2, mb: 0.75 }}>Factory hub</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: PLANET_COLORS[combo.hub.type], flex: "none" }} />
                  <Typography sx={{ fontSize: ".82rem", fontWeight: 500 }}>{cap(combo.hub.type)}</Typography>
                  <Typography sx={{ fontSize: ".74rem", color: "text.secondary" }}>
                    makes {nameOf(target)}
                  </Typography>
                </Box>
                {combo.hub.extracts.length > 0 && (
                  <Typography sx={{ fontSize: ".7rem", color: "text.disabled", mb: 0.75 }}>
                    also extracts {combo.hub.extracts.map(nameOf).join(", ")}
                  </Typography>
                )}
                <Typography sx={{ ...controlLabel, color: TIER_COLORS.P0, mt: 1.25, mb: 0.75 }}>
                  Resource spokes
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6, mb: 1.5 }}>
                  {combo.spokes.map((s) => (
                    <Box key={s.p0} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: PLANET_COLORS[s.type], flex: "none" }} />
                      <Typography sx={{ fontSize: ".78rem", minWidth: 82 }}>{cap(s.type)}</Typography>
                      <Image src={ICON(s.p0)} alt="" width={18} height={18} unoptimized />
                      <Typography sx={{ fontSize: ".76rem", color: "text.secondary" }}>{nameOf(s.p0)}</Typography>
                    </Box>
                  ))}
                </Box>
                <Typography sx={{ ...controlLabel, mb: 0.5 }}>
                  Facilities per top-tier factory
                </Typography>
                <Typography sx={{ fontSize: ".78rem" }}>
                  {combo.facilities.highTech > 0 && `${combo.facilities.highTech} high-tech · `}
                  {combo.facilities.advanced} advanced · {combo.facilities.basic} basic ·{" "}
                  {combo.facilities.extractorPlanets} extractor planets
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </Section>
    </Box>
  );
}
