import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { resetDogmaCache } from "../../src/lib/dogma/sde-loader.js";
import { createFit } from "../../src/lib/db/fits.js";
import { upsertJitaPrices } from "../../src/lib/db/market-prices.js";
import { loadFittingIndex } from "../../src/lib/fits/load.js";

let pool: Pool;
const CID = 669539978;
const NOW = new Date("2026-09-02T12:00:00Z");

beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });

beforeEach(async () => {
  await resetSde(pool);
  resetDogmaCache();
  await pool.query("TRUNCATE fits RESTART IDENTITY CASCADE");
  await pool.query("TRUNCATE characters CASCADE");
  await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES ($1, 'TrilliumONE', 'enc')", [CID]);
  await pool.query("INSERT INTO sde_categories (id, name, published) VALUES (6, 'Ship', true), (7, 'Module', true)");
  await pool.query("INSERT INTO sde_groups (id, category_id, name, published) VALUES (25, 6, 'Frigate', true), (55, 7, 'Projectile Weapon', true)");
  await pool.query("INSERT INTO sde_types (id, group_id, name, published) VALUES (587, 25, 'Rifter', true), (2889, 55, '200mm AutoCannon II', true)");
  await pool.query(
    `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag, is_singleton)
     VALUES ($1, 1000, 587, 1, 60003760, 'station', 'Hangar', true)`, [CID]);
  await pool.query(
    `INSERT INTO character_fittings (character_id, fitting_id, name, description, ship_type_id)
     VALUES ($1, 55, 'Saved Rifter', '', 587)`, [CID]);
  await upsertJitaPrices([{ typeId: 587, sellMin: 8_000_000, buyMax: null }]);
});

describe("loadFittingIndex", () => {
  it("lists local fits with their hull, pilot, age and value", async () => {
    await createFit({
      name: "Cheap Rifter", shipTypeId: 587, characterId: CID,
      items: [{ typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: null, state: "active" }],
    });
    const index = await loadFittingIndex(CID, NOW);
    expect(index.rows).toHaveLength(1);
    expect(index.rows[0]).toMatchObject({
      name: "Cheap Rifter", typeName: "Rifter", pilot: "TrilliumONE", value: "8.0M ISK",
    });
    expect(index.rows[0].unpriced).toBe("1 item unpriced");   // the autocannon has no price row
  });

  it("labels an unassigned fit as All skills V and names an unknown hull", async () => {
    await createFit({ name: "Theory", shipTypeId: 99999 });
    const index = await loadFittingIndex(CID, NOW);
    expect(index.rows[0]).toMatchObject({ pilot: "All skills V", typeName: "Unknown type (99999)" });
  });

  it("offers the character's saved fittings and assembled ships as clone sources", async () => {
    const index = await loadFittingIndex(CID, NOW);
    expect(index.fittings).toEqual([{ id: 55, label: "Saved Rifter" }]);
    expect(index.ships).toEqual([{ id: 1000, label: "Rifter" }]);
  });

  it("works with no character at all", async () => {
    await createFit({ name: "Theory", shipTypeId: 587 });
    const index = await loadFittingIndex(null, NOW);
    expect(index.rows).toHaveLength(1);
    expect(index.fittings).toEqual([]);
    expect(index.ships).toEqual([]);
  });
});
