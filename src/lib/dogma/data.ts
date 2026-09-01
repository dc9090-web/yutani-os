/**
 * The dogma data model: ids, enums and the SDE→engine mappings.
 *
 * Pure and isomorphic. Nothing under src/lib/dogma may import node: or pg except sde-loader.ts —
 * phase 5 runs this engine in the browser.
 *
 * Every id here was verified against the SDE (docs/research/dogma-engine.md §5.1/§5.2).
 */

export type AttrId = number;
export type TypeId = number;
export type EffectId = number;
export type GroupId = number;

/**
 * Ascending numeric order === operator precedence, copied from EOS (eos/const/eos.py).
 * PostMulImmune is EOS's own slot (the ancillary armour repairer); the SDE never produces it,
 * but keeping it here means PostAssign is 10 and the ordering matches EOS one-for-one.
 */
export enum Operator {
  PreAssign = 1,
  PreMul = 2,
  PreDiv = 3,
  ModAdd = 4,
  ModSub = 5,
  PostMul = 6,
  PostMulImmune = 7,
  PostDiv = 8,
  PostPercent = 9,
  PostAssign = 10,
}

/** Ascending so an item in state X runs every effect whose required state is <= X. */
export enum State {
  Offline = 1,
  Online = 2,
  Active = 3,
  Overload = 4,
}

/** The order the calculator applies operator buckets in. */
export const OPERATOR_ORDER: readonly Operator[] = [
  Operator.PreAssign, Operator.PreMul, Operator.PreDiv, Operator.ModAdd, Operator.ModSub,
  Operator.PostMul, Operator.PostMulImmune, Operator.PostDiv, Operator.PostPercent, Operator.PostAssign,
];

export type ModifierFunc =
  | "ItemModifier"
  | "LocationModifier"
  | "LocationGroupModifier"
  | "LocationRequiredSkillModifier"
  | "OwnerRequiredSkillModifier";

export type ModifierDomain = "self" | "character" | "ship" | "other";

export interface Modifier {
  func: ModifierFunc;
  domain: ModifierDomain;
  modifiedAttrId: AttrId;
  /** The magnitude source, read as the *fully calculated* value on the carrier item. */
  modifyingAttrId: AttrId;
  operation: Operator;
  /** LocationGroupModifier only. */
  groupId?: GroupId;
  /** LocationRequiredSkillModifier / OwnerRequiredSkillModifier only. */
  skillTypeId?: TypeId;
}

export interface DogmaAttribute {
  id: AttrId;
  name: string | null;
  defaultValue: number;
  stackable: boolean;
  highIsGood: boolean;
  maxAttributeId?: AttrId;
  /** Loaded for completeness; the calculator implements only the upper cap (research §2.6). */
  minAttributeId?: AttrId;
}

export interface DogmaEffect {
  id: EffectId;
  categoryId: number;
  state: State;
  modifiers: Modifier[];
  fittingUsageChanceAttrId?: AttrId;
}

export interface DogmaType {
  id: TypeId;
  groupId: GroupId;
  categoryId: number;
  name: string | null;
  attrs: Map<AttrId, number>;
  /** effectId → isDefault */
  effects: Map<EffectId, boolean>;
}

export interface DogmaGroup {
  id: GroupId;
  name: string | null;
  categoryId: number;
}

export interface DogmaData {
  attributes: Map<AttrId, DogmaAttribute>;
  effects: Map<EffectId, DogmaEffect>;
  types: Map<TypeId, DogmaType>;
  groups: Map<GroupId, DogmaGroup>;
}

export const ATTR = {
  capacitorNeed: 6,
  mass: 4,
  powerOutput: 11,
  lowSlots: 12,
  medSlots: 13,
  hiSlots: 14,
  power: 30,
  capacity: 38,
  cpuOutput: 48,
  cpu: 50,
  launcherSlots: 101,
  turretSlots: 102,
  volume: 161,
  radius: 162,
  skillLevel: 280,
  upgradeCapacity: 1132,
  rigSlots: 1137,
  drawback: 1138,
  upgradeCost: 1153,
  maxSubSystems: 1367,
  turretHardPointModifier: 1368,
  launcherHardPointModifier: 1369,
  hiSlotModifier: 1374,
  medSlotModifier: 1375,
  lowSlotModifier: 1376,
  fitsToShipType: 1380,
  maxGroupFitted: 1544,
  rigSize: 1547,
} as const;

