import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool } from "pg";
import { resetDb, resetSde } from "./helpers.js";
import { closePool } from "../../src/lib/db/client.js";
import { importSde } from "../../src/lib/sde/import.js";
import { FIXTURE_ZIP } from "../sde/fixture.js";
import { loadDogmaData, resetDogmaCache } from "../../src/lib/dogma/sde-loader.js";
import { ATTR, Operator, State, type DogmaData } from "../../src/lib/dogma/data.js";

let pool: Pool;
let data: DogmaData;

beforeAll(async () => {
  pool = await resetDb();
  await resetSde(pool);
  await importSde(FIXTURE_ZIP, pool);
  resetDogmaCache();
  // 587 Rifter, 519 Gyrostabilizer II, 3426 CPU Management, 3413 Power Grid Management.
  data = await loadDogmaData([587, 519, 3426, 3413]);
}, 120_000);
afterAll(async () => { resetDogmaCache(); await closePool(); });

describe("attributes", () => {
  it("loads every attribute in the build", () => {
    expect(data.attributes.size).toBe(2867);
  });

  it("carries defaultValue, stackable and highIsGood", () => {
    expect(data.attributes.get(ATTR.cpu)).toEqual({ id: 50, name: "cpu", defaultValue: 0, stackable: true, highIsGood: false });
    expect(data.attributes.get(64)).toEqual({ id: 64, name: "damageMultiplier", defaultValue: 1, stackable: false, highIsGood: true });
    expect(data.attributes.get(ATTR.drawback)!.defaultValue).toBe(10);
  });

  it("carries maxAttributeId and minAttributeId where the SDE has them", () => {
    expect(data.attributes.get(37)!.maxAttributeId).toBe(2033);
    expect(data.attributes.get(37)!.minAttributeId).toBeUndefined();
    expect(data.attributes.get(20)!.minAttributeId).toBe(2266);
    expect(data.attributes.get(ATTR.cpu)!.maxAttributeId).toBeUndefined();
  });
});

describe("effects", () => {
  it("loads every effect in the build", () => {
    expect(data.effects.size).toBe(22);
  });

  it("patches the online effect into the online category", () => {
    const online = data.effects.get(16)!;
    expect(online.categoryId).toBe(4);
    expect(online.state).toBe(State.Online);
    expect(online.modifiers).toEqual([]);
  });

  it("maps CPU Management's two effects verbatim", () => {
    expect(data.effects.get(368)).toEqual({
      id: 368, categoryId: 0, state: State.Offline,
      modifiers: [{ func: "ItemModifier", domain: "self", modifiedAttrId: 424, modifyingAttrId: 280, operation: Operator.PreMul }],
    });
    expect(data.effects.get(397)).toEqual({
      id: 397, categoryId: 0, state: State.Offline,
      modifiers: [{ func: "ItemModifier", domain: "ship", modifiedAttrId: 48, modifyingAttrId: 424, operation: Operator.PostPercent }],
    });
  });

  it("keeps groupId on a LocationGroupModifier and skillTypeId on a required-skill modifier", () => {
    expect(data.effects.get(92)!.modifiers).toEqual([
      { func: "LocationGroupModifier", domain: "ship", modifiedAttrId: 64, modifyingAttrId: 64, operation: Operator.PostMul, groupId: 55 },
    ]);
    expect(data.effects.get(7248)!.modifiers).toEqual([
      { func: "LocationRequiredSkillModifier", domain: "ship", modifiedAttrId: 51, modifyingAttrId: 460, operation: Operator.PostPercent, skillTypeId: 3302 },
    ]);
  });

  it("drops effect 132 (skillEffect) entirely, not just its unsupported operation-9 row", () => {
    expect(data.effects.has(132)).toBe(false);
  });

  it("drops targetID/target domains and EffectStopper rows, keeping the effect itself", () => {
    // 5928 warpScrambleTargetMWDBlockActivationForEntity: 2 targetID modifiers, 2 EffectStoppers, 1 more targetID.
    expect(data.effects.get(5928)!.modifiers).toEqual([]);
    expect(data.effects.get(5928)!.state).toBe(State.Active);
  });
});

