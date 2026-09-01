import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { upsertCharacter } from "../../src/lib/db/characters.js";
import { replaceFittings, listFittings, type FittingRow } from "../../src/lib/db/character-fittings.js";

const CID = 669539978;
beforeEach(async () => {
  await resetDb();
  await upsertCharacter({ id: CID, name: "TrilliumONE", refreshTokenEnc: "enc", scopes: [] });
});
afterAll(closePool);

const fittings: FittingRow[] = [
  { fittingId: 4021, name: "Rifter — cheap tackle", description: "", shipTypeId: 587, items: [
    { idx: 0, typeId: 484, quantity: 1, flag: "HiSlot0" },
    { idx: 1, typeId: 12608, quantity: 400, flag: "Cargo" },
    { idx: 2, typeId: 27339, quantity: 1, flag: "Invalid" },
  ] },
  { fittingId: 4022, name: "Vexor — ratting", description: "Drone boat for anomalies.", shipTypeId: 626, items: [
    { idx: 0, typeId: 2456, quantity: 5, flag: "DroneBay" },
  ] },
];

describe("character-fittings repo", () => {
  it("writes fittings with their items in file order, including an Invalid flag", async () => {
    expect(await replaceFittings(CID, fittings)).toBe(6);      // 2 fittings + 4 items
    const rows = await listFittings(CID);
    expect(rows.map((f) => f.fittingId)).toEqual([4021, 4022]);
    expect(rows[0].description).toBe("");
    expect(rows[0].items.map((i) => i.flag)).toEqual(["HiSlot0", "Cargo", "Invalid"]);
    expect(rows[0].items[1].quantity).toBe(400);
    expect(rows[1].items).toHaveLength(1);
  });
  it("replaces wholesale, dropping items of deleted fittings", async () => {
    await replaceFittings(CID, fittings);
    expect(await replaceFittings(CID, [fittings[1]])).toBe(2);
    const rows = await listFittings(CID);
    expect(rows.map((f) => f.fittingId)).toEqual([4022]);
    expect(rows[0].items).toHaveLength(1);
  });
  it("returns an empty list for a character with no fittings", async () => {
    expect(await listFittings(CID)).toEqual([]);
  });
});
