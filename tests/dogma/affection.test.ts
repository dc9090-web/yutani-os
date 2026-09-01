import { describe, it, expect } from "vitest";
import { Operator, State } from "../../src/lib/dogma/data.js";
import { addModule, attachCharge, createFit, makeItem, makeSkill } from "../../src/lib/dogma/fit.js";
import type { CarriedModifier } from "../../src/lib/dogma/effects.js";
import { absoluteDomain, affects, itemForDomain, itemRequiresSkill } from "../../src/lib/dogma/affection.js";
import { fixtureData } from "./fixture.js";
import { mod, world } from "./synthetic.js";

const data = fixtureData("rifter");

/** A Rifter with a gun (+ charge), a rig, a drone, a skill and an implant. */
function harness() {
  const fit = createFit(data, makeItem(data, 587));
  const gun = makeItem(data, 2889, { state: State.Active });
  const charge = makeItem(data, 12608);
  attachCharge(gun, charge);
  addModule(fit, gun, "high", 0);
  const rig = makeItem(data, 31686);
  addModule(fit, rig, "rig", 0);
  const skill = makeSkill(data, 3318, 5);
  fit.skills.set(3318, skill);
  const implant = makeItem(data, 27143);
  fit.implants.push(implant);
  const drone = makeItem(data, 2456);
  fit.drones.push(drone);
  return { fit, gun, charge, rig, skill, implant, drone };
}

const carry = (carrier: ReturnType<typeof makeItem>, modifier: Parameters<typeof mod>[0]): CarriedModifier =>
  ({ carrier, effect: { id: 1, categoryId: 0, state: State.Offline, modifiers: [] }, modifier: mod(modifier) });

describe("itemForDomain", () => {
  it("resolves self, character, ship and other", () => {
    const h = harness();
    expect(itemForDomain(h.fit, h.gun, "self")).toBe(h.gun);
    expect(itemForDomain(h.fit, h.gun, "character")).toBe(h.fit.character);
    expect(itemForDomain(h.fit, h.gun, "ship")).toBe(h.fit.ship);
    expect(itemForDomain(h.fit, h.gun, "other")).toBe(h.charge);
    expect(itemForDomain(h.fit, h.charge, "other")).toBe(h.gun);
    expect(itemForDomain(h.fit, h.rig, "other")).toBeNull();
  });
});

describe("absoluteDomain", () => {
  it("resolves `self` against the carrier and refuses anything but ship or character", () => {
    const h = harness();
    expect(absoluteDomain(h.fit, h.fit.ship, "self")).toBe("ship");
    expect(absoluteDomain(h.fit, h.fit.character, "self")).toBe("character");
    expect(absoluteDomain(h.fit, h.gun, "self")).toBeNull();
    expect(absoluteDomain(h.fit, h.gun, "ship")).toBe("ship");
    expect(absoluteDomain(h.fit, h.gun, "character")).toBe("character");
    expect(absoluteDomain(h.fit, h.gun, "other")).toBeNull();
  });
});

describe("ItemModifier", () => {
  it("hits exactly one item", () => {
    const h = harness();
    const m = carry(h.skill, { func: "ItemModifier", domain: "ship", modifiedAttrId: 48, modifyingAttrId: 310 });
    expect(affects(h.fit, m, h.fit.ship)).toBe(true);
    expect(affects(h.fit, m, h.gun)).toBe(false);
    expect(affects(h.fit, m, h.fit.character)).toBe(false);
  });

  it("with domain self hits only the carrier", () => {
    const h = harness();
    const m = carry(h.skill, { func: "ItemModifier", domain: "self", modifiedAttrId: 310, modifyingAttrId: 280, operation: Operator.PreMul });
    expect(affects(h.fit, m, h.skill)).toBe(true);
    expect(affects(h.fit, m, h.fit.ship)).toBe(false);
  });
});

