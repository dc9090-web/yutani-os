import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { applySchema } from "../../scripts/migrate.js";
import { closePool } from "../../src/lib/db/client.js";
import type { Pool } from "pg";

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); }, 60_000);
afterAll(closePool);

describe("schema", () => {
  it("is idempotent and creates the phase-1, sde and phase-3 tables", async () => {
    await applySchema(pool);
    const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    expect(rows.map((r) => r.table_name).sort()).toEqual([
      "accounts",
      "character_assets", "character_attributes", "character_clones", "character_fitting_items",
      "character_fittings", "character_implants", "character_jump_clones", "character_location",
      "character_skill_queue", "character_skill_summary", "character_skills", "character_wallet",
      "character_wallet_journal", "character_wallet_transactions", "characters", "esi_cache",
      "market_prices",
      "sde_categories", "sde_constellations", "sde_dogma_attribute_categories", "sde_dogma_attributes",
      "sde_dogma_effect_modifiers", "sde_dogma_effects", "sde_dogma_units", "sde_groups",
      "sde_market_groups", "sde_meta", "sde_meta_groups", "sde_regions", "sde_solar_systems",
      "sde_stations", "sde_type_attributes", "sde_type_bonuses", "sde_type_effects", "sde_types",
      "structures", "sync_runs", "universe_names",
    ]);
  });
  it("rejects an unknown token_status", async () => {
    await expect(pool.query("INSERT INTO characters (id, name, refresh_token_enc, token_status) VALUES (1, 'x', 'e', 'bogus')")).rejects.toThrow(/check/i);
  });
  it("constrains sde_meta to a single row and sde_type_bonuses.kind to the three kinds", async () => {
    await expect(pool.query("INSERT INTO sde_meta (id, build_number, release_date) VALUES (2, 1, now())")).rejects.toThrow(/check/i);
    await expect(pool.query("INSERT INTO sde_type_bonuses (type_id, idx, kind) VALUES (1, 0, 'bogus')")).rejects.toThrow(/check/i);
  });
  it("cascades every per-character table when a character is deleted", async () => {
    await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES (42, 'Cascade', 'enc') ON CONFLICT (id) DO NOTHING");
    await pool.query("INSERT INTO character_skills (character_id, skill_id, trained_level, active_level, skillpoints) VALUES (42, 3300, 5, 5, 256000)");
    await pool.query("INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag) VALUES (42, 1, 34, 5, 60003760, 'station', 'Hangar')");
    await pool.query("INSERT INTO character_wallet (character_id, balance) VALUES (42, 1.00)");
    await pool.query("DELETE FROM characters WHERE id = 42");
    for (const t of ["character_skills", "character_assets", "character_wallet"]) {
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${t} WHERE character_id = 42`);
      expect(rows[0].n).toBe(0);
    }
  });
  it("accepts an ESI enum value nobody has seen before", async () => {
    await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES (43, 'Enum', 'enc') ON CONFLICT (id) DO NOTHING");
    await pool.query(
      `INSERT INTO character_wallet_journal (character_id, id, date, ref_type) VALUES (43, 1, now(), 'brand_new_ref_type_2027')`);
    await pool.query(
      `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag)
       VALUES (43, 2, 34, 1, 60003760, 'station', 'BrandNewHold')`);
    await pool.query("DELETE FROM characters WHERE id = 43");
  });
});