export const EFFECT = {
  loPower: 11,
  hiPower: 12,
  medPower: 13,
  online: 16,
  launcherFitted: 40,
  turretFitted: 42,
  rigSlot: 2663,
  subSystem: 3772,
  hardPointModifier: 3773,
  slotModifier: 3774,
} as const;

export const CATEGORY = {
  ship: 6,
  module: 7,
  charge: 8,
  skill: 16,
  drone: 18,
  implant: 20,
  subsystem: 32,
  fighter: 87,
} as const;

/**
 * requiredSkillN → requiredSkillNLevel. There are exactly six, the ids are non-contiguous, and for
 * n = 5/6 the level id is numerically *below* the skill id. Never derive levelId = skillId + 1.
 */
export const REQUIRED_SKILL_ATTRS: readonly (readonly [AttrId, AttrId])[] = [
  [182, 277], [183, 278], [184, 279], [1285, 1286], [1289, 1287], [1290, 1288],
];

/** canFitShipType1..12 (1-digit, unpadded). */
export const CAN_FIT_SHIP_TYPE_ATTRS: readonly AttrId[] =
  [1302, 1303, 1304, 1305, 1944, 2103, 2463, 2486, 2487, 2488, 2758, 5948];

/** canFitShipGroup01..20 (2-digit, zero-padded). */
export const CAN_FIT_SHIP_GROUP_ATTRS: readonly AttrId[] = [
  1298, 1299, 1300, 1301, 1872, 1879, 1880, 1881, 2065, 2396,
  2476, 2477, 2478, 2479, 2480, 2481, 2482, 2483, 2484, 2485,
];

/** Ship, Charge, Skill, Implant (incl. boosters) and Subsystem carriers never penalise. */
export const PENALTY_IMMUNE_CATEGORY_IDS: ReadonlySet<number> = new Set([6, 8, 16, 20, 32]);

/** cpu, power, cpuOutput, powerOutput — the 2-dp rounding is the fitting tolerance. */
export const ROUNDED_ATTR_IDS: ReadonlySet<AttrId> = new Set([
  ATTR.cpu, ATTR.power, ATTR.cpuOutput, ATTR.powerOutput,
]);

/** sde_types columns that must be injected as dogma attributes (research §4.5). */
export const COLUMN_ATTRS: readonly (readonly [AttrId, "mass" | "capacity" | "volume" | "radius"])[] = [
  [ATTR.mass, "mass"], [ATTR.capacity, "capacity"], [ATTR.volume, "volume"], [ATTR.radius, "radius"],
];

/**
 * The SDE files `online` (16) under effectCategoryID 1 (active); the client treats it as online.
 * EVEShipFit patches the category, EOS special-cases the id — we patch, which is the cleaner fix
 * for a fresh implementation (research §7). Without the patch every online-category effect on
 * every module would be permanently suppressed by full-compliance rule 2.
 */
export const ONLINE_EFFECT_CATEGORY_ID = 4;

/**
 * Effects 3773 and 3774 have no modifierInfo in the SDE (verified: zero rows in
 * sde_dogma_effect_modifiers). Both engines hand-code them; these are EOS's exact modifiers
 * (eos/eve_obj/custom/subsystem_slot_bonus/modifier.py, research §5.4).
 */
export const CUSTOM_EFFECT_MODIFIERS: ReadonlyMap<EffectId, readonly Modifier[]> = new Map([
  [EFFECT.slotModifier, [
    { func: "ItemModifier", domain: "ship", modifiedAttrId: ATTR.hiSlots, modifyingAttrId: ATTR.hiSlotModifier, operation: Operator.ModAdd },
    { func: "ItemModifier", domain: "ship", modifiedAttrId: ATTR.medSlots, modifyingAttrId: ATTR.medSlotModifier, operation: Operator.ModAdd },
    { func: "ItemModifier", domain: "ship", modifiedAttrId: ATTR.lowSlots, modifyingAttrId: ATTR.lowSlotModifier, operation: Operator.ModAdd },
  ]],
  [EFFECT.hardPointModifier, [
    { func: "ItemModifier", domain: "ship", modifiedAttrId: ATTR.turretSlots, modifyingAttrId: ATTR.turretHardPointModifier, operation: Operator.ModAdd },
    { func: "ItemModifier", domain: "ship", modifiedAttrId: ATTR.launcherSlots, modifyingAttrId: ATTR.launcherHardPointModifier, operation: Operator.ModAdd },
  ]],
] satisfies [EffectId, Modifier[]][]);

