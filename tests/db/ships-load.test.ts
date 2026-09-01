import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { importSde } from "../../src/lib/sde/import.js";
import { FIXTURE_ZIP } from "../sde/fixture.js";
import { resetDogmaCache } from "../../src/lib/dogma/sde-loader.js";
import { loadFitData } from "../../src/lib/ships/load.js";

let pool: Pool;

beforeAll(async () => {
  pool = await resetDb();
  await resetSde(pool);
  await importSde(FIXTURE_ZIP, pool);
  resetDogmaCache();
  await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES (1, 'Trill', 'enc'), (2, 'Fresh', 'enc')");
  await pool.query(
    `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag, is_singleton, name)
     VALUES (1, 1000, 587, 1, 60003760, 'station', 'Hangar', true, 'Scarlet Dart'),
            (1, 1001, 519, 1, 1000, 'item', 'LoSlot0', true, NULL)`);
  await pool.query(
    "INSERT INTO character_fittings (character_id, fitting_id, name, description, ship_type_id) VALUES (1, 7, 'Solo', '', 587)");
  await pool.query(
    `INSERT INTO character_fitting_items (character_id, fitting_id, idx, type_id, quantity, flag)
     VALUES (1, 7, 0, 519, 1, 'LoSlot0')`);
  await pool.query(
    "INSERT INTO character_skills (character_id, skill_id, trained_level, active_level, skillpoints) VALUES (1, 3300, 5, 4, 256000)");
  // 34 stands in for an implant: the mini SDE has no implant type, and the loader only cares that
  // the id reaches ctx.implants and loadDogmaData.
  await pool.query("INSERT INTO character_implants (character_id, type_id) VALUES (1, 34)");
}, 180_000);
afterAll(closePool);

describe("loadFitData", () => {
  it("reads the four tables and loads every type it will model, plus the required-skill closure", async () => {
    const data = await loadFitData(1);
    expect(data.assets.map((a) => a.itemId)).toEqual([1000, 1001]);
    expect(data.fittings).toHaveLength(1);
    expect(data.fittings[0].items).toEqual([{ idx: 0, typeId: 519, quantity: 1, flag: "LoSlot0" }]);

    for (const typeId of [587, 519, 3300, 34]) expect(data.ctx.data.types.has(typeId)).toBe(true);
    // 3329 (Minmatar Frigate) is nobody's asset — loadDogmaData pulls it in as the Rifter's
    // required skill, which is what makes the recursive missing-skill expansion possible.
    expect(data.ctx.data.types.has(3329)).toBe(true);
  });

  it("uses trained levels and reports that skills are synced", async () => {
    const data = await loadFitData(1);
    expect(data.ctx.skills).toEqual(new Map([[3300, 5]]));
    expect(data.ctx.implants).toEqual([34]);
    expect(data.skillsSynced).toBe(true);
  });

  it("gives an unsynced character an empty skill map and says so", async () => {
    const data = await loadFitData(2);
    expect(data.assets).toEqual([]);
    expect(data.fittings).toEqual([]);
    expect(data.ctx.skills.size).toBe(0);
    expect(data.ctx.implants).toEqual([]);
    expect(data.skillsSynced).toBe(false);
  });
});
