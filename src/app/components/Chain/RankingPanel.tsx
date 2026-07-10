"use client";

import { useContext, useMemo } from "react";
import Image from "next/image";
import { Box, Typography } from "@mui/material";
import { SessionContext } from "@/app/context/Context";
import { EVE_IMAGE_URL } from "@/const";
import { TIER_COLORS } from "@/pi-tiers";
import { fmtIsk, rankChains } from "@/pi-chain";

/**
 * R4 — profitability ranking. Every P2/P3/P4 by net ISK/hr per top-tier
 * factory, full build from P0, tax & price aware. Click a row to open it
 * in the Chain Explorer.
 */
const ICON = (typeId: number, size = 32) =>
  `${EVE_IMAGE_URL}/types/${typeId}/icon?size=${size}`;

export function RankingPanel({ onOpen }: { onOpen: (typeId: number) => void }) {
  const { piPrices } = useContext(SessionContext);
  const rows = useMemo(() => rankChains(piPrices), [piPrices]);
  const maxNet = rows.length ? Math.max(...rows.map((r) => r.net), 1) : 1;

  return (
    <Box>
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 500 }}>
        Profitability ranking{" "}
        <Typography component="span" sx={{ color: "text.disabled", fontSize: ".85rem" }}>
          · which chain to run right now
        </Typography>
      </Typography>
      <Typography sx={{ fontSize: ".75rem", color: "text.disabled", mb: 1.75 }}>
        Net ISK/hr per top-tier factory, full build from P0 — tax &amp; price
        aware (live Jita prices). Click a row to open it in the Chain Explorer.
      </Typography>

      <Box
        sx={{
          bgcolor: "#1e1e1e",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        {rows.map((r, idx) => (
          <Box
            key={r.id}
            onClick={() => onOpen(r.id)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 1.75,
              py: 1.1,
              borderBottom: "1px solid rgba(255,255,255,.05)",
              cursor: "pointer",
              "&:hover": { bgcolor: "rgba(144,202,249,.06)" },
            }}
          >
            <Typography sx={{ fontSize: ".8rem", color: "text.disabled", width: 22, flex: "none", textAlign: "right" }}>
              {idx + 1}
            </Typography>
            <Image src={ICON(r.id)} alt="" width={26} height={26} unoptimized />
            <Typography
              sx={{
                fontSize: ".66rem",
                fontWeight: 700,
                color: TIER_COLORS[r.tier],
                border: `1px solid ${TIER_COLORS[r.tier]}`,
                borderRadius: "4px",
                px: 0.6,
                flex: "none",
              }}
            >
              {r.tier}
            </Typography>
            <Typography sx={{ fontSize: ".85rem", flex: 1, minWidth: 120 }}>{r.name}</Typography>
            <Box
              sx={{
                flex: 1,
                minWidth: 80,
                maxWidth: 220,
                height: 6,
                bgcolor: "rgba(255,255,255,.08)",
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  height: "100%",
                  width: `${Math.max(0, Math.min(100, (r.net / maxNet) * 100))}%`,
                  bgcolor: r.net >= 0 ? "success.main" : "error.main",
                  borderRadius: "3px",
                }}
              />
            </Box>
            <Typography
              sx={{
                fontSize: ".9rem",
                fontWeight: 600,
                color: r.net >= 0 ? "success.main" : "error.main",
                width: 90,
                flex: "none",
                textAlign: "right",
              }}
            >
              {fmtIsk(r.net)}
            </Typography>
            <Typography sx={{ fontSize: ".72rem", color: "text.disabled", width: 90, flex: "none", textAlign: "right" }}>
              {fmtIsk(r.perUnit)}/u
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
