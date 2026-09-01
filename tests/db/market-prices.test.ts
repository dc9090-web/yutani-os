import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { getPrices, upsertEsiPrices, upsertJitaPrices } from "../../src/lib/db/market-prices.js";

beforeAll(async () => { await resetDb(); }, 60_000);
afterAll(closePool);

describe("market_prices repo", () => {
  it("upserts ESI prices, then Jita prices, without either clearing the other", async () => {
    expect(await upsertEsiPrices([
      { typeId: 34, adjustedPrice: 4.2, averagePrice: 4.5 },
      { typeId: 587, adjustedPrice: 8_000_000, averagePrice: null },
    ])).toBe(2);
    expect(await upsertJitaPrices([{ typeId: 34, sellMin: 3.85, buyMax: 3.67 }])).toBe(1);

    const prices = await getPrices([34, 587, 999999]);
    expect(prices.get(34)).toEqual({ sell: 3.85, buy: 3.67, adjusted: 4.2 });
    expect(prices.get(587)).toEqual({ sell: null, buy: null, adjusted: 8_000_000 });
    expect(prices.has(999999)).toBe(false);
  });

  it("overwrites an existing row and leaves the other source's columns alone", async () => {
    await upsertEsiPrices([{ typeId: 34, adjustedPrice: 4.9, averagePrice: 5.1 }]);
    expect((await getPrices([34])).get(34)).toEqual({ sell: 3.85, buy: 3.67, adjusted: 4.9 });
    await upsertJitaPrices([{ typeId: 34, sellMin: null, buyMax: null }]);
    expect((await getPrices([34])).get(34)).toEqual({ sell: null, buy: null, adjusted: 4.9 });
  });

  it("returns numbers, not the strings pg gives back for numeric", async () => {
    const price = (await getPrices([34])).get(34)!;
    expect(typeof price.adjusted).toBe("number");
  });

  it("no-ops on empty input", async () => {
    expect(await upsertEsiPrices([])).toBe(0);
    expect(await upsertJitaPrices([])).toBe(0);
    expect(await getPrices([])).toEqual(new Map());
  });
});
