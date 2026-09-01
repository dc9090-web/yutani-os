import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { importSde } from "../../src/lib/sde/import.js";
import { FIXTURE_ZIP } from "../sde/fixture.js";
import { resetDogmaCache } from "../../src/lib/dogma/sde-loader.js";
import { assetSheet, fittingSheet } from "../../src/lib/ships/sheet.js";

let pool: Pool;

beforeAll(async () => {
  pool = await resetDb();
  await resetSde(pool);
  await importSde(FIXTURE_ZIP, pool);
  resetDogmaCache();
  await pool.query("INSERT INTO characters (id, name, refresh_token_enc) VALUES (1, 'Trill', 'enc')");
  await pool.query(
    `INSERT INTO character_assets (character_id, item_id, type_id, quantity, location_id, location_type, location_flag, is_singleton, name)
     VALUES (1, 1000, 587, 1, 60003760, 'station', 'Hangar', true, 'Scarlet Dart'),
            (1, 1001, 519, 1, 1000, 'item', 'LoSlot0', true, NULL)`);
  await pool.query(
    "INSERT INTO character_fittings (character_id, fitting_id, name, description, ship_type_id) VALUES (1, 7, 'Solo Rifter', '<b>hi</b>', 587)");
  await pool.query(
    `INSERT INTO character_fitting_items (character_id, fitting_id, idx, type_id, quantity, flag)
     VALUES (1, 7, 0, 519, 1, 'LoSlot0')`);
  await pool.query("INSERT INTO market_prices (type_id, jita_sell_min) VALUES (587, 8000000)");
}, 180_000);
afterAll(closePool);

describe("assetSheet", () => {
  it("renders the docked Rifter's sheet from the mini SDE", async () => {
    const result = await assetSheet(1, 1000);
    // If this is not "ok", read the logged engine error: the sheet must render for a hull whose
    // required skills are only partly present in the mini SDE (phase 4a: unknown ids are skipped).
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const view = result.view;
    expect(view.title).toBe("Scarlet Dart");
    expect(view.typeName).toBe("Rifter");
    expect(view.renderUrl).toBe("https://images.evetech.net/types/587/render?size=128");
    // Phase 4a's asserted bare-hull numbers at skills 0.
    expect(view.gauges[0].text.endsWith("/ 130.00 tf")).toBe(true);
    expect(view.gauges[1].text.endsWith("/ 41.00 MW")).toBe(true);
    expect(view.slots.find((s) => s.slot === "low")!.rows[0].name).toBe("Gyrostabilizer II");
    expect(view.bonuses.map((b) => b.skill)).toEqual(["Minmatar Frigate", "Minmatar Frigate"]);
    expect(view.bonuses[0].level).toBe(0);
    expect(view.skillsSynced).toBe(false);
    expect(view.value.lines[0]).toEqual({ label: "Hull", value: "8,000,000.00 ISK" });
    expect(view.value.unpriced).toBe("1 item unpriced");     // the Gyrostabilizer has no price
  });

  it("404s for an item the character does not own", async () => {
    expect(await assetSheet(1, 999999)).toEqual({ kind: "notFound" });
  });

  it("404s for an item that is not an assembled ship", async () => {
    expect(await assetSheet(1, 1001)).toEqual({ kind: "notFound" });
  });
});

describe("fittingSheet", () => {
  it("renders a saved fit and never shows its player-authored description", async () => {
    const result = await fittingSheet(1, 7);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.view.title).toBe("Solo Rifter");
    expect(result.view.subtitle).toBe("Saved fit");
    expect(result.view.slots.find((s) => s.slot === "low")!.rows[0].name).toBe("Gyrostabilizer II");
  });

  it("404s for an unknown fitting", async () => {
    expect(await fittingSheet(1, 4242)).toEqual({ kind: "notFound" });
  });
});
