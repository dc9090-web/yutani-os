import { describe, it, expect } from "vitest";
import { statSync } from "node:fs";
import path from "node:path";
import { FIXTURE_DIR, fixtureData } from "./fixture.js";
import { ATTR, EFFECT, Operator, State } from "../../src/lib/dogma/data.js";

describe("rifter.json", () => {
  const data = fixtureData("rifter");

  it("holds the seed types and their required-skill closure", () => {
    expect(data.types.size).toBe(53);
    for (const id of [587, 2889, 2048, 519, 440, 380, 33076, 31686, 31682, 31724, 484, 5443, 12608,
                      27339, 4256, 12034, 27143, 2456, 626, 3426, 3413, 3318, 11207]) {
      expect(data.types.has(id)).toBe(true);
    }
    // Pulled in transitively: 2889 → 11084 Small Autocannon Specialization → 3312 → 3300 Gunnery.
    for (const id of [11084, 3312, 3302, 3300, 3394, 3392, 3329, 3327, 3411]) {
      expect(data.types.has(id)).toBe(true);
    }
  });

  it("carries the Rifter's hull numbers", () => {
    const rifter = data.types.get(587)!;
    expect(rifter.name).toBe("Rifter");
    expect(rifter.groupId).toBe(25);
    expect(rifter.categoryId).toBe(6);
    expect(rifter.attrs.get(ATTR.cpuOutput)).toBe(130);
    expect(rifter.attrs.get(ATTR.powerOutput)).toBe(41);
    expect(rifter.attrs.get(ATTR.hiSlots)).toBe(3);
    expect(rifter.attrs.get(ATTR.medSlots)).toBe(3);
    expect(rifter.attrs.get(ATTR.lowSlots)).toBe(4);
    expect(rifter.attrs.get(ATTR.rigSlots)).toBe(3);
    expect(rifter.attrs.get(ATTR.turretSlots)).toBe(3);
    expect(rifter.attrs.get(ATTR.launcherSlots)).toBe(2);
    expect(rifter.attrs.get(ATTR.upgradeCapacity)).toBe(400);
    expect(rifter.attrs.get(ATTR.rigSize)).toBe(1);
  });

  it("carries the module numbers the fitting fixtures depend on", () => {
    expect(data.types.get(2889)!.attrs.get(ATTR.cpu)).toBe(9);
    expect(data.types.get(2889)!.attrs.get(ATTR.power)).toBe(4);
    expect(data.types.get(2889)!.groupId).toBe(55);
    expect([...data.types.get(2889)!.effects.keys()]).toContain(EFFECT.turretFitted);
    expect([...data.types.get(2889)!.effects.keys()]).toContain(EFFECT.hiPower);
    expect(data.types.get(2048)!.attrs.get(ATTR.cpu)).toBe(30);
    expect(data.types.get(2048)!.attrs.get(ATTR.power)).toBe(1);
    expect(data.types.get(2048)!.attrs.get(ATTR.maxGroupFitted)).toBe(1);
    expect(data.types.get(519)!.attrs.get(ATTR.cpu)).toBe(30);
    expect(data.types.get(519)!.attrs.get(ATTR.power)).toBe(1);
    expect(data.types.get(440)!.attrs.get(ATTR.power)).toBe(17);
    expect(data.types.get(380)!.attrs.get(ATTR.cpu)).toBe(23);
    expect(data.types.get(5443)!.attrs.get(ATTR.cpu)).toBe(30);
    expect(data.types.get(31686)!.attrs.get(ATTR.upgradeCost)).toBe(300);
    expect(data.types.get(31686)!.attrs.get(ATTR.rigSize)).toBe(1);
    expect(data.types.get(31724)!.attrs.get(ATTR.upgradeCost)).toBe(75);
    expect(data.types.get(31724)!.attrs.get(ATTR.rigSize)).toBe(2);
    expect(data.types.get(4256)!.attrs.get(1298)).toBe(834);   // canFitShipGroup01 = Stealth Bomber
    expect(data.types.get(12034)!.groupId).toBe(834);
  });

  it("carries the fitting skills' bonus attributes", () => {
    expect(data.types.get(3426)!.attrs.get(424)).toBe(5);      // cpuOutputBonus2
    expect(data.types.get(3413)!.attrs.get(313)).toBe(5);      // powerEngineeringOutputBonus
    expect(data.types.get(3318)!.attrs.get(310)).toBe(-5);     // cpuNeedBonus
    expect(data.types.get(11207)!.attrs.get(323)).toBe(-2);    // powerNeedBonus
    expect(data.types.get(27143)!.attrs.get(424)).toBe(1);     // the implant's own +1 %
  });

  it("carries the two-effect skill-scaling pattern", () => {
    expect(data.effects.get(368)!.modifiers).toEqual([
      { func: "ItemModifier", domain: "self", modifiedAttrId: 424, modifyingAttrId: 280, operation: Operator.PreMul },
    ]);
    expect(data.effects.get(397)!.modifiers).toEqual([
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 48, modifyingAttrId: 424, operation: Operator.PostPercent },
    ]);
    expect(data.effects.get(581)!.modifiers).toEqual([
      { func: "LocationRequiredSkillModifier", domain: "ship", modifiedAttrId: 50, modifyingAttrId: 310, operation: Operator.PostPercent, skillTypeId: 3300 },
      { func: "LocationRequiredSkillModifier", domain: "ship", modifiedAttrId: 50, modifyingAttrId: 310, operation: Operator.PostPercent, skillTypeId: 55033 },
    ]);
    expect(data.effects.get(1638)!.modifiers.map((m) => m.skillTypeId)).toEqual([3300, 3319, 55033]);
  });

  it("keeps the online effect patched into the online category", () => {
    expect(data.effects.get(EFFECT.online)!.categoryId).toBe(4);
    expect(data.effects.get(EFFECT.online)!.state).toBe(State.Online);
  });

  it("keeps every attribute the pruned effects read", () => {
    for (const id of [276, 280, 310, 313, 323, 424, 64, ATTR.cpu, ATTR.power, ATTR.cpuOutput, ATTR.powerOutput]) {
      expect(data.attributes.has(id)).toBe(true);
    }
    expect(data.attributes.get(ATTR.cpu)!.stackable).toBe(true);
    expect(data.attributes.get(64)!.stackable).toBe(false);
  });

  it("stays inside the fixture budget", () => {
    expect(statSync(path.join(FIXTURE_DIR, "rifter.json")).size).toBeLessThan(400_000);
  });
});

