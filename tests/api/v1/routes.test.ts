import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";
import type { Pool } from "pg";
import { closePool } from "../../../src/lib/db/client.js";
import { createAppSession, revokeAppSession } from "../../../src/lib/db/app-sessions.js";
import { SESSION_COOKIE, signPayload } from "../../../src/lib/auth/session.js";
import { ALT, FIXTURE_EMAIL, MAIN, TRISTAN_FIT, TRISTAN_ITEM, seedApiFixtureDb } from "./fixture-data.js";

// The routes themselves, over the seeded test database. `loadFitData` is wrapped (not replaced) so
// the tests can count how often the sync list has to read a character's fit data.
vi.mock("../../../src/lib/ships/load.js", async (original) => {
  const real = await original<typeof import("../../../src/lib/ships/load.js")>();
  return { ...real, loadFitData: vi.fn(real.loadFitData) };
});
const { loadFitData } = await import("../../../src/lib/ships/load.js");
const { resetSyncCache } = await import("../../../src/lib/api/v1/sync.js");

type Handler = (req: NextRequest, ctx: { params: Promise<never> }) => Promise<NextResponse>;
const R = "../../../src/app/api/v1";
const ROUTES = ([
  [/^\/api\/v1\/me$/, await import(`${R}/me/route.js`)],
  [/^\/api\/v1\/sync$/, await import(`${R}/sync/route.js`)],
  [/^\/api\/v1\/server$/, await import(`${R}/server/route.js`)],
  [/^\/api\/v1\/characters$/, await import(`${R}/characters/route.js`)],
  [/^\/api\/v1\/overview$/, await import(`${R}/overview/route.js`)],
  [/^\/api\/v1\/training-overview$/, await import(`${R}/training-overview/route.js`)],
  [/^\/api\/v1\/characters\/(?<id>[^/]+)\/skills$/, await import(`${R}/characters/[id]/skills/route.js`)],
  [/^\/api\/v1\/characters\/(?<id>[^/]+)\/training$/, await import(`${R}/characters/[id]/training/route.js`)],
  [/^\/api\/v1\/characters\/(?<id>[^/]+)\/clones$/, await import(`${R}/characters/[id]/clones/route.js`)],
  [/^\/api\/v1\/characters\/(?<id>[^/]+)\/assets$/, await import(`${R}/characters/[id]/assets/route.js`)],
  [/^\/api\/v1\/characters\/(?<id>[^/]+)\/wallet$/, await import(`${R}/characters/[id]/wallet/route.js`)],
  [/^\/api\/v1\/characters\/(?<id>[^/]+)\/ships$/, await import(`${R}/characters/[id]/ships/route.js`)],
  [/^\/api\/v1\/characters\/(?<id>[^/]+)\/ships\/asset\/(?<itemId>[^/]+)$/, await import(`${R}/characters/[id]/ships/asset/[itemId]/route.js`)],
  [/^\/api\/v1\/characters\/(?<id>[^/]+)\/ships\/fit\/(?<fittingId>[^/]+)$/, await import(`${R}/characters/[id]/ships/fit/[fittingId]/route.js`)],
] as [RegExp, { GET: unknown }][]).map(([pattern, module]) => [pattern, module.GET as Handler] as const);

let pool: Pool;
let token: string;

/** A GET the way the phone makes it: the path from the sync list, a bearer token, maybe If-None-Match. */
async function get(path: string, headers: Record<string, string> = { authorization: `Bearer ${token}` }): Promise<NextResponse> {
  const url = new URL(path, "https://eve.example.com");
  for (const [pattern, handler] of ROUTES) {
    const match = pattern.exec(url.pathname);
    if (match !== null) return handler(new NextRequest(url, { headers }), { params: Promise.resolve({ ...match.groups } as never) });
  }
  throw new Error(`no route for ${path}`);
}
const syncList = async (): Promise<{ path: string; etag: string }[]> => (await (await get("/api/v1/sync")).json()).data.resources;

beforeAll(async () => {
  pool = await seedApiFixtureDb();
  ({ token } = await createAppSession({ sub: "g-1", email: FIXTURE_EMAIL, deviceName: "Test phone" }));
}, 180_000);
afterAll(closePool);
afterEach(() => { vi.useRealTimers(); });

