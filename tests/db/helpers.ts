import type { Pool } from "pg";
import { getPool, closePool } from "../../src/lib/db/client.js";
import { applySchema } from "../../scripts/migrate.js";
import { sdeDdl, SDE_TABLES } from "../../src/lib/sde/ddl.js";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://eve:eve@127.0.0.1:5432/eve_test";

/** Points DATABASE_URL at eve_test, applies the schema, truncates every phase-1 table. */
export async function resetDb(): Promise<Pool> {
  await closePool();
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const pool = getPool();
  await applySchema(pool);
  // CASCADE clears every character_* table via their characters(id) foreign key; universe_names,
  // structures and market_prices have no FK, so they are listed explicitly.
  await pool.query("TRUNCATE sync_runs, esi_cache, characters, accounts, universe_names, structures, market_prices, fits RESTART IDENTITY CASCADE");
  return pool;
}

/** Drops the staging schema and every sde_* table, then recreates them empty. */
export async function resetSde(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA IF EXISTS sde_import CASCADE");
  for (const table of SDE_TABLES) await pool.query(`DROP TABLE IF EXISTS public.${table} CASCADE`);
  for (const stmt of sdeDdl("public")) await pool.query(stmt);
  await pool.query("DELETE FROM sde_meta");
}
