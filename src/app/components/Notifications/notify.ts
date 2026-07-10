import { DateTime } from "luxon";
import { AccessToken, Pin } from "@/types";
import { STORAGE_IDS, STORAGE_CAPACITIES, PI_PRODUCT_VOLUMES } from "@/const";
import { planetEconomics } from "@/planet-economics";

/**
 * R5 — notification rules + trigger evaluation. The triggers reuse the same
 * math the dashboard already shows (extractor expiry, storage fill, import
 * buffer); this module only decides WHEN to deliver, and the panel/API decide
 * WHERE (Discord webhook and/or the browser Notification API).
 */
export type RuleKey = "extractor" | "storage" | "buffer";
export type Channel = "discord" | "browser" | "both";

export interface NotifyRule {
  key: RuleKey;
  enabled: boolean;
  threshold: number;
  channel: Channel;
}

export interface NotifyConfig {
  enabled: boolean;
  webhook: string;
  rules: NotifyRule[];
}

export const RULE_META: Record<
  RuleKey,
  { label: (t: number) => string; unit: string }
> = {
  extractor: {
    label: (t) => `Extractor expires in < ${t}h (or already expired)`,
    unit: "h",
  },
  storage: { label: (t) => `Storage or launchpad > ${t}% full`, unit: "%" },
  buffer: { label: (t) => `Import buffer covers < ${t}h`, unit: "h" },
};

export const DEFAULT_CONFIG: NotifyConfig = {
  enabled: false,
  webhook: "",
  rules: [
    { key: "extractor", enabled: true, threshold: 12, channel: "both" },
    { key: "storage", enabled: true, threshold: 85, channel: "both" },
    { key: "buffer", enabled: false, threshold: 24, channel: "both" },
  ],
};

const CONFIG_KEY = "notifyConfig_v1";
const FIRED_KEY = "notifyFired_v1";
export const COOLDOWN_MS = 6 * 60 * 60 * 1000; // don't repeat an alert within 6h

export const loadNotifyConfig = (): NotifyConfig => {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as NotifyConfig;
      // merge so new default rules appear for existing configs
      const rules = DEFAULT_CONFIG.rules.map(
        (d) => parsed.rules?.find((r) => r.key === d.key) ?? d,
      );
      return { ...DEFAULT_CONFIG, ...parsed, rules };
    }
  } catch {
    // best-effort: ignore storage/delivery failures
  }
  return DEFAULT_CONFIG;
};

export const saveNotifyConfig = (config: NotifyConfig) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

export interface Alert {
  id: string; // stable key for cooldown dedupe
  rule: RuleKey;
  channel: Channel;
  message: string;
}

export const evaluateAlerts = (
  characters: AccessToken[],
  config: NotifyConfig,
): Alert[] => {
  const alerts: Alert[] = [];
  const rule = (key: RuleKey) =>
    config.rules.find((r) => r.key === key && r.enabled);

  const extractorRule = rule("extractor");
  const storageRule = rule("storage");
  const bufferRule = rule("buffer");

  characters.forEach((character) => {
    const charName = character.character.name;
    character.planets.forEach((planet) => {
      const planetName =
        planet.infoUniverse?.name ?? `Planet ${planet.planet_id}`;
      const base = `${character.character.characterId}-${planet.planet_id}`;

      if (extractorRule) {
        const expiries = planet.info.pins
          .map((p) => p.expiry_time)
          .filter((e): e is string => !!e);
        const soonest = expiries
          .map((e) => DateTime.fromISO(e))
          .sort((a, b) => a.toMillis() - b.toMillis())[0];
        if (soonest) {
          const hoursLeft = soonest.diff(DateTime.now(), "hours").hours;
          if (hoursLeft < extractorRule.threshold) {
            alerts.push({
              id: `${base}-extractor`,
              rule: "extractor",
              channel: extractorRule.channel,
              message:
                hoursLeft <= 0
                  ? `⛏️ ${charName} · ${planetName}: extractor EXPIRED`
                  : `⛏️ ${charName} · ${planetName}: extractor expires in ${hoursLeft.toFixed(1)}h`,
            });
          }
        }
      }

      if (storageRule) {
        planet.info.pins
          .filter((p: Pin) =>
            STORAGE_IDS().some((s) => s.type_id === p.type_id),
          )
          .forEach((storage) => {
            const capacity = STORAGE_CAPACITIES[storage.type_id] ?? 0;
            if (!capacity) return;
            const used = (storage.contents ?? []).reduce(
              (sum, c) => sum + c.amount * (PI_PRODUCT_VOLUMES[c.type_id] ?? 0),
              0,
            );
            const fillRate = (used / capacity) * 100;
            if (fillRate > storageRule.threshold) {
              alerts.push({
                id: `${base}-storage-${storage.pin_id}`,
                rule: "storage",
                channel: storageRule.channel,
                message: `📦 ${charName} · ${planetName}: storage ${fillRate.toFixed(0)}% full`,
              });
            }
          });
      }

      if (bufferRule) {
        const { worstCoverHours } = planetEconomics(planet, undefined);
        if (isFinite(worstCoverHours) && worstCoverHours < bufferRule.threshold) {
          alerts.push({
            id: `${base}-buffer`,
            rule: "buffer",
            channel: bufferRule.channel,
            message: `🔻 ${charName} · ${planetName}: import buffer covers only ~${Math.round(worstCoverHours)}h`,
          });
        }
      }
    });
  });

  return alerts;
};

/** Filter to alerts not fired within the cooldown window, and mark them fired. */
export const takeUnfired = (alerts: Alert[]): Alert[] => {
  let fired: Record<string, number> = {};
  try {
    fired = JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}");
  } catch {
    // best-effort: ignore storage/delivery failures
  }
  const now = Date.now();
  const fresh = alerts.filter((a) => !fired[a.id] || now - fired[a.id] > COOLDOWN_MS);
  fresh.forEach((a) => (fired[a.id] = now));
  // prune old entries so the record doesn't grow forever
  Object.keys(fired).forEach((k) => {
    if (now - fired[k] > 7 * 24 * 60 * 60 * 1000) delete fired[k];
  });
  localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  return fresh;
};

export const sendDiscord = async (webhook: string, content: string) => {
  await fetch("api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ webhook, content }),
  });
};

export const sendBrowser = (message: string) => {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    new Notification("EVE PI", { body: message, icon: "/factory.png" });
  }
};

export const deliverAlerts = async (alerts: Alert[], config: NotifyConfig) => {
  const discordLines = alerts
    .filter((a) => a.channel !== "browser")
    .map((a) => a.message);
  if (discordLines.length && config.webhook) {
    try {
      await sendDiscord(config.webhook, discordLines.join("\n"));
    } catch {
    // best-effort: ignore storage/delivery failures
  }
  }
  alerts
    .filter((a) => a.channel !== "discord")
    .forEach((a) => sendBrowser(a.message));
};
