import { NextApiRequest, NextApiResponse } from "next";
import logger from "@/utils/logger";

/**
 * R5 — Discord webhook relay. Executes a user-supplied Discord webhook
 * server-side so the browser never depends on Discord CORS behavior. Only
 * discord.com / discordapp.com webhook URLs are accepted.
 */
const WEBHOOK_PATTERN =
  /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    return res.status(404).end();
  }

  try {
    const { webhook, content } =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (typeof webhook !== "string" || !WEBHOOK_PATTERN.test(webhook)) {
      return res.status(400).json({ error: "Invalid Discord webhook URL" });
    }
    if (typeof content !== "string" || !content.length || content.length > 1900) {
      return res.status(400).json({ error: "Invalid content" });
    }

    const discordRes = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, username: "EVE PI" }),
    });

    if (!discordRes.ok) {
      logger.warn({ event: "notify_discord_failed", status: discordRes.status });
      return res.status(502).json({ error: "Discord rejected the webhook call" });
    }

    return res.json({ ok: true });
  } catch (e) {
    logger.error({ event: "notify_failed", error: e });
    return res.status(500).json({ error: "Failed to send notification" });
  }
};

export default handler;
