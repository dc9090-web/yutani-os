/**
 * The slot grid and every edit the editor can make to a fit, as pure functions over a `FitDoc`.
 * Isomorphic — this file runs in the browser.
 */
import {
  ATTR, CAN_FIT_SHIP_GROUP_ATTRS, CAN_FIT_SHIP_TYPE_ATTRS, DRONE_BAY_FLAG, EFFECT, SLOT_KINDS, State,
  defaultStateOfType, getAttr, kindOfType, slotFromFlag, slotOfType,
  type AttrId, type DogmaData, type DogmaType, type Fit, type SlotKind,
} from "../dogma/index.js";
import {
  CARGO_FLAG, FIT_ITEM_STATES, flagFor, stateName,
  type FitDoc, type FitItem, type FitItemState,
} from "./doc.js";

export type SlotTotals = Record<SlotKind, number>;
export interface SlotCell { slot: SlotKind; index: number; item: FitItem | null; over: boolean }

/** The charge rule lives with the engine now (dogma/ammo.ts); re-exported so the editor's imports hold. */
export { CHARGE_GROUP_ATTRS, CHARGE_SIZE_ATTR, chargeFits } from "../dogma/ammo.js";

const SLOT_ATTRS: Record<SlotKind, AttrId> = {
  high: ATTR.hiSlots, mid: ATTR.medSlots, low: ATTR.lowSlots,
  rig: ATTR.rigSlots, subsystem: ATTR.maxSubSystems,
};

/**
 * The hull's slot counts **with fitted modifiers applied** — read through the engine, so a
 * subsystem or a slot-modifier module changes the grid the moment it is fitted. The 5 → 4
 * subsystem correction repeats `fitStats`, deliberately: the grid and the counters must agree.
 */
export function slotTotals(fit: Fit): SlotTotals {
  const out = {} as SlotTotals;
  for (const kind of SLOT_KINDS) {
    let total = Math.floor(getAttr(fit, fit.ship, SLOT_ATTRS[kind]));
    if (kind === "subsystem" && total === 5) total = 4;
    out[kind] = Math.max(0, total);
  }
  return out;
}

/** Every slot of every kind, in index order, with the module in it (or `null`). */
export function slotGrid(doc: FitDoc, totals: SlotTotals): Record<SlotKind, SlotCell[]> {
  const byKind = {} as Record<SlotKind, Map<number, FitItem>>;
  for (const kind of SLOT_KINDS) byKind[kind] = new Map();
  for (const entry of doc.items) {
    const place = slotFromFlag(entry.flag);
    if (place !== null) byKind[place.slot].set(place.index, entry);
  }

  const grid = {} as Record<SlotKind, SlotCell[]>;
  for (const kind of SLOT_KINDS) {
    const used = byKind[kind];
    const highest = used.size === 0 ? -1 : Math.max(...used.keys());
    const length = Math.max(totals[kind], highest + 1);
    grid[kind] = Array.from({ length }, (_, index) => ({
      slot: kind, index, item: used.get(index) ?? null, over: index >= totals[kind],
    }));
  }
  return grid;
}

/** The first empty index inside the hull's own count, or `null` when the row is full. */
export function firstFreeIndex(doc: FitDoc, slot: SlotKind, totals: SlotTotals): number | null {
  const taken = new Set<number>();
  for (const entry of doc.items) {
    const place = slotFromFlag(entry.flag);
    if (place !== null && place.slot === slot) taken.add(place.index);
  }
  for (let index = 0; index < totals[slot]; index += 1) if (!taken.has(index)) return index;
  return null;
}

/**
 * Spec §4's Fit button: "adds to the first free matching slot (or replaces the selected slot)".
 * A full row over-fits at the next index rather than refusing — `slotGrid` marks it `.over` and
 * `validateFit` raises the problem.
 */
export function fitTypeInto(
  doc: FitDoc, data: DogmaData, typeId: number, totals: SlotTotals,
  at?: { slot: SlotKind; index: number },
): FitDoc {
  const type = data.types.get(typeId);
  if (type === undefined) return doc;                       // unknown to this SDE build: no-op
  const slot = slotOfType(type);
  if (slot === null) return addLoose(doc, data, type);

  const chosen = at !== undefined && at.slot === slot ? at.index : firstFreeIndex(doc, slot, totals);
  const index = chosen ?? nextIndex(doc, slot);
  const entry: FitItem = {
    typeId, quantity: 1, flag: flagFor(slot, index), chargeTypeId: null,
    state: stateName(defaultStateOfType(data, type, kindOfType(type))),
  };
  const items = [...doc.items];
  const existing = items.findIndex((i) => i.flag === entry.flag);
  if (existing >= 0) items[existing] = entry; else items.push(entry);
  return { ...doc, items };
}

export function removeSlot(doc: FitDoc, slot: SlotKind, index: number): FitDoc {
  const flag = flagFor(slot, index);
  if (!doc.items.some((i) => i.flag === flag)) return doc;
  return { ...doc, items: doc.items.filter((i) => i.flag !== flag) };
}

export function setSlotState(doc: FitDoc, slot: SlotKind, index: number, state: FitItemState): FitDoc {
  return patchSlot(doc, slot, index, (entry) => ({ ...entry, state }));
}

