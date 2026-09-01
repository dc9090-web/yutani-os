import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { upsertCharacter } from "../../src/lib/db/characters.js";
import { replaceClones, getClones, listImplants, type ClonesWrite } from "../../src/lib/db/character-clones.js";

const CID = 669539978;
beforeEach(async () => {
  await resetDb();
  await upsertCharacter({ id: CID, name: "TrilliumONE", refreshTokenEnc: "enc", scopes: [] });
});
afterAll(closePool);

const write: ClonesWrite = {
  clones: {
    homeLocationId: 60003760, homeLocationType: "station",
    lastCloneJumpDate: new Date("2026-08-20T21:04:11Z"), lastStationChangeDate: new Date("2026-08-28T07:45:02Z"),
    jumpClones: [
      { jumpCloneId: 1001, locationId: 60008494, locationType: "station", name: "Amarr medical", implants: [9899, 9941, 9942] },
      { jumpCloneId: 1002, locationId: 1035466617946, locationType: "structure", name: null, implants: [] },
    ],
  },
  implants: [9899, 9941, 9942, 9943, 9954],
};

describe("character-clones repo", () => {
  it("writes the home clone, jump clones and active implants", async () => {
    expect(await replaceClones(CID, write)).toBe(8);            // 1 home + 2 jump clones + 5 implants
    const state = (await getClones(CID))!;
    expect(state.homeLocationId).toBe(60003760);
    expect(state.homeLocationType).toBe("station");
    expect(state.jumpClones.map((c) => c.jumpCloneId)).toEqual([1001, 1002]);
    expect(state.jumpClones[1].implants).toEqual([]);
    expect(state.jumpClones[1].name).toBeNull();
    expect(state.jumpClones[1].locationId).toBe(1035466617946);
    expect(await listImplants(CID)).toEqual([9899, 9941, 9942, 9943, 9954]);
  });
  it("tolerates a fully absent home_location", async () => {
    await replaceClones(CID, { clones: { homeLocationId: null, homeLocationType: null, lastCloneJumpDate: null, lastStationChangeDate: null, jumpClones: [] }, implants: [] });
    const state = (await getClones(CID))!;
    expect(state.homeLocationId).toBeNull();
    expect(state.jumpClones).toEqual([]);
  });
  it("replaces wholesale and leaves an unsynced section alone", async () => {
    await replaceClones(CID, write);
    await replaceClones(CID, { clones: { ...write.clones!, jumpClones: [] }, implants: null });
    expect((await getClones(CID))!.jumpClones).toEqual([]);
    expect(await listImplants(CID)).toEqual([9899, 9941, 9942, 9943, 9954]);
  });
  it("returns null / empty for a character that has never synced", async () => {
    expect(await getClones(CID)).toBeNull();
    expect(await listImplants(CID)).toEqual([]);
  });
});
