import { describe, it, expect } from "vitest";
import {
  ATTR, CATEGORY, CAN_FIT_SHIP_GROUP_ATTRS, CAN_FIT_SHIP_TYPE_ATTRS, COLUMN_ATTRS, CUSTOM_EFFECT_MODIFIERS,
  EFFECT, ONLINE_EFFECT_CATEGORY_ID, OPERATOR_ORDER, Operator, PENALTY_IMMUNE_CATEGORY_IDS,
  REQUIRED_SKILL_ATTRS, ROUNDED_ATTR_IDS, State, deserialiseDogmaData, domainFromSde, operatorFromSde,
  serialiseDogmaData, stateForEffectCategory, type DogmaData,
} from "../../src/lib/dogma/data.js";

describe("operator enum", () => {
  it("is ordered so that ascending numeric order is precedence order", () => {
    expect(Operator.PreAssign).toBe(1);
    expect(Operator.PostAssign).toBe(10);
    expect([...OPERATOR_ORDER]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(OPERATOR_ORDER.indexOf(Operator.ModAdd)).toBeLessThan(OPERATOR_ORDER.indexOf(Operator.PostPercent));
  });

  it("maps every SDE operation int that the engine honours", () => {
    expect(operatorFromSde(-1)).toBe(Operator.PreAssign);
    expect(operatorFromSde(0)).toBe(Operator.PreMul);
    expect(operatorFromSde(1)).toBe(Operator.PreDiv);
    expect(operatorFromSde(2)).toBe(Operator.ModAdd);
    expect(operatorFromSde(3)).toBe(Operator.ModSub);
    expect(operatorFromSde(4)).toBe(Operator.PostMul);
    expect(operatorFromSde(5)).toBe(Operator.PostDiv);
    expect(operatorFromSde(6)).toBe(Operator.PostPercent);
    expect(operatorFromSde(7)).toBe(Operator.PostAssign);
  });

  it("drops operation 9 (effect 132's skill-points→level op), unknown ints and null", () => {
    expect(operatorFromSde(9)).toBeNull();
    expect(operatorFromSde(8)).toBeNull();
    expect(operatorFromSde(null)).toBeNull();
  });

  it("never produces PostMulImmune, which is EOS's own slot", () => {
    for (const op of [-1, 0, 1, 2, 3, 4, 5, 6, 7]) expect(operatorFromSde(op)).not.toBe(Operator.PostMulImmune);
  });
});

describe("state", () => {
  it("ascends so `>=` gates effects", () => {
    expect(State.Offline).toBe(1);
    expect(State.Online).toBe(2);
    expect(State.Active).toBe(3);
    expect(State.Overload).toBe(4);
  });

  it("maps effect categories to the state that runs them", () => {
    expect(stateForEffectCategory(0)).toBe(State.Offline);
    expect(stateForEffectCategory(7)).toBe(State.Offline);
    expect(stateForEffectCategory(4)).toBe(State.Online);
    expect(stateForEffectCategory(1)).toBe(State.Active);
    expect(stateForEffectCategory(2)).toBe(State.Active);
    expect(stateForEffectCategory(5)).toBe(State.Overload);
  });

  it("has no mapping for area (3), dungeon (6), unknown or null", () => {
    expect(stateForEffectCategory(3)).toBeNull();
    expect(stateForEffectCategory(6)).toBeNull();
    expect(stateForEffectCategory(99)).toBeNull();
    expect(stateForEffectCategory(null)).toBeNull();
  });
});

describe("domains", () => {
  it("maps the four domains the engine supports", () => {
    expect(domainFromSde(null)).toBe("self");
    expect(domainFromSde("itemID")).toBe("self");
    expect(domainFromSde("charID")).toBe("character");
    expect(domainFromSde("shipID")).toBe("ship");
    expect(domainFromSde("otherID")).toBe("other");
  });

  it("drops projected and structure domains", () => {
    expect(domainFromSde("targetID")).toBeNull();
    expect(domainFromSde("target")).toBeNull();
    expect(domainFromSde("structureID")).toBeNull();
  });
});

describe("constants", () => {
  it("carries the verified fitting attribute ids", () => {
    expect(ATTR.cpu).toBe(50);
    expect(ATTR.power).toBe(30);
    expect(ATTR.cpuOutput).toBe(48);
    expect(ATTR.powerOutput).toBe(11);
    expect(ATTR.upgradeCapacity).toBe(1132);
    expect(ATTR.upgradeCost).toBe(1153);
    expect(ATTR.hiSlots).toBe(14);
    expect(ATTR.medSlots).toBe(13);
    expect(ATTR.lowSlots).toBe(12);
    expect(ATTR.rigSlots).toBe(1137);
    expect(ATTR.maxSubSystems).toBe(1367);
    expect(ATTR.turretSlots).toBe(102);
    expect(ATTR.launcherSlots).toBe(101);
    expect(ATTR.rigSize).toBe(1547);
    expect(ATTR.maxGroupFitted).toBe(1544);
    expect(ATTR.skillLevel).toBe(280);
    expect(ATTR.capacitorNeed).toBe(6);
    expect(ATTR.fitsToShipType).toBe(1380);
  });

  it("carries the verified marker effect ids", () => {
    expect(EFFECT).toEqual({
      loPower: 11, hiPower: 12, medPower: 13, online: 16, launcherFitted: 40, turretFitted: 42,
      rigSlot: 2663, subSystem: 3772, hardPointModifier: 3773, slotModifier: 3774,
    });
  });

  it("lists the six non-contiguous requiredSkill/level attribute pairs", () => {
    expect(REQUIRED_SKILL_ATTRS.map((p) => [...p])).toEqual([
      [182, 277], [183, 278], [184, 279], [1285, 1286], [1289, 1287], [1290, 1288],
    ]);
  });

  it("lists canFitShipType 1..12 and canFitShipGroup 01..20", () => {
    expect([...CAN_FIT_SHIP_TYPE_ATTRS]).toEqual([1302, 1303, 1304, 1305, 1944, 2103, 2463, 2486, 2487, 2488, 2758, 5948]);
    expect([...CAN_FIT_SHIP_GROUP_ATTRS]).toEqual([
      1298, 1299, 1300, 1301, 1872, 1879, 1880, 1881, 2065, 2396,
      2476, 2477, 2478, 2479, 2480, 2481, 2482, 2483, 2484, 2485,
    ]);
  });

  it("exempts ship, charge, skill, implant and subsystem carriers from the stacking penalty", () => {
    expect([...PENALTY_IMMUNE_CATEGORY_IDS].sort((a, b) => a - b)).toEqual([6, 8, 16, 20, 32]);
    expect(CATEGORY.module).toBe(7);
    expect(CATEGORY.drone).toBe(18);
    expect(PENALTY_IMMUNE_CATEGORY_IDS.has(CATEGORY.module)).toBe(false);
    expect(PENALTY_IMMUNE_CATEGORY_IDS.has(CATEGORY.drone)).toBe(false);
  });

  it("rounds exactly the four fitting attributes to 2 dp", () => {
    expect([...ROUNDED_ATTR_IDS].sort((a, b) => a - b)).toEqual([11, 30, 48, 50]);
  });

  it("injects the four sde_types columns as attributes", () => {
    expect(COLUMN_ATTRS.map((p) => [...p])).toEqual([[4, "mass"], [38, "capacity"], [161, "volume"], [162, "radius"]]);
  });

  it("patches the online effect into the online category", () => {
    expect(ONLINE_EFFECT_CATEGORY_ID).toBe(4);
  });
});

describe("hand-coded subsystem effects", () => {
  it("gives 3774 the three slot adds and 3773 the two hardpoint adds", () => {
    expect(CUSTOM_EFFECT_MODIFIERS.get(3774)!.map((m) => ({ ...m }))).toEqual([
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 14, modifyingAttrId: 1374, operation: Operator.ModAdd },
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 13, modifyingAttrId: 1375, operation: Operator.ModAdd },
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 12, modifyingAttrId: 1376, operation: Operator.ModAdd },
    ]);
    expect(CUSTOM_EFFECT_MODIFIERS.get(3773)!.map((m) => ({ ...m }))).toEqual([
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 102, modifyingAttrId: 1368, operation: Operator.ModAdd },
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 101, modifyingAttrId: 1369, operation: Operator.ModAdd },
    ]);
    expect([...CUSTOM_EFFECT_MODIFIERS.keys()].sort((a, b) => a - b)).toEqual([3773, 3774]);
  });
});

