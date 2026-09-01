/**
 * Turning phase-3 rows into fits.
 *
 * The row types are imported with `import type`, which is erased at compile time — this file stays free
 * of any value import from src/lib/db, so the engine remains isomorphic.
 */
import type { AssetRow } from "../db/character-assets.js";
import type { DogmaData, TypeId } from "./data.js";
import {
  SLOT_KINDS, addModule, attachCharge, createFit, makeItem, makeSkill,
  type Fit, type Item, type SlotKind,
} from "./fit.js";
import { clearMemo } from "./calc.js";

export interface FitContext {
  data: DogmaData;
  /** typeId → trained level, from character_skills. */
  skills: Map<TypeId, number>;
  /** the active clone's implants, from character_implants. */
  implants: TypeId[];
}

export interface FitEntry {
  typeId: TypeId;
  quantity: number;
  flag: string;
  name: string | null;
}

export interface BuiltFit {
  fit: Fit;
  cargo: FitEntry[];
  drones: FitEntry[];
  /** Fitting items whose flag is `Invalid` — listed, never modelled. */
  unfittable: FitEntry[];
  /** Items whose type this SDE build does not know (spec §6). */
  unknown: FitEntry[];
}

export const DRONE_BAY_FLAG = "DroneBay";
export const INVALID_FLAG = "Invalid";

const SLOT_FLAG_PREFIXES: readonly (readonly [string, SlotKind])[] = [
  ["HiSlot", "high"], ["MedSlot", "mid"], ["LoSlot", "low"],
  ["RigSlot", "rig"], ["SubSystemSlot", "subsystem"],
];

export function slotFromFlag(flag: string): { slot: SlotKind; index: number } | null {
  for (const [prefix, slot] of SLOT_FLAG_PREFIXES) {
    if (!flag.startsWith(prefix)) continue;
    const rest = flag.slice(prefix.length);
    if (!/^\d+$/.test(rest)) return null;
    return { slot, index: Number(rest) };
  }
  return null;
}

export function fitFromAssets(shipAsset: AssetRow, childAssets: AssetRow[], ctx: FitContext): BuiltFit {
  const built = startFit(ctx, shipAsset.typeId);
  const slotted = new Map<string, { entry: FitEntry; isSingleton: boolean }[]>();

  for (const asset of childAssets) {
    if (asset.locationId !== shipAsset.itemId) continue;      // not inside this ship
    const entry: FitEntry = {
      typeId: asset.typeId, quantity: asset.quantity, flag: asset.locationFlag, name: asset.name,
    };
    if (slotFromFlag(asset.locationFlag)) {
      pushInto(slotted, asset.locationFlag, { entry, isSingleton: asset.isSingleton });
      continue;
    }
    if (asset.locationFlag === DRONE_BAY_FLAG) { addDrone(built, ctx, entry); continue; }
    built.cargo.push(entry);
  }

  for (const flag of orderedFlags(slotted.keys())) {
    const group = slotted.get(flag) ?? [];
    // The singleton is the module; anything non-singleton sharing its flag is a charge.
    const module = group.find((g) => g.isSingleton) ?? group[0];
    const { slot, index } = slotFromFlag(flag)!;
    fitOneModule(built, ctx, module.entry, slot, index, group.filter((g) => g !== module).map((g) => g.entry));
  }

  clearMemo(built.fit);
  return built;
}

function startFit(ctx: FitContext, shipTypeId: TypeId): BuiltFit {
  // An unknown hull is fatal for this fit; the caller renders "Could not compute".
  const fit = createFit(ctx.data, makeItem(ctx.data, shipTypeId));
  for (const [typeId, level] of ctx.skills) {
    if (ctx.data.types.has(typeId)) fit.skills.set(typeId, makeSkill(ctx.data, typeId, level));
  }
  for (const typeId of ctx.implants) {
    if (ctx.data.types.has(typeId)) fit.implants.push(makeItem(ctx.data, typeId));
  }
  return { fit, cargo: [], drones: [], unfittable: [], unknown: [] };
}

function fitOneModule(
  built: BuiltFit, ctx: FitContext, entry: FitEntry, slot: SlotKind, index: number, charges: FitEntry[],
): void {
  const item = tryMakeItem(built, ctx, entry);
  if (!item) {
    built.cargo.push(...charges);        // nothing to hang them on
    return;
  }
  let attached = false;
  for (const chargeEntry of charges) {
    if (attached) { built.cargo.push(chargeEntry); continue; }
    const charge = tryMakeItem(built, ctx, chargeEntry);
    if (!charge) continue;
    attachCharge(item, charge);
    attached = true;
  }
  addModule(built.fit, item, slot, index);
}

function tryMakeItem(built: BuiltFit, ctx: FitContext, entry: FitEntry): Item | null {
  if (!ctx.data.types.has(entry.typeId)) {
    built.unknown.push(entry);
    return null;
  }
  return makeItem(ctx.data, entry.typeId);
}

function addDrone(built: BuiltFit, ctx: FitContext, entry: FitEntry): void {
  built.drones.push(entry);
  // Drones' contribution is out of scope (spec §8); one modelled item per row is enough for skills.
  const item = tryMakeItem(built, ctx, entry);
  if (item) built.fit.drones.push(item);
}

function pushInto<T>(into: Map<string, T[]>, key: string, value: T): void {
  const list = into.get(key);
  if (list) list.push(value); else into.set(key, [value]);
}

/** Stable module order: by slot kind, then by index. */
function orderedFlags(flags: Iterable<string>): string[] {
  return [...flags].sort((a, b) => {
    const left = slotFromFlag(a)!;
    const right = slotFromFlag(b)!;
    const bySlot = SLOT_KINDS.indexOf(left.slot) - SLOT_KINDS.indexOf(right.slot);
    return bySlot !== 0 ? bySlot : left.index - right.index;
  });
}