describe("who may ask", () => {
  it("401s without a token or cookie, on every kind of route", async () => {
    for (const path of ["/api/v1/me", "/api/v1/sync", "/api/v1/overview", `/api/v1/characters/${MAIN}/skills`, `/api/v1/characters/${MAIN}/ships/asset/${TRISTAN_ITEM}`]) {
      const res = await get(path, {});
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "unauthorised" });
    }
  });

  it("401s an unknown token, and a revoked one", async () => {
    expect((await get("/api/v1/me", { authorization: "Bearer not-a-token" })).status).toBe(401);
    const gone = await createAppSession({ sub: "g-1", email: FIXTURE_EMAIL, deviceName: "Old phone" });
    expect((await get("/api/v1/me", { authorization: `Bearer ${gone.token}` })).status).toBe(200);
    await revokeAppSession(gone.id);
    expect((await get("/api/v1/me", { authorization: `Bearer ${gone.token}` })).status).toBe(401);
  });

  it("401s a token whose account is not on the allow-list", async () => {
    const stranger = await createAppSession({ sub: "g-2", email: "stranger@example.com", deviceName: "Phone" });
    expect((await get("/api/v1/me", { authorization: `Bearer ${stranger.token}` })).status).toBe(401);
  });

  it("accepts the site's own cookie", async () => {
    const req = new NextRequest("https://eve.example.com/api/v1/me");
    req.cookies.set(SESSION_COOKIE, signPayload({ sub: "g-1", email: FIXTURE_EMAIL, activeCharacterId: ALT, iat: Math.floor(Date.now() / 1000) }, process.env.SESSION_SECRET!));
    const res = await ROUTES[0][1](req, { params: Promise.resolve({} as never) });
    expect(res.status).toBe(200);
  });
});

describe("the routes", () => {
  it("/me says who is signed in", async () => {
    const res = await get("/api/v1/me");
    const body = await res.json();
    expect(body.data).toEqual({ email: FIXTURE_EMAIL, ownerInitials: "EP", apiVersion: 1 });
    expect(Date.parse(body.generatedAt)).toBeGreaterThan(Date.now() - 60_000);
  });

  it("serves the character in the path — there is no active character to read", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-14T12:00:00Z"));
    const main = (await (await get(`/api/v1/characters/${MAIN}/training`)).json()).data;
    const alt = (await (await get(`/api/v1/characters/${ALT}/training`)).json()).data;
    expect(main.entries[0].skill).toBe("Drone Interfacing");
    expect(alt.entries[0].skill).toBe("Minmatar Frigate");
  });

  it("400s an id that is not one and 404s a character the site does not hold", async () => {
    for (const tail of ["skills", "training", "clones", "assets", "wallet", "wallet?kind=journal", "ships", "ships/asset/1", "ships/fit/1"]) {
      const bad = await get(`/api/v1/characters/nope/${tail}`);
      expect(bad.status, tail).toBe(400);
      await expect(bad.json()).resolves.toEqual({ error: "bad-id" });
      const missing = await get(`/api/v1/characters/4242/${tail}`);
      expect(missing.status, tail).toBe(404);
      await expect(missing.json()).resolves.toEqual({ error: "not-found" });
    }
  });

  it("404s a ship or fit the character does not have, 400s a bad ship id", async () => {
    expect((await get(`/api/v1/characters/${ALT}/ships/asset/${TRISTAN_ITEM}`)).status).toBe(404);
    expect((await get(`/api/v1/characters/${MAIN}/ships/fit/424242`)).status).toBe(404);
    expect((await get(`/api/v1/characters/${MAIN}/ships/asset/-3`)).status).toBe(400);
    expect((await get(`/api/v1/characters/${MAIN}/ships/fit/abc`)).status).toBe(400);
  });

  it("ship detail carries the drone limits and takes no drones parameter", async () => {
    const plain = await (await get(`/api/v1/characters/${MAIN}/ships/asset/${TRISTAN_ITEM}`)).json();
    const withQuery = await (await get(`/api/v1/characters/${MAIN}/ships/asset/${TRISTAN_ITEM}?drones=2488:3`)).json();
    expect(plain.data.kind).toBe("ok");
    expect(plain.data.view.droneControl.types.map((t: { typeId: number }) => t.typeId)).toEqual([2456, 2488]);
    expect(withQuery.data).toEqual(plain.data);
    expect((await (await get(`/api/v1/characters/${MAIN}/ships/fit/${TRISTAN_FIT}`)).json()).data.view.title).toBe("Tristan - drone brawler");
  });

  describe("wallet", () => {
    const wallet = (query: string) => get(`/api/v1/characters/${MAIN}/wallet${query}`);
    it("is the balance alone without a kind", async () => {
      expect((await (await wallet("")).json()).data).toEqual({ balance: "1,284,503,217.44", balanceIsk: 1284503217.44 });
    });
    it("slices a list by offset and limit, 100 rows by default", async () => {
      expect((await (await wallet("?kind=journal")).json()).data).toMatchObject({ kind: "journal", offset: 0, limit: 100 });
      const page = (await (await wallet("?kind=journal&offset=2&limit=3")).json()).data;
      expect(page).toMatchObject({ kind: "journal", offset: 2, limit: 3 });
      expect(page.rows.map((r: { id: number }) => r.id)).toEqual([5003, 5004, 5005]);
      expect((await (await wallet("?kind=transactions&limit=500")).json()).data.rows).toHaveLength(4);
    });
    it("400s a bad kind, offset or limit", async () => {
      for (const query of ["?kind=ledger", "?kind=journal&offset=-1", "?kind=journal&offset=x", "?kind=journal&limit=0", "?kind=journal&limit=501", "?kind=journal&limit=", "?kind=transactions&limit=1.5"]) {
        const res = await wallet(query);
        expect(res.status, query).toBe(400);
        await expect(res.json()).resolves.toEqual({ error: "bad-request" });
      }
    });
  });
});

