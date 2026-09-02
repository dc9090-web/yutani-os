import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { typesOfInterest } from "../../src/lib/market/interest.js";

let pool: Pool;
beforeAll(async () => { pool = await resetDb(); }, 60_000);
afterAll(closePool);

describe("typesOfInterest", () => {
  it("is empty on an empty database", async () => {
    expect(await typesOfInterest()).toEqual([]);
  });

  it("unions assets, fitting items, fitting hulls and recent transactions", async () => {
    await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES (1, 'Trill', 'enc')");
    await pool.query(
      `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag)
       VALUES (1, 100, 587, 1, 60003760, 'station', 'Hangar'), (1, 101, 519, 1, 100, 'item', 'LoSlot0')`);
    await pool.query(
      "INSERT INTO character_fittings (character_id, fitting_id, name, description, ship_type_id) VALUES (1, 7, 'Fit', '', 626)");
    await pool.query(
      `INSERT INTO character_fitting_items (character_id, fitting_id, idx, type_id, quantity, flag)
       VALUES (1, 7, 0, 2889, 1, 'HiSlot0')`);
    await pool.query(
      `INSERT INTO character_wallet_transactions (character_id, transaction_id, date, type_id, quantity, unit_price)
       VALUES (1, 900, now() - interval '5 days', 34, 1000, 3.85),
              (1, 901, now() - interval '40 days', 35, 1000, 8.10)`);

    // 35 was traded 40 days ago, outside the 30-day window; everything else is in.
    expect(await typesOfInterest()).toEqual([34, 519, 587, 626, 2889]);
  });

  it("deduplicates a type that appears in several places", async () => {
    await pool.query(
      `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag)
       VALUES (1, 102, 34, 500, 60003760, 'station', 'Hangar')`);
    const ids = await typesOfInterest();
    expect(ids.filter((id) => id === 34)).toEqual([34]);
  });

  it("adds killmail item and victim ship types inside the 90-day window", async () => {
    await pool.query(
      `INSERT INTO killmails (killmail_id, killmail_hash, killmail_time, victim_ship_type_id, source)
       VALUES (1, 'h', now() - interval '10 days', 24698, 'esi'),
              (2, 'h', now() - interval '200 days', 11567, 'zkb')`);
    await pool.query(
      `INSERT INTO killmail_items (killmail_id, idx, item_type_id, flag)
       VALUES (1, 0, 12058, 27), (2, 0, 41155, 27)`);
    const ids = await typesOfInterest();
    expect(ids).toContain(24698);      // victim ship, 10 days ago
    expect(ids).toContain(12058);      // its module
    expect(ids).not.toContain(11567);  // 200 days ago, outside the window
    expect(ids).not.toContain(41155);
  });
});
