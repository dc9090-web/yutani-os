import { describe, it, expect, vi } from "vitest";
import {
  MARKET_PRICES_INTERVAL_MS, MARKET_PRICES_RETRY_MS, REAL_FETCH_ESI_PRICES, createMarketPricesJob,
  marketPricesJob, toEsiPriceRow, type MarketPricesDeps,
} from "../../src/worker/jobs/market-prices.js";
import { fetchAggregates } from "../../src/lib/market/fuzzwork.js";
import type { EsiClient } from "../../src/lib/esi/client.js";
import type { JobOutcome } from "../../src/worker/scheduler.js";

const ESI_PRICES = [
  { typeId: 34, adjustedPrice: 4.2, averagePrice: 4.5 },
  { typeId: 587, adjustedPrice: 8_000_000, averagePrice: null },
];

function deps(over: Partial<MarketPricesDeps> = {}): MarketPricesDeps {
  return {
    fetchEsiPrices: vi.fn(async () => ESI_PRICES),
    typesOfInterest: vi.fn(async () => [34, 587]),
    fetchAggregates: vi.fn(async () => [{ typeId: 34, sellMin: 3.85, buyMax: 3.67 }]),
    upsertEsiPrices: vi.fn(async (rows) => rows.length),
    upsertJitaPrices: vi.fn(async (rows) => rows.length),
    touchMissingJitaPrices: vi.fn(async () => 0),
    log: () => {},
    ...over,
  };
}

const esi = {} as EsiClient;

describe("market-prices job", () => {
  it("is an hourly global job that retries after ten minutes", () => {
    expect(marketPricesJob.name).toBe("market-prices");
    expect(marketPricesJob.scope).toBe("global");
    expect(marketPricesJob.intervalMs).toBe(MARKET_PRICES_INTERVAL_MS);
    expect(MARKET_PRICES_INTERVAL_MS).toBe(60 * 60 * 1000);
    expect(marketPricesJob.retryMs).toBe(MARKET_PRICES_RETRY_MS);
    expect(MARKET_PRICES_RETRY_MS).toBe(10 * 60 * 1000);
  });

  it("maps an ESI /markets/prices entry, defaulting the optional fields to null", () => {
    expect(toEsiPriceRow({ type_id: 34, adjusted_price: 4.2, average_price: 4.5 }))
      .toEqual({ typeId: 34, adjustedPrice: 4.2, averagePrice: 4.5 });
    expect(toEsiPriceRow({ type_id: 44992 })).toEqual({ typeId: 44992, adjustedPrice: null, averagePrice: null });
  });

  it("writes ESI prices, then Jita prices for the types of interest, and sums the rows", async () => {
    const d = deps();
    expect(await createMarketPricesJob(d).run({ esi })).toBe(3);          // 2 ESI + 1 Jita
    expect(d.fetchEsiPrices).toHaveBeenCalledWith(esi);
    expect(d.upsertEsiPrices).toHaveBeenCalledWith(ESI_PRICES);
    expect(d.fetchAggregates).toHaveBeenCalledWith([34, 587]);
    expect(d.upsertJitaPrices).toHaveBeenCalledWith([{ typeId: 34, sellMin: 3.85, buyMax: 3.67 }]);
    // 587 is a type of interest but Fuzzwork's response (mocked above) left it out entirely.
    expect(d.touchMissingJitaPrices).toHaveBeenCalledWith([587]);
  });

  it("does not touch anything when every type of interest came back from Fuzzwork", async () => {
    const d = deps({ typesOfInterest: vi.fn(async () => [34]) });
    await createMarketPricesJob(d).run({ esi });
    expect(d.touchMissingJitaPrices).not.toHaveBeenCalled();
  });

  it("skips Fuzzwork entirely when nothing is of interest yet", async () => {
    const d = deps({ typesOfInterest: vi.fn(async () => []) });
    expect(await createMarketPricesJob(d).run({ esi })).toBe(2);
    expect(d.fetchAggregates).not.toHaveBeenCalled();
  });

  it("returns a warning instead of failing when Fuzzwork is down, keeping the ESI prices", async () => {
    const d = deps({ fetchAggregates: vi.fn(async () => { throw new Error("Fuzzwork 503 for 2 types"); }) });
    const outcome = (await createMarketPricesJob(d).run({ esi })) as JobOutcome;
    expect(outcome.rows).toBe(2);
    expect(outcome.warn).toMatch(/Fuzzwork 503/);
    expect(d.upsertEsiPrices).toHaveBeenCalledTimes(1);
    expect(d.upsertJitaPrices).not.toHaveBeenCalled();
  });

  it("propagates an upsertJitaPrices failure as a real error, not a warning", async () => {
    const d = deps({ upsertJitaPrices: vi.fn(async () => { throw new Error("pool exhausted"); }) });
    await expect(createMarketPricesJob(d).run({ esi })).rejects.toThrow(/pool exhausted/);
    expect(d.fetchAggregates).toHaveBeenCalledTimes(1);
    expect(d.upsertJitaPrices).toHaveBeenCalledTimes(1);
  });

  it("propagates an ESI failure as a real error and writes nothing", async () => {
    const d = deps({ fetchEsiPrices: vi.fn(async () => { throw new Error("ESI 500 for /markets/prices"); }) });
    await expect(createMarketPricesJob(d).run({ esi })).rejects.toThrow(/ESI 500/);
    expect(d.upsertEsiPrices).not.toHaveBeenCalled();
    expect(d.fetchAggregates).not.toHaveBeenCalled();
  });

  it("calls /markets/prices publicly — no characterId, so no Authorization header", async () => {
    const get = vi.fn(async () => ({ data: [{ type_id: 34, adjusted_price: 4.2 }], status: 200, pages: 1, fromCache: false, lastModified: null }));
    const rows = await REAL_FETCH_ESI_PRICES({ get } as unknown as EsiClient);
    expect(get).toHaveBeenCalledWith("/markets/prices");
    expect(rows).toEqual([{ typeId: 34, adjustedPrice: 4.2, averagePrice: null }]);
  });

  it("passes the interest list through the real Fuzzwork client", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ "34": { sell: { min: "3.85" }, buy: { max: "3.67" } } }), { status: 200 }));
    const d = deps({ fetchAggregates: (ids) => fetchAggregates(ids, fetchImpl as unknown as typeof fetch, "ua") });
    expect(await createMarketPricesJob(d).run({ esi })).toBe(3);
    expect(new URL((fetchImpl.mock.calls[0] as unknown as [string])[0]).searchParams.get("types")).toBe("34,587");
  });
});
