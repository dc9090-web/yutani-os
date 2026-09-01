import { describe, it, expect, vi, beforeEach } from "vitest";
import { EsiClient, EsiError, EsiUnavailableError } from "../../src/lib/esi/client.js";
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
    config: { esiBaseUrl: "https://esi.test", esiCompatibilityDate: "2026-08-18", esiUserAgent: "ua" },
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
    expect(h["X-Compatibility-Date"]).toBe("2026-08-18"); expect(h["User-Agent"]).toBe("ua"); expect(h.Authorization).toBe("Bearer tok-1");
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
  it("post sends a JSON body with the bearer, compat date and UA, and returns the parsed response", async () => {
    const { client, calls, store } = make([{ status: 200, body: [{ item_id: 7, name: "Fast Tackle" }] }]);
    const out = await client.post<{ item_id: number; name: string }[]>("/characters/1/assets/names", [7], { characterId: 1 });
    expect(out).toEqual([{ item_id: 7, name: "Fast Tackle" }]);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.body).toBe("[7]");
    const h = calls[0].init.headers as Record<string, string>;
    expect(h["Content-Type"]).toBe("application/json");
    expect(h.Authorization).toBe("Bearer tok-1");
    expect(h["X-Compatibility-Date"]).toBe("2026-08-18");
    expect(h["User-Agent"]).toBe("ua");
    expect(store.size).toBe(0);                       // POST responses carry no cache headers
  });
  it("post throws EsiError on a 4xx and sends no bearer for a public route", async () => {
    const { client, calls } = make([{ status: 200, body: [] }, { status: 400, body: { error: "too many ids" } }]);
    await client.post("/universe/names", [1, 2]);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined();
    await expect(client.post("/universe/names", [1, 2])).rejects.toMatchObject({ status: 400, path: "/universe/names" });
  });
  it("keys rate-limit buckets on (group, characterId) so one character never delays another", async () => {
    const low = { "X-Ratelimit-Group": "char-wallet", "X-Ratelimit-Limit": "150/15m", "X-Ratelimit-Remaining": "5" };
    const high = { "X-Ratelimit-Group": "char-wallet", "X-Ratelimit-Limit": "150/15m", "X-Ratelimit-Remaining": "140" };
    const { client, sleeps } = make([
      { status: 200, body: {}, headers: low }, { status: 200, body: {}, headers: high }, { status: 200, body: {}, headers: high },
    ]);
    await client.get("/characters/1/wallet", { characterId: 1 });   // bucket char-wallet:1 now throttled
    await client.get("/characters/2/wallet", { characterId: 2 });   // same route template, different bucket
    expect(sleeps).toEqual([]);
    await client.get("/characters/1/wallet", { characterId: 1 });   // same template: bucket char-wallet:1 is known and throttled
    expect(sleeps.length).toBe(1);                                  // bucket char-wallet:1 waited
  });
  it("waits for the error-limit reset when fewer than 20 errors remain in the window", async () => {
    const { client, sleeps } = make([
      { status: 404, headers: { "X-ESI-Error-Limit-Remain": "12", "X-ESI-Error-Limit-Reset": "37" } },
      { status: 200, body: { ok: 1 } },
    ]);
    await expect(client.get("/a")).rejects.toMatchObject({ status: 404 });
    await client.get("/b");
    expect(sleeps).toContain(37_000);
  });
  it("does not wait while the error limit is healthy or the headers are absent", async () => {
    const { client, sleeps } = make([
      { status: 200, body: {}, headers: { "X-ESI-Error-Limit-Remain": "98", "X-ESI-Error-Limit-Reset": "40" } },
      { status: 200, body: {} },
      { status: 200, body: {} },
    ]);
    await client.get("/a"); await client.get("/b"); await client.get("/c");
    expect(sleeps).toEqual([]);
  });
  it("opens a 60s breaker on 503 and fails fast without touching ESI", async () => {
    const { client, calls, advance } = make([
      { status: 503, body: { error: "Timeout contacting tranquility" } },
      { status: 200, body: { ok: 1 } },
    ]);
    await expect(client.get("/status")).rejects.toBeInstanceOf(EsiUnavailableError);
    await expect(client.get("/characters/1", { characterId: 1 })).rejects.toMatchObject({ status: 503, name: "EsiUnavailableError" });
    expect(calls.length).toBe(1);                     // second call never left the process
    advance(60_001);
    expect((await client.get<{ ok: number }>("/characters/1", { characterId: 1 })).data.ok).toBe(1);
    expect(calls.length).toBe(2);
  });
  it("opens the breaker on 502 and 504 too, and post fails fast as well", async () => {
    const { client, calls } = make([{ status: 502 }]);
    await expect(client.get("/a")).rejects.toBeInstanceOf(EsiUnavailableError);
    await expect(client.post("/universe/names", [1])).rejects.toBeInstanceOf(EsiUnavailableError);
    expect(calls.length).toBe(1);
    const gateway = make([{ status: 504, body: { error: "Timeout contacting tranquility", timeout: 10 } }]);
    await expect(gateway.client.get("/a")).rejects.toBeInstanceOf(EsiUnavailableError);
  });
  it("EsiUnavailableError is an EsiError so existing catch sites keep working", async () => {
    const { client } = make([{ status: 503 }]);
    await expect(client.get("/a")).rejects.toBeInstanceOf(EsiError);
  });
  it("restarts the paginated walk once when a page's Last-Modified disagrees with page 1", async () => {
    const a = "Mon, 01 Sep 2026 10:00:00 GMT";
    const b = "Mon, 01 Sep 2026 10:30:00 GMT";
    const { client, calls } = make([
      { status: 200, body: [1], headers: { "X-Pages": "2", "Last-Modified": a } },
      { status: 200, body: [2], headers: { "Last-Modified": b } },     // torn
      { status: 200, body: [1, 9], headers: { "X-Pages": "2", "Last-Modified": b } },
      { status: 200, body: [2], headers: { "Last-Modified": b } },     // consistent on the retry
    ]);
    expect(await client.getAll<number>("/characters/1/assets", { characterId: 1 })).toEqual([1, 9, 2]);
    expect(calls.length).toBe(4);
  });
  it("throws 409 when the walk is still torn after the restart", async () => {
    const h = (lm: string, pages?: string): Record<string, string> => (pages ? { "X-Pages": pages, "Last-Modified": lm } : { "Last-Modified": lm });
    const { client } = make([
      { status: 200, body: [1], headers: h("Mon, 01 Sep 2026 10:00:00 GMT", "2") },
      { status: 200, body: [2], headers: h("Mon, 01 Sep 2026 10:30:00 GMT") },
      { status: 200, body: [1], headers: h("Mon, 01 Sep 2026 11:00:00 GMT", "2") },
      { status: 200, body: [2], headers: h("Mon, 01 Sep 2026 11:30:00 GMT") },
    ]);
    await expect(client.getAll("/characters/1/assets", { characterId: 1 }))
      .rejects.toMatchObject({ status: 409, path: "/characters/1/assets" });
  });
  it("accepts a walk whose pages agree, and one where ESI sent no Last-Modified at all", async () => {
    const lm = "Mon, 01 Sep 2026 10:00:00 GMT";
    const same = make([
      { status: 200, body: [1], headers: { "X-Pages": "2", "Last-Modified": lm } },
      { status: 200, body: [2], headers: { "Last-Modified": lm } },
    ]);
    expect(await same.client.getAll<number>("/x", { characterId: 1 })).toEqual([1, 2]);
    const none = make([{ status: 200, body: [1], headers: { "X-Pages": "2" } }, { status: 200, body: [2] }]);
    expect(await none.client.getAll<number>("/y", { characterId: 1 })).toEqual([1, 2]);
  });
  it("the restart bypasses a still-valid cached page 1", async () => {
    const a = "Mon, 01 Sep 2026 10:00:00 GMT";
    const b = "Mon, 01 Sep 2026 10:30:00 GMT";
    const { client, calls } = make([
      { status: 200, body: [1], headers: { "X-Pages": "2", "Last-Modified": a, Expires: future(1_700_000_000_000, 3600) } },
      { status: 200, body: [2], headers: { "Last-Modified": b } },
      { status: 200, body: [1], headers: { "X-Pages": "2", "Last-Modified": b } },
      { status: 200, body: [2], headers: { "Last-Modified": b } },
    ]);
    expect(await client.getAll<number>("/z", { characterId: 1 })).toEqual([1, 2]);
    expect(calls.length).toBe(4);                    // page 1 was re-requested despite the fresh cache
  });
});
