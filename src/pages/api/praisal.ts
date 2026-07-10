import {
  EvePraisalResult,
  getPraisal,
  JITA_REGION_ID,
  MARKET_HUBS,
} from "@/eve-praisal";
import { NextApiRequest, NextApiResponse } from "next";
import logger from "@/utils/logger";

const PRICE_CACHE_TTL_MS = 15 * 60 * 1000;
const priceCache = new Map<
  string,
  { data: EvePraisalResult; timestamp: number }
>();

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === "POST") {
    logger.info({ 
      event: 'praisal_request_start'
    });

    try {
      const parsed = JSON.parse(req.body);

      if (!Array.isArray(parsed)) {
        return res.status(400).json({ error: 'Invalid input' });
      }

      const praisalRequest: { quantity: number; type_id: number }[] = parsed.filter(
        (item): item is { quantity: number; type_id: number } =>
          item !== null &&
          typeof item === 'object' &&
          typeof item.quantity === 'number' &&
          Number.isFinite(item.quantity) &&
          item.quantity >= 0 &&
          typeof item.type_id === 'number' &&
          Number.isInteger(item.type_id) &&
          item.type_id > 0
      );

      logger.info({
        event: 'praisal_request_parsed',
        items: praisalRequest.length
      });

      const requestedRegion = Number(req.query.region);
      const regionId = MARKET_HUBS.some((h) => h.regionId === requestedRegion)
        ? requestedRegion
        : JITA_REGION_ID;

      const cacheKey =
        regionId +
        ":" +
        praisalRequest
          .map((i) => i.type_id)
          .sort((a, b) => a - b)
          .join(",");
      const cached = priceCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL_MS) {
        logger.info({ event: 'praisal_request_cache_hit', regionId });
        return res.json(cached.data);
      }

      const praisal = await getPraisal(praisalRequest, regionId);

      if (praisal?.appraisal?.items?.length) {
        priceCache.set(cacheKey, { data: praisal, timestamp: Date.now() });
      }

      logger.info({
        event: 'praisal_request_success',
        items: praisalRequest.length
      });

      return res.json(praisal);
    } catch (e) {
      logger.error({
        event: 'praisal_request_failed',
        error: e,
      });
      return res.status(500).json({ error: 'Failed to get praisal' });
    }
  } else {
    logger.warn({ 
      event: 'invalid_method',
      method: req.method,
      path: req.url
    });
    res.status(404).end();
  }
};

export default handler;
