import { PI_TYPES_ARRAY, PI_TYPES_MAP } from "./const";

export interface Totals {
  buy: number;
  sell: number;
  volume: number;
}

export interface All {
  avg: number;
  max: number;
  median: number;
  min: number;
  percentile: number;
  stddev: number;
  volume: number;
  order_count: number;
}

export interface Buy {
  avg: number;
  max: number;
  median: number;
  min: number;
  percentile: number;
  stddev: number;
  volume: number;
  order_count: number;
}

export interface Sell {
  avg: number;
  max: number;
  median: number;
  min: number;
  percentile: number;
  stddev: number;
  volume: number;
  order_count: number;
}

export interface Prices {
  all: All;
  buy: Buy;
  sell: Sell;
  updated: string;
  strategy: string;
}

export interface Meta {}

export interface Item {
  name: string;
  typeID: number;
  typeName: string;
  typeVolume: number;
  quantity: number;
  prices: Prices;
  meta: Meta;
}

export interface Appraisal {
  created: number;
  kind: string;
  market_name: string;
  totals: Totals;
  items: Item[];
  raw: string;
  unparsed?: any;
  private: boolean;
  live: boolean;
}

export interface EvePraisalResult {
  appraisal: Appraisal;
}

export interface EvePraisalRequest {
  items: { amount: number; typeId: number }[];
}

const PRAISAL_URL = process.env.NEXT_PUBLIC_PRAISAL_URL ?? "";

const FUZZWORK_AGGREGATES_URL = "https://market.fuzzwork.co.uk/aggregates/";
const JITA_REGION_ID = 10000002;

interface FuzzworkSide {
  weightedAverage?: string | number;
  max?: string | number;
  min?: string | number;
  stddev?: string | number;
  median?: string | number;
  volume?: string | number;
  orderCount?: string | number;
  percentile?: string | number;
}

const num = (v: string | number | undefined): number => {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};

const toPriceSide = (side: FuzzworkSide | undefined) => ({
  avg: num(side?.weightedAverage),
  max: num(side?.max),
  median: num(side?.median),
  min: num(side?.min),
  percentile: num(side?.percentile),
  stddev: num(side?.stddev),
  volume: num(side?.volume),
  order_count: num(side?.orderCount),
});

/**
 * Fallback price source: Fuzzwork market aggregates (Jita / The Forge).
 * One GET covers every requested type_id and is mapped into the same
 * EvePraisalResult shape the rest of the app already consumes
 * (items[].typeID + prices.sell.min / prices.buy.max).
 */
const getFuzzworkPraisal = async (
  items: { quantity: number; type_id: number }[]
): Promise<EvePraisalResult | undefined> => {
  const typeIds = Array.from(new Set(items.map((i) => i.type_id)));
  if (typeIds.length === 0) return undefined;

  try {
    const res = await fetch(
      `${FUZZWORK_AGGREGATES_URL}?region=${JITA_REGION_ID}&types=${typeIds.join(",")}`,
      {
        headers: {
          "User-Agent": "EVE-PI https://github.com/calli-eve/eve-pi",
        },
      }
    );
    if (!res.ok) return undefined;
    const data: Record<string, { buy?: FuzzworkSide; sell?: FuzzworkSide }> =
      await res.json();

    const now = new Date().toISOString();
    const itemsMapped: Item[] = items.map((i) => {
      const aggregate = data[String(i.type_id)];
      const name = PI_TYPES_MAP[i.type_id]?.name ?? `Type ${i.type_id}`;
      return {
        name,
        typeID: i.type_id,
        typeName: name,
        typeVolume: 0,
        quantity: i.quantity,
        prices: {
          all: toPriceSide(aggregate?.sell),
          buy: toPriceSide(aggregate?.buy),
          sell: toPriceSide(aggregate?.sell),
          updated: now,
          strategy: "orders",
        },
        meta: {},
      };
    });

    return {
      appraisal: {
        created: Math.floor(Date.now() / 1000),
        kind: "fuzzwork",
        market_name: "jita",
        totals: { buy: 0, sell: 0, volume: 0 },
        items: itemsMapped,
        raw: "",
        private: true,
        live: true,
      },
    };
  } catch (e) {
    console.log("Fuzzwork price fallback failed", e);
    return undefined;
  }
};

export const getPraisal = async (
  items: { quantity: number; type_id: number }[]
): Promise<EvePraisalResult | undefined> => {
  if (PRAISAL_URL) {
    const praisalRequest = {
      market_name: "jita",
      items,
    };
    const fromPraisal = await fetch(PRAISAL_URL, {
      method: "POST",
      body: JSON.stringify(praisalRequest),
      headers: {
        "User-Agent": "EVE-PI https://github.com/calli-eve/eve-pi",
      },
    })
      .then((res) => (res.ok ? res.json() : undefined))
      .catch(() => {
        console.log("Appraisal failed");
        return undefined;
      });
    if (fromPraisal?.appraisal?.items?.length) return fromPraisal;
  }

  // No PRAISAL_URL configured, or the appraisal service is down/empty.
  return getFuzzworkPraisal(items);
};

export const fetchAllPrices = async (): Promise<EvePraisalResult> => {
  const allPI = PI_TYPES_ARRAY.map((t) => {
    return { quantity: 1, type_id: t.type_id };
  });
  return await fetch("api/praisal", {
    method: "POST",
    body: JSON.stringify(allPI),
  }).then((res) => res.json());
};
