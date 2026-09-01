import { describe, it, expect, beforeEach, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { putNames, putStructure } from "../../src/lib/db/names.js";
import { locationLabel, locationLabels, displayNames } from "../../src/lib/names/label.js";

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
    expect(await locationLabel(1040000000001)).toEqual({ name: "Unknown structure (1040000000001)", solarSystemId: null, kind: "structure" });
  });
  it("degrades for ids nothing knows about", async () => {
    expect(await locationLabel(1099999999999)).toEqual({ name: "Unknown structure (1099999999999)", solarSystemId: null, kind: "structure" });
    expect(await locationLabel(60009999)).toEqual({ name: "Unknown station (60009999)", solarSystemId: null, kind: "station" });
    expect(await locationLabel(30009999)).toEqual({ name: "Unknown system (30009999)", solarSystemId: 30009999, kind: "system" });
    expect(await locationLabel(42)).toEqual({ name: "Unknown location (42)", solarSystemId: null, kind: "unknown" });
  });
});

describe("locationLabels", () => {
  it("labels systems, stations and structures in one pass", async () => {
    await putNames([
      { id: 60003760, category: "station", name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant" },
    ]);
    await putStructure({ id: 1035466617946, name: "Perimeter - Tranquility Trading Tower", solarSystemId: 30000144, typeId: 35834, ownerId: 98599770, forbidden: false });
    const labels = await locationLabels([30000142, 60003760, 1035466617946, 42]);
    expect(labels.get(30000142)).toEqual({ name: "Jita", solarSystemId: 30000142, kind: "system" });
    expect(labels.get(60003760)!.name).toBe("Jita IV - Moon 4 - Caldari Navy Assembly Plant");
    expect(labels.get(60003760)!.solarSystemId).toBe(30000142);
    expect(labels.get(1035466617946)).toEqual({ name: "Perimeter - Tranquility Trading Tower", solarSystemId: 30000144, kind: "structure" });
    expect(labels.get(42)).toEqual({ name: "Unknown location (42)", solarSystemId: null, kind: "unknown" });
  });

  it("degrades exactly like locationLabel and deduplicates its input", async () => {
    const labels = await locationLabels([60009999, 60009999, 1099999999999, 30009999]);
    expect(labels.size).toBe(3);
    expect(labels.get(60009999)).toEqual({ name: "Unknown station (60009999)", solarSystemId: null, kind: "station" });
    expect(labels.get(1099999999999)).toEqual({ name: "Unknown structure (1099999999999)", solarSystemId: null, kind: "structure" });
    expect(labels.get(30009999)).toEqual({ name: "Unknown system (30009999)", solarSystemId: 30009999, kind: "system" });
  });

  it("returns an empty map for an empty or junk list", async () => {
    expect(await locationLabels([])).toEqual(new Map());
    expect(await locationLabels([0, -1])).toEqual(new Map());
  });
});

describe("displayNames", () => {
  it("returns only the ids universe_names has a name for", async () => {
    await putNames([
      { id: 1000035, category: "corporation", name: "Caldari Navy" },
      { id: 669539978, category: "character", name: "TrilliumONE" },
      { id: 777, category: "unknown", name: null },
    ]);
    const names = await displayNames([1000035, 669539978, 777, 888]);
    expect(names.get(1000035)).toBe("Caldari Navy");
    expect(names.get(669539978)).toBe("TrilliumONE");
    expect(names.has(777)).toBe(false);        // cached as unresolvable
    expect(names.has(888)).toBe(false);        // never seen
  });

  it("returns an empty map for an empty list", async () => {
    expect(await displayNames([])).toEqual(new Map());
  });
});
