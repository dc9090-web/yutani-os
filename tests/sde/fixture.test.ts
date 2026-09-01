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
});
