/**
 * Drone control and local repair rates, on synthetic fixtures: every attribute is chosen here, so
 * each pinned number is a short hand derivation. Attribute and effect ids are the live SDE's
 * (sde_dogma_attributes / sde_dogma_effects), named in perf.ts.
 */
import { describe, it, expect } from "vitest";
import { ATTR, CATEGORY, Operator, State, type AttrId, type TypeId } from "../../src/lib/dogma/data.js";
import { CHARACTER_ATTR, PERF_ATTR, REPAIR_EFFECT, droneRoom, fitPerformance, launchedDrones } from "../../src/lib/dogma/perf.js";
import { skillGaps } from "../../src/lib/dogma/skill-gaps.js";
import { mod, world } from "./synthetic.js";
import { buildFit } from "./build-fit.js";

type Attrs = [AttrId, number][];
const SHIELD_BONUS = 68, ARMOR_AMOUNT = 84, HULL_AMOUNT = 83, PASTE_MULTIPLIER = 1886;

function bench() {
  const w = world();
  const declare = (id: number, name: string, defaultValue = 0) => w.attr({ id, name, defaultValue, stackable: true, highIsGood: true });
  declare(PERF_ATTR.speed, "speed"); declare(PERF_ATTR.duration, "duration");
  declare(PERF_ATTR.damageMultiplier, "damageMultiplier", 1);
  for (const id of [PERF_ATTR.emDamage, PERF_ATTR.thermalDamage, PERF_ATTR.kineticDamage, PERF_ATTR.explosiveDamage]) declare(id, `damage${id}`);
  declare(PERF_ATTR.droneBandwidth, "droneBandwidth"); declare(PERF_ATTR.droneBandwidthUsed, "droneBandwidthUsed");
  declare(PERF_ATTR.droneCapacity, "droneCapacity");
  declare(CHARACTER_ATTR.maxActiveDrones, "maxActiveDrones");
  declare(SHIELD_BONUS, "shieldBonus"); declare(ARMOR_AMOUNT, "armorDamageAmount"); declare(HULL_AMOUNT, "structureDamageAmount");
  declare(PASTE_MULTIPLIER, "chargedArmorDamageMultiplier");
  declare(ATTR.skillLevel, "skillLevel");
  for (const id of [...REPAIR_EFFECT.shieldBoost, ...REPAIR_EFFECT.armorRepair, ...REPAIR_EFFECT.hullRepair]) {
    w.effect({ id, categoryId: 1, state: State.Active });
  }
  const type = (categoryId: number, attrs: Attrs, effects: [number, boolean][] = [], name: string | null = null): TypeId =>
    w.type({ categoryId, attrs, effects, name }).id;
  return {
    w, data: w.data,
    hull: (bandwidth: number) => type(CATEGORY.ship, [[PERF_ATTR.droneBandwidth, bandwidth], [PERF_ATTR.droneCapacity, 125]], [], "Hull"),
    /** `damage` per shot every `cycleMs`, taking `bandwidth` Mbit/s. */
    drone: (name: string, damage: number, cycleMs: number, bandwidth: number) =>
      type(CATEGORY.drone, [[PERF_ATTR.kineticDamage, damage], [PERF_ATTR.speed, cycleMs], [PERF_ATTR.droneBandwidthUsed, bandwidth]], [], name),
    module: (attrs: Attrs, effectId: number) => type(CATEGORY.module, attrs, [[effectId, true]]),
    charge: () => type(CATEGORY.charge, []),
    /** A skill granting `perLevel` × its level to the character's `maxActiveDrones`, as the Drones skill does. */
    dronesSkill: () => {
      const bonus = w.attr({ name: "maxActiveDroneBonus" }).id;
      const perLevel = w.attr({ name: "perLevel" }).id;
      const scale = w.effect({ modifiers: [mod({ modifiedAttrId: bonus, modifyingAttrId: ATTR.skillLevel, operation: Operator.PreMul })] }).id;
      const grant = w.effect({ modifiers: [mod({ domain: "character", modifiedAttrId: CHARACTER_ATTR.maxActiveDrones, modifyingAttrId: bonus, operation: Operator.ModAdd })] }).id;
      void perLevel;
      return type(CATEGORY.skill, [[bonus, 1]], [[scale, false], [grant, false]], "Drones");
    },
  };
}

