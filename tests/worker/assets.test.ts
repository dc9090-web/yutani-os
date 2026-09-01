import { describe, it, expect, vi } from "vitest";
import { createAssetsJob, assetsJob, ASSETS_INTERVAL_MS, ASSETS_RETRY_MS, ASSET_NAMES_CHUNK, type AssetsJobDeps } from "../../src/worker/jobs/assets.js";
import type { AssetRow } from "../../src/lib/db/character-assets.js";
import { EsiUnavailableError } from "../../src/lib/esi/client.js";
import { esiFixture } from "../fixtures/esi.js";

const CID = 669539978;
type RawAsset = { item_id: number; type_id: number; quantity: number; location_id: number; location_type: string; location_flag: string; is_singleton: boolean; is_blueprint_copy?: boolean };

function harness(scopes: string[] = ["esi-assets.read_assets.v1"], assets = esiFixture<RawAsset[]>("assets")) {
  const writes: AssetRow[][] = [];
  const resolved: { ids: number[]; characterId: number }[] = [];
  const posts: { path: string; body: number[] }[] = [];
  const getAllPaths: string[] = [];
  const deps: AssetsJobDeps = {
    getCharacter: async () => ({ scopes }),
    replaceAssets: async (_id, rows) => { writes.push(rows); return rows.length; },
    resolveLocations: async (ids, characterId) => { resolved.push({ ids, characterId }); return new Map(); },
  };
  const esi = {
    getAll: vi.fn(async (path: string) => { getAllPaths.push(path); return assets; }),
    post: vi.fn(async (path: string, body: unknown) => {
      posts.push({ path, body: body as number[] });
      const names = esiFixture<{ item_id: number; name: string }[]>("assets-names");
      return names.filter((n) => (body as number[]).includes(n.item_id));
    }),
  };
  return { job: createAssetsJob(deps), esi, writes, resolved, posts, getAllPaths };
}

describe("assets job", () => {
  it("is an hourly character job that retries in 10 minutes", () => {
    expect(assetsJob.name).toBe("assets");
    expect(assetsJob.intervalMs).toBe(ASSETS_INTERVAL_MS);
    expect(ASSETS_INTERVAL_MS).toBe(60 * 60 * 1000);
    expect(assetsJob.retryMs).toBe(ASSETS_RETRY_MS);
    expect(ASSETS_RETRY_MS).toBe(10 * 60 * 1000);
    expect(ASSET_NAMES_CHUNK).toBe(1000);
  });
  it("walks every page, names the singletons and returns the rows written", async () => {
    const h = harness();
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(6);
    expect(h.getAllPaths).toEqual([`/characters/${CID}/assets`]);
    expect(h.posts).toHaveLength(1);
    expect(h.posts[0].path).toBe(`/characters/${CID}/assets/names`);
    // Only is_singleton items are worth naming — a stack of Tritanium just returns the type name.
    expect(h.posts[0].body).toEqual([1023456789012, 1023456789014, 1023456789015, 1023456789016, 1023456789017]);
    const rows = h.writes[0];
    expect(rows.find((r) => r.itemId === 1023456789012)!.name).toBe("Fast Tackle");
    expect(rows.find((r) => r.itemId === 1023456789013)!.name).toBeNull();
  });
  it("treats an absent is_blueprint_copy as false and keeps the raw location fields", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    const rows = h.writes[0];
    expect(rows.filter((r) => r.isBlueprintCopy).map((r) => r.itemId)).toEqual([1023456789016]);
    expect(rows.find((r) => r.itemId === 1023456789014)).toMatchObject({
      locationId: 1023456789012, locationType: "item", locationFlag: "LoSlot0", isSingleton: true, isBlueprintCopy: false,
    });
    expect(rows.find((r) => r.itemId === 1023456789017)!.locationType).toBe("solar_system");
  });
  it("resolves the distinct root locations after writing", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.resolved).toHaveLength(1);
    expect(h.resolved[0].characterId).toBe(CID);
    expect([...h.resolved[0].ids].sort((a, b) => a - b)).toEqual([30000142, 60003760, 1035466617946]);
  });
  it("chunks the names POST to 1000 unique ids", async () => {
    const many: RawAsset[] = Array.from({ length: 2500 }, (_, i) => ({
      item_id: 2_000_000_000_000 + i, type_id: 587, quantity: 1, location_id: 60003760,
      location_type: "station", location_flag: "Hangar", is_singleton: true,
    }));
    const h = harness(["esi-assets.read_assets.v1"], many);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.posts.map((p) => p.body.length)).toEqual([1000, 1000, 500]);
    expect(new Set(h.posts.flatMap((p) => p.body)).size).toBe(2500);
  });
  it("skips the names POST when nothing is a singleton", async () => {
    const h = harness(["esi-assets.read_assets.v1"], [{
      item_id: 1, type_id: 34, quantity: 5, location_id: 60003760,
      location_type: "station", location_flag: "Hangar", is_singleton: false,
    }]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.posts).toEqual([]);
    expect(h.writes[0][0].name).toBeNull();
  });
  it("returns 0 without calling ESI when the scope is missing", async () => {
    const h = harness([]);
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(0);
    expect(h.getAllPaths).toEqual([]);
    expect(h.resolved).toEqual([]);
  });
  it("lets an ESI outage propagate without writing or resolving anything", async () => {
    const h = harness();
    h.esi.getAll = vi.fn(async () => { throw new EsiUnavailableError("/characters/1/assets", Date.now() + 60_000); });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(EsiUnavailableError);
    expect(h.writes).toEqual([]);
    expect(h.resolved).toEqual([]);
  });
});
