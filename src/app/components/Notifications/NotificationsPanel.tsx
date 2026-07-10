"use client";

import { useContext, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Switch,
  Select,
  MenuItem,
} from "@mui/material";
import { CharacterContext } from "@/app/context/Context";
import {
  Channel,
  evaluateAlerts,
  loadNotifyConfig,
  NotifyConfig,
  RULE_META,
  saveNotifyConfig,
  sendBrowser,
  sendDiscord,
} from "./notify";

/**
 * R5 — Notifications tab. Rules → Discord webhook / browser push. The
 * triggers are already computed by the alert model; this panel is delivery
 * config. Checks run in the background while the app is open (MainGrid).
 */
export function NotificationsPanel() {
  const { characters } = useContext(CharacterContext);
  const [config, setConfig] = useState<NotifyConfig>(loadNotifyConfig);
  const [status, setStatus] = useState("");

  const patchRule = (key: string, patch: Partial<NotifyConfig["rules"][number]>) =>
    setConfig((c) => ({
      ...c,
      rules: c.rules.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));

  const save = async () => {
    const wantsBrowser = config.rules.some(
      (r) => r.enabled && r.channel !== "discord",
    );
    if (wantsBrowser && typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    const next = { ...config, enabled: true };
    setConfig(next);
    saveNotifyConfig(next);
    setStatus("Saved — checks run every 5 minutes while the app is open.");
  };

  const test = async () => {
    setStatus("Sending test…");
    const message = "🔔 EVE PI test notification — delivery works.";
    let ok = true;
    if (config.webhook) {
      try {
        await sendDiscord(config.webhook, message);
      } catch {
        ok = false;
      }
    }
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "default") await Notification.requestPermission();
      sendBrowser(message);
    }
    const firing = evaluateAlerts(characters, config).length;
    setStatus(
      (ok ? "Test sent." : "Discord test failed — check the webhook URL.") +
        ` ${firing} rule trigger${firing === 1 ? "" : "s"} currently firing.`,
    );
  };

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 500 }}>
        Notifications{" "}
        <Typography component="span" sx={{ color: "text.disabled", fontSize: ".85rem" }}>
          · get pinged instead of checking in-game
        </Typography>
      </Typography>
      <Typography sx={{ fontSize: ".75rem", color: "text.disabled", mb: 2 }}>
        Every trigger below is already computed by the alert model — this is just delivery.
        Checks run while the app is open; alerts repeat at most every 6 hours.
      </Typography>

      {/* webhook */}
      <Box
        sx={{
          bgcolor: "#1e1e1e",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: "10px",
          px: 2,
          py: 1.75,
          mb: 1.75,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#5865F2" }} />
          <Typography sx={{ fontSize: ".85rem", fontWeight: 500 }}>Discord webhook</Typography>
        </Box>
        <TextField
          fullWidth
          size="small"
          placeholder="https://discord.com/api/webhooks/…"
          value={config.webhook}
          onChange={(e) => setConfig((c) => ({ ...c, webhook: e.target.value.trim() }))}
          sx={{ bgcolor: "#242424" }}
        />
        <Typography sx={{ fontSize: ".7rem", color: "text.disabled", mt: 0.75 }}>
          Browser notifications also fire for rules set to Browser (permission requested on save).
        </Typography>
      </Box>

      {/* rules */}
      <Box
        sx={{
          bgcolor: "#1e1e1e",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        {config.rules.map((r) => (
          <Box
            key={r.key}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 2,
              py: 1.25,
              borderBottom: "1px solid rgba(255,255,255,.05)",
              flexWrap: "wrap",
            }}
          >
            <Switch
              size="small"
              checked={r.enabled}
              onChange={(e) => patchRule(r.key, { enabled: e.target.checked })}
            />
            <Typography sx={{ flex: 1, fontSize: ".86rem", minWidth: 220 }}>
              {RULE_META[r.key].label(r.threshold)}
            </Typography>
            <TextField
              size="small"
              type="number"
              value={r.threshold}
              onChange={(e) =>
                patchRule(r.key, { threshold: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              sx={{ width: 84, bgcolor: "#242424" }}
              InputProps={{
                endAdornment: (
                  <Typography sx={{ fontSize: ".72rem", color: "text.disabled" }}>
                    {RULE_META[r.key].unit}
                  </Typography>
                ),
              }}
            />
            <Select
              size="small"
              value={r.channel}
              onChange={(e) => patchRule(r.key, { channel: e.target.value as Channel })}
              sx={{ bgcolor: "#242424", fontSize: ".78rem", minWidth: 110 }}
            >
              <MenuItem value="both" sx={{ fontSize: ".78rem" }}>Discord + Browser</MenuItem>
              <MenuItem value="discord" sx={{ fontSize: ".78rem" }}>Discord</MenuItem>
              <MenuItem value="browser" sx={{ fontSize: ".78rem" }}>Browser</MenuItem>
            </Select>
          </Box>
        ))}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            justifyContent: "flex-end",
            px: 2,
            py: 1.5,
            bgcolor: "#191919",
          }}
        >
          <Typography sx={{ flex: 1, fontSize: ".74rem", color: "text.secondary" }}>
            {status}
          </Typography>
          <Button size="small" variant="outlined" onClick={test}>
            Send test
          </Button>
          <Button size="small" variant="contained" onClick={save} sx={{ fontWeight: 600 }}>
            Save &amp; enable
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
