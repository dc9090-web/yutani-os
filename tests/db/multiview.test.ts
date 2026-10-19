import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { listMultiview, setMultiview } from "../../src/lib/db/multiview.js";

let pool: Pool;

beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });
beforeEach(async () => {
  await pool.query("TRUNCATE characters CASCADE");
  await pool.query(
    `INSERT INTO characters (id, name, refresh_token_enc) VALUES (1, 'A', 'enc'), (2, 'B', 'enc'), (3, 'C', 'enc')`);
});

describe("the multiview repo", () => {
  it("is empty until set, then lists in the saved order", async () => {
    expect(await listMultiview()).toEqual([]);
    await setMultiview([3, 1]);
    expect(await listMultiview()).toEqual([3, 1]);
  });

  it("replaces the whole list", async () => {
    await setMultiview([3, 1]);
    await setMultiview([2]);
    expect(await listMultiview()).toEqual([2]);
  });

  it("drops a deleted character", async () => {
    await setMultiview([1, 2]);
    await pool.query("DELETE FROM characters WHERE id = 1");
    expect(await listMultiview()).toEqual([2]);
  });
});
