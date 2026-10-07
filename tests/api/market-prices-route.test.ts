import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getPrices, stalePriceIds, upsertJitaPrices, touchMissingJitaPrices, fetchAggregates } = vi.hoisted(() => ({
  getPrices: vi.fn(), stalePriceIds: vi.fn(), upsertJitaPrices: vi.fn(), touchMissingJitaPrices: vi.fn(),
  fetchAggregates: vi.fn(),
}));
vi.mock("../../src/lib/db/market-prices.js", () => ({
  getPrices, stalePriceIds, upsertJitaPrices, touchMissingJitaPrices,
}));
vi.mock("../../src/lib/market/fuzzwork.js", () => ({ fetchAggregates, FUZZWORK_CHUNK: 500 }));

const { GET } = await import("../../src/app/api/market/prices/route.js");
const request = (query: string) => new NextRequest(`https://eve.example.com/api/market/prices${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  stalePriceIds.mockResolvedValue([]);
  touchMissingJitaPrices.mockResolvedValue(0);
  getPrices.mockResolvedValue(new Map([[587, { sell: 8_000_000, buy: 7_500_000, adjusted: 7_900_000 }]]));
});

describe("GET /api/market/prices", () => {
  it("serves stored prices as an object keyed by type id", async () => {
    const res = await GET(request("?ids=587"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      prices: { "587": { sell: 8000000, buy: 7500000, adjusted: 7900000 } },
    });
    expect(fetchAggregates).not.toHaveBeenCalled();
  });

  it("tops stale ids up from Fuzzwork before answering", async () => {
    stalePriceIds.mockResolvedValue([2889]);
    fetchAggregates.mockResolvedValue([{ typeId: 2889, sellMin: 1_500_000, buyMax: 1_400_000 }]);
    const res = await GET(request("?ids=587,2889"));
    expect(res.status).toBe(200);
    expect(stalePriceIds).toHaveBeenCalledWith([587, 2889], 24);
    // The route passes a timeout-wrapped fetchImpl (fix 4), not the bare global fetch.
    expect(fetchAggregates).toHaveBeenCalledTimes(1);
    expect(fetchAggregates.mock.calls[0][0]).toEqual([2889]);
    expect(typeof fetchAggregates.mock.calls[0][1]).toBe("function");
    expect(fetchAggregates.mock.calls[0][1]).not.toBe(fetch);
    expect(upsertJitaPrices).toHaveBeenCalledWith([{ typeId: 2889, sellMin: 1500000, buyMax: 1400000 }]);
    // Every stale id came back in the response, so nothing needed the "left out entirely" touch.
    expect(touchMissingJitaPrices).not.toHaveBeenCalled();
    // getPrices runs AFTER the upsert, so the answer includes the fresh row.
    expect(getPrices).toHaveBeenCalledWith([587, 2889]);
  });

  it("touches an id Fuzzwork's response left out entirely, without nulling it via upsertJitaPrices", async () => {
    stalePriceIds.mockResolvedValue([2889, 99999]);
    fetchAggregates.mockResolvedValue([{ typeId: 2889, sellMin: 1_500_000, buyMax: 1_400_000 }]);
    const res = await GET(request("?ids=2889,99999"));
    expect(res.status).toBe(200);
    expect(upsertJitaPrices).toHaveBeenCalledWith([{ typeId: 2889, sellMin: 1500000, buyMax: 1400000 }]);
    expect(touchMissingJitaPrices).toHaveBeenCalledWith([99999]);
  });

  it("the fetchImpl the route passes carries an AbortSignal, so a hung Fuzzwork request times out", async () => {
    stalePriceIds.mockResolvedValue([2889]);
    let capturedInit: RequestInit | undefined;
    fetchAggregates.mockImplementation(async (_ids: number[], fetchImpl: typeof fetch) => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedInit = init;
        return new Response("{}", { status: 200 });
      }) as typeof fetch;
      try {
        await fetchImpl("https://market.fuzzwork.co.uk/aggregates/?region=10000002&types=2889");
      } finally {
        globalThis.fetch = originalFetch;
      }
      return [];
    });
    const res = await GET(request("?ids=2889"));
    expect(res.status).toBe(200);
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal);
    expect(capturedInit?.signal?.aborted).toBe(false);
  });

  it("still answers 200 when Fuzzwork is down", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    stalePriceIds.mockResolvedValue([2889]);
    fetchAggregates.mockRejectedValue(new Error("Fuzzwork 503 for 1 types"));
    const res = await GET(request("?ids=587,2889"));
    expect(res.status).toBe(200);
    expect(upsertJitaPrices).not.toHaveBeenCalled();
    expect(touchMissingJitaPrices).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("rejects a missing, malformed or oversized id list", async () => {
    expect((await GET(request(""))).status).toBe(400);
    expect((await GET(request("?ids=abc"))).status).toBe(400);
    const many = Array.from({ length: 501 }, (_, i) => i + 1).join(",");
    expect((await GET(request(`?ids=${many}`))).status).toBe(400);
    expect(getPrices).not.toHaveBeenCalled();
  });
});
