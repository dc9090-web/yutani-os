import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { importSde } from "../../src/lib/sde/import.js";
import { FIXTURE_ZIP } from "../sde/fixture.js";
import {
  getSdeMeta, getType, getTypes, searchTypes, getTypeAttributes, getTypeEffects,
  getSkillRequirements, getSolarSystem, getRegion, getStation,
} from "../../src/lib/sde/repo.js";

let pool: Pool;

beforeAll(async () => {
  pool = await resetDb();
  await resetSde(pool);
  await importSde(FIXTURE_ZIP, pool);
}, 120_000);
afterAll(closePool);

describe("getSdeMeta", () => {
  it("reports the build and the four headline counts", async () => {
    const meta = await getSdeMeta();
    expect(meta).not.toBeNull();
    expect(meta!.buildNumber).toBe(3484357);
    expect(meta!.releaseDate.toISOString()).toBe("2026-08-28T11:07:12.000Z");
    expect(meta!.importedAt).toBeInstanceOf(Date);
    expect(meta!.counts).toEqual({ types: 10, dogmaAttributes: 2867, dogmaEffects: 23, solarSystems: 7 });
  });

  it("returns null before the first import", async () => {
    await resetSde(pool);
    expect(await getSdeMeta()).toBeNull();
    await importSde(FIXTURE_ZIP, pool);   // restore for the rest of the file
  }, 120_000);
});

describe("types", () => {
  it("reads one type with camelCase fields", async () => {
    expect(await getType(587)).toEqual({
      id: 587, groupId: 25, name: "Rifter", description: expect.stringContaining("combat frigate"),
      published: true, marketGroupId: 64, metaGroupId: 1, metaLevel: 0, techLevel: 1,
      mass: 1067000, volume: 27289, packagedVolume: 2500, capacity: 140, basePrice: 400000,
      iconId: null, graphicId: 46, raceId: 2, factionId: 500002, portionSize: 1, variationParentTypeId: null,
    });
    expect(await getType(999999)).toBeNull();
  });

  it("reads many types at once, skipping unknown ids", async () => {
    const map = await getTypes([587, 519, 999999]);
    expect(map.size).toBe(2);
    expect(map.get(519)!.name).toBe("Gyrostabilizer II");
    expect(map.get(587)!.groupId).toBe(25);
    expect(await getTypes([])).toEqual(new Map());
  });

  it("searches case-insensitively, published only, name-ascending", async () => {
    expect((await searchTypes("rift")).map((t) => t.name)).toEqual(["Rifter"]);
    expect((await searchTypes("RIFT")).map((t) => t.name)).toEqual(["Rifter"]);
    expect((await searchTypes("turret")).map((t) => t.name)).toEqual(["Small Hybrid Turret", "Small Projectile Turret"]);
    // "Jita Trade Hub" (52678) is published = false
    expect(await searchTypes("jita")).toEqual([]);
  });

  it("filters a search by category and honours the limit", async () => {
    expect((await searchTypes("t", { categoryId: 6 })).map((t) => t.name)).toEqual(["Rifter"]);
    expect((await searchTypes("management", { categoryId: 16 })).map((t) => t.name)).toEqual(["CPU Management", "Power Grid Management"]);
    expect((await searchTypes("management", { categoryId: 7 }))).toEqual([]);
    expect((await searchTypes("turret", { limit: 1 })).map((t) => t.name)).toEqual(["Small Hybrid Turret"]);
  });
});

describe("dogma", () => {
  it("reads a type's attributes as attributeId → value", async () => {
    const attrs = await getTypeAttributes(519);
    expect(attrs.size).toBe(9);
    expect(attrs.get(64)).toBe(1.1);
    expect(attrs.get(182)).toBe(3318);
    expect(attrs.get(9999)).toBeUndefined();
    expect(await getTypeAttributes(34)).toEqual(new Map());   // Tritanium has no typeDogma row
  });

  it("reads a type's effects", async () => {
    expect(await getTypeEffects(519)).toEqual([
      { effectId: 11, isDefault: false },
      { effectId: 16, isDefault: false },
      { effectId: 89, isDefault: false },
      { effectId: 92, isDefault: false },
    ]);
    expect(await getTypeEffects(34)).toEqual([]);
  });

  it("derives skill requirements from the attribute pairs, rounded to ints", async () => {
    expect(await getSkillRequirements(587)).toEqual([{ skillTypeId: 3329, level: 1 }]);
    expect(await getSkillRequirements(519)).toEqual([{ skillTypeId: 3318, level: 4 }]);
    expect(await getSkillRequirements(34)).toEqual([]);
  });
});

describe("map lookups", () => {
  it("reads a solar system, its region and a station", async () => {
    const jita = await getSolarSystem(30000142);
    expect(jita!.name).toBe("Jita");
    expect(jita!.constellationId).toBe(20000020);
    expect(jita!.regionId).toBe(10000002);
    expect(jita!.securityStatus).toBeCloseTo(0.9459, 4);
    expect(jita!.securityClass).toBe("B");
    expect(await getRegion(10000002)).toEqual({ id: 10000002, name: "The Forge" });
    expect(await getStation(60003760)).toEqual({
      id: 60003760, solarSystemId: 30000142, typeId: 52678, ownerId: 1000035, operationId: 14,
    });
  });

  it("returns null for unknown ids", async () => {
    expect(await getSolarSystem(1)).toBeNull();
    expect(await getRegion(1)).toBeNull();
    expect(await getStation(1)).toBeNull();
  });
});
