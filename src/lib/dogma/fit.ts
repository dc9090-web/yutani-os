/**
 * The item and fit model — EOS's `eos/item/*` collapsed into one tagged record.
 *
 * The two properties that drive everything are `domain` and `ownerModifiable`: together they decide
 * which items a LocationModifier / OwnerRequiredSkillModifier can reach (research §1.2).
 */
import {
  ATTR, CATEGORY, EFFECT, REQUIRED_SKILL_ATTRS, State,
  type AttrId, type DogmaData, type DogmaType, type EffectId, type GroupId, type TypeId,
} from "./data.js";

export type SlotKind = "high" | "mid" | "low" | "rig" | "subsystem";
export type Hardpoint = "turret" | "launcher";
export type ItemDomain = "ship" | "character" | null;
export type ItemKind =
  | "ship" | "character" | "module" | "rig" | "subsystem" | "charge" | "implant" | "skill" | "drone";

export const SLOT_KINDS: readonly SlotKind[] = ["high", "mid", "low", "rig", "subsystem"];
export const HARDPOINTS: readonly Hardpoint[] = ["turret", "launcher"];

/** The character is synthetic: the SDE has no "the pilot" type. */
export const CHARACTER_TYPE_ID = 0;
const CHARACTER_CATEGORY_ID = 1;

export class UnknownTypeError extends Error {
  constructor(readonly typeId: TypeId) {
    super(`unknown type ${typeId}`);
    this.name = "UnknownTypeError";
  }
}

export interface Item {
  kind: ItemKind;
  typeId: TypeId;
  categoryId: number;
  groupId: GroupId;
  name: string | null;
  state: State;
  attrs: Map<AttrId, number>;
  /** effectId → isDefault */
  effects: Map<EffectId, boolean>;
  charge?: Item;
  container?: Item;
  /** A charge the app loaded itself (`assumeCargoAmmo`), not one the pilot fitted. */
  assumed?: boolean;
  domain: ItemDomain;
  ownerModifiable: boolean;
}

export interface Slotted {
  item: Item;
  slot: SlotKind;
  index: number;
}

export interface Fit {
  data: DogmaData;
  ship: Item;
  character: Item;
  skills: Map<TypeId, Item>;
  implants: Item[];
  modules: Slotted[];
  drones: Item[];
}

/** research §1.2 — copied from EOS's per-class `_modifier_domain` / `_owner_modifiable`. */
const DOMAIN_TABLE: Record<ItemKind, { domain: ItemDomain; ownerModifiable: boolean }> = {
  ship: { domain: null, ownerModifiable: false },
  character: { domain: null, ownerModifiable: false },
  module: { domain: "ship", ownerModifiable: false },
  rig: { domain: "ship", ownerModifiable: false },
  subsystem: { domain: "ship", ownerModifiable: false },
  charge: { domain: "ship", ownerModifiable: true },
  implant: { domain: "character", ownerModifiable: false },
  skill: { domain: "character", ownerModifiable: false },
  drone: { domain: null, ownerModifiable: true },
};

/** Iteration order matters — a rig wins if a type carries two markers (Pyfa module.py:863). */
const SLOT_MARKERS: readonly (readonly [EffectId, SlotKind])[] = [
  [EFFECT.rigSlot, "rig"], [EFFECT.loPower, "low"], [EFFECT.medPower, "mid"],
  [EFFECT.hiPower, "high"], [EFFECT.subSystem, "subsystem"],
];

const HARDPOINT_MARKERS: readonly (readonly [EffectId, Hardpoint])[] = [
  [EFFECT.turretFitted, "turret"], [EFFECT.launcherFitted, "launcher"],
];

export function slotOfType(type: DogmaType): SlotKind | null {
  for (const [effectId, slot] of SLOT_MARKERS) if (type.effects.has(effectId)) return slot;
  return null;
}

export function hardpointOfType(type: DogmaType): Hardpoint | null {
  for (const [effectId, hardpoint] of HARDPOINT_MARKERS) if (type.effects.has(effectId)) return hardpoint;
  return null;
}

export function kindOfType(type: DogmaType): ItemKind {
  switch (type.categoryId) {
    case CATEGORY.ship: return "ship";
    case CATEGORY.charge: return "charge";
    case CATEGORY.skill: return "skill";
    case CATEGORY.implant: return "implant";
    case CATEGORY.subsystem: return "subsystem";
    case CATEGORY.drone:
    case CATEGORY.fighter: return "drone";
    default: return slotOfType(type) === "rig" ? "rig" : "module";
  }
}

