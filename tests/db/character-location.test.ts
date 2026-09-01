import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { upsertCharacter } from "../../src/lib/db/characters.js";
import { upsertLocation, getLocation, type LocationInput } from "../../src/lib/db/character-location.js";

const CID = 669539978;
beforeEach(async () => {
  await resetDb();
  await upsertCharacter({ id: CID, name: "TrilliumONE", refreshTokenEnc: "enc", scopes: [] });
});
afterAll(closePool);

const inSpace: LocationInput = {
  solarSystemId: 30000142, stationId: null, structureId: null,
  shipItemId: 1023456789012, shipTypeId: 587, shipName: "Fast Tackle",
  online: true, lastLogin: new Date("2026-09-01T08:12:44Z"), lastLogout: new Date("2026-08-31T23:58:01Z"),
};

describe("character-location repo", () => {
  it("upserts and reads back a character in space", async () => {
    expect(await upsertLocation(CID, inSpace)).toBe(1);
    const row = (await getLocation(CID))!;
    expect(row).toMatchObject({ characterId: CID, solarSystemId: 30000142, shipTypeId: 587, shipName: "Fast Tackle", online: true });
    expect(row.stationId).toBeNull();
    expect(row.structureId).toBeNull();
    expect(row.shipItemId).toBe(1023456789012);
  });
  it("overwrites on the next tick, including docking in a structure", async () => {
    await upsertLocation(CID, inSpace);
    await upsertLocation(CID, { ...inSpace, structureId: 1035466617946, online: null, lastLogin: null, lastLogout: null });
    const row = (await getLocation(CID))!;
    expect(row.structureId).toBe(1035466617946);
    expect(row.online).toBeNull();
    expect(row.lastLogin).toBeNull();
  });
  it("returns null for a character that has never synced", async () => {
    expect(await getLocation(CID)).toBeNull();
  });
});
