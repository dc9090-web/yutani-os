import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { importSde } from "../../src/lib/sde/import.js";
import { FIXTURE_ZIP } from "../sde/fixture.js";
import {
  getSdeMeta, getType, getTypes, searchTypes, getTypeAttributes, getTypeEffects,
  getSkillRequirements, getSolarSystem, getRegion, getStation,
  getGroups, listGroups, getSolarSystems, getStations, getTypeBonuses,
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

describe("groups", () => {
  it("reads many groups at once, skipping unknown ids", async () => {
    const groups = await getGroups([255, 1216, 25, 999999]);
    expect(groups.size).toBe(3);
    expect(groups.get(255)).toMatchObject({ id: 255, categoryId: 16, name: "Gunnery" });
    expect(groups.get(1216)!.name).toBe("Engineering");
    expect(groups.get(1216)!.categoryId).toBe(16);
    expect(groups.get(25)!.categoryId).toBe(6);            // Frigate — a ship group, not a skill group
    expect(await getGroups([])).toEqual(new Map());
  });

  it("lists a whole category name-ascending", async () => {
    const skills = await listGroups(16);
    expect(skills.length).toBeGreaterThan(20);
    expect(skills.every((g) => g.categoryId === 16)).toBe(true);
    const names = skills.map((g) => g.name);
    expect(names).toContain("Gunnery");
    expect(names).toContain("Spaceship Command");
    // Name-ascending. Asserted as a relative order, not against JS's .sort(): Postgres' collation
    // and UTF-16 code-point order disagree about spaces and hyphens.
    expect(names.indexOf("Gunnery")).toBeLessThan(names.indexOf("Spaceship Command"));
    expect(await listGroups(999999)).toEqual([]);
  });
});

describe("batched map lookups", () => {
  it("reads many solar systems at once", async () => {
    const systems = await getSolarSystems([30000142, 30000144, 30009999]);
    expect(systems.size).toBe(2);
    expect(systems.get(30000142)!.name).toBe("Jita");
    expect(systems.get(30000142)!.securityStatus).toBeCloseTo(0.9459, 4);
    expect(systems.get(30000144)!.name).toBe("Perimeter");
    expect(await getSolarSystems([])).toEqual(new Map());
  });

  it("reads many stations at once", async () => {
    const stations = await getStations([60003760, 60000361, 60009999]);
    expect(stations.size).toBe(2);
    expect(stations.get(60003760)!.solarSystemId).toBe(30000142);
    expect(stations.get(60000361)!.solarSystemId).toBe(30000142);
    expect(await getStations([])).toEqual(new Map());
  });
});

describe("type bonuses", () => {
  it("reads the Rifter's two skill bonuses in file order", async () => {
    expect(await getTypeBonuses(587)).toEqual([
      {
        idx: 0, kind: "skill", skillTypeId: 3329, importance: 1, bonus: 7.5, unitId: 105,
        bonusText: "bonus to <a href=showinfo:3302>Small Projectile Turret</a> rate of fire",
      },
      {
        idx: 1, kind: "skill", skillTypeId: 3329, importance: 2, bonus: 10, unitId: 105,
        bonusText: "bonus to <a href=showinfo:3302>Small Projectile Turret</a> falloff",
      },
    ]);
  });

  it("returns an empty list for a type with no bonuses", async () => {
    expect(await getTypeBonuses(519)).toEqual([]);
    expect(await getTypeBonuses(999999)).toEqual([]);
  });
});