describe("LocationModifier", () => {
  it("reaches the items on the ship but never the ship or the character", () => {
    const h = harness();
    const m = carry(h.skill, { func: "LocationModifier", domain: "ship", modifiedAttrId: 50, modifyingAttrId: 310 });
    expect(affects(h.fit, m, h.gun)).toBe(true);
    expect(affects(h.fit, m, h.rig)).toBe(true);
    expect(affects(h.fit, m, h.charge)).toBe(true);      // charges are in the ship bucket
    expect(affects(h.fit, m, h.fit.ship)).toBe(false);
    expect(affects(h.fit, m, h.fit.character)).toBe(false);
    expect(affects(h.fit, m, h.implant)).toBe(false);
    expect(affects(h.fit, m, h.drone)).toBe(false);      // drones are in no bucket
  });

  it("reaches implants and skills in the character bucket", () => {
    const h = harness();
    const m = carry(h.fit.character, { func: "LocationModifier", domain: "character", modifiedAttrId: 50, modifyingAttrId: 310 });
    expect(affects(h.fit, m, h.implant)).toBe(true);
    expect(affects(h.fit, m, h.skill)).toBe(true);
    expect(affects(h.fit, m, h.fit.character)).toBe(false);
    expect(affects(h.fit, m, h.gun)).toBe(false);
  });

  it("is skipped when `self` cannot be resolved to a bucket", () => {
    const h = harness();
    const m = carry(h.gun, { func: "LocationModifier", domain: "self", modifiedAttrId: 50, modifyingAttrId: 310 });
    expect(affects(h.fit, m, h.rig)).toBe(false);
    expect(affects(h.fit, m, h.gun)).toBe(false);
  });
});

describe("LocationGroupModifier", () => {
  it("filters the bucket by group", () => {
    const h = harness();
    const m = carry(h.skill, { func: "LocationGroupModifier", domain: "ship", groupId: 55, modifiedAttrId: 64, modifyingAttrId: 64 });
    expect(affects(h.fit, m, h.gun)).toBe(true);        // 200mm AutoCannon II is group 55
    expect(affects(h.fit, m, h.rig)).toBe(false);       // group 777
  });
});

describe("LocationRequiredSkillModifier", () => {
  it("filters the bucket by the affectee's required skills", () => {
    const h = harness();
    // Weapon Upgrades' effect 581: modules on the ship requiring Gunnery (3300).
    const m = carry(h.skill, { func: "LocationRequiredSkillModifier", domain: "ship", skillTypeId: 3300, modifiedAttrId: 50, modifyingAttrId: 310 });
    expect(affects(h.fit, m, h.gun)).toBe(true);        // 2889 requiredSkill2 = 3300
    expect(affects(h.fit, m, h.rig)).toBe(false);       // the rig requires nothing
    expect(affects(h.fit, m, h.fit.ship)).toBe(false);
  });

  it("matches any of the six requiredSkill slots", () => {
    const h = harness();
    for (const [skillTypeId, expected] of [[3302, true], [11084, true], [3319, false]] as const) {
      const m = carry(h.skill, { func: "LocationRequiredSkillModifier", domain: "ship", skillTypeId, modifiedAttrId: 50, modifyingAttrId: 310 });
      expect(affects(h.fit, m, h.gun)).toBe(expected);
    }
  });
});

describe("OwnerRequiredSkillModifier", () => {
  it("reaches owner-modifiable items anywhere in the fit, ignoring the domain", () => {
    const h = harness();
    // Hail S requires 11084; Hobgoblin II requires 24241.
    const toCharge = carry(h.skill, { func: "OwnerRequiredSkillModifier", domain: "character", skillTypeId: 11084, modifiedAttrId: 64, modifyingAttrId: 310 });
    expect(affects(h.fit, toCharge, h.charge)).toBe(true);
    expect(affects(h.fit, toCharge, h.gun)).toBe(false);        // the gun also requires 11084 but is not owner-modifiable
    const toDrone = carry(h.skill, { func: "OwnerRequiredSkillModifier", domain: "character", skillTypeId: 24241, modifiedAttrId: 64, modifyingAttrId: 310 });
    expect(affects(h.fit, toDrone, h.drone)).toBe(true);
    expect(affects(h.fit, toDrone, h.charge)).toBe(false);
  });
});

describe("itemRequiresSkill", () => {
  it("reads the six requiredSkill attributes", () => {
    const w = world();
    const type = w.type({ attrs: [[182, 3300], [277, 5], [1290, 1234], [1288, 2]] });
    const item = makeItem(w.data, type.id);
    expect(itemRequiresSkill(item, 3300)).toBe(true);
    expect(itemRequiresSkill(item, 1234)).toBe(true);
    expect(itemRequiresSkill(item, 9999)).toBe(false);
  });
});
