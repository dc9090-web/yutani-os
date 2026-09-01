import { describe, it, expect } from "vitest";
import { ATTR, Operator, State } from "../../src/lib/dogma/data.js";
import { clearMemo, explain, getAttr } from "../../src/lib/dogma/calc.js";
import { fixtureData } from "./fixture.js";
import { allSkills, buildFit } from "./build-fit.js";

const data = fixtureData("rifter");
const tengu = fixtureData("tengu");
const skills = (pairs: [number, number][]) => new Map<number, number>(pairs);

describe("Rifter CPU and powergrid output", () => {
  it("is 130 tf / 41 MW on a bare hull with no skills", () => {
    const fit = buildFit(data, 587);
    expect(getAttr(fit, fit.ship, ATTR.cpuOutput)).toBe(130);
    expect(getAttr(fit, fit.ship, ATTR.powerOutput)).toBe(41);
  });

  it("is 162.5 tf / 51.25 MW with CPU Management V and Power Grid Management V", () => {
    const fit = buildFit(data, 587, { skills: skills([[3426, 5], [3413, 5]]) });
    expect(getAttr(fit, fit.ship, ATTR.cpuOutput)).toBe(162.5);
    expect(getAttr(fit, fit.ship, ATTR.powerOutput)).toBe(51.25);
  });

  it("scales with the trained level, and the 2-dp rounding cleans up the float", () => {
    // 130 × 1.15 is 149.49999999999999 in IEEE-754; the cpuOutput rounding makes it 149.5.
    const fit = buildFit(data, 587, { skills: skills([[3426, 3]]) });
    expect(getAttr(fit, fit.ship, ATTR.cpuOutput)).toBe(149.5);
    expect(getAttr(fit, fit.ship, ATTR.powerOutput)).toBe(41);
  });

  it("takes a fitting implant through the character domain onto the ship", () => {
    const alone = buildFit(data, 587, { implants: [27143] });
    expect(getAttr(alone, alone.ship, ATTR.cpuOutput)).toBe(131.3);           // 130 × 1.01
    const both = buildFit(data, 587, { implants: [27143], skills: skills([[3426, 5]]) });
    // 130 × 1.25 × 1.01 = 164.125 exactly: an exact 2dp tie, rounded to the even neighbour 164.12.
    expect(getAttr(both, both.ship, ATTR.cpuOutput)).toBe(164.12);
  });

  it("stacks the skill and the implant unpenalised, because cpuOutput is stackable", () => {
    const fit = buildFit(data, 587, { implants: [27143], skills: skills([[3426, 5]]) });
    const applied = explain(fit, fit.ship, ATTR.cpuOutput);
    expect(applied.every((a) => !a.penalised)).toBe(true);
  });
});

describe("Weapon Upgrades and Advanced Weapon Upgrades", () => {
  const gun: [number, "high", number] = [2889, "high", 0];

  it("charges a turret its full CPU and PG at skill 0", () => {
    const fit = buildFit(data, 587, { modules: [gun] });
    expect(getAttr(fit, fit.modules[0].item, ATTR.cpu)).toBe(9);
    expect(getAttr(fit, fit.modules[0].item, ATTR.power)).toBe(4);
  });

  it("takes 25 % off a turret's CPU at Weapon Upgrades V", () => {
    const fit = buildFit(data, 587, { modules: [gun], skills: skills([[3318, 5]]) });
    expect(getAttr(fit, fit.modules[0].item, ATTR.cpu)).toBe(6.75);
    expect(getAttr(fit, fit.modules[0].item, ATTR.power)).toBe(4);
  });

  it("takes 10 % off a turret's powergrid at Advanced Weapon Upgrades V", () => {
    const fit = buildFit(data, 587, { modules: [gun], skills: skills([[11207, 5]]) });
    expect(getAttr(fit, fit.modules[0].item, ATTR.power)).toBe(3.6);
    expect(getAttr(fit, fit.modules[0].item, ATTR.cpu)).toBe(9);
  });

  it("does not reach a module that does not require Gunnery", () => {
    // Gyrostabilizer II requires Weapon Upgrades (3318), not Gunnery (3300), so effect 581 misses it.
    const fit = buildFit(data, 587, { modules: [[519, "low", 0]], skills: skills([[3318, 5], [11207, 5]]) });
    expect(getAttr(fit, fit.modules[0].item, ATTR.cpu)).toBe(30);
    expect(getAttr(fit, fit.modules[0].item, ATTR.power)).toBe(1);
  });
});