const SDE_OPERATIONS: ReadonlyMap<number, Operator> = new Map([
  [-1, Operator.PreAssign], [0, Operator.PreMul], [1, Operator.PreDiv], [2, Operator.ModAdd],
  [3, Operator.ModSub], [4, Operator.PostMul], [5, Operator.PostDiv], [6, Operator.PostPercent],
  [7, Operator.PostAssign],
]);

/**
 * `9` occurs exactly once (effect 132, skill points → skill level). We seed skillLevel from the
 * character sheet, so it is a no-op for us — dropped, along with anything unrecognised.
 */
export function operatorFromSde(op: number | null): Operator | null {
  if (op === null) return null;
  return SDE_OPERATIONS.get(op) ?? null;
}

const EFFECT_CATEGORY_STATES: ReadonlyMap<number, State> = new Map([
  [0, State.Offline], [7, State.Offline], [4, State.Online],
  [1, State.Active], [2, State.Active], [5, State.Overload],
]);

/** Categories 3 (area) and 6 (dungeon) have no mapping and no guard in EOS — drop those effects. */
export function stateForEffectCategory(categoryId: number | null): State | null {
  if (categoryId === null) return null;
  return EFFECT_CATEGORY_STATES.get(categoryId) ?? null;
}

const SDE_DOMAINS: ReadonlyMap<string, ModifierDomain> = new Map<string, ModifierDomain>([
  ["itemID", "self"], ["charID", "character"], ["shipID", "ship"], ["otherID", "other"],
]);

/** `targetID`/`target` are projected-only and `structureID` has no EOS equivalent — all dropped. */
export function domainFromSde(domain: string | null): ModifierDomain | null {
  if (domain === null) return "self";
  return SDE_DOMAINS.get(domain) ?? null;
}

export interface DogmaAttributeJson {
  id: AttrId; name: string | null; defaultValue: number; stackable: boolean; highIsGood: boolean;
  maxAttributeId?: AttrId; minAttributeId?: AttrId;
}
export interface DogmaEffectJson {
  id: EffectId; categoryId: number; state: State; modifiers: Modifier[]; fittingUsageChanceAttrId?: AttrId;
}
export interface DogmaTypeJson {
  id: TypeId; groupId: GroupId; categoryId: number; name: string | null;
  attrs: [AttrId, number][]; effects: [EffectId, boolean][];
}
export interface DogmaDataJson {
  attributes: DogmaAttributeJson[];
  effects: DogmaEffectJson[];
  types: DogmaTypeJson[];
  groups: DogmaGroup[];
}

/** Maps are not JSON-representable; snapshots store them as entry arrays. */
export function serialiseDogmaData(data: DogmaData): DogmaDataJson {
  return {
    attributes: [...data.attributes.values()],
    effects: [...data.effects.values()],
    types: [...data.types.values()].map((t) => ({
      id: t.id, groupId: t.groupId, categoryId: t.categoryId, name: t.name,
      attrs: [...t.attrs.entries()], effects: [...t.effects.entries()],
    })),
    groups: [...data.groups.values()],
  };
}

export function deserialiseDogmaData(json: DogmaDataJson): DogmaData {
  return {
    attributes: new Map(json.attributes.map((a) => [a.id, a])),
    effects: new Map(json.effects.map((e) => [e.id, e])),
    types: new Map(json.types.map((t) => [t.id, {
      id: t.id, groupId: t.groupId, categoryId: t.categoryId, name: t.name,
      attrs: new Map(t.attrs), effects: new Map(t.effects),
    }])),
    groups: new Map(json.groups.map((g) => [g.id, g])),
  };
}
