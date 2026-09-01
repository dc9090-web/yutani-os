import { describe, it, expect } from "vitest";
import { tableDef, en, int, num, bool, str, SDE_TABLE_DEFS } from "../../src/lib/sde/tables.js";
import { fixtureRecord } from "./fixture.js";

/** Maps a fixture record with the named table's mapper and returns the single row. */
async function row(table: Parameters<typeof tableDef>[0], member: string, key: number | string): Promise<unknown[]> {
  const out = tableDef(table).map(await fixtureRecord(member, key));
  return out as unknown[];
}
/** Maps a fixture record with a fan-out mapper and returns every row. */
async function rows(table: Parameters<typeof tableDef>[0], member: string, key: number | string): Promise<unknown[][]> {
  const out = tableDef(table).map(await fixtureRecord(member, key));
  return out as unknown[][];
}

describe("field helpers", () => {
  it("en picks English from a localised map and passes plain strings through", () => {
    expect(en({ de: "Fregatte", en: "Frigate" })).toBe("Frigate");
    expect(en("Damage multiplier.")).toBe("Damage multiplier.");
    expect(en({ de: "Fregatte" })).toBeNull();
    expect(en(undefined)).toBeNull();
  });
  it("int rounds, num keeps, bool and str reject the wrong type", () => {
    expect(int(3329.0)).toBe(3329);
    expect(int(-1)).toBe(-1);
    expect(int(undefined)).toBeNull();
    expect(num(0.945913)).toBe(0.945913);
    expect(num("1")).toBeNull();
    expect(bool(false)).toBe(false);
    expect(bool(undefined)).toBeNull();
    expect(str("B")).toBe("B");
    expect(str(1)).toBeNull();
  });
});

describe("every table def", () => {
  it("covers 17 tables and declares a type for every column", () => {
    expect(SDE_TABLE_DEFS.length).toBe(17);
    expect(new Set(SDE_TABLE_DEFS.map((d) => d.table)).size).toBe(17);
    for (const def of SDE_TABLE_DEFS) {
      expect(def.columns.length).toBeGreaterThan(0);
      for (const c of def.columns) expect(["int", "text", "bool", "float8"]).toContain(c.type);
    }
  });
});

describe("simple mappers", () => {
  it("maps a category, a group and a market group", async () => {
    expect(await row("sde_categories", "categories.jsonl", 6)).toEqual([6, "Ship", true, null]);
    expect(await row("sde_groups", "groups.jsonl", 25)).toEqual([25, 6, "Frigate", true, null, false, false, false, false]);
    expect(await row("sde_market_groups", "marketGroups.jsonl", 64)).toEqual([64, 5, "Minmatar", "Minmatar frigate designs.", true, 20968]);
  });

  it("maps a meta group, a dogma unit and an attribute category", async () => {
    expect(await row("sde_meta_groups", "metaGroups.jsonl", 2)).toEqual([2, "Tech II", "t2"]);
    // dogmaUnits 105 has no `description` — absent must become null, not undefined
    expect(await row("sde_dogma_units", "dogmaUnits.jsonl", 105)).toEqual([105, "Percentage", "%", null]);
    expect(await row("sde_dogma_attribute_categories", "dogmaAttributeCategories.jsonl", 29)).toEqual([29, "Turrets", "NPC Turrets Attributes"]);
  });

  it("maps the map tables", async () => {
    expect(await row("sde_regions", "mapRegions.jsonl", 10000002)).toEqual([10000002, "The Forge"]);
    expect(await row("sde_constellations", "mapConstellations.jsonl", 20000020)).toEqual([20000020, 10000002, "Kimotoro"]);
    expect(await row("sde_solar_systems", "mapSolarSystems.jsonl", 30000142)).toEqual([30000142, 20000020, 10000002, "Jita", 0.945913, "B"]);
    expect(await row("sde_stations", "npcStations.jsonl", 60003760)).toEqual([60003760, 30000142, 52678, 1000035, 14]);
  });
});

describe("sde_types", () => {
  it("maps the Rifter, picking English and keeping every numeric field", async () => {
    const r = await row("sde_types", "types.jsonl", 587);
    expect(r.slice(0, 3)).toEqual([587, 25, "Rifter"]);
    expect(String(r[3])).toMatch(/^The Rifter is a very powerful combat frigate/);
    //          published mktGrp metaGrp metaLvl techLvl race faction icon graphic mass    volume packVol capacity radius basePrice portion varParent
    expect(r.slice(4)).toEqual([true, 64, 1, 0, 1, 2, 500002, null, 46, 1067000, 27289, 2500, 140, 31, 400000, 1, null]);
  });

  it("turns every absent optional field into null (Jita Trade Hub has no description or mass)", async () => {
    expect(await row("sde_types", "types.jsonl", 52678)).toEqual([
      52678, 15, "Jita Trade Hub", null, false, null, null, null, null, 1, null, null, 24488,
      null, 1, 1, null, 100000, 600000, 1, null,
    ]);
  });
});

