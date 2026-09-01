import { describe, it, expect } from "vitest";
import { ATTR, CATEGORY, EFFECT, State } from "../../src/lib/dogma/data.js";
import {
  CHARACTER_TYPE_ID, HARDPOINTS, SLOT_KINDS, UnknownTypeError, addModule, attachCharge, createFit,
  defaultStateOfType, effectiveState, fitItems, hardpointOf, kindOfType, makeCharacter, makeItem,
  makeSkill, requiredSkills, slotOf,
} from "../../src/lib/dogma/fit.js";
import { fixtureData } from "./fixture.js";
import { world } from "./synthetic.js";

const data = fixtureData("rifter");
const tengu = fixtureData("tengu");

describe("kinds and the EOS domain table", () => {
  it("classifies every fixture type by category", () => {
    expect(kindOfType(data.types.get(587)!)).toBe("ship");
    expect(kindOfType(data.types.get(2889)!)).toBe("module");
    expect(kindOfType(data.types.get(31686)!)).toBe("rig");
    expect(kindOfType(data.types.get(12608)!)).toBe("charge");
    expect(kindOfType(data.types.get(3426)!)).toBe("skill");
    expect(kindOfType(data.types.get(27143)!)).toBe("implant");
    expect(kindOfType(data.types.get(2456)!)).toBe("drone");
    expect(kindOfType(tengu.types.get(45601)!)).toBe("subsystem");
  });

  it("gives each kind the domain and ownerModifiable flag EOS gives it", () => {
    const table: [number, "ship" | "character" | null, boolean][] = [
      [587, null, false],       // Ship
      [2889, "ship", false],    // Module
      [31686, "ship", false],   // Rig
      [12608, "ship", true],    // Charge — owner modifiable
      [27143, "character", false], // Implant
      [3426, "character", false],  // Skill
      [2456, null, true],       // Drone — owner modifiable
    ];
    for (const [typeId, domain, ownerModifiable] of table) {
      const item = makeItem(data, typeId);
      expect([item.typeId, item.domain, item.ownerModifiable]).toEqual([typeId, domain, ownerModifiable]);
    }
    const subsystem = makeItem(tengu, 45601);
    expect([subsystem.domain, subsystem.ownerModifiable]).toEqual(["ship", false]);
    const character = makeCharacter();
    expect([character.typeId, character.domain, character.ownerModifiable]).toEqual([CHARACTER_TYPE_ID, null, false]);
  });

  it("throws on a type this SDE build does not know", () => {
    expect(() => makeItem(data, 999999)).toThrow(UnknownTypeError);
  });
});

describe("slot and hardpoint markers", () => {
  it("reads the marker effects", () => {
    expect(slotOf(makeItem(data, 2889))).toBe("high");
    expect(slotOf(makeItem(data, 5443))).toBe("mid");
    expect(slotOf(makeItem(data, 2048))).toBe("low");
    expect(slotOf(makeItem(data, 31686))).toBe("rig");
    expect(slotOf(makeItem(tengu, 45601))).toBe("subsystem");
    expect(slotOf(makeItem(data, 12608))).toBeNull();
    expect(hardpointOf(makeItem(data, 2889))).toBe("turret");
    expect(hardpointOf(makeItem(data, 2048))).toBeNull();
    expect([...SLOT_KINDS]).toEqual(["high", "mid", "low", "rig", "subsystem"]);
    expect([...HARDPOINTS]).toEqual(["turret", "launcher"]);
  });

  it("lets the rig marker win when a type carries two markers", () => {
    const w = world();
    const type = w.type({ effects: [[EFFECT.loPower, false], [EFFECT.rigSlot, false]] });
    expect(slotOf(makeItem(w.data, type.id))).toBe("rig");
  });
});