describe("ETags", () => {
  it("every GET sends a strong ETag and answers it back with 304 and no body", async () => {
    for (const { path } of [{ path: "/api/v1/sync" }, ...(await syncList())]) {
      const first = await get(path);
      expect(first.status, path).toBe(200);
      const etag = first.headers.get("etag")!;
      expect(etag, path).toMatch(/^"[A-Za-z0-9_-]{32}"$/);
      const again = await get(path, { authorization: `Bearer ${token}`, "if-none-match": etag });
      expect(again.status, path).toBe(304);
      expect(await again.text()).toBe("");
      expect(again.headers.get("etag")).toBe(etag);
    }
  });

  it("a tag does not move because time passed, though the countdowns in the body do", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-14T12:00:00Z"));
    const paths = ["/api/v1/overview", "/api/v1/training-overview", `/api/v1/characters/${MAIN}/skills`, `/api/v1/characters/${MAIN}/training`];
    const before = await Promise.all(paths.map(async (path) => { const res = await get(path); return { etag: res.headers.get("etag"), body: await res.json() }; }));
    // Six days on: Drone Interfacing V has finished and the next entry is the head.
    vi.setSystemTime(new Date("2026-03-20T12:00:00Z"));
    for (const [index, path] of paths.entries()) {
      const res = await get(path);
      expect(res.headers.get("etag"), path).toBe(before[index].etag);
      const body = await res.json();
      expect(body.data, path).not.toEqual(before[index].body.data);
      expect(body.generatedAt).toBe("2026-03-20T12:00:00.000Z");
    }
  });

  it("generatedAt is not part of the tag", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-14T12:00:00Z"));
    const a = await get(`/api/v1/characters/${MAIN}/assets`);
    vi.setSystemTime(new Date("2026-03-14T12:00:07Z"));
    const b = await get(`/api/v1/characters/${MAIN}/assets`);
    expect((await a.json()).generatedAt).not.toBe((await b.json()).generatedAt);
    expect(b.headers.get("etag")).toBe(a.headers.get("etag"));
  });
});

