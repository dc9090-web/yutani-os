import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { createFit, deleteFit, getFit, listFits, updateFit } from "../../src/lib/db/fits.js";
import type { FitItem } from "../../src/lib/fits/doc.js";

let pool: Pool;
const CID = 669539978;

const GUN: FitItem = { typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: 12608, state: "active" };
const DC: FitItem = { typeId: 2048, quantity: 1, flag: "LoSlot0", chargeTypeId: null, state: "offline" };
const DRONES: FitItem = { typeId: 2456, quantity: 5, flag: "DroneBay", chargeTypeId: null, state: "active" };

beforeAll(async () => { pool = await resetDb(); });
afterAll(async () => { await closePool(); });
beforeEach(async () => {
  await pool.query("TRUNCATE fits RESTART IDENTITY CASCADE");
  await pool.query("TRUNCATE characters CASCADE");
  await pool.query(
    `INSERT INTO characters (id, name, refresh_token_enc) VALUES ($1, 'TrilliumONE', 'enc')`, [CID]);
});

describe("the fits repo", () => {
  it("creates a fit with its items and reads it back in order", async () => {
    const created = await createFit({
      name: "Cheap Rifter", shipTypeId: 587, description: "brawler", characterId: CID,
      items: [GUN, DC, DRONES],
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.characterId).toBe(CID);
    const read = await getFit(created.id);
    expect(read?.name).toBe("Cheap Rifter");
    expect(read?.description).toBe("brawler");
    expect(read?.shipTypeId).toBe(587);
    expect(read?.items).toEqual([GUN, DC, DRONES]);
  });

  it("defaults description, character and items", async () => {
    const created = await createFit({ name: "Empty", shipTypeId: 587 });
    expect(created).toMatchObject({ description: "", characterId: null, items: [] });
  });

  it("replaces the items wholesale and bumps updated_at", async () => {
    const created = await createFit({ name: "Cheap Rifter", shipTypeId: 587, items: [GUN, DC] });
    const updated = await updateFit(created.id, { name: "Renamed", items: [DRONES] });
    expect(updated?.name).toBe("Renamed");
    expect(updated?.items).toEqual([DRONES]);
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  });

  it("leaves the items alone when the patch omits them", async () => {
    const created = await createFit({ name: "Cheap Rifter", shipTypeId: 587, items: [GUN] });
    const renamed = await updateFit(created.id, { name: "Just a rename" });
    expect(renamed?.items).toEqual([GUN]);
  });

  it("stores a null character as the All-V pilot", async () => {
    const created = await createFit({ name: "Theory", shipTypeId: 587, characterId: CID });
    expect((await updateFit(created.id, { characterId: null }))?.characterId).toBeNull();
  });

  it("returns null for an unknown id and false for an unknown delete", async () => {
    expect(await getFit(99999)).toBeNull();
    expect(await updateFit(99999, { name: "nope" })).toBeNull();
    expect(await deleteFit(99999)).toBe(false);
  });

  it("cascades the items when the fit is deleted", async () => {
    const created = await createFit({ name: "Cheap Rifter", shipTypeId: 587, items: [GUN, DC] });
    expect(await deleteFit(created.id)).toBe(true);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM fit_items");
    expect(rows[0].n).toBe(0);
  });

  it("nulls the character when the character row goes away", async () => {
    const created = await createFit({ name: "Cheap Rifter", shipTypeId: 587, characterId: CID });
    await pool.query("DELETE FROM characters WHERE id = $1", [CID]);
    expect((await getFit(created.id))?.characterId).toBeNull();
  });

  it("lists fits newest-update first", async () => {
    const a = await createFit({ name: "A", shipTypeId: 587 });
    const b = await createFit({ name: "B", shipTypeId: 587 });
    await updateFit(a.id, { name: "A again" });
    expect((await listFits()).map((f) => f.name)).toEqual(["A again", "B"]);
  });
});