describe("group and drawback modifiers", () => {
  it("applies a rig's drawback to the powergrid of every projectile weapon on the ship", () => {
    // Rig 31686 carries effect 2708: postPercent power ← drawback (10) on group 55.
    const fit = buildFit(data, 587, { modules: [[2889, "high", 0], [31686, "rig", 0]] });
    expect(getAttr(fit, fit.modules[0].item, ATTR.power)).toBe(4.4);
  });

  it("penalises a module-sourced damage bonus and stops it when the module goes offline", () => {
    const fit = buildFit(data, 587, { modules: [[2889, "high", 0], [519, "low", 0]] });
    const gun = fit.modules[0].item;
    const gyro = fit.modules[1].item;
    expect(getAttr(fit, gun, 64)).toBeCloseTo(3.8115, 10);     // 3.465 × 1.1
    expect(explain(fit, gun, 64).map((a) => a.penalised)).toEqual([true]);
    gyro.state = State.Offline;
    clearMemo(fit);
    expect(getAttr(fit, gun, 64)).toBe(3.465);
  });
});

describe("T3 subsystems", () => {
  it("adds the subsystem's own CPU and powergrid to the hull", () => {
    const fit = buildFit(tengu, 29984, { modules: [[45601, "subsystem", 0]] });
    expect(getAttr(fit, fit.ship, ATTR.cpuOutput)).toBe(470);    // 310 + 160
    expect(getAttr(fit, fit.ship, ATTR.powerOutput)).toBe(610);  // 420 + 190
  });

  it("adds slots and hardpoints through the hand-coded effects 3774 and 3773", () => {
    const bare = buildFit(tengu, 29984);
    expect(getAttr(bare, bare.ship, ATTR.hiSlots)).toBe(0);
    expect(getAttr(bare, bare.ship, ATTR.launcherSlots)).toBe(0);
    const fit = buildFit(tengu, 29984, { modules: [[45601, "subsystem", 0]] });
    expect(getAttr(fit, fit.ship, ATTR.hiSlots)).toBe(7);         // 0 + hiSlotModifier 7
    expect(getAttr(fit, fit.ship, ATTR.medSlots)).toBe(0);
    expect(getAttr(fit, fit.ship, ATTR.lowSlots)).toBe(0);
    expect(getAttr(fit, fit.ship, ATTR.launcherSlots)).toBe(6);   // 0 + launcherHardPointModifier 6
    expect(getAttr(fit, fit.ship, ATTR.turretSlots)).toBe(0);
    expect(getAttr(fit, fit.ship, ATTR.maxSubSystems)).toBe(5);
  });
});

describe("explain", () => {
  it("lists CPU Management on the ship's cpuOutput", () => {
    const fit = buildFit(data, 587, { skills: allSkills(data, 5) });
    const applied = explain(fit, fit.ship, ATTR.cpuOutput);
    expect(applied).toHaveLength(1);
    expect(applied[0]).toMatchObject({
      carrierTypeId: 3426,
      carrierName: "CPU Management",
      effectId: 397,
      operator: Operator.PostPercent,
      modifyingAttrId: 424,
      rawValue: 25,
      value: 0.25,
      penalised: false,
    });
    expect(applied[0].carrier).toBe(fit.skills.get(3426));
  });

  it("lists Power Grid Management on the ship's powerOutput and nothing on a bare hull", () => {
    const fit = buildFit(data, 587, { skills: allSkills(data, 5) });
    expect(explain(fit, fit.ship, ATTR.powerOutput).map((a) => a.carrierTypeId)).toEqual([3413]);
    const bare = buildFit(data, 587);
    expect(explain(bare, bare.ship, ATTR.cpuOutput)).toEqual([]);
  });

  it("lists Weapon Upgrades on a turret's cpu", () => {
    const fit = buildFit(data, 587, { modules: [[2889, "high", 0]], skills: allSkills(data, 5) });
    const applied = explain(fit, fit.modules[0].item, ATTR.cpu);
    expect(applied.map((a) => [a.carrierTypeId, a.effectId, a.rawValue])).toEqual([[3318, 581, -25]]);
  });
});