describe("groups", () => {
  it("loads every group with its category", () => {
    expect(data.groups.size).toBe(1610);
    expect(data.groups.get(25)).toEqual({ id: 25, name: "Frigate", categoryId: 6 });
    expect(data.groups.get(1216)).toEqual({ id: 1216, name: "Engineering", categoryId: 16 });
  });
});

describe("types", () => {
  it("loads the requested types and the required-skill closure, skipping ids this build lacks", () => {
    // 587 pulls in 3329 Minmatar Frigate; 3329's own prerequisite 3327 and 519's 3318 are not in the
    // mini fixture's allow-list, so they are skipped instead of throwing.
    expect([...data.types.keys()].sort((a, b) => a - b)).toEqual([519, 587, 3329, 3413, 3426]);
  });

  it("resolves groupId, categoryId and name", () => {
    const rifter = data.types.get(587)!;
    expect(rifter.groupId).toBe(25);
    expect(rifter.categoryId).toBe(6);
    expect(rifter.name).toBe("Rifter");
    expect(data.types.get(3426)!.categoryId).toBe(16);
  });

  it("carries the Rifter's fitting attributes", () => {
    const attrs = data.types.get(587)!.attrs;
    expect(attrs.get(ATTR.cpuOutput)).toBe(130);
    expect(attrs.get(ATTR.powerOutput)).toBe(41);
    expect(attrs.get(ATTR.hiSlots)).toBe(3);
    expect(attrs.get(ATTR.medSlots)).toBe(3);
    expect(attrs.get(ATTR.lowSlots)).toBe(4);
    expect(attrs.get(ATTR.rigSlots)).toBe(3);
    expect(attrs.get(ATTR.turretSlots)).toBe(3);
    expect(attrs.get(ATTR.launcherSlots)).toBe(2);
    expect(attrs.get(ATTR.upgradeCapacity)).toBe(400);
    expect(attrs.get(ATTR.rigSize)).toBe(1);
  });

  it("injects mass/capacity/volume/radius from the sde_types columns", () => {
    const attrs = data.types.get(587)!.attrs;
    expect(attrs.size).toBe(93);        // 89 typeDogma rows + the four columns
    expect(attrs.get(ATTR.mass)).toBe(1067000);
    expect(attrs.get(ATTR.capacity)).toBe(140);
    expect(attrs.get(ATTR.volume)).toBe(27289);
    expect(attrs.get(ATTR.radius)).toBe(31);
  });

  it("injects only the columns that are populated", () => {
    const skill = data.types.get(3426)!.attrs;
    expect(skill.size).toBe(6);          // 5 typeDogma rows + volume only
    expect(skill.get(ATTR.volume)).toBe(0.01);
    expect(skill.has(ATTR.mass)).toBe(false);
    expect(skill.has(ATTR.capacity)).toBe(false);
    expect(skill.has(ATTR.radius)).toBe(false);
  });

  it("carries the type→effect map with isDefault", () => {
    expect([...data.types.get(587)!.effects.entries()]).toEqual([[5779, false], [7248, false]]);
    // 132 (skillEffect) would otherwise be here too — it's dropped from every type's effects map.
    expect([...data.types.get(3426)!.effects.entries()].sort((a, b) => a[0] - b[0])).toEqual([[368, false], [397, false]]);
    expect([...data.types.get(519)!.effects.keys()].sort((a, b) => a - b)).toEqual([11, 16, 89, 92]);
  });
});

describe("memoisation", () => {
  it("returns the same type object for a repeated request and shares the base maps", async () => {
    const again = await loadDogmaData([587]);
    expect(again.types.get(587)).toBe(data.types.get(587));
    expect(again.attributes).toBe(data.attributes);
    expect(again.effects).toBe(data.effects);
    expect(again.groups).toBe(data.groups);
    expect(again.types.has(519)).toBe(false);
  });
});
