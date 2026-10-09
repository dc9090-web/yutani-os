import { describe, it, expect, vi } from "vitest";
import { createAssetsJob, assetsJob, ASSETS_INTERVAL_MS, ASSETS_RETRY_MS, ASSET_NAMES_CHUNK, type AssetsJobDeps } from "../../src/worker/jobs/assets.js";
import { customAssetName, type AssetRow } from "../../src/lib/db/character-assets.js";
import { EsiError, EsiUnavailableError } from "../../src/lib/esi/client.js";
import { NeedsReauthError } from "../../src/lib/esi/tokens.js";
import { esiFixture } from "../fixtures/esi.js";

const CID = 669539978;
type RawAsset = { item_id: number; type_id: number; quantity: number; location_id: number; location_type: string; location_flag: string; is_singleton: boolean; is_blueprint_copy?: boolean };

function harness(scopes: string[] = ["esi-assets.read_assets.v1"], assets = esiFixture<RawAsset[]>("assets"), over: Partial<AssetsJobDeps> = {}) {
  const writes: AssetRow[][] = [];
  const resolved: { ids: number[]; characterId: number }[] = [];
  const posts: { path: string; body: number[] }[] = [];
  const getAllPaths: string[] = [];
  const getTypesCalls: number[][] = [];
  const deps: AssetsJobDeps = {
    getCharacter: async () => ({ scopes }),
    replaceAssets: async (_id, rows) => { writes.push(rows); return rows.length; },
    resolveLocations: async (ids, characterId) => { resolved.push({ ids, characterId }); return new Map(); },
    getTypes: async (ids) => { getTypesCalls.push(ids); return new Map(); },
    ...over,
  };
  const esi = {
    getAll: vi.fn(async (path: string) => { getAllPaths.push(path); return assets; }),
    post: vi.fn(async (path: string, body: unknown) => {
      posts.push({ path, body: body as number[] });
      const names = esiFixture<{ item_id: number; name: string }[]>("assets-names");
      return names.filter((n) => (body as number[]).includes(n.item_id));
    }),
  };
  return { job: createAssetsJob(deps), esi, writes, resolved, posts, getAllPaths, getTypesCalls };
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
  it("resolves an item-typed orphan root (structure-docked hangar) but not a genuinely nested item's parent", async () => {
    const STRUCTURE = 1035466617946;               // not an item_id in this fixture: an orphan root
    const assets: RawAsset[] = [
      { item_id: 1023456789012, type_id: 587, quantity: 1, location_id: STRUCTURE, location_type: "item", location_flag: "Hangar", is_singleton: false },
      { item_id: 1023456789014, type_id: 2048, quantity: 1, location_id: 1023456789012, location_type: "item", location_flag: "LoSlot0", is_singleton: false },
    ];
    const h = harness(["esi-assets.read_assets.v1"], assets);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.resolved).toHaveLength(1);
    const ids = h.resolved[0].ids;
    expect(ids).toContain(STRUCTURE);
    expect(ids).not.toContain(1023456789012);      // a real item id: its child stays nested, not a root
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
  it("nulls a singleton's name when it just echoes the type name back", async () => {
    // Fixture: item 1023456789012 (type 587) is named "Fast Tackle" by /assets/names.
    const h = harness(["esi-assets.read_assets.v1"], undefined, {
      getTypes: async () => new Map([[587, { name: "Fast Tackle" }]]),
    });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0].find((r) => r.itemId === 1023456789012)!.name).toBeNull();
  });
  it("nulls the \"None\" and empty names ESI gives unrenamed singletons, and trims a real one", async () => {
    const h = harness(["esi-assets.read_assets.v1"], undefined, {
      getTypes: async () => new Map([[587, { name: "Rifter" }]]),
    });
    h.esi.post = vi.fn(async () => [
      { item_id: 1023456789012, name: "None" }, { item_id: 1023456789014, name: "" }, { item_id: 1023456789015, name: " Old Faithful " },
    ]) as never;
    await h.job.run({ characterId: CID, esi: h.esi as never });
    const byId = new Map(h.writes[0].map((r) => [r.itemId, r.name]));
    expect(byId.get(1023456789012)).toBeNull();
    expect(byId.get(1023456789014)).toBeNull();
    expect(byId.get(1023456789015)).toBe("Old Faithful");
  });
  it("keeps a singleton's name when it differs from the type name", async () => {
    const h = harness(["esi-assets.read_assets.v1"], undefined, {
      getTypes: async () => new Map([[587, { name: "Rifter" }]]),
    });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0].find((r) => r.itemId === 1023456789012)!.name).toBe("Fast Tackle");
  });
  it("does not call getTypes when nothing is a singleton", async () => {
    const h = harness(["esi-assets.read_assets.v1"], [{
      item_id: 1, type_id: 34, quantity: 5, location_id: 60003760,
      location_type: "station", location_flag: "Hangar", is_singleton: false,
    }]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.getTypesCalls).toEqual([]);
  });
  it("does not fail the run when resolveLocations throws a non-outage error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = harness(["esi-assets.read_assets.v1"], undefined, {
      resolveLocations: async () => { throw new Error("boom"); },
    });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).resolves.toBe(6);
    expect(warn).toHaveBeenCalledWith(`[assets] location resolution failed for ${CID}: boom`);
    warn.mockRestore();
  });
  it("still rejects when resolveLocations throws an EsiUnavailableError", async () => {
    const h = harness(["esi-assets.read_assets.v1"], undefined, {
      resolveLocations: async () => { throw new EsiUnavailableError("/universe/structures/1", Date.now() + 60_000); },
    });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(EsiUnavailableError);
  });
  it("still rejects when resolveLocations throws a NeedsReauthError", async () => {
    const h = harness(["esi-assets.read_assets.v1"], undefined, {
      resolveLocations: async () => { throw new NeedsReauthError(CID); },
    });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(NeedsReauthError);
  });
  it("still rejects when resolveLocations throws an EsiError(401)", async () => {
    const h = harness(["esi-assets.read_assets.v1"], undefined, {
      resolveLocations: async () => { throw new EsiError(401, "/universe/structures/1", "token rejected"); },
    });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toMatchObject({ status: 401 });
  });
});

describe("customAssetName", () => {
  it("keeps only a name that is not a placeholder", () => {
    expect(customAssetName("Fast Tackle", "Rifter")).toBe("Fast Tackle");
    expect(customAssetName("Rifter", "Rifter")).toBeNull();
    expect(customAssetName("None", "Rifter")).toBeNull();
    expect(customAssetName("", "Rifter")).toBeNull();
    expect(customAssetName("   ", null)).toBeNull();
    expect(customAssetName(null)).toBeNull();
    expect(customAssetName(undefined)).toBeNull();
    // On read the type name is not to hand; the two placeholders still go.
    expect(customAssetName("None")).toBeNull();
    expect(customAssetName("Loki - Mara")).toBe("Loki - Mara");
  });
});
