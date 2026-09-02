import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import {
  pruneKillmailCache, setComputedValues, touchValueChecked, unvaluedKillmails,
} from "../../src/lib/db/killmail-values.js";

let pool: Pool;
beforeAll(async () => {
  pool = await resetDb();
  await pool.query(
    `INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, victim_ship_type_id, source)
     VALUES (1, 'h', '2026-09-01T12:00:00Z', 621, 'esi'),
            (2, 'h', '2026-08-01T12:00:00Z', 587, 'zkb'),
            (3, 'h', '2026-07-01T12:00:00Z', NULL, 'zkb')`);
  await pool.query(
    `INSERT INTO killmail_items (killmail_id, idx, item_type_id, flag, quantity_destroyed, quantity_dropped)
     VALUES (1, 0, 34, 5, 500, 500), (1, 1, 2456, 87, 3, 0), (2, 0, 34, 5, 0, 10)`);
}, 60_000);
afterAll(closePool);

describe("unvaluedKillmails", () => {
  it("returns least-recently-checked first (all NULL here, so newest first), quantities added together", async () => {
    const rows = await unvaluedKillmails();
    expect(rows.map((r) => r.killmailId)).toEqual([1, 2, 3]);
    expect(rows[0]).toEqual({
      killmailId: 1, shipTypeId: 621,
      // 500 destroyed + 500 dropped = 1000 of Tritanium, and 3 + 0 = 3 of 2456.
      items: [{ typeId: 34, quantity: 1000 }, { typeId: 2456, quantity: 3 }],
    });
    expect(rows[1]).toEqual({ killmailId: 2, shipTypeId: 587, items: [{ typeId: 34, quantity: 10 }] });
    expect(rows[2]).toEqual({ killmailId: 3, shipTypeId: null, items: [] });
  });

  it("honours the limit", async () => {
    expect((await unvaluedKillmails(2)).map((r) => r.killmailId)).toEqual([1, 2]);
  });
});

describe("unvaluedKillmails starvation guard", () => {
  it("does not re-select an examined-but-still-unpriced id within 24h, and does after", async () => {
    // Killmail 3 was examined this run (touchValueChecked) but stayed unpriced (no ship type).
    await touchValueChecked([3]);
    expect((await unvaluedKillmails()).map((r) => r.killmailId)).toEqual([1, 2]);

    // Past the 24h grace window: eligible again, sorted after the never-checked ones (NULLS FIRST).
    await pool.query(
      "UPDATE killmails SET value_checked_at = now() - interval '25 hours' WHERE killmail_id = 3");
    expect((await unvaluedKillmails()).map((r) => r.killmailId)).toEqual([1, 2, 3]);
  });
});

describe("setComputedValues", () => {
  it("writes the values, stamps value_checked_at and drops those killmails out of the unvalued list", async () => {
    expect(await setComputedValues([{ killmailId: 1, value: 8_125_000 }, { killmailId: 3, value: 0 }])).toBe(2);
    const { rows } = await pool.query(
      "SELECT killmail_id, computed_value, value_checked_at FROM killmails ORDER BY killmail_id");
    expect(Number(rows[0].computed_value)).toBe(8_125_000);
    expect(rows[0].value_checked_at).not.toBeNull();
    expect(rows[1].computed_value).toBeNull();
    expect(Number(rows[2].computed_value)).toBe(0);
    expect(rows[2].value_checked_at).not.toBeNull();
    expect((await unvaluedKillmails()).map((r) => r.killmailId)).toEqual([2]);
  });
  it("writes nothing for an empty list", async () => {
    expect(await setComputedValues([])).toBe(0);
  });
});

describe("pruneKillmailCache", () => {
  it("deletes only killmail-body cache rows (character_id = 0, path under /killmails/) older than seven days", async () => {
    await pool.query(
      `INSERT INTO esi_cache (character_id, path, pages, updated_at) VALUES
         (0, '/killmails/1/hash1', 1, now() - interval '8 days'),
         (0, '/killmails/2/hash2', 1, now() - interval '1 day'),
         (0, '/markets/prices', 1, now() - interval '30 days'),
         (669539978, '/killmails/1/hash1', 1, now() - interval '8 days')`);
    expect(await pruneKillmailCache()).toBe(1);
    const { rows } = await pool.query(
      `SELECT character_id AS "characterId", path FROM esi_cache ORDER BY "characterId", path`);
    expect(rows.map((r) => `${r.characterId}:${r.path}`)).toEqual([
      "0:/killmails/2/hash2", "0:/markets/prices", "669539978:/killmails/1/hash1",
    ]);
  });
});
