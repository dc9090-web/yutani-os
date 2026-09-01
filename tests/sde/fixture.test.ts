import { describe, it, expect } from "vitest";
import { stat } from "node:fs/promises";
import { FIXTURE_ZIP, fixtureCount, fixtureRecord } from "./fixture.js";

describe("sde-mini.zip", () => {
  it("stays under the 1.5 MB budget", async () => {
    expect((await stat(FIXTURE_ZIP)).size).toBeLessThan(1_500_000);
  });

  it("holds exactly the allow-listed records", async () => {
    const members = [
      "_sde.jsonl", "categories.jsonl", "groups.jsonl", "metaGroups.jsonl", "dogmaUnits.jsonl",
      "dogmaAttributeCategories.jsonl", "dogmaAttributes.jsonl", "marketGroups.jsonl", "mapRegions.jsonl",
      "types.jsonl", "typeDogma.jsonl", "typeBonus.jsonl", "dogmaEffects.jsonl",
      "mapConstellations.jsonl", "mapSolarSystems.jsonl", "npcStations.jsonl",
      "cloneGrades.jsonl", "skillPlans.jsonl",
    ];
    const counts: Record<string, number> = {};
    for (const m of members) counts[m] = await fixtureCount(m);
    expect(counts).toEqual({
      "_sde.jsonl": 1,
      "categories.jsonl": 48,
      "groups.jsonl": 1610,
      "metaGroups.jsonl": 13,
      "dogmaUnits.jsonl": 60,
      "dogmaAttributeCategories.jsonl": 37,
      "dogmaAttributes.jsonl": 2867,
      "marketGroups.jsonl": 2106,
      "mapRegions.jsonl": 114,
      "types.jsonl": 10,
      "typeDogma.jsonl": 9,          // type 34 (Tritanium) has no dogma row at all
      "typeBonus.jsonl": 1,          // only the Rifter has ship traits
      "dogmaEffects.jsonl": 23,
      "mapConstellations.jsonl": 1,
      "mapSolarSystems.jsonl": 7,
      "npcStations.jsonl": 18,
      "cloneGrades.jsonl": 4,
      "skillPlans.jsonl": 40,
    });
  }, 30_000);

  it("carries the build pointer and the records the other tests assert on", async () => {
    expect(await fixtureRecord("_sde.jsonl", "sde")).toEqual({
      _key: "sde", buildNumber: 3484357, releaseDate: "2026-08-28T11:07:12Z",
    });
    const rifter = await fixtureRecord("types.jsonl", 587);
    expect(rifter.groupID).toBe(25);
    expect(rifter.marketGroupID).toBe(64);
    expect(rifter.mass).toBe(1067000);
    expect((rifter.name as Record<string, string>).en).toBe("Rifter");
    const jita = await fixtureRecord("mapSolarSystems.jsonl", 30000142);
    expect(jita.securityStatus).toBe(0.945913);
    expect(jita.regionID).toBe(10000002);
    const station = await fixtureRecord("npcStations.jsonl", 60003760);
    expect(station.solarSystemID).toBe(30000142);
    expect(station.typeID).toBe(52678);
  }, 30_000);

  it("carries the Alpha clone grades and CCP's career plans", async () => {
    const alpha = await fixtureRecord("cloneGrades.jsonl", 1);
    expect(alpha.name).toBe("Alpha Caldari");
    expect((alpha.skills as unknown[]).length).toBe(175);
    const plan = await fixtureRecord("skillPlans.jsonl", 4);
    expect((plan.name as Record<string, string>).en).toBe("Minmatar Militia Fighter");
    expect((plan.skillRequirements as unknown[])[0]).toEqual({ level: 1, typeID: 3327 });
    expect(plan.milestones).toEqual([
      { level: 3, typeID: 3329 }, { level: 2, typeID: 3356 }, { level: 3, typeID: 3302 },
      { level: 3, typeID: 3315 }, { level: 3, typeID: 3310 },
    ]);
  }, 30_000);
});
