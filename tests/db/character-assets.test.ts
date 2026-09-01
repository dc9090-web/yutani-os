import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { upsertCharacter } from "../../src/lib/db/characters.js";
import { replaceAssets, listAssets, type AssetRow } from "../../src/lib/db/character-assets.js";

const CID = 669539978;
beforeEach(async () => {
  await resetDb();
  await upsertCharacter({ id: CID, name: "TrilliumONE", refreshTokenEnc: "enc", scopes: [] });
});
afterAll(closePool);

const ship: AssetRow = { itemId: 1023456789012, typeId: 587, quantity: 1, locationId: 60003760, locationType: "station", locationFlag: "Hangar", isSingleton: true, isBlueprintCopy: false, name: "Fast Tackle" };
const module_: AssetRow = { itemId: 1023456789014, typeId: 2048, quantity: 1, locationId: 1023456789012, locationType: "item", locationFlag: "LoSlot0", isSingleton: true, isBlueprintCopy: false, name: "Damage Control II" };
const stack: AssetRow = { itemId: 1023456789013, typeId: 34, quantity: 129837, locationId: 60003760, locationType: "station", locationFlag: "Hangar", isSingleton: false, isBlueprintCopy: false, name: null };

describe("character-assets repo", () => {
  it("writes assets and reads them back with bigints as numbers", async () => {
    expect(await replaceAssets(CID, [ship, module_, stack])).toBe(3);
    const rows = await listAssets(CID);
    expect(rows.map((r) => r.itemId)).toEqual([1023456789012, 1023456789013, 1023456789014]);
    expect(rows[0].quantity).toBe(1);
    expect(rows[1].quantity).toBe(129837);
    expect(rows[2].locationId).toBe(1023456789012);
    expect(rows[2].locationType).toBe("item");
    expect(rows[1].name).toBeNull();
  });
  it("replaces wholesale: stale rows disappear", async () => {
    await replaceAssets(CID, [ship, module_, stack]);
    expect(await replaceAssets(CID, [ship])).toBe(1);
    expect((await listAssets(CID)).map((r) => r.itemId)).toEqual([1023456789012]);
  });
  it("clears everything when the character owns nothing", async () => {
    await replaceAssets(CID, [ship]);
    expect(await replaceAssets(CID, [])).toBe(0);
    expect(await listAssets(CID)).toEqual([]);
  });
  it("writes more rows than one insert batch", async () => {
    const many: AssetRow[] = Array.from({ length: 4500 }, (_, i) => ({ ...stack, itemId: 2000000000000 + i }));
    expect(await replaceAssets(CID, many)).toBe(4500);
    expect((await listAssets(CID)).length).toBe(4500);
  });
});