describe("GET /api/v1/sync", () => {
  it("lists everything a phone should hold, by the exact path to GET", async () => {
    const paths = (await syncList()).map((r) => r.path);
    expect(paths).toEqual([
      "/api/v1/me", "/api/v1/server", "/api/v1/characters", "/api/v1/overview", "/api/v1/training-overview",
      ...[MAIN, ALT, 9000003].flatMap((id) => [
        `/api/v1/characters/${id}/skills`, `/api/v1/characters/${id}/training`, `/api/v1/characters/${id}/clones`,
        `/api/v1/characters/${id}/assets`, `/api/v1/characters/${id}/wallet`,
        `/api/v1/characters/${id}/wallet?kind=journal&offset=0&limit=500`,
        `/api/v1/characters/${id}/wallet?kind=transactions&offset=0&limit=500`,
        `/api/v1/characters/${id}/ships`,
        ...(id === MAIN ? [
          `/api/v1/characters/${id}/ships/asset/1040000000001`, `/api/v1/characters/${id}/ships/asset/1040000000050`,
          `/api/v1/characters/${id}/ships/fit/7001`, `/api/v1/characters/${id}/ships/fit/7002`,
        ] : []),
      ]),
    ]);
  });

  it("lists for each resource the very ETag its GET returns", async () => {
    for (const { path, etag } of await syncList()) {
      expect((await get(path)).headers.get("etag"), path).toBe(etag);
    }
  });

  it("does not rebuild anything when nothing changed", async () => {
    resetSyncCache();
    vi.mocked(loadFitData).mockClear();
    const cold = await syncList();
    // Cold: one read of fit data per character, shared by the Ships list and every sheet under it.
    expect(vi.mocked(loadFitData).mock.calls.map(([id]) => id)).toEqual([MAIN, ALT, 9000003]);
    vi.mocked(loadFitData).mockClear();
    expect(await syncList()).toEqual(cold);
    expect(loadFitData).not.toHaveBeenCalled();
  });

  it("keeps its tags as time passes", async () => {
    const before = await syncList();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-01-01T00:00:00Z"));
    expect(await syncList()).toEqual(before);
  });

  describe("when stored data changes", () => {
    const changed = (before: { path: string; etag: string }[], after: { path: string; etag: string }[]): string[] => {
      const old = new Map(before.map((r) => [r.path, r.etag]));
      return after.filter((r) => old.get(r.path) !== r.etag).map((r) => r.path);
    };

    it("a new wallet balance moves the balance and the Overview, not the 500-row lists", async () => {
      const before = await syncList();
      await pool.query("UPDATE character_wallet SET balance = balance + 1000 WHERE character_id = $1", [MAIN]);
      expect(changed(before, await syncList())).toEqual(["/api/v1/overview", `/api/v1/characters/${MAIN}/wallet`]);
    });

    it("a sync run that writes the same rows again moves nothing", async () => {
      const before = await syncList();
      vi.mocked(loadFitData).mockClear();
      await pool.query("UPDATE character_wallet SET updated_at = now() + interval '1 hour'");
      await pool.query("UPDATE character_skill_summary SET updated_at = now() + interval '1 hour'");
      await pool.query("UPDATE market_prices SET updated_at = now() + interval '1 hour'");
      await pool.query("UPDATE universe_names SET updated_at = now() + interval '1 hour'");
      expect(await syncList()).toEqual(before);
      expect(loadFitData).not.toHaveBeenCalled();
    });

    it("a price change moves the ships it values and nothing else", async () => {
      const before = await syncList();
      await pool.query("UPDATE market_prices SET jita_sell_min = jita_sell_min * 2 WHERE type_id = 2889");   // the Rifter's autocannon
      expect(changed(before, await syncList())).toEqual([
        `/api/v1/characters/${MAIN}/ships`, `/api/v1/characters/${MAIN}/ships/asset/1040000000050`, `/api/v1/characters/${MAIN}/ships/fit/7002`,
      ]);
    });

    it("a trained level moves that character's skills, the lists that show SP, and their fits", async () => {
      const before = await syncList();
      await pool.query("UPDATE character_skills SET trained_level = 5, active_level = 5 WHERE character_id = $1 AND skill_id = 3442", [MAIN]);
      const moved = changed(before, await syncList());
      expect(moved).toContain(`/api/v1/characters/${MAIN}/skills`);
      expect(moved).toContain(`/api/v1/characters/${MAIN}/ships/asset/${TRISTAN_ITEM}`);
      expect(moved.some((path) => path.includes(`/${ALT}/`))).toBe(false);
    });

    it("a tag edited on the site moves the Overview", async () => {
      const before = await syncList();
      await pool.query("DELETE FROM character_tag_map WHERE character_id = $1", [ALT]);
      expect(changed(before, await syncList())).toEqual(["/api/v1/overview"]);
    });

    it("a sold ship leaves the list, and a new saved fit joins it", async () => {
      await pool.query("DELETE FROM character_assets WHERE character_id = $1 AND (item_id = 1040000000050 OR location_id = 1040000000050)", [MAIN]);
      await pool.query("INSERT INTO character_fittings (character_id, fitting_id, name, ship_type_id) VALUES ($1, 7003, 'Bare Tristan', 593)", [MAIN]);
      const paths = (await syncList()).map((r) => r.path);
      expect(paths).not.toContain(`/api/v1/characters/${MAIN}/ships/asset/1040000000050`);
      expect(paths).toContain(`/api/v1/characters/${MAIN}/ships/fit/7003`);
      expect((await get(`/api/v1/characters/${MAIN}/ships/fit/7003`)).status).toBe(200);
    });

    it("still lists the very ETag each GET returns after all of that", async () => {
      for (const { path, etag } of await syncList()) expect((await get(path)).headers.get("etag"), path).toBe(etag);
    });
  });
});
