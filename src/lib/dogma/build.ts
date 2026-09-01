/**
 * Turning phase-3 rows into fits.
 *
 * The row types are imported with `import type`, which is erased at compile time — this file stays free
 * of any value import from src/lib/db, so the engine remains isomorphic.
 */
import type { AssetRow } from "../db/character-assets.js";
import type { FittingItemRow, FittingRow } from "../db/character-fittings.js";
import type { DogmaData, TypeId } from "./data.js";
import {
  SLOT_KINDS, addModule, attachCharge, createFit, makeItem, makeSkill, slotOfType,
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
    const { slot, index } = slotFromFlag(flag)!;
    const matches: FitEntry[] = [];
    const charges: FitEntry[] = [];
    for (const g of group) {
      // The singleton is the module; anything non-singleton sharing its flag is a charge — including
      // a non-singleton entry whose type happens to carry a slot marker, since a stack is never the
      // module (review tightening #1's non-promotion extends here too).
      if (!g.isSingleton) { classifyKnownOrUnknown(built, ctx.data, g.entry, charges); continue; }
      switch (slotVerdict(ctx.data, g.entry.typeId, slot)) {
        case "unknown": built.unknown.push(g.entry); break;
        case "module": matches.push(g.entry); break;
        // A singleton of the wrong slot kind (e.g. a low-slot module singleton under a HiSlot flag) is
        // neither the module nor a charge — it's unfittable (review tightening: known-and-marker-kind).
        case "mismatch": built.unfittable.push(g.entry); break;
        // A singleton that carries no slot marker at all (category 8 charges can be singleton, item 5)
        // is a charge.
        case "charge": charges.push(g.entry); break;
      }
    }
    if (matches.length === 0) { built.cargo.push(...charges); continue; }
    const [module, ...extra] = matches;
    // A second singleton sharing the flag is not a charge either — it's an unfittable extra module
    // (review tightening #2).
    built.unfittable.push(...extra);
    fitOneModule(built, ctx, module, slot, index, charges);
  }

  clearMemo(built.fit);
  return built;
}

/**
 * A saved ESI fitting has no `is_singleton`, so the module in a slot is the entry whose *type* carries
 * that slot's marker effect; anything else sharing the flag is its charge.
 */
export function fitFromFitting(fitting: FittingRow, items: FittingItemRow[], ctx: FitContext): BuiltFit {
  const built = startFit(ctx, fitting.shipTypeId);
  const slotted = new Map<string, FitEntry[]>();

  for (const row of items) {
    const entry: FitEntry = { typeId: row.typeId, quantity: row.quantity, flag: row.flag, name: null };
    if (row.flag === INVALID_FLAG) { built.unfittable.push(entry); continue; }
    if (slotFromFlag(row.flag)) { pushInto(slotted, row.flag, entry); continue; }
    if (row.flag === DRONE_BAY_FLAG) { addDrone(built, ctx, entry); continue; }
    built.cargo.push(entry);
  }

  for (const flag of orderedFlags(slotted.keys())) {
    const group = slotted.get(flag) ?? [];
    const { slot, index } = slotFromFlag(flag)!;
    const matches: FitEntry[] = [];
    const charges: FitEntry[] = [];
    for (const entry of group) {
      switch (slotVerdict(ctx.data, entry.typeId, slot)) {
        // A type this SDE build doesn't know can't be ruled out either way, so it's neither a module
        // candidate nor a charge — it always lands in `unknown` (never unfittable, never promoted).
        case "unknown": built.unknown.push(entry); break;
        // The entry's type carries this flag's own slot marker: a module candidate.
        case "module": matches.push(entry); break;
        // The entry's type carries a *different* slot's marker — a real module, just the wrong kind
        // for this flag, so it can't be a charge either. Unfittable.
        case "mismatch": built.unfittable.push(entry); break;
        // The entry's type carries no slot marker at all — a charge (or cargo, if no module).
        case "charge": charges.push(entry); break;
      }
    }
    if (matches.length === 0) { built.cargo.push(...charges); continue; }
    const [module, ...extra] = matches;
    // A second marker-carrying entry sharing the flag is not a charge either — it's an unfittable
    // extra module (review tightening #2).
    built.unfittable.push(...extra);
    fitOneModule(built, ctx, module, slot, index, charges);
  }

  clearMemo(built.fit);
  return built;
}

type SlotVerdict = "unknown" | "module" | "mismatch" | "charge";

/**
 * Where a known-or-unknown type stands relative to a slot flag's own kind:
 *  - `unknown`  — this SDE build doesn't have the type at all.
 *  - `module`   — it carries *this* flag's slot marker: a candidate for the module.
 *  - `mismatch` — it carries a *different* slot's marker: a module, just the wrong kind here.
 *  - `charge`   — it carries no slot marker at all.
 */
function slotVerdict(data: DogmaData, typeId: TypeId, flagSlot: SlotKind): SlotVerdict {
  const type = data.types.get(typeId);
  if (!type) return "unknown";
  const kind = slotOfType(type);
  if (kind === null) return "charge";
  return kind === flagSlot ? "module" : "mismatch";
}

/** For a non-singleton asset row: unknown types always land in `unknown`, known types are a charge. */
function classifyKnownOrUnknown(built: BuiltFit, data: DogmaData, entry: FitEntry, charges: FitEntry[]): void {
  if (data.types.has(entry.typeId)) charges.push(entry); else built.unknown.push(entry);
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