describe("tengu.json", () => {
  const data = fixtureData("tengu");

  it("holds the hull, the subsystem and their closure", () => {
    expect(data.types.size).toBe(18);
    expect(data.types.has(29984)).toBe(true);
    expect(data.types.has(45601)).toBe(true);
  });

  it("carries the T3 hull's zero slots and five subsystem slots", () => {
    const tengu = data.types.get(29984)!;
    expect(tengu.attrs.get(ATTR.cpuOutput)).toBe(310);
    expect(tengu.attrs.get(ATTR.powerOutput)).toBe(420);
    expect(tengu.attrs.get(ATTR.hiSlots)).toBe(0);
    expect(tengu.attrs.get(ATTR.medSlots)).toBe(0);
    expect(tengu.attrs.get(ATTR.lowSlots)).toBe(0);
    expect(tengu.attrs.get(ATTR.turretSlots)).toBe(0);
    expect(tengu.attrs.get(ATTR.launcherSlots)).toBe(0);
    expect(tengu.attrs.get(ATTR.maxSubSystems)).toBe(5);
  });

  it("carries the subsystem's slot and hardpoint modifier attributes and its three marker effects", () => {
    const sub = data.types.get(45601)!;
    expect(sub.categoryId).toBe(32);
    expect(sub.attrs.get(ATTR.hiSlotModifier)).toBe(7);
    expect(sub.attrs.get(ATTR.medSlotModifier)).toBe(0);
    expect(sub.attrs.get(ATTR.lowSlotModifier)).toBe(0);
    expect(sub.attrs.get(ATTR.turretHardPointModifier)).toBe(0);
    expect(sub.attrs.get(ATTR.launcherHardPointModifier)).toBe(6);
    expect(sub.attrs.get(ATTR.cpuOutput)).toBe(160);
    expect(sub.attrs.get(ATTR.powerOutput)).toBe(190);
    for (const id of [EFFECT.subSystem, EFFECT.hardPointModifier, EFFECT.slotModifier]) {
      expect(sub.effects.has(id)).toBe(true);
    }
  });

  it("baked the hand-coded 3773/3774 modifiers into the snapshot", () => {
    expect(data.effects.get(EFFECT.slotModifier)!.modifiers).toEqual([
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 14, modifyingAttrId: 1374, operation: Operator.ModAdd },
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 13, modifyingAttrId: 1375, operation: Operator.ModAdd },
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 12, modifyingAttrId: 1376, operation: Operator.ModAdd },
    ]);
    expect(data.effects.get(EFFECT.hardPointModifier)!.modifiers).toEqual([
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 102, modifyingAttrId: 1368, operation: Operator.ModAdd },
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 101, modifyingAttrId: 1369, operation: Operator.ModAdd },
    ]);
  });

  it("carries the subsystem's own passive output adds", () => {
    // 3783 cpuOutputAddCpuOutputPassive / 3782 powerOutputAddPassive: ModAdd of the subsystem's own value.
    expect(data.effects.get(3783)!.modifiers).toEqual([
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 48, modifyingAttrId: 48, operation: Operator.ModAdd },
    ]);
    expect(data.effects.get(3782)!.modifiers).toEqual([
      { func: "ItemModifier", domain: "ship", modifiedAttrId: 11, modifyingAttrId: 11, operation: Operator.ModAdd },
    ]);
  });

  it("stays inside the fixture budget", () => {
    expect(statSync(path.join(FIXTURE_DIR, "tengu.json")).size).toBeLessThan(400_000);
  });
});
