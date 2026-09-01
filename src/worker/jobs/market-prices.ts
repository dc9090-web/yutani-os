import type { EsiClient } from "../../lib/esi/client.js";
import type { GlobalSyncJob, JobOutcome } from "../scheduler.js";
import { fetchAggregates } from "../../lib/market/fuzzwork.js";
import { typesOfInterest } from "../../lib/market/interest.js";
import {
  upsertEsiPrices, upsertJitaPrices, type EsiPriceRow, type JitaPriceRow,
} from "../../lib/db/market-prices.js";

/** Spec §3. ESI caches /markets/prices for an hour, so the interval and the cache line up exactly. */
export const MARKET_PRICES_INTERVAL_MS = 60 * 60 * 1000;
export const MARKET_PRICES_RETRY_MS = 10 * 60 * 1000;

/** One entry of `GET /markets/prices`; both price fields are optional (research §4). */
export interface EsiMarketPrice { type_id: number; adjusted_price?: number; average_price?: number }

export function toEsiPriceRow(p: EsiMarketPrice): EsiPriceRow {
  return { typeId: p.type_id, adjustedPrice: p.adjusted_price ?? null, averagePrice: p.average_price ?? null };
}

/**
 * The real ESI half, exported so the test can prove the call is public (no `characterId`, therefore
 * no `Authorization` header and a shared `character_id = 0` cache row).
 */
export const REAL_FETCH_ESI_PRICES = async (esi: EsiClient): Promise<EsiPriceRow[]> => {
  const res = await esi.get<EsiMarketPrice[]>("/markets/prices");
  return res.data.map(toEsiPriceRow);
};

/** Every side effect is injected so the job is unit-tested with fakes, exactly like `sde-update`. */
export interface MarketPricesDeps {
  fetchEsiPrices: (esi: EsiClient) => Promise<EsiPriceRow[]>;
  typesOfInterest: () => Promise<number[]>;
  fetchAggregates: (typeIds: number[]) => Promise<JitaPriceRow[]>;
  upsertEsiPrices: (rows: EsiPriceRow[]) => Promise<number>;
  upsertJitaPrices: (rows: JitaPriceRow[]) => Promise<number>;
  log?: (msg: string) => void;
}

/**
 * ESI first (one request, ~1.1 MB, every market type in the game), then Fuzzwork for the types of
 * interest. An ESI failure propagates and the scheduler records an `error` run; a Fuzzwork failure
 * comes back as a `JobOutcome` warning instead, because the ESI prices already written are a valid
 * — if less accurate — answer (spec §3).
 */
export function createMarketPricesJob(deps: MarketPricesDeps): GlobalSyncJob {
  const log = deps.log ?? ((): void => {});
  return {
    name: "market-prices",
    scope: "global",
    intervalMs: MARKET_PRICES_INTERVAL_MS,
    retryMs: MARKET_PRICES_RETRY_MS,
    async run({ esi }): Promise<number | JobOutcome> {
      const esiRows = await deps.fetchEsiPrices(esi);
      let rows = await deps.upsertEsiPrices(esiRows);
      log(`market-prices: ${rows} ESI reference prices`);

      const typeIds = await deps.typesOfInterest();
      if (typeIds.length === 0) {
        log("market-prices: nothing of interest yet, skipping Fuzzwork");
        return rows;
      }
      let jita: JitaPriceRow[];
      try {
        jita = await deps.fetchAggregates(typeIds);
      } catch (e) {
        const message = (e as Error).message ?? String(e);
        log(`market-prices: Fuzzwork failed, keeping ESI prices: ${message}`);
        return { rows, warn: `Fuzzwork aggregates failed for ${typeIds.length} types: ${message}` };
      }
      rows += await deps.upsertJitaPrices(jita);
      log(`market-prices: ${jita.length} Jita aggregates for ${typeIds.length} types of interest`);
      return rows;
    },
  };
}

export const marketPricesJob: GlobalSyncJob = createMarketPricesJob({
  fetchEsiPrices: REAL_FETCH_ESI_PRICES,
  typesOfInterest: () => typesOfInterest(),
  fetchAggregates: (typeIds) => fetchAggregates(typeIds),
  upsertEsiPrices: (rows) => upsertEsiPrices(rows),
  upsertJitaPrices: (rows) => upsertJitaPrices(rows),
  log: (msg) => console.log(`[worker] ${msg}`),
});
