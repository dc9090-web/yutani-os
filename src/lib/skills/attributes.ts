/**
 * Character attributes, implant bonuses and the remap search space. Pure and isomorphic.
 *
 * The bonus ids (175-179) are imported from the phase-3 Skills page rather than redeclared, so the
 * two places that read implants can never disagree about which id means which attribute.
 */
import { ATTRIBUTE_BONUS_ATTR, type AttributeKey } from "../view/skills.js";

export type { AttributeKey };

export const ATTRIBUTE_KEYS: readonly AttributeKey[] =
  ["charisma", "intelligence", "memory", "perception", "willpower"];

/** charisma … willpower, in the order EVE numbers them. */
export const ATTRIBUTE_ATTR: Record<AttributeKey, number> = {
  charisma: 164, intelligence: 165, memory: 166, perception: 167, willpower: 168,
};

export const ATTRIBUTE_KEY_BY_ATTR: ReadonlyMap<number, AttributeKey> =
  new Map(ATTRIBUTE_KEYS.map((key) => [ATTRIBUTE_ATTR[key], key]));

/** Remap rules: floor 17 in each attribute, 14 free points, at most +10 into any one. 5*17+14 = 99. */
export const BASE_ATTRIBUTE = 17;
export const FREE_POINTS = 14;
export const MAX_REMAP_POINTS = 10;
export const TOTAL_ATTRIBUTE_POINTS = 99;

export type AttributeSet = Record<AttributeKey, number>;

export const ZERO_ATTRIBUTES: AttributeSet =
  { charisma: 0, intelligence: 0, memory: 0, perception: 0, willpower: 0 };

export function addAttributes(a: AttributeSet, b: AttributeSet): AttributeSet {
  return {
    charisma: a.charisma + b.charisma, intelligence: a.intelligence + b.intelligence,
    memory: a.memory + b.memory, perception: a.perception + b.perception, willpower: a.willpower + b.willpower,
  };
}

/** One `getTypeAttributes(typeId)` map per implant on the active clone. Boosters are out of scope. */
export function implantBonuses(implantAttributes: readonly ReadonlyMap<number, number>[]): AttributeSet {
  const out: AttributeSet = { ...ZERO_ATTRIBUTES };
  for (const attributes of implantAttributes) {
    for (const key of ATTRIBUTE_KEYS) out[key] += attributes.get(ATTRIBUTE_BONUS_ATTR[key]) ?? 0;
  }
  return out;
}

export function effectiveAttributes(
  base: AttributeSet, implantAttributes: readonly ReadonlyMap<number, number>[],
): AttributeSet {
  return addAttributes(base, implantBonuses(implantAttributes));
}

/**
 * Omega rate (spec §2 ruling — every character on this install is Omega). `primaryAttrId` and
 * `secondaryAttrId` are the VALUES of dogma attributes 180/181, which are themselves ids in
 * 164-168. An id we do not recognise yields 0, which the timeline renders as an untrainable entry.
 */
export function spPerMinute(attrs: AttributeSet, primaryAttrId: number, secondaryAttrId: number): number {
  const primary = ATTRIBUTE_KEY_BY_ATTR.get(primaryAttrId);
  const secondary = ATTRIBUTE_KEY_BY_ATTR.get(secondaryAttrId);
  if (primary === undefined || secondary === undefined) return 0;
  return attrs[primary] + attrs[secondary] / 2;
}

export function isLegalBase(base: AttributeSet): boolean {
  let total = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const value = base[key];
    if (!Number.isInteger(value) || value < BASE_ATTRIBUTE || value > BASE_ATTRIBUTE + MAX_REMAP_POINTS) return false;
    total += value;
  }
  return total === TOTAL_ATTRIBUTE_POINTS;
}

/**
 * Every legal base distribution, walking perception → willpower → intelligence → memory with
 * charisma taking the remainder. The order is part of the contract: `optimalRemap` keeps the first
 * candidate of any tied group, so the search must be deterministic. 2,885 of the 11^4 = 14,641
 * visited tuples leave charisma inside 0..10.
 */
export function enumerateBases(): AttributeSet[] {
  const out: AttributeSet[] = [];
  for (let per = 0; per <= MAX_REMAP_POINTS; per++) {
    for (let wil = 0; wil <= MAX_REMAP_POINTS; wil++) {
      for (let int = 0; int <= MAX_REMAP_POINTS; int++) {
        for (let mem = 0; mem <= MAX_REMAP_POINTS; mem++) {
          const cha = FREE_POINTS - per - wil - int - mem;
          if (cha < 0 || cha > MAX_REMAP_POINTS) continue;
          out.push({
            charisma: BASE_ATTRIBUTE + cha, intelligence: BASE_ATTRIBUTE + int,
            memory: BASE_ATTRIBUTE + mem, perception: BASE_ATTRIBUTE + per, willpower: BASE_ATTRIBUTE + wil,
          });
        }
      }
    }
  }
  return out;
}
