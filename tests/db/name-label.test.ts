import { describe, it, expect, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { putNames, putStructure } from "../../src/lib/db/names.js";
import { locationLabel } from "../../src/lib/names/label.js";

let pool: Pool;
beforeEach(async () => {
  pool = await resetDb();
  await resetSde(pool);
  await pool.query("INSERT INTO sde_solar_systems (id, name, security_status) VALUES (30000142, 'Jita', 0.946)");
  await pool.query("INSERT INTO sde_stations (id, solar_system_id) VALUES (60003760, 30000142)");
});
afterAll(closePool);

describe("locationLabel", () => {
  it("labels a solar system from the SDE", async () => {
    expect(await locationLabel(30000142)).toEqual({ name: "Jita", solarSystemId: 30000142, kind: "system" });
  });
  it("labels a station from universe_names and takes its system from the SDE", async () => {
    await putNames([{ id: 60003760, category: "station", name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant" }]);
    expect(await locationLabel(60003760)).toEqual({
      name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", solarSystemId: 30000142, kind: "station",
    });
  });
  it("labels a resolved structure and degrades for a forbidden one", async () => {
    await putStructure({ id: 1035466617946, name: "Perimeter - Tranquility Trading Tower", solarSystemId: 30000144, typeId: 35834, ownerId: 98599770, forbidden: false });
    await putStructure({ id: 1040000000001, name: null, solarSystemId: null, typeId: null, ownerId: null, forbidden: true });
    expect(await locationLabel(1035466617946)).toEqual({ name: "Perimeter - Tranquility Trading Tower", solarSystemId: 30000144, kind: "structure" });
    expect(await locationLabel(1040000000001)).toEqual({ name: "Unknown structure (1040…)", solarSystemId: null, kind: "structure" });
  });
  it("degrades for ids nothing knows about", async () => {
    expect(await locationLabel(1099999999999)).toEqual({ name: "Unknown structure (1099…)", solarSystemId: null, kind: "structure" });
    expect(await locationLabel(60009999)).toEqual({ name: "Unknown station (60009999)", solarSystemId: null, kind: "station" });
    expect(await locationLabel(30009999)).toEqual({ name: "Unknown system (30009999)", solarSystemId: 30009999, kind: "system" });
    expect(await locationLabel(42)).toEqual({ name: "Unknown location (42)", solarSystemId: null, kind: "unknown" });
  });
});