describe("default state", () => {
  it("is Active for a type with an active-category effect or a capacitorNeed", () => {
    // 2889 carries effect 34 projectileFired (category 2 → active); 440 has capacitorNeed 40.
    expect(makeItem(data, 2889).state).toBe(State.Active);
    expect(makeItem(data, 440).state).toBe(State.Active);
  });

  it("is Online for a passive or online-only module and for a rig", () => {
    expect(makeItem(data, 2048).state).toBe(State.Online);
    expect(makeItem(data, 519).state).toBe(State.Online);
    expect(makeItem(data, 31686).state).toBe(State.Online);
    expect(makeItem(tengu, 45601).state).toBe(State.Online);
  });

  it("is Offline for the hull, skills, implants and drones", () => {
    expect(makeItem(data, 587).state).toBe(State.Offline);
    expect(makeItem(data, 3426).state).toBe(State.Offline);
    expect(makeItem(data, 27143).state).toBe(State.Offline);
    expect(makeItem(data, 2456).state).toBe(State.Offline);
  });

  it("honours an explicit state and can be asked for a type's default directly", () => {
    expect(makeItem(data, 2889, { state: State.Offline }).state).toBe(State.Offline);
    expect(defaultStateOfType(data, data.types.get(2048)!, "module")).toBe(State.Online);
  });
});

describe("items", () => {
  it("copies the type's attributes so per-item overrides do not leak", () => {
    const a = makeItem(data, 2889);
    const b = makeItem(data, 2889);
    a.attrs.set(ATTR.cpu, 1);
    expect(b.attrs.get(ATTR.cpu)).toBe(9);
    expect(data.types.get(2889)!.attrs.get(ATTR.cpu)).toBe(9);
  });

  it("seeds a skill's attribute 280 with the trained level", () => {
    const skill = makeSkill(data, 3426, 5);
    expect(skill.kind).toBe("skill");
    expect(skill.state).toBe(State.Offline);
    expect(skill.attrs.get(ATTR.skillLevel)).toBe(5);
    expect(makeSkill(data, 3426, 0).attrs.get(ATTR.skillLevel)).toBe(0);
  });

  it("links a charge to its container and makes it inherit the container's state", () => {
    const launcher = makeItem(data, 2889, { state: State.Active });
    const charge = makeItem(data, 12608);
    attachCharge(launcher, charge);
    expect(launcher.charge).toBe(charge);
    expect(charge.container).toBe(launcher);
    expect(effectiveState(charge)).toBe(State.Active);
    launcher.state = State.Offline;
    expect(effectiveState(charge)).toBe(State.Offline);
    expect(effectiveState(launcher)).toBe(State.Offline);
  });

  it("reads the six requiredSkill pairs", () => {
    expect(requiredSkills(makeItem(data, 2889))).toEqual([
      { skillTypeId: 3302, level: 5 }, { skillTypeId: 3300, level: 2 }, { skillTypeId: 11084, level: 1 },
    ]);
    expect(requiredSkills(makeItem(data, 587))).toEqual([{ skillTypeId: 3329, level: 1 }]);
    expect(requiredSkills(makeItem(data, 31686))).toEqual([]);
  });
});

describe("fit", () => {
  it("starts empty around a hull and its synthetic character", () => {
    const fit = createFit(data, makeItem(data, 587));
    expect(fit.data).toBe(data);
    expect(fit.ship.typeId).toBe(587);
    expect(fit.character.typeId).toBe(CHARACTER_TYPE_ID);
    expect(fit.modules).toEqual([]);
    expect(fit.drones).toEqual([]);
    expect(fit.implants).toEqual([]);
    expect(fit.skills.size).toBe(0);
  });

  it("collects every item, charges included, exactly once", () => {
    const fit = createFit(data, makeItem(data, 587));
    const gun = makeItem(data, 2889);
    attachCharge(gun, makeItem(data, 12608));
    addModule(fit, gun, "high", 0);
    addModule(fit, makeItem(data, 2048), "low", 0);
    fit.skills.set(3426, makeSkill(data, 3426, 5));
    fit.implants.push(makeItem(data, 27143));
    fit.drones.push(makeItem(data, 2456));
    const items = fitItems(fit);
    expect(items).toHaveLength(8);           // ship, character, skill, implant, 2 modules, 1 charge, 1 drone
    expect(new Set(items).size).toBe(8);
    expect(items).toContain(fit.ship);
    expect(items).toContain(fit.character);
    expect(items).toContain(gun.charge);
  });

  it("records the slot and index of each module", () => {
    const fit = createFit(data, makeItem(data, 587));
    const slotted = addModule(fit, makeItem(data, 2889), "high", 2);
    expect(slotted).toEqual({ item: fit.modules[0].item, slot: "high", index: 2 });
    expect(fit.modules).toEqual([slotted]);
  });
});