/**
 * Modules come up Active when they can be activated, otherwise Online. Everything else is Offline —
 * including the hull, which is safe because no published category-6 type carries a non-passive effect.
 */
export function defaultStateOfType(data: DogmaData, type: DogmaType, kind: ItemKind): State {
  if (kind !== "module" && kind !== "rig" && kind !== "subsystem") return State.Offline;
  for (const effectId of type.effects.keys()) {
    const effect = data.effects.get(effectId);
    if (effect && effect.state === State.Active) return State.Active;
  }
  return type.attrs.has(ATTR.capacitorNeed) ? State.Active : State.Online;
}

export function makeItem(
  data: DogmaData, typeId: TypeId, over: { kind?: ItemKind; state?: State } = {},
): Item {
  const type = data.types.get(typeId);
  if (!type) throw new UnknownTypeError(typeId);
  const kind = over.kind ?? kindOfType(type);
  const { domain, ownerModifiable } = DOMAIN_TABLE[kind];
  return {
    kind,
    typeId: type.id,
    categoryId: type.categoryId,
    groupId: type.groupId,
    name: type.name,
    state: over.state ?? defaultStateOfType(data, type, kind),
    attrs: new Map(type.attrs),
    effects: new Map(type.effects),
    domain,
    ownerModifiable,
  };
}

export function makeCharacter(): Item {
  return {
    kind: "character",
    typeId: CHARACTER_TYPE_ID,
    categoryId: CHARACTER_CATEGORY_ID,
    groupId: 0,
    name: null,
    state: State.Offline,
    attrs: new Map<AttrId, number>(),
    effects: new Map<EffectId, boolean>(),
    domain: null,
    ownerModifiable: false,
  };
}

/**
 * A skill is an ordinary item whose attribute 280 is seeded with the trained level. The SDE's
 * two-effect pattern (a preMul of the bonus attribute by 280 on the skill, then a postPercent of the
 * target attribute by the bonus attribute) does the rest with no special casing.
 */
export function makeSkill(data: DogmaData, typeId: TypeId, level: number): Item {
  const skill = makeItem(data, typeId, { kind: "skill", state: State.Offline });
  skill.attrs.set(ATTR.skillLevel, level);
  return skill;
}

export function attachCharge(module: Item, charge: Item): void {
  module.charge = charge;
  charge.container = module;
}

export function slotOf(item: Item): SlotKind | null {
  for (const [effectId, slot] of SLOT_MARKERS) if (item.effects.has(effectId)) return slot;
  return null;
}

export function hardpointOf(item: Item): Hardpoint | null {
  for (const [effectId, hardpoint] of HARDPOINT_MARKERS) if (item.effects.has(effectId)) return hardpoint;
  return null;
}

/** A charge has no state of its own (EOS ContainerStateMixin). */
export function effectiveState(item: Item): State {
  return item.container ? item.container.state : item.state;
}

export function requiredSkills(item: Item): { skillTypeId: TypeId; level: number }[] {
  const out: { skillTypeId: TypeId; level: number }[] = [];
  for (const [skillAttr, levelAttr] of REQUIRED_SKILL_ATTRS) {
    const skill = item.attrs.get(skillAttr);
    if (skill === undefined || skill <= 0) continue;
    out.push({ skillTypeId: Math.round(skill), level: Math.round(item.attrs.get(levelAttr) ?? 0) });
  }
  return out;
}

export function createFit(data: DogmaData, ship: Item): Fit {
  return {
    data, ship, character: makeCharacter(),
    skills: new Map<TypeId, Item>(), implants: [], modules: [], drones: [],
  };
}

export function addModule(fit: Fit, item: Item, slot: SlotKind, index: number): Slotted {
  const slotted: Slotted = { item, slot, index };
  fit.modules.push(slotted);
  return slotted;
}

/** Every item in the fit, each exactly once. Charges follow their module. */
export function fitItems(fit: Fit): Item[] {
  const items: Item[] = [fit.ship, fit.character];
  for (const skill of fit.skills.values()) items.push(skill);
  for (const implant of fit.implants) items.push(implant);
  for (const { item } of fit.modules) {
    items.push(item);
    if (item.charge) items.push(item.charge);
  }
  for (const drone of fit.drones) items.push(drone);
  return items;
}
