import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetDb } from "./helpers.js";
import { applySchema } from "../../scripts/migrate.js";
import { closePool } from "../../src/lib/db/client.js";
import type { Pool } from "pg";

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); });
afterAll(closePool);

describe("schema", () => {
  it("is idempotent", async () => {
    await applySchema(pool);
    const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
    expect(rows.map((r) => r.table_name)).toEqual(["accounts", "characters", "esi_cache", "sync_runs"]);
  });
  it("rejects an unknown token_status", async () => {
    await expect(pool.query("INSERT INTO characters (id, name, refresh_token_enc, token_status) VALUES (1, 'x', 'e', 'bogus')")).rejects.toThrow(/check/i);
  });
});
