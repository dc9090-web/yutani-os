import { describe, it, expect, vi } from "vitest";
import { createLocationJob, locationJob, LOCATION_INTERVAL_MS, LOCATION_RETRY_MS, type LocationJobDeps } from "../../src/worker/jobs/location.js";
import type { LocationInput } from "../../src/lib/db/character-location.js";
import { EsiUnavailableError } from "../../src/lib/esi/client.js";
import { esiFixture } from "../fixtures/esi.js";

const CID = 669539978;
const ALL = ["esi-location.read_location.v1", "esi-location.read_ship_type.v1", "esi-location.read_online.v1"];

function harness(scopes: string[] = ALL, location: unknown = esiFixture("location"), over: Partial<LocationJobDeps> = {}) {
  const writes: LocationInput[] = [];
  const resolved: { ids: number[]; characterId: number }[] = [];
  const paths: string[] = [];
  const deps: LocationJobDeps = {
    getCharacter: async () => ({ scopes }),
    upsertLocation: async (_id, loc) => { writes.push(loc); return 1; },
    resolveLocations: async (ids, characterId) => { resolved.push({ ids, characterId }); return new Map(); },
    ...over,
  };
  const esi = {
    get: vi.fn(async (path: string) => {
      paths.push(path);
      if (path.endsWith("/location")) return { data: location };
      if (path.endsWith("/ship")) return { data: esiFixture("ship") };
      if (path.endsWith("/online")) return { data: esiFixture("online") };
      throw new Error(`unexpected ${path}`);
    }),
  };
  return { job: createLocationJob(deps), esi, writes, resolved, paths };
}

describe("location job", () => {
  it("is a 15-minute character job that retries in 5 minutes", () => {
    expect(locationJob.name).toBe("location");
    expect(locationJob.intervalMs).toBe(LOCATION_INTERVAL_MS);
    expect(LOCATION_INTERVAL_MS).toBe(15 * 60 * 1000);
    expect(locationJob.retryMs).toBe(LOCATION_RETRY_MS);
    expect(LOCATION_RETRY_MS).toBe(5 * 60 * 1000);
  });
  it("upserts a character in space with neither station nor structure", async () => {
    const h = harness();
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(1);
    expect(h.paths).toEqual([`/characters/${CID}/location`, `/characters/${CID}/ship`, `/characters/${CID}/online`]);
    expect(h.writes[0]).toEqual({
      solarSystemId: 30000142, stationId: null, structureId: null,
      shipItemId: 1023456789012, shipTypeId: 587, shipName: "Fast Tackle",
      online: true, lastLogin: new Date("2026-09-01T08:12:44Z"), lastLogout: new Date("2026-08-31T23:58:01Z"),
    });
    expect(h.resolved).toEqual([]);                       // nothing docked, nothing to name
  });
  it("resolves the docked structure so the Overview can label it", async () => {
    const h = harness(ALL, { solar_system_id: 30000144, structure_id: 1035466617946 });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0].structureId).toBe(1035466617946);
    expect(h.resolved).toEqual([{ ids: [1035466617946], characterId: CID }]);
  });
  it("resolves a docked NPC station too", async () => {
    const h = harness(ALL, { solar_system_id: 30000142, station_id: 60003760 });
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.writes[0].stationId).toBe(60003760);
    expect(h.resolved).toEqual([{ ids: [60003760], characterId: CID }]);
  });
  it("stores null for /online when the scope is missing but still syncs the rest", async () => {
    const h = harness(["esi-location.read_location.v1", "esi-location.read_ship_type.v1"]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.paths).toEqual([`/characters/${CID}/location`, `/characters/${CID}/ship`]);
    expect(h.writes[0]).toMatchObject({ online: null, lastLogin: null, lastLogout: null, shipTypeId: 587 });
  });
  it("stores null for the ship when its scope is missing", async () => {
    const h = harness(["esi-location.read_location.v1"]);
    await h.job.run({ characterId: CID, esi: h.esi as never });
    expect(h.paths).toEqual([`/characters/${CID}/location`]);
    expect(h.writes[0]).toMatchObject({ shipItemId: null, shipTypeId: null, shipName: null, solarSystemId: 30000142 });
  });
  it("returns 0 without calling ESI when no location scope is granted", async () => {
    const h = harness([]);
    expect(await h.job.run({ characterId: CID, esi: h.esi as never })).toBe(0);
    expect(h.paths).toEqual([]);
    expect(h.writes).toEqual([]);
  });
  it("lets an ESI outage propagate so the scheduler records it", async () => {
    const h = harness();
    h.esi.get = vi.fn(async () => { throw new EsiUnavailableError("/characters/1/location", Date.now() + 60_000); });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(EsiUnavailableError);
    expect(h.writes).toEqual([]);
  });
  it("does not fail the run when resolveLocations throws a non-outage error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = harness(ALL, { solar_system_id: 30000144, structure_id: 1035466617946 }, {
      resolveLocations: async () => { throw new Error("boom"); },
    });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).resolves.toBe(1);
    expect(warn).toHaveBeenCalledWith(`[location] location resolution failed for ${CID}: boom`);
    warn.mockRestore();
  });
  it("still rejects when resolveLocations throws an EsiUnavailableError", async () => {
    const h = harness(ALL, { solar_system_id: 30000144, structure_id: 1035466617946 }, {
      resolveLocations: async () => { throw new EsiUnavailableError("/universe/structures/1", Date.now() + 60_000); },
    });
    await expect(h.job.run({ characterId: CID, esi: h.esi as never })).rejects.toBeInstanceOf(EsiUnavailableError);
  });
});
