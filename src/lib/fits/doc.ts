/**
 * The fit document: what React state holds, what the API stores and what EFT text parses into.
 * Pure and isomorphic — this file and everything it imports must stay safe inside a client
 * component, so nothing here may reach for `pg`, `node:*` or `src/lib/dogma/sde-loader.js`.
 */
import {
  DRONE_BAY_FLAG, State, addModule, attachCharge, clearMemo, createFit, makeItem, makeSkill,
  slotFromFlag, type BuiltFit, type Fit, type FitContext, type SlotKind,
} from "../dogma/index.js";

export type FitItemState = "offline" | "online" | "active" | "overload";
/** Ascending by power draw — the order the state toggle cycles through. */
export const FIT_ITEM_STATES: readonly FitItemState[] = ["offline", "online", "active", "overload"];
/** ESI's fitting-flag vocabulary for the cargo hold (spec §2). */
export const CARGO_FLAG = "Cargo";

export interface FitItem {
  typeId: number;
  quantity: number;
  /** HiSlot0..7 | MedSlot0..7 | LoSlot0..7 | RigSlot0..2 | SubSystemSlot0..3 | DroneBay | Cargo */
  flag: string;
  chargeTypeId: number | null;
  state: FitItemState;
}

export interface FitDoc {
  id: number;
  name: string;
  description: string;
  shipTypeId: number;
  /** Whose skills the numbers use. `"all-v"` is the synthetic every-skill-at-5 pilot (spec §3). */
  characterId: number | "all-v";
  items: FitItem[];
}

/** What a `FitDoc` becomes once the engine has seen it. */
export interface DocFit {
  fit: Fit;
  drones: FitItem[];
  cargo: FitItem[];
  /** Items whose type this `DogmaData` does not know — listed, never modelled (spec §7). */
  unknown: FitItem[];
}

const STATE_VALUES: Record<FitItemState, State> = {
  offline: State.Offline, online: State.Online, active: State.Active, overload: State.Overload,
};

export function stateValue(state: FitItemState): State {
  return STATE_VALUES[state];
}

export function stateName(state: State): FitItemState {
  switch (state) {
    case State.Offline: return "offline";
    case State.Online: return "online";
    case State.Overload: return "overload";
    default: return "active";
  }
}

const SLOT_FLAG_PREFIX: Record<SlotKind, string> = {
  high: "HiSlot", mid: "MedSlot", low: "LoSlot", rig: "RigSlot", subsystem: "SubSystemSlot",
};

/** The inverse of phase 4a's `slotFromFlag`. */
export function flagFor(slot: SlotKind, index: number): string {
  return `${SLOT_FLAG_PREFIX[slot]}${index}`;
}

/**
 * Build the engine's `Fit` from a document. An unknown **hull** throws `UnknownTypeError` — there is
 * no fit to show — while an unknown item is collected and skipped (spec §7).
 */
export function fitFromDoc(doc: FitDoc, ctx: FitContext): DocFit {
  const fit = createFit(ctx.data, makeItem(ctx.data, doc.shipTypeId));
  for (const [typeId, level] of ctx.skills) {
    if (ctx.data.types.has(typeId)) fit.skills.set(typeId, makeSkill(ctx.data, typeId, level));
  }
  for (const typeId of ctx.implants) {
    if (ctx.data.types.has(typeId)) fit.implants.push(makeItem(ctx.data, typeId));
  }

  const out: DocFit = { fit, drones: [], cargo: [], unknown: [] };
  for (const entry of doc.items) {
    if (!ctx.data.types.has(entry.typeId)) { out.unknown.push(entry); continue; }
    const place = slotFromFlag(entry.flag);
    if (place === null) {
      if (entry.flag === DRONE_BAY_FLAG) {
        out.drones.push(entry);
        // One modelled drone per row is enough for the skill requirements; drone damage is out of
        // scope (spec §9), exactly as phase 4a's asset builder does it.
        fit.drones.push(makeItem(ctx.data, entry.typeId));
      } else {
        out.cargo.push(entry);
      }
      continue;
    }
    const item = makeItem(ctx.data, entry.typeId, { state: stateValue(entry.state) });
    if (entry.chargeTypeId !== null) {
      if (ctx.data.types.has(entry.chargeTypeId)) {
        attachCharge(item, makeItem(ctx.data, entry.chargeTypeId));
      } else {
        out.unknown.push({
          typeId: entry.chargeTypeId, quantity: 1, flag: entry.flag, chargeTypeId: null, state: entry.state,
        });
      }
    }
    addModule(fit, item, place.slot, place.index);
  }

  clearMemo(fit);
  return out;
}

/**
 * Clone a phase-4 `BuiltFit` (an assembled ship or a saved ESI fitting) into doc items.
 * `built.unfittable` is deliberately dropped: those items carry ESI's `Invalid` flag and were never
 * fitted, so a clone starts without them.
 */
export function docItemsFromBuilt(built: BuiltFit): FitItem[] {
  const items: FitItem[] = [];
  for (const { item, slot, index } of built.fit.modules) {
    items.push({
      typeId: item.typeId,
      quantity: 1,
      flag: flagFor(slot, index),
      chargeTypeId: item.charge?.typeId ?? null,
      state: stateName(item.state),
    });
  }
  for (const drone of built.drones) {
    items.push({ typeId: drone.typeId, quantity: drone.quantity, flag: DRONE_BAY_FLAG, chargeTypeId: null, state: "active" });
  }
  for (const entry of built.cargo) {
    items.push({ typeId: entry.typeId, quantity: entry.quantity, flag: CARGO_FLAG, chargeTypeId: null, state: "active" });
  }
  return items;
}