describe("drone control", () => {
  function setup(bandwidth: number, level: number) {
    const b = bench();
    const heavy = b.drone("Heavy", 200, 4000, 25);     // 50 dps each
    const light = b.drone("Light", 60, 3000, 5);       // 20 dps each
    const miner = b.drone("Miner", 0, 60000, 5);       // deals nothing
    const skill = b.dronesSkill();
    const fit = buildFit(b.data, b.hull(bandwidth), { drones: [heavy, light, miner], skills: new Map([[skill, level]]) });
    const bay = [{ typeId: heavy, quantity: 3 }, { typeId: light, quantity: 2 }, { typeId: light, quantity: 3 }, { typeId: miner, quantity: 5 }];
    return { fit, bay, heavy, light, miner };
  }

  it("reads the pilot's drone limit, the hull's bandwidth and each type's per-drone figures", () => {
    const { fit, bay, heavy, light, miner } = setup(75, 5);
    const control = fitPerformance(fit, bay).drones!;
    expect(control.maxActive).toBe(5);
    expect(control.bandwidth).toBe(75);
    // Hardest-hitting first; a stack ESI split in two is one type.
    expect(control.types.map((t) => [t.typeId, t.inBay, t.bandwidth, t.dpsEach, t.volleyEach])).toEqual([
      [heavy, 3, 25, 50, 200], [light, 5, 5, 20, 60], [miner, 5, 5, 0, 0],
    ]);
  });

  it("launches the hardest-hitting drones the limits allow, and counts only those", () => {
    const { fit, bay, heavy, light } = setup(75, 5);
    const perf = fitPerformance(fit, bay);
    // 75 Mbit/s carries all three heavies (75), leaving nothing for lights.
    expect(perf.drones!.launched).toEqual({ [heavy]: 3 });
    expect(perf.droneDps).toBe(150);
    expect(perf.dps).toBe(150);
    expect(perf.volley).toBe(600);
    // 60 Mbit/s: two heavies (50), then two lights (10); five-drone limit not reached.
    const tight = setup(60, 5);
    const tightPerf = fitPerformance(tight.fit, tight.bay);
    expect(tightPerf.drones!.launched).toEqual({ [tight.heavy]: 2, [tight.light]: 2 });
    expect(tightPerf.droneDps).toBe(140);
    void light;
  });

  it("stops at the pilot's control limit", () => {
    const { fit, bay, heavy, light } = setup(200, 4);
    const perf = fitPerformance(fit, bay);
    expect(perf.drones!.maxActive).toBe(4);
    expect(perf.drones!.launched).toEqual({ [heavy]: 3, [light]: 1 });
    expect(perf.droneDps).toBe(170);
  });

  it("launches nothing for a pilot without the Drones skill", () => {
    const { fit, bay } = setup(200, 0);
    const perf = fitPerformance(fit, bay);
    expect(perf.drones!.launched).toEqual({});
    expect(perf.droneDps).toBeNull();
    expect(perf.dps).toBeNull();
  });

  it("answers how many more of a type can go out, and totals a selection", () => {
    const { fit, bay, heavy, light } = setup(60, 5);
    const control = fitPerformance(fit, bay).drones!;
    const [heavyType, lightType] = control.types;
    expect(droneRoom(control, {}, heavyType)).toBe(2);                           // bandwidth: 60 / 25
    expect(droneRoom(control, { [heavy]: 2 }, lightType)).toBe(2);               // bandwidth: 10 / 5
    expect(droneRoom(control, { [light]: 5 }, lightType)).toBe(0);               // bay and control limit
    expect(droneRoom(control, { [light]: 4 }, heavyType)).toBe(1);               // control limit: one slot left
    expect(launchedDrones(control, { [heavy]: 1, [light]: 3 })).toEqual({ dps: 110, volley: 380, active: 4, bandwidthUsed: 40 });
    expect(launchedDrones(control, { [heavy]: 9 }).active).toBe(3);              // never more than the bay holds
  });

  it("keeps the old one-per-drone count when no bay is given", () => {
    const { fit } = setup(60, 5);
    const perf = fitPerformance(fit);
    expect(perf.drones).toBeNull();
    expect(perf.droneDps).toBe(70);    // one heavy + one light
  });
});

describe("repair rates", () => {
  it("sums each layer's active local repairers per second", () => {
    const b = bench();
    const booster = b.module([[SHIELD_BONUS, 300], [PERF_ATTR.duration, 4000]], REPAIR_EFFECT.shieldBoost[0]);       // 75 hp/s
    const ancillaryBooster = b.module([[SHIELD_BONUS, 100], [PERF_ATTR.duration, 2000]], REPAIR_EFFECT.shieldBoost[1]); // 50 hp/s
    const armor = b.module([[ARMOR_AMOUNT, 240], [PERF_ATTR.duration, 12000]], REPAIR_EFFECT.armorRepair[0]);         // 20 hp/s
    const hull = b.module([[HULL_AMOUNT, 120], [PERF_ATTR.duration, 24000]], REPAIR_EFFECT.hullRepair[0]);            // 5 hp/s
    const fit = buildFit(b.data, b.hull(0), { modules: [[booster, "mid", 0], [ancillaryBooster, "mid", 1], [armor, "low", 0], [hull, "low", 1]] });
    expect(fitPerformance(fit)).toMatchObject({ shieldBoostRate: 125, armorRepairRate: 20, hullRepairRate: 5 });
  });

  it("is zero for a fit with no repairers, and ignores one that is not running", () => {
    const b = bench();
    expect(fitPerformance(buildFit(b.data, b.hull(0)))).toMatchObject({ shieldBoostRate: 0, armorRepairRate: 0, hullRepairRate: 0 });
    const armor = b.module([[ARMOR_AMOUNT, 240], [PERF_ATTR.duration, 12000]], REPAIR_EFFECT.armorRepair[0]);
    const fit = buildFit(b.data, b.hull(0), { modules: [[armor, "low", 0]] });
    fit.modules[0].item.state = State.Online;
    expect(fitPerformance(fit).armorRepairRate).toBe(0);
  });

  it("does not count a module that merely carries the amount attribute (a remote repairer)", () => {
    const b = bench();
    const remote = b.w.effect({ categoryId: 2, state: State.Active }).id;
    const module = b.module([[ARMOR_AMOUNT, 240], [PERF_ATTR.duration, 12000]], remote);
    expect(fitPerformance(buildFit(b.data, b.hull(0), { modules: [[module, "high", 0]] })).armorRepairRate).toBe(0);
  });

  it("multiplies an ancillary armor repairer by its paste multiplier only while it holds paste", () => {
    const b = bench();
    const ancillary = b.module([[ARMOR_AMOUNT, 100], [PERF_ATTR.duration, 5000], [PASTE_MULTIPLIER, 3]], REPAIR_EFFECT.armorRepair[1]);
    expect(fitPerformance(buildFit(b.data, b.hull(0), { modules: [[ancillary, "low", 0]] })).armorRepairRate).toBe(20);
    const loaded = buildFit(b.data, b.hull(0), { modules: [[ancillary, "low", 0]], charges: new Map([[0, b.charge()]]) });
    expect(fitPerformance(loaded).armorRepairRate).toBe(60);
  });
});

