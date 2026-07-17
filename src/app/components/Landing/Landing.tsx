"use client";

import { useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import PublicIcon from "@mui/icons-material/Public";
import { LoginDialog } from "../Login/LoginDialog";
import { TIER_COLORS } from "@/pi-tiers";

/**
 * Landing / login gate — shown to logged-out visitors. "Log in with EVE
 * Online" opens the existing SSO dialog; "Explore the demo" enters the app
 * without characters (the reference tabs — Chain Explorer, Ranking, System
 * Planner — are fully functional logged out).
 */
const STEPS = [
  {
    n: "1",
    title: "Log in your characters",
    body: "EVE SSO imports every colony automatically. Nothing to type, no spreadsheets.",
  },
  {
    n: "2",
    title: "See what's happening",
    body: "The P0 → P1 → P2 pipeline, ISK/hr and factory uptime per planet, and which colonies are running at a loss.",
  },
  {
    n: "3",
    title: "Know what to do",
    body: "A 2-day haul manifest, product-swap fixes for red planets, and Discord alerts so you never babysit a colony.",
  },
];

const FEATURES = [
  { color: TIER_COLORS.P2, title: "Pipeline", body: "Extract → import → carry out, per planet" },
  { color: "#f0a5a0", title: "Goal", body: "Start at the item you want to build" },
  { color: TIER_COLORS.P1, title: "Your Week", body: "One haul manifest, in and out" },
  { color: "#66bb6a", title: "Rebalance", body: "Swap products to end losses" },
  { color: "#c58af9", title: "Investigator", body: "Build-vs-buy economics, tax aware" },
  { color: "#5fb0c9", title: "System Planner", body: "Plan a whole system by planet type" },
  { color: "#5865F2", title: "Notifications", body: "Discord & browser timer alerts" },
];

export function Landing({ onDemo }: { onDemo: () => void }) {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#121212", color: "#fff" }}>
      {/* header */}
      <Box
        sx={{
          maxWidth: 1120,
          mx: "auto",
          px: 3,
          py: 2.75,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <PublicIcon sx={{ fontSize: 22 }} />
        <Typography
          sx={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: ".26rem", fontSize: "1.1rem" }}
        >
          EVE U PIG
        </Typography>
        <Typography
          sx={{
            fontSize: ".56rem",
            fontWeight: 600,
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,.4)",
          }}
        >
          Ultimate PI Guide
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" sx={{ color: "rgba(255,255,255,.7)" }} onClick={onDemo}>
          View demo
        </Button>
      </Box>

      {/* hero */}
      <Box sx={{ maxWidth: 960, mx: "auto", px: 3, pt: 5.5, pb: 2.25, textAlign: "center" }}>
        <Typography
          sx={{
            fontSize: ".72rem",
            fontWeight: 600,
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: "primary.main",
            mb: 2.25,
          }}
        >
          EVE Online · Planetary Industry
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontSize: "clamp(2rem, 5vw, 3.3rem)",
            lineHeight: 1.08,
            fontWeight: 700,
            letterSpacing: "-.01em",
            mb: 2.25,
          }}
        >
          Run your whole PI empire
          <br />
          from one screen.
        </Typography>
        <Typography
          sx={{
            fontSize: "1.05rem",
            lineHeight: 1.6,
            color: "rgba(255,255,255,.65)",
            maxWidth: 630,
            mx: "auto",
            mb: 3.75,
          }}
        >
          Log in your capsuleers and EVE U PIG pulls every colony automatically — extractor
          timers, the P0 → P1 → P2 pipeline, ISK/hr per planet, and exactly what to haul each
          run. Then walk away.
        </Typography>
        <Box sx={{ display: "flex", gap: 1.75, justifyContent: "center", flexWrap: "wrap", mb: 1.75 }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => setLoginOpen(true)}
            sx={{
              bgcolor: "#000",
              color: "#fff",
              border: "1px solid #2f2f2f",
              fontWeight: 600,
              px: 3,
              "&:hover": { bgcolor: "#111", borderColor: "#f5c04a" },
            }}
          >
            Log in with EVE Online
          </Button>
          <Button
            variant="outlined"
            size="large"
            color="inherit"
            onClick={onDemo}
            sx={{ fontWeight: 600, borderColor: "rgba(255,255,255,.25)", px: 2.75 }}
          >
            Explore the demo →
          </Button>
        </Box>
        <Typography sx={{ fontSize: ".75rem", color: "rgba(255,255,255,.4)" }}>
          Your data stays in your browser · no account needed to try the demo
        </Typography>

        {/* tier chips */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1.25,
            flexWrap: "wrap",
            mt: 5.25,
          }}
        >
          {(
            [
              [TIER_COLORS.P0, "P0 · Extract"],
              [TIER_COLORS.P1, "P1 · Import"],
              [TIER_COLORS.P2, "P2 · Carry out"],
            ] as const
          ).map(([color, label], i) => (
            <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              {i > 0 && <Typography sx={{ color: "rgba(255,255,255,.3)" }}>→</Typography>}
              <Typography
                sx={{
                  fontSize: ".8rem",
                  fontWeight: 600,
                  color,
                  border: `1px solid ${color}`,
                  borderRadius: "20px",
                  px: 2,
                  py: 0.75,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* steps */}
      <Box sx={{ maxWidth: 1000, mx: "auto", px: 3, py: 4.25 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {STEPS.map((s) => (
            <Box
              key={s.n}
              sx={{
                flex: 1,
                minWidth: 230,
                bgcolor: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: "12px",
                p: 2.5,
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  bgcolor: "rgba(144,202,249,.16)",
                  color: "primary.main",
                  fontWeight: 700,
                  fontSize: ".85rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mb: 1.5,
                }}
              >
                {s.n}
              </Box>
              <Typography sx={{ fontWeight: 600, fontSize: ".95rem", mb: 0.6 }}>{s.title}</Typography>
              <Typography sx={{ fontSize: ".82rem", color: "rgba(255,255,255,.55)", lineHeight: 1.55 }}>
                {s.body}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* feature tiles */}
      <Box sx={{ maxWidth: 1000, mx: "auto", px: 3, pt: 0.75, pb: 6.25 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 1.5,
          }}
        >
          {FEATURES.map((f) => (
            <Box
              key={f.title}
              sx={{
                bgcolor: "rgba(255,255,255,.02)",
                border: "1px solid rgba(255,255,255,.07)",
                borderRadius: "10px",
                px: 1.9,
                py: 1.75,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.9, mb: 0.6 }}>
                <Box sx={{ width: 9, height: 9, borderRadius: "2px", bgcolor: f.color }} />
                <Typography sx={{ fontWeight: 600, fontSize: ".85rem" }}>{f.title}</Typography>
              </Box>
              <Typography sx={{ fontSize: ".75rem", color: "rgba(255,255,255,.5)", lineHeight: 1.5 }}>
                {f.body}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        component="footer"
        sx={{
          borderTop: "1px solid rgba(255,255,255,.08)",
          px: 3,
          py: 2.5,
          textAlign: "center",
          fontSize: ".72rem",
          color: "rgba(255,255,255,.35)",
        }}
      >
        Fan-made tool · not affiliated with or endorsed by CCP hf. EVE Online is a trademark of
        CCP hf. · Everything is stored locally in your browser.
      </Box>

      <LoginDialog open={loginOpen} closeDialog={() => setLoginOpen(false)} />
    </Box>
  );
}