describe("json round trip", () => {
  const data: DogmaData = {
    attributes: new Map([
      [50, { id: 50, name: "cpu", defaultValue: 0, stackable: true, highIsGood: false }],
      [37, { id: 37, name: "maxVelocity", defaultValue: 0, stackable: false, highIsGood: true, maxAttributeId: 2033 }],
    ]),
    effects: new Map([
      [397, {
        id: 397, categoryId: 0, state: State.Offline,
        modifiers: [{ func: "ItemModifier", domain: "ship", modifiedAttrId: 48, modifyingAttrId: 424, operation: Operator.PostPercent }],
      }],
      [16, { id: 16, categoryId: 4, state: State.Online, modifiers: [], fittingUsageChanceAttrId: 1234 }],
    ]),
    types: new Map([[587, {
      id: 587, groupId: 25, categoryId: 6, name: "Rifter",
      attrs: new Map([[48, 130], [11, 41]]), effects: new Map([[5779, false], [7248, true]]),
    }]]),
    groups: new Map([[25, { id: 25, name: "Frigate", categoryId: 6 }]]),
  };

  it("survives JSON.stringify → JSON.parse → deserialise unchanged", () => {
    const round = deserialiseDogmaData(JSON.parse(JSON.stringify(serialiseDogmaData(data))));
    expect(round.attributes.get(37)).toEqual(data.attributes.get(37));
    expect(round.attributes.get(50)!.maxAttributeId).toBeUndefined();
    expect(round.effects.get(397)).toEqual(data.effects.get(397));
    expect(round.effects.get(16)!.fittingUsageChanceAttrId).toBe(1234);
    expect(round.types.get(587)!.attrs.get(48)).toBe(130);
    expect(round.types.get(587)!.effects.get(7248)).toBe(true);
    expect(round.groups.get(25)).toEqual({ id: 25, name: "Frigate", categoryId: 6 });
  });

  it("serialises maps as arrays so the snapshot is plain JSON", () => {
    const json = serialiseDogmaData(data);
    expect(Array.isArray(json.types)).toBe(true);
    expect(json.types[0].attrs).toEqual([[48, 130], [11, 41]]);
    expect(json.types[0].effects).toEqual([[5779, false], [7248, true]]);
  });
});
