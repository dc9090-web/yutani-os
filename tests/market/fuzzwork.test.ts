import { describe, it, expect, vi } from "vitest";
import { FUZZWORK_CHUNK, fetchAggregates, parsePrice } from "../../src/lib/market/fuzzwork.js";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("parsePrice", () => {
  it("parses the string values Fuzzwork sends", () => {
    expect(parsePrice("3.85")).toBe(3.85);
    expect(parsePrice("15207338606.0")).toBe(15207338606);
  });
  it("maps the empty-market shapes to null", () => {
    expect(parsePrice("0")).toBeNull();       // string zero — spec §3
    expect(parsePrice(0)).toBeNull();         // numeric zero — research §4, verified with PLEX
    expect(parsePrice(undefined)).toBeNull();
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("not a number")).toBeNull();
  });
});

describe("fetchAggregates", () => {
  it("asks Jita for one chunk, parses sell.min and buy.max, and sends the user agent", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      "34": { buy: { max: "3.67", min: "0.01" }, sell: { min: "3.85", max: "38420.0" } },
      "587": { buy: { max: "0" }, sell: { min: "0" } },
    }));
    const rows = await fetchAggregates([34, 587], fetchImpl as unknown as typeof fetch, "EVE/0.1 dac9dc@gmail.com");

    expect(rows).toEqual([
      { typeId: 34, sellMin: 3.85, buyMax: 3.67 },
      { typeId: 587, sellMin: null, buyMax: null },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://market.fuzzwork.co.uk/aggregates/?region=10000002&types=34,587");
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("EVE/0.1 dac9dc@gmail.com");
  });

  it("chunks at 500 ids per request and deduplicates", async () => {
    const ids = [...Array(1201).keys()].map((i) => i + 1);
    const seen: number[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      const types = new URL(url).searchParams.get("types")!.split(",");
      seen.push(types.length);
      return jsonResponse(Object.fromEntries(types.map((t) => [t, { sell: { min: "1.5" }, buy: { max: "1.0" } }])));
    });
    const rows = await fetchAggregates([...ids, 1, 2], fetchImpl as unknown as typeof fetch, "ua");
    expect(FUZZWORK_CHUNK).toBe(500);
    expect(seen).toEqual([500, 500, 201]);
    expect(rows).toHaveLength(1201);
    expect(rows[0]).toEqual({ typeId: 1, sellMin: 1.5, buyMax: 1 });
  });

  it("skips a type the response leaves out rather than blanking it", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ "34": { sell: { min: "3.85" }, buy: { max: "3.67" } } }));
    expect(await fetchAggregates([34, 44992], fetchImpl as unknown as typeof fetch, "ua"))
      .toEqual([{ typeId: 34, sellMin: 3.85, buyMax: 3.67 }]);
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response("Request-URI Too Large", { status: 414 }));
    await expect(fetchAggregates([34], fetchImpl as unknown as typeof fetch, "ua")).rejects.toThrow(/414/);
  });

  it("does not call fetch at all for an empty type list", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    expect(await fetchAggregates([], fetchImpl as unknown as typeof fetch, "ua")).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
