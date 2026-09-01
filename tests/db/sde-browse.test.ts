import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { browseTypes, listMarketGroups, getMetaGroups, getTypesByNames } from "../../src/lib/sde/repo.js";

let pool: Pool;

beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });

beforeEach(async () => { await resetSde(pool); });

describe("browseTypes", () => {
  beforeEach(async () => {
    await pool.query("INSERT INTO sde_groups (id, category_id, name, published) VALUES (55, 7, 'Projectile Weapon', true), (100, 18, 'Light Scout Drone', true)");
    await pool.query(
      `INSERT INTO sde_types (id, group_id, name, published, market_group_id, meta_group_id, meta_level)
       VALUES (2889, 55, '200mm AutoCannon II', true, 574, 2, 5),
              (484, 55, '125mm Gatling AutoCannon I', true, 574, 1, 0),
              (2456, 100, 'Hobgoblin II', true, 837, 2, 5),
              (9999, 55, 'Unpublished Gun', false, 574, 1, 0)`);
    await pool.query("INSERT INTO sde_meta_groups (id, name) VALUES (1, 'Tech I'), (2, 'Tech II')");
    await pool.query("INSERT INTO sde_market_groups (id, parent_id, name, has_types) VALUES (9, NULL, 'Ship Equipment', false), (574, 9, 'Projectile Turrets', true)");
  });

  it("filters by name substring, case-insensitively, published only", async () => {
    const rows = await browseTypes({ q: "autocannon" });
    expect(rows.map((r) => r.id)).toEqual([484, 2889]);          // name-ascending
    expect(rows[1]).toMatchObject({ categoryId: 7, marketGroupId: 574, metaGroupId: 2, metaLevel: 5 });
  });

  it("filters by category list and by market group", async () => {
    expect((await browseTypes({ categoryIds: [18] })).map((r) => r.id)).toEqual([2456]);
    // name-ascending over only the seeded rows: "125mm..." < "200mm..." < "Hobgoblin II"
    expect((await browseTypes({ categoryIds: [7, 18] })).map((r) => r.id)).toEqual([484, 2889, 2456]);
    expect((await browseTypes({ marketGroupId: 574 })).map((r) => r.id)).toEqual([484, 2889]);
  });

  it("honours the limit", async () => {
    expect(await browseTypes({ categoryIds: [7], limit: 1 })).toHaveLength(1);
  });
});

describe("listMarketGroups / getMetaGroups / getTypesByNames", () => {
  beforeEach(async () => {
    await pool.query("INSERT INTO sde_market_groups (id, parent_id, name, has_types) VALUES (9, NULL, 'Ship Equipment', false), (574, 9, 'Projectile Turrets', true)");
    await pool.query("INSERT INTO sde_meta_groups (id, name) VALUES (2, 'Tech II')");
    await pool.query("INSERT INTO sde_groups (id, category_id, name, published) VALUES (55, 7, 'Projectile Weapon', true)");
    await pool.query("INSERT INTO sde_types (id, group_id, name, published) VALUES (2889, 55, '200mm AutoCannon II', true)");
  });

  it("returns the whole tree, the meta-group names and name lookups", async () => {
    expect(await listMarketGroups()).toEqual([
      { id: 9, parentId: null, name: "Ship Equipment", hasTypes: false },
      { id: 574, parentId: 9, name: "Projectile Turrets", hasTypes: true },
    ]);
    expect((await getMetaGroups()).get(2)).toBe("Tech II");
    const byName = await getTypesByNames(["200MM AUTOCANNON II", "Nope"]);
    expect(byName.get("200mm autocannon ii")).toBe(2889);
    expect(byName.has("nope")).toBe(false);
    expect(await getTypesByNames([])).toEqual(new Map());
  });
});
