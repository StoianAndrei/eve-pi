"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Box,
  Typography,
  MenuItem,
  Select,
  TextField,
  Button,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { SessionContext } from "@/app/context/Context";
import { EVE_IMAGE_URL } from "@/const";
import {
  EvePraisalResult,
  fetchAllPrices,
  JITA_REGION_ID,
  MARKET_HUBS,
} from "@/eve-praisal";
import { TIER_COLORS } from "@/pi-tiers";
import {
  buildChain,
  buildPlanText,
  CHAIN_TARGETS,
  fmtIsk,
  OrderSide,
} from "@/pi-chain";

/**
 * R3 — Chain Explorer. Back-trace any P2/P3/P4 to its P0 leaves, tax & price
 * aware. Live Jita prices via SessionContext; hub + price-basis controls land
 * with R2 (richer price source).
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
        <Typography sx={{ fontSize: ".7rem", color: "text.disabled", mt: 0.25 }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

export function ChainExplorer({
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
  const hubCache = useRef(new Map<string, EvePraisalResult>());

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

  const chain = useMemo(
    () => buildChain(target, activePrices, { customsPct, marketPct, sellSide, buySide }),
    [target, activePrices, customsPct, marketPct, sellSide, buySide],
  );

  const stateUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams({
      view: "chain",
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
        Chain Explorer{" "}
        <Typography component="span" sx={{ color: "text.disabled", fontSize: ".85rem" }}>
          · back-trace any product to P0, tax &amp; price aware
        </Typography>
      </Typography>
      <Typography sx={{ fontSize: ".75rem", color: "text.disabled", mb: 1.75 }}>
        Live {hub} prices{hubLoading && " (loading…)"}. Net is per one top-tier
        factory, full build from P0.
        {chain?.missingPrice && !hubLoading && " — no market price for this product yet."}
      </Typography>

      {/* controls */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "flex-end", mb: 1.5 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography sx={controlLabel}>Product</Typography>
          <Select
            size="small"
            value={target}
            onChange={(e) => onTargetChange(Number(e.target.value))}
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

      {chain && (
        <>
          {/* econ summary */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, mb: 2 }}>
            <EconCard
              label="Net ISK / hr · factory"
              value={fmtIsk(chain.net)}
              color={chain.net >= 0 ? "success.main" : "error.main"}
              sub={`${chain.targetPerHour.toFixed(0)} u/h · ${fmtIsk(chain.perUnit)}/u`}
              accent={TIER_COLORS[chain.byTier[chain.byTier.length - 1].tier]}
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

          {/* tier ladder */}
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
                          <Typography
                            sx={{ fontSize: ".8rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                          >
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
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
