import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { applySchema } from "../../scripts/migrate.js";
import { closePool } from "../../src/lib/db/client.js";
import type { Pool } from "pg";

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); }, 60_000);
afterAll(closePool);

describe("schema", () => {
  it("is idempotent and creates the phase-1 and sde tables", async () => {
    await applySchema(pool);
    const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
    expect(rows.map((r) => r.table_name)).toEqual([
      "accounts", "characters", "esi_cache",
      "sde_categories", "sde_constellations", "sde_dogma_attribute_categories", "sde_dogma_attributes",
      "sde_dogma_effect_modifiers", "sde_dogma_effects", "sde_dogma_units", "sde_groups",
      "sde_market_groups", "sde_meta", "sde_meta_groups", "sde_regions", "sde_solar_systems",
      "sde_stations", "sde_type_attributes", "sde_type_bonuses", "sde_type_effects", "sde_types",
      "sync_runs",
    ]);
  });
  it("rejects an unknown token_status", async () => {
    await expect(pool.query("INSERT INTO characters (id, name, refresh_token_enc, token_status) VALUES (1, 'x', 'e', 'bogus')")).rejects.toThrow(/check/i);
  });
  it("constrains sde_meta to a single row and sde_type_bonuses.kind to the three kinds", async () => {
    await expect(pool.query("INSERT INTO sde_meta (id, build_number, release_date) VALUES (2, 1, now())")).rejects.toThrow(/check/i);
    await expect(pool.query("INSERT INTO sde_type_bonuses (type_id, idx, kind) VALUES (1, 0, 'bogus')")).rejects.toThrow(/check/i);
  });
});