describe("dogma", () => {
  it("maps attribute 64, whose description is a plain string and whose stackable is false", async () => {
    expect(await row("sde_dogma_attributes", "dogmaAttributes.jsonl", 64)).toEqual([
      64, "damageMultiplier", "Damage Modifier", "Damage multiplier.", 29, 104, 5, 1, true, false, true, false, 1432,
    ]);
  });

  it("maps effect 92 and its single LocationGroupModifier", async () => {
    expect(await row("sde_dogma_effects", "dogmaEffects.jsonl", 92)).toEqual([
      92, "projectileWeaponDamageMultiply", null, null, 4, false, false, false, false, false,
      null, null, null, null, null, null, null,
    ]);
    expect(await rows("sde_dogma_effect_modifiers", "dogmaEffects.jsonl", 92)).toEqual([
      [92, 0, "shipID", "LocationGroupModifier", 64, 64, 4, null, 55, null],
    ]);
  });

  it("maps effect 5928's modifiers including the two EffectStopper entries", async () => {
    expect(await rows("sde_dogma_effect_modifiers", "dogmaEffects.jsonl", 5928)).toEqual([
      [5928, 0, "targetID", "ItemModifier", 104, 105, 2, null, null, null],
      [5928, 1, "targetID", "LocationRequiredSkillModifier", 1349, 1350, 2, 3454, null, null],
      [5928, 2, "target", "EffectStopper", null, null, null, null, null, 6441],
      [5928, 3, "target", "EffectStopper", null, null, null, null, null, 6442],
      [5928, 4, "targetID", "LocationRequiredSkillModifier", 1349, 1350, 2, 4385, null, null],
    ]);
  });

  it("fans typeDogma out into attributes and effects", async () => {
    expect(await rows("sde_type_attributes", "typeDogma.jsonl", 519)).toEqual([
      [519, 9, 40], [519, 30, 1], [519, 50, 30], [519, 64, 1.1], [519, 182, 3318],
      [519, 204, 0.895], [519, 277, 4], [519, 422, 2], [519, 633, 5],
    ]);
    expect(await rows("sde_type_effects", "typeDogma.jsonl", 519)).toEqual([
      [519, 11, false], [519, 16, false], [519, 89, false], [519, 92, false],
    ]);
  });

  it("returns no rows for an effect with no modifierInfo", () => {
    expect(tableDef("sde_dogma_effect_modifiers").map({ _key: 1, name: "x" })).toEqual([]);
  });
});

describe("sde_type_bonuses fan-out order", () => {
  it("maps the Rifter's two skill bonuses in file order", async () => {
    expect(await rows("sde_type_bonuses", "typeBonus.jsonl", 587)).toEqual([
      [587, 0, "skill", 3329, 1, 7.5, "bonus to <a href=showinfo:3302>Small Projectile Turret</a> rate of fire", 105],
      [587, 1, "skill", 3329, 2, 10, "bonus to <a href=showinfo:3302>Small Projectile Turret</a> falloff", 105],
    ]);
  });

  it("emits skill bonuses before role bonuses even when the record lists roleBonuses first", () => {
    // Verbatim typeBonus record for type 91849 (Algos Navy Issue), build 3484357.
    const record = {
      "_key": 91849,
      "roleBonuses": [{ "bonus": 25.0, "bonusText": { "en": "bonus to <a href=showinfo:3436>Drone</a> max velocity" }, "importance": 1, "unitID": 105 }],
      "types": [{ "_key": 33093, "_value": [
        { "bonus": 10.0, "bonusText": { "en": "bonus to <a href=showinfo:3436>Drone</a> hitpoints and damage" }, "importance": 1, "unitID": 105 },
        { "bonus": 10.0, "bonusText": { "en": "bonus to <a href=showinfo:3301>Small Hybrid Turret</a> damage and tracking speed" }, "importance": 2, "unitID": 105 },
        { "bonus": 10.0, "bonusText": { "en": "bonus to <a href=showinfo:3436>Stasis Webifier Drone</a> factor of velocity decrease and hitpoints" }, "importance": 3, "unitID": 105 },
      ] }],
    };
    expect(tableDef("sde_type_bonuses").map(record)).toEqual([
      [91849, 0, "skill", 33093, 1, 10, "bonus to <a href=showinfo:3436>Drone</a> hitpoints and damage", 105],
      [91849, 1, "skill", 33093, 2, 10, "bonus to <a href=showinfo:3301>Small Hybrid Turret</a> damage and tracking speed", 105],
      [91849, 2, "skill", 33093, 3, 10, "bonus to <a href=showinfo:3436>Stasis Webifier Drone</a> factor of velocity decrease and hitpoints", 105],
      [91849, 3, "role", null, 1, 25, "bonus to <a href=showinfo:3436>Drone</a> max velocity", 105],
    ]);
  });

  it("maps a misc bonus with no bonus value and no unit", () => {
    // Verbatim typeBonus record for type 54838 (EDENCOM Cynosural Jammer), localisations elided
    // to the two languages that matter here; `bonus` and `unitID` really are absent.
    const record = {
      "_key": 54838,
      "iconID": 24419,
      "miscBonuses": [{ "bonusText": { "de": "Anziehungsfeldgeneration blockiert", "en": "Cynosural Field Generation Blocked" }, "importance": 1 }],
    };
    expect(tableDef("sde_type_bonuses").map(record)).toEqual([
      [54838, 0, "misc", null, 1, null, "Cynosural Field Generation Blocked", null],
    ]);
  });
});
