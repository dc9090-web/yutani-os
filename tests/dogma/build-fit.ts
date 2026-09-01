import { CATEGORY, type DogmaData, type TypeId } from "../../src/lib/dogma/data.js";
import {
  addModule, attachCharge, createFit, makeItem, makeSkill, type Fit, type SlotKind,
} from "../../src/lib/dogma/fit.js";
import { clearMemo } from "../../src/lib/dogma/calc.js";

/** Every skill type in the snapshot, at the same level — "all skills V" for a fixture. */
export function allSkills(data: DogmaData, level: number): Map<TypeId, number> {
  const out = new Map<TypeId, number>();
  for (const type of data.types.values()) if (type.categoryId === CATEGORY.skill) out.set(type.id, level);
  return out;
}

export interface FitOptions {
  modules?: [TypeId, SlotKind, number][];
  /** index into `modules` → charge type id */
  charges?: Map<number, TypeId>;
  skills?: Map<TypeId, number>;
  implants?: TypeId[];
  drones?: TypeId[];
}

export function buildFit(data: DogmaData, shipTypeId: TypeId, opts: FitOptions = {}): Fit {
  const fit = createFit(data, makeItem(data, shipTypeId));
  for (const [typeId, level] of opts.skills ?? new Map<TypeId, number>()) {
    if (data.types.has(typeId)) fit.skills.set(typeId, makeSkill(data, typeId, level));
  }
  for (const typeId of opts.implants ?? []) fit.implants.push(makeItem(data, typeId));
  for (const typeId of opts.drones ?? []) fit.drones.push(makeItem(data, typeId));
  (opts.modules ?? []).forEach(([typeId, slot, index], i) => {
    const item = makeItem(data, typeId);
    const chargeTypeId = opts.charges?.get(i);
    if (chargeTypeId !== undefined) attachCharge(item, makeItem(data, chargeTypeId));
    addModule(fit, item, slot, index);
  });
  clearMemo(fit);
  return fit;
}
