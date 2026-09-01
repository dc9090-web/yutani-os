import { describe, it, expect, vi, beforeEach } from "vitest";
import { EsiClient, EsiError } from "../../src/lib/esi/client.js";
import type { CacheEntry } from "../../src/lib/db/esi-cache.js";

type Resp = { status: number; body?: unknown; headers?: Record<string, string> };
function make(responses: Resp[]) {
  const store = new Map<string, CacheEntry>();
  const calls: { url: string; init: RequestInit }[] = [];
  let t = 1_700_000_000_000;
  const sleeps: number[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const r = responses.shift() ?? { status: 500 };
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: r.headers ?? {} });
  }) as unknown as typeof fetch;
  const client = new EsiClient({
    fetchImpl, getAccessToken: async (cid) => `tok-${cid}`,
    cache: { get: async (cid, p) => store.get(`${cid}${p}`) ?? null, put: async (cid, p, e) => { store.set(`${cid}${p}`, e); } },
    config: { esiBaseUrl: "https://esi.test", esiCompatibilityDate: "2026-08-28", esiUserAgent: "ua" },
    now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; },
  });
  return { client, calls, store, sleeps, advance: (ms: number) => { t += ms; } };
}
const future = (t: number, s: number) => new Date(t + s * 1000).toUTCString();

describe("EsiClient", () => {
  it("sends compat date, UA, bearer and stores etag/expires", async () => {
    const { client, calls, store } = make([{ status: 200, body: { name: "T" }, headers: { ETag: '"e1"', Expires: future(1_700_000_000_000, 300), "X-Pages": "1" } }]);
    const r = await client.get<{ name: string }>("/characters/1", { characterId: 1 });
    expect(r.data.name).toBe("T"); expect(r.fromCache).toBe(false);
    const h = calls[0].init.headers as Record<string, string>;
    expect(h["X-Compatibility-Date"]).toBe("2026-08-28"); expect(h["User-Agent"]).toBe("ua"); expect(h.Authorization).toBe("Bearer tok-1");
    expect(calls[0].url).toBe("https://esi.test/characters/1");
    expect(store.get("1/characters/1")?.etag).toBe('"e1"');
  });
  it("stores expiresAt: null and does not throw when Expires is unparsable", async () => {
    const { client, store } = make([{ status: 200, body: { name: "T" }, headers: { Expires: "garbage" } }]);
    const r = await client.get<{ name: string }>("/characters/1", { characterId: 1 });
    expect(r.data.name).toBe("T");
    expect(store.get("1/characters/1")?.expiresAt).toBeNull();
  });
  it("serves from cache before Expires without fetching, then sends If-None-Match and accepts 304", async () => {
    const { client, calls, advance } = make([
      { status: 200, body: [1], headers: { ETag: '"e1"', Expires: future(1_700_000_000_000, 60) } },
      { status: 304, headers: { Expires: future(1_700_000_000_000, 200) } },
    ]);
    await client.get("/x", { characterId: 0 });
    const cached = await client.get("/x", { characterId: 0 });
    expect(cached.fromCache).toBe(true); expect(calls.length).toBe(1);
    advance(61_000);
    const revalidated = await client.get<number[]>("/x", { characterId: 0 });
    expect(calls.length).toBe(2);
    expect((calls[1].init.headers as Record<string, string>)["If-None-Match"]).toBe('"e1"');
    expect(revalidated.data).toEqual([1]); expect(revalidated.status).toBe(304);
  });
  it("public routes use cache key character 0 and no bearer", async () => {
    const { client, calls, store } = make([{ status: 200, body: {} }]);
    await client.get("/markets/prices");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(store.has("0/markets/prices")).toBe(true);
  });
  it("throttles when the bucket is nearly empty and honours Retry-After on 429", async () => {
    const { client, sleeps } = make([
      { status: 200, body: {}, headers: { "X-Ratelimit-Group": "g", "X-Ratelimit-Limit": "150/15m", "X-Ratelimit-Remaining": "10" } },
      { status: 200, body: {}, headers: { "X-Ratelimit-Group": "g", "X-Ratelimit-Limit": "150/15m", "X-Ratelimit-Remaining": "100" } },
      { status: 429, headers: { "Retry-After": "7" } },
      { status: 200, body: { ok: 1 } },
    ]);
    await client.get("/a"); await client.get("/a?b=1");
    expect(sleeps[0]).toBeGreaterThan(0);            // remaining 10 < 20% of 150 → waited before 2nd call
    const r = await client.get<{ ok: number }>("/c");
    expect(sleeps).toContain(7000); expect(r.data.ok).toBe(1);
  });
  it("halts all calls for 60s after a 420", async () => {
    const { client, sleeps } = make([{ status: 420 }, { status: 200, body: {} }, { status: 200, body: {} }]);
    await expect(client.get("/a")).rejects.toBeInstanceOf(EsiError);
    await client.get("/b");
    expect(sleeps).toContain(60_000);
  });
  it("throws EsiError with status for other errors", async () => {
    const { client } = make([{ status: 403, body: { error: "forbidden" } }]);
    await expect(client.get("/a", { characterId: 1 })).rejects.toMatchObject({ status: 403, path: "/a" });
  });
  it("getAll follows X-Pages", async () => {
    const { client, calls } = make([
      { status: 200, body: [1, 2], headers: { "X-Pages": "3" } }, { status: 200, body: [3] }, { status: 200, body: [4] },
    ]);
    expect(await client.getAll<number>("/characters/1/assets", { characterId: 1 })).toEqual([1, 2, 3, 4]);
    expect(calls.map((c) => new URL(c.url).searchParams.get("page"))).toEqual(["1", "2", "3"]);
  });
});