describe("skillGaps", () => {
  function setup(levels: { ship: number; gunnery: number; drones: number; other: number }) {
    const w = world();
    const level = w.attr({ id: ATTR.skillLevel, name: "skillLevel" }).id;
    const speed = w.attr({ name: "maxVelocity" }).id;
    const rof = w.attr({ name: "rof" }).id;
    const droneDamage = w.attr({ name: "droneDamage" }).id;
    const unused = w.attr({ name: "shipBonusOther" }).id;
    const bonus = w.attr({ name: "bonus" }).id;
    const skill = (name: string, modifier: Parameters<typeof mod>[0]) => {
      const scale = w.effect({ modifiers: [mod({ modifiedAttrId: bonus, modifyingAttrId: level, operation: Operator.PreMul })] }).id;
      const apply = w.effect({ modifiers: [mod(modifier)] }).id;
      return w.type({ categoryId: CATEGORY.skill, name, attrs: [[bonus, 5]], effects: [[scale, false], [apply, false]] }).id;
    };
    const gunSkillMarker = w.type({ categoryId: CATEGORY.skill, name: "Gun family" }).id;
    const ship = skill("Navigation", { domain: "ship", modifiedAttrId: speed, modifyingAttrId: bonus });
    const gunnery = skill("Gunnery", { func: "LocationRequiredSkillModifier", domain: "ship", skillTypeId: gunSkillMarker, modifiedAttrId: rof, modifyingAttrId: bonus });
    const drones = skill("Drone Interfacing", { func: "OwnerRequiredSkillModifier", domain: "character", skillTypeId: gunSkillMarker, modifiedAttrId: droneDamage, modifyingAttrId: bonus });
    // Aims at the ship, but at an attribute this hull does not carry — every racial ship skill does this.
    const other = skill("Amarr Battleship", { domain: "ship", modifiedAttrId: unused, modifyingAttrId: bonus });
    const req = w.attr({ id: 182, name: "requiredSkill1" }).id;
    const hull = w.type({ categoryId: CATEGORY.ship, name: "Rifter", attrs: [[speed, 300]] }).id;
    const gun = w.type({ categoryId: CATEGORY.module, name: "200mm AutoCannon", attrs: [[rof, 3000], [req, gunSkillMarker]] }).id;
    const web = w.type({ categoryId: CATEGORY.module, name: "Web", attrs: [] }).id;
    const drone = w.type({ categoryId: CATEGORY.drone, name: "Hobgoblin", attrs: [[droneDamage, 10], [req, gunSkillMarker]] }).id;
    const fit = buildFit(w.data, hull, {
      modules: [[gun, "high", 0], [gun, "high", 1], [web, "mid", 0]], drones: [drone],
      skills: new Map([[ship, levels.ship], [gunnery, levels.gunnery], [drones, levels.drones], [other, levels.other]]),
    });
    return { fit, hull, gun, drone };
  }

  it("lists skills below five that change a number on the fit, by where they land", () => {
    const { fit, hull, gun, drone } = setup({ ship: 4, gunnery: 3, drones: 0, other: 1 });
    expect(skillGaps(fit).map((g) => [g.name, g.level, g.group, g.affects.map((a) => [a.typeId, a.count, a.isShip])])).toEqual([
      ["Drone Interfacing", 0, "drones", [[drone, 1, false]]],
      ["Gunnery", 3, "modules", [[gun, 2, false]]],
      ["Navigation", 4, "ship", [[hull, 1, true]]],
    ]);
  });

  it("leaves out skills at level five, and one whose attribute the hull does not carry", () => {
    const { fit } = setup({ ship: 5, gunnery: 5, drones: 5, other: 2 });
    expect(skillGaps(fit)).toEqual([]);
  });
});
