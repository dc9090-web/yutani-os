import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { closePool, getPool } from "../../src/lib/db/client.js";
import { getNames, getName, putNames, getStructures, getStructure, putStructure } from "../../src/lib/db/names.js";

beforeEach(async () => { await resetDb(); });
afterAll(closePool);

describe("names repo", () => {
  it("upserts names and reads them back by id", async () => {
    expect(await putNames([
      { id: 669539978, category: "character", name: "TrilliumONE" },
      { id: 34, category: "inventory_type", name: "Tritanium" },
    ])).toBe(2);
    const rows = await getNames([669539978, 34, 999]);
    expect(rows.map((r) => r.id).sort((a, b) => a - b)).toEqual([34, 669539978]);
    expect((await getName(34))!.name).toBe("Tritanium");
    expect(await getName(999)).toBeNull();
  });
  it("stores an unresolvable id as category 'unknown' with a null name", async () => {
    await putNames([{ id: 12345, category: "unknown", name: null }]);
    const row = (await getName(12345))!;
    expect(row.category).toBe("unknown");
    expect(row.name).toBeNull();
  });
  it("re-upserting refreshes the name, the category and updated_at", async () => {
    await putNames([{ id: 98000001, category: "unknown", name: null }]);
    await getPool().query("UPDATE universe_names SET updated_at = now() - interval '40 days' WHERE id = 98000001");
    const before = (await getName(98000001))!.updatedAt.getTime();
    await putNames([{ id: 98000001, category: "corporation", name: "Real Corp" }]);
    const after = (await getName(98000001))!;
    expect(after.category).toBe("corporation");
    expect(after.name).toBe("Real Corp");
    expect(after.updatedAt.getTime()).toBeGreaterThan(before);
  });
  it("returns an empty array rather than querying for no ids", async () => {
    expect(await getNames([])).toEqual([]);
    expect(await getStructures([])).toEqual([]);
    expect(await putNames([])).toBe(0);
  });
  it("collapses duplicate ids within one putNames call instead of throwing", async () => {
    const count = await putNames([
      { id: 1, category: "character", name: "A" },
      { id: 1, category: "character", name: "B" },
    ]);
    expect(count).toBe(1);
    expect((await getName(1))!.name).toBe("B");
  });
  it("stores a resolved structure and a forbidden one", async () => {
    await putStructure({ id: 1035466617946, name: "Perimeter - Tranquility Trading Tower", solarSystemId: 30000144, typeId: 35834, ownerId: 98599770, forbidden: false });
    await putStructure({ id: 1040000000001, name: null, solarSystemId: null, typeId: null, ownerId: null, forbidden: true });
    const rows = await getStructures([1035466617946, 1040000000001]);
    expect(rows).toHaveLength(2);
    const ok = (await getStructure(1035466617946))!;
    expect(ok.name).toBe("Perimeter - Tranquility Trading Tower");
    expect(ok.solarSystemId).toBe(30000144);
    expect(ok.forbidden).toBe(false);
    const denied = (await getStructure(1040000000001))!;
    expect(denied.forbidden).toBe(true);
    expect(denied.name).toBeNull();
    expect(await getStructure(7)).toBeNull();
  });
});