export function setSlotCharge(
  doc: FitDoc, slot: SlotKind, index: number, chargeTypeId: number | null,
): FitDoc {
  return patchSlot(doc, slot, index, (entry) => ({ ...entry, chargeTypeId }));
}

/** Drone-bay and cargo quantities. A quantity of zero or less removes the entry. */
export function setEntryQuantity(doc: FitDoc, flag: string, typeId: number, quantity: number): FitDoc {
  const items = quantity <= 0
    ? doc.items.filter((i) => !(i.flag === flag && i.typeId === typeId))
    : doc.items.map((i) => (i.flag === flag && i.typeId === typeId ? { ...i, quantity } : i));
  return { ...doc, items };
}

/**
 * Spec §4's "Fits this hull" filter. Advisory only — `validateFit` remains the authority and still
 * raises `shipRestriction` / `rigSize` if the filter is cleared and the module fitted anyway. It
 * reads exactly what the engine's validator reads: `canFitShipType1..12` plus `fitsToShipType`
 * (1380), `canFitShipGroup01..20`, and `rigSize` (1547) compared with strict equality — and it
 * repeats the validator's exemption of rigs and subsystems from the hull restriction.
 */
export function canFitShip(shipType: DogmaType, moduleType: DogmaType): boolean {
  const slot = slotOfType(moduleType);

  // `validateFit`'s `allowedOnHull`, attribute for attribute — including `fitsToShipType` (1380)
  // beside `canFitShipType1..12`, and its exemption for rigs and subsystems.
  if (slot !== "rig" && slot !== "subsystem") {
    const allowedTypes = new Set<number>();
    const allowedGroups = new Set<number>();
    for (const attrId of [...CAN_FIT_SHIP_TYPE_ATTRS, ATTR.fitsToShipType]) {
      const value = moduleType.attrs.get(attrId);
      if (value !== undefined && value > 0) allowedTypes.add(Math.round(value));
    }
    for (const attrId of CAN_FIT_SHIP_GROUP_ATTRS) {
      const value = moduleType.attrs.get(attrId);
      if (value !== undefined && value > 0) allowedGroups.add(Math.round(value));
    }
    if ((allowedTypes.size > 0 || allowedGroups.size > 0)
        && !allowedTypes.has(shipType.id) && !allowedGroups.has(shipType.groupId)) {
      return false;
    }
  }

  // `validateFit`'s rigSize rule: rigs only, raw attributes, strict equality, skipped when either
  // side lacks the attribute.
  if (slot === "rig") {
    const rigSize = moduleType.attrs.get(ATTR.rigSize);
    const hullRigSize = shipType.attrs.get(ATTR.rigSize);
    if (rigSize === undefined || hullRigSize === undefined) return true;
    return Math.round(rigSize) === Math.round(hullRigSize);
  }
  return true;
}

/** The states this type can actually be put in — a single-entry list means "render no toggle". */
export function allowedStates(data: DogmaData, type: DogmaType): FitItemState[] {
  // The default state must always be offerable: a rig comes up Online but carries no effect 16.
  const supported = new Set<State>([State.Offline, defaultStateOfType(data, type, kindOfType(type))]);
  if (type.effects.has(EFFECT.online)) supported.add(State.Online);
  for (const effectId of type.effects.keys()) {
    const effect = data.effects.get(effectId);
    if (effect === undefined) continue;
    if (effect.state === State.Active || effect.state === State.Overload) supported.add(effect.state);
  }
  return FIT_ITEM_STATES.filter((name) => supported.has(STATE_BY_NAME[name]));
}

const STATE_BY_NAME: Record<FitItemState, State> = {
  offline: State.Offline, online: State.Online, active: State.Active, overload: State.Overload,
};

function patchSlot(
  doc: FitDoc, slot: SlotKind, index: number, patch: (entry: FitItem) => FitItem,
): FitDoc {
  const flag = flagFor(slot, index);
  if (!doc.items.some((i) => i.flag === flag)) return doc;
  return { ...doc, items: doc.items.map((i) => (i.flag === flag ? patch(i) : i)) };
}

function nextIndex(doc: FitDoc, slot: SlotKind): number {
  let highest = -1;
  for (const entry of doc.items) {
    const place = slotFromFlag(entry.flag);
    if (place !== null && place.slot === slot && place.index > highest) highest = place.index;
  }
  return highest + 1;
}

/** A type with no slot marker: a drone goes to the bay, everything else to the cargo hold. */
function addLoose(doc: FitDoc, data: DogmaData, type: DogmaType): FitDoc {
  const flag = kindOfType(type) === "drone" ? DRONE_BAY_FLAG : CARGO_FLAG;
  const existing = doc.items.findIndex((i) => i.flag === flag && i.typeId === type.id);
  if (existing >= 0) {
    const items = [...doc.items];
    items[existing] = { ...items[existing], quantity: items[existing].quantity + 1 };
    return { ...doc, items };
  }
  return {
    ...doc,
    items: [...doc.items, { typeId: type.id, quantity: 1, flag, chargeTypeId: null, state: "active" }],
  };
}
