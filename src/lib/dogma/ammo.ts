/**
 * Charge compatibility and the "best ammo in cargo" assumption.
 *
 * An assembled ship in the hangar is usually unloaded — the pilot pulls the ammo when docking, or
 * ESI simply reports the guns with nothing in them — so its damage figures would read as nothing.
 * `assumeCargoAmmo` loads every empty turret and launcher with the highest-damage compatible charge
 * the cargo hold carries, marks each such charge `assumed`, and reports what it did so the sheet
 * can say so. Purely additive: modules that already hold a charge are left alone, and the cargo
 * entries themselves are not consumed.
 */
import type { AttrId, DogmaData, DogmaType, TypeId } from "./data.js";
import { attachCharge, hardpointOf, makeItem, type Fit, type Item } from "./fit.js";
import { clearMemo } from "./calc.js";
import type { BuiltFit } from "./build.js";

/** chargeGroup1..5 — the groups a module will accept (spec §4). */
export const CHARGE_GROUP_ATTRS: readonly AttrId[] = [604, 605, 606, 609, 610];
/** chargeSize — a Small launcher does not take a Medium missile. */
export const CHARGE_SIZE_ATTR: AttrId = 128;
/** em, thermal, kinetic, explosive — a charge's raw damage per shot. */
const DAMAGE_ATTRS: readonly AttrId[] = [114, 118, 117, 116];

/** Spec §4's charge filter: the module's `chargeGroup*` must list the charge's group, and sizes must fit. */
export function chargeFits(moduleType: DogmaType, chargeType: DogmaType): boolean {
  const groups: number[] = [];
  for (const attrId of CHARGE_GROUP_ATTRS) {
    const value = moduleType.attrs.get(attrId);
    if (value !== undefined) groups.push(Math.round(value));
  }
  if (groups.length === 0) return false;                    // this module takes no charge at all
  if (!groups.includes(chargeType.groupId)) return false;
  const max = moduleType.attrs.get(CHARGE_SIZE_ATTR);
  const size = chargeType.attrs.get(CHARGE_SIZE_ATTR);
  if (max === undefined || size === undefined) return true; // CCP only sets it where it bites
  return size <= max;
}

export interface AssumedAmmo { slot: string; index: number; moduleTypeId: TypeId; chargeTypeId: TypeId }

/** A charge's raw damage per shot from its own type attributes — the ranking key for "most powerful". */
function rawDamage(type: DogmaType): number {
  let total = 0;
  for (const attrId of DAMAGE_ATTRS) total += type.attrs.get(attrId) ?? 0;
  return total;
}

/**
 * Load every empty weapon from the cargo hold. The pick is the compatible cargo type with the most
 * raw damage per shot (ties: the lower type id, so the choice is stable); a module that takes no
 * charge, or already holds one, is skipped. Returns the loads made, in slot order.
 */
export function assumeCargoAmmo(built: BuiltFit): AssumedAmmo[] {
  const data: DogmaData = built.fit.data;
  const candidates: DogmaType[] = [];
  const seen = new Set<TypeId>();
  for (const entry of built.cargo) {
    if (seen.has(entry.typeId)) continue;
    seen.add(entry.typeId);
    const type = data.types.get(entry.typeId);
    if (type !== undefined && rawDamage(type) > 0) candidates.push(type);
  }
  if (candidates.length === 0) return [];

  const loads: AssumedAmmo[] = [];
  for (const { item, slot, index } of built.fit.modules) {
    if (item.charge !== undefined || hardpointOf(item) === null) continue;
    const moduleType = data.types.get(item.typeId);
    if (moduleType === undefined) continue;
    let best: DogmaType | null = null;
    for (const charge of candidates) {
      if (!chargeFits(moduleType, charge)) continue;
      if (best === null || rawDamage(charge) > rawDamage(best) || (rawDamage(charge) === rawDamage(best) && charge.id < best.id)) best = charge;
    }
    if (best === null) continue;
    const charge: Item = makeItem(data, best.id);
    charge.assumed = true;
    attachCharge(item, charge);
    loads.push({ slot, index, moduleTypeId: item.typeId, chargeTypeId: best.id });
  }
  if (loads.length > 0) clearMemo(built.fit as Fit);
  return loads;
}
