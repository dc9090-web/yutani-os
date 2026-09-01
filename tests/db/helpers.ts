import type { Pool } from "pg";
import { getPool, closePool } from "../../src/lib/db/client.js";
import { applySchema } from "../../scripts/migrate.js";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://eve:eve@127.0.0.1:5432/eve_test";

/** Points DATABASE_URL at eve_test, applies the schema, truncates every table. */
export async function resetDb(): Promise<Pool> {
  await closePool();
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const pool = getPool();
  await applySchema(pool);
  await pool.query("TRUNCATE sync_runs, esi_cache, characters, accounts RESTART IDENTITY CASCADE");
  return pool;
}
