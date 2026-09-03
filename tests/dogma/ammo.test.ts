/**
 * The "best ammo in cargo" assumption on a synthetic world: every attribute and group is chosen here.
 */
import { describe, it, expect } from "vitest";
import { CATEGORY, EFFECT, State, type TypeId } from "../../src/lib/dogma/data.js";
import { CHARGE_GROUP_ATTRS, CHARGE_SIZE_ATTR, assumeCargoAmmo, chargeFits } from "../../src/lib/dogma/ammo.js";
import { fitPerformance } from "../../src/lib/dogma/perf.js";
import type { BuiltFit } from "../../src/lib/dogma/build.js";
import { world } from "./synthetic.js";
import { buildFit } from "./build-fit.js";

const EM = 114, THERMAL = 118, KINETIC = 117, EXPLOSIVE = 116, SPEED = 51;

function bench() {
  const w = world();
  for (const [id, name] of [[EM, "emDamage"], [THERMAL, "thermalDamage"], [KINETIC, "kineticDamage"], [EXPLOSIVE, "explosiveDamage"]] as const) {
    w.attr({ id, name, defaultValue: 0, stackable: true, highIsGood: true });
  }
  w.attr({ id: SPEED, name: "speed", defaultValue: 0, stackable: false, highIsGood: false });
  w.attr({ id: CHARGE_SIZE_ATTR, name: "chargeSize", defaultValue: 0 });
  for (const id of CHARGE_GROUP_ATTRS) w.attr({ id, name: `chargeGroup${id}`, defaultValue: 0 });
  w.effect({ id: EFFECT.turretFitted, categoryId: 0, state: State.Offline });
  const fires = w.effect({ categoryId: 2, state: State.Active }).id;
  const ammoGroup = w.group(CATEGORY.charge).id;
  const otherGroup = w.group(CATEGORY.charge).id;
  const gun = w.type({ categoryId: CATEGORY.module, attrs: [[SPEED, 5000], [CHARGE_GROUP_ATTRS[0], ammoGroup], [CHARGE_SIZE_ATTR, 1]], effects: [[EFFECT.turretFitted, false], [fires, true]] }).id;
  const charge = (damage: number, over: { groupId?: number; size?: number } = {}): TypeId =>
    w.type({ categoryId: CATEGORY.charge, groupId: over.groupId ?? ammoGroup, attrs: [[EM, damage], [CHARGE_SIZE_ATTR, over.size ?? 1]] }).id;
  return { w, gun, charge, otherGroup };
}

function built(fit: BuiltFit["fit"], cargoTypeIds: TypeId[]): BuiltFit {
  return { fit, cargo: cargoTypeIds.map((typeId) => ({ typeId, quantity: 100, flag: "Cargo", name: null })), drones: [], unfittable: [], unknown: [] };
}

describe("chargeFits", () => {
  it("wants the charge's group listed and its size no larger than the module's", () => {
    const b = bench();
    const types = b.w.data.types;
    expect(chargeFits(types.get(b.gun)!, types.get(b.charge(10))!)).toBe(true);
    expect(chargeFits(types.get(b.gun)!, types.get(b.charge(10, { groupId: b.otherGroup }))!)).toBe(false);
    expect(chargeFits(types.get(b.gun)!, types.get(b.charge(10, { size: 2 }))!)).toBe(false);
  });
});

describe("assumeCargoAmmo", () => {
  it("loads every empty weapon with the most damaging compatible charge in cargo, and says so", () => {
    const b = bench();
    const weak = b.charge(10), strong = b.charge(40), wrongGroup = b.charge(999, { groupId: b.otherGroup }), tooBig = b.charge(999, { size: 2 });
    const fit = buildFit(b.w.data, b.w.type({ categoryId: CATEGORY.ship }).id, { modules: [[b.gun, "high", 0], [b.gun, "high", 1]] });
    expect(fitPerformance(fit).dps).toBeNull();                 // nothing loaded: no damage at all
    const loads = assumeCargoAmmo(built(fit, [weak, wrongGroup, strong, tooBig]));
    expect(loads).toEqual([
      { slot: "high", index: 0, moduleTypeId: b.gun, chargeTypeId: strong },
      { slot: "high", index: 1, moduleTypeId: b.gun, chargeTypeId: strong },
    ]);
    expect(fit.modules.every(({ item }) => item.charge?.typeId === strong && item.charge.assumed === true)).toBe(true);
    expect(fitPerformance(fit).dps).toBe(16);                   // 2 guns x 40 damage / 5 s
  });

  it("leaves a loaded weapon alone and does nothing without ammo in cargo", () => {
    const b = bench();
    const weak = b.charge(10), strong = b.charge(40);
    const fit = buildFit(b.w.data, b.w.type({ categoryId: CATEGORY.ship }).id, { modules: [[b.gun, "high", 0]], charges: new Map([[0, weak]]) });
    expect(assumeCargoAmmo(built(fit, [strong]))).toEqual([]);
    expect(fit.modules[0].item.charge?.typeId).toBe(weak);
    expect(fit.modules[0].item.charge?.assumed).toBeUndefined();
    const empty = buildFit(b.w.data, b.w.type({ categoryId: CATEGORY.ship }).id, { modules: [[b.gun, "high", 0]] });
    expect(assumeCargoAmmo(built(empty, []))).toEqual([]);
    expect(empty.modules[0].item.charge).toBeUndefined();
  });
});
