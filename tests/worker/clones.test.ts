import { describe, it, expect, vi } from "vitest";
import { createClonesJob, clonesJob, CLONES_INTERVAL_MS, CLONES_RETRY_MS, type ClonesJobDeps } from "../../src/worker/jobs/clones.js";
import type { ClonesWrite } from "../../src/lib/db/character-clones.js";
import { esiFixture } from "../fixtures/esi.js";
import { EsiError, EsiUnavailableError } from "../../src/lib/esi/client.js";
import { NeedsReauthError } from "../../src/lib/esi/tokens.js";

const CID = 669539978;
const ALL = ["esi-clones.read_clones.v1", "esi-clones.read_implants.v1"];

function harness(scopes: string[] = ALL, over: Partial<ClonesJobDeps> = {}) {
  const writes: ClonesWrite[] = [];
  const paths: string[] = [];
  const resolved: { ids: number[]; characterId: number }[] = [];
  const deps: ClonesJobDeps = {
    getCharacter: async () => ({ scopes }),
    replaceClones: async (_id, w) => { writes.push(w); return 8; },
    resolveLocations: async (ids, characterId) => { resolved.push({ ids, characterId }); return new Map(); },
    ...over,
  };
  const esi = {
    get: vi.fn(async (path: string) => {
      paths.push(path);
      if (path.endsWith("/clones")) return { data: esiFixture("clones") };
      if (path.endsWith("/implants")) return { data: esiFixture("implants") };
      throw new Error(`unexpected ${path}`);
    }),
  };
  return { job: createClonesJob(deps), esi, writes, paths, resolved };
}

describe("clones job", () => {
  it("is a 6-hourly character job that retries in 15 minutes", () => {
    expect(clonesJob.name).toBe("clones");
    expect(clonesJob.intervalMs).toBe(CLONES_INTERVAL_MS);
    expect(CLONES_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
    expect(clonesJob.retryMs).toBe(CLONES_RETRY_MS);
    expect(CLONES_RETRY_MS).toBe(15 * 60 * 1000);
  });
  it("maps the home clone, jump clones and the active clone's implants", async () => {
    const h = harness();
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(8);
    expect(h.paths).toEqual([`/characters/${CID}/clones`, `/characters/${CID}/implants`]);
    const w = h.writes[0];
    expect(w.clones).toMatchObject({
      homeLocationId: 60003760, homeLocationType: "station",
      lastCloneJumpDate: new Date("2026-08-20T21:04:11Z"),
      lastStationChangeDate: new Date("2026-08-28T07:45:02Z"),
    });
    expect(w.clones!.jumpClones).toEqual([
      { jumpCloneId: 1001, locationId: 60008494, locationType: "station", name: "Amarr medical", implants: [9899, 9941, 9942] },
      { jumpCloneId: 1002, locationId: 1035466617946, locationType: "structure", name: null, implants: [] },
    ]);
    expect(w.implants).toEqual([9899, 9941, 9942, 9943, 9954]);
  });
  it("survives a fully absent home_location and empty dates", async () => {
    const h = harness();
    h.esi.get = vi.fn(async (path: string) =>
      path.endsWith("/clones") ? { data: { jump_clones: [] } } : { data: [] });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0].clones).toEqual({
      homeLocationId: null, homeLocationType: null, lastCloneJumpDate: null,
      lastStationChangeDate: null, jumpClones: [],
    });
  });
  it("skips /implants when its scope is missing", async () => {
    const h = harness(["esi-clones.read_clones.v1"]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.paths).toEqual([`/characters/${CID}/clones`]);
    expect(h.writes[0].implants).toBeNull();
  });
  it("skips /clones when its scope is missing", async () => {
    const h = harness(["esi-clones.read_implants.v1"]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.paths).toEqual([`/characters/${CID}/implants`]);
    expect(h.writes[0].clones).toBeNull();
  });
  it("returns 0 without calling ESI when neither scope is granted", async () => {
    const h = harness([]);
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(0);
    expect(h.paths).toEqual([]);
  });
  it("lets an ESI outage propagate so the scheduler records it", async () => {
    const h = harness();
    h.esi.get = vi.fn(async () => { throw new EsiUnavailableError("/characters/1/clones", Date.now() + 60_000); });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(EsiUnavailableError);
    expect(h.writes).toEqual([]);
  });
  it("resolves the home station and every jump-clone location so the page can label them", async () => {
    const h = harness();
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.resolved).toEqual([{ ids: [60003760, 60008494, 1035466617946], characterId: CID }]);
  });
  it("asks for nothing when there are no clone locations", async () => {
    const h = harness();
    h.esi.get = vi.fn(async (path: string) =>
      path.endsWith("/clones") ? { data: { jump_clones: [] } } : { data: [] });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.resolved).toEqual([]);
  });
  it("asks for nothing when the clones scope is missing", async () => {
    const h = harness(["esi-clones.read_implants.v1"]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.resolved).toEqual([]);
  });
  it("does not fail the run when resolveLocations throws a non-outage error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = harness(ALL, { resolveLocations: async () => { throw new Error("boom"); } });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).resolves.toBe(8);
    expect(warn).toHaveBeenCalledWith(`[clones] location resolution failed for ${CID}: boom`);
    warn.mockRestore();
  });
  it("still rejects when resolveLocations throws an EsiUnavailableError", async () => {
    const h = harness(ALL, { resolveLocations: async () => { throw new EsiUnavailableError("/universe/structures/1", Date.now() + 60_000); } });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(EsiUnavailableError);
  });
  it("still rejects when resolveLocations throws a NeedsReauthError", async () => {
    const h = harness(ALL, { resolveLocations: async () => { throw new NeedsReauthError(CID); } });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(NeedsReauthError);
  });
  it("still rejects when resolveLocations throws an EsiError(401)", async () => {
    const h = harness(ALL, { resolveLocations: async () => { throw new EsiError(401, "/universe/structures/1", "token rejected"); } });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toMatchObject({ status: 401 });
  });
});
