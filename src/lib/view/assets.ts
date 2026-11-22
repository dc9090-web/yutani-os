import type { AssetRow } from "../db/character-assets.js";
import { flagLabel } from "./enums.js";

export interface AssetNode {
  itemId: number; typeId: number; quantity: number; locationFlag: string;
  isSingleton: boolean; isBlueprintCopy: boolean; name: string | null; children: AssetNode[];
}

/**
 * A root location. `locationType` is the raw ESI `location_type` of the rows sitting directly in it
 * — "station" | "solar_system" | "item" | "other". A "item"-typed root is an orphan: ESI reports a
 * structure-docked hangar this way, with `locationId` = the structure's item id, which classifyLocation()
 * happily (and correctly, here) treats as a player structure — see `locationDisplayLabel`.
 */
export interface AssetLocation { locationId: number; locationType: string; itemCount: number; nodes: AssetNode[] }

/**
 * Turns the flat asset list into one tree per root location. Rows with `location_type = 'item'`
 * nest under the row whose `item_id` equals their `location_id`; a row whose parent is missing from
 * the response stays a root (nothing is silently dropped). A parent cycle is impossible in ESI data
 * and, because the walk only ever starts from roots, would leave those rows out rather than loop.
 */
export function buildAssetTree(rows: AssetRow[]): AssetLocation[] {
  const nodes = new Map<number, AssetNode>();
  for (const r of rows) {
    nodes.set(r.itemId, {
      itemId: r.itemId, typeId: r.typeId, quantity: r.quantity, locationFlag: r.locationFlag,
      isSingleton: r.isSingleton, isBlueprintCopy: r.isBlueprintCopy, name: r.name, children: [],
    });
  }
  const roots = new Map<number, { locationType: string; nodes: AssetNode[] }>();
  for (const r of rows) {
    const node = nodes.get(r.itemId);
    if (node === undefined) continue;
    const parent = r.locationType === "item" ? nodes.get(r.locationId) : undefined;
    if (parent !== undefined && parent !== node) {
      parent.children.push(node);
      continue;
    }
    const bucket = roots.get(r.locationId);
    if (bucket === undefined) roots.set(r.locationId, { locationType: r.locationType, nodes: [node] });
    else bucket.nodes.push(node);
  }
  const out: AssetLocation[] = [];
  for (const [locationId, bucket] of roots) {
    sortNodes(bucket.nodes);
    out.push({ locationId, locationType: bucket.locationType, itemCount: countNodes(bucket.nodes), nodes: bucket.nodes });
  }
  // Biggest hangar first; ties broken by id so the order never depends on Map insertion order.
  out.sort((a, b) => b.itemCount - a.itemCount || a.locationId - b.locationId);
  return out;
}

function sortNodes(list: AssetNode[]): void {
  // Flag first (Cargo before LoSlot0…), then assembled/singleton items (ships, containers) before stacks,
  // then id — so a hangar lists its ships and containers ahead of loose stacks.
  list.sort((a, b) =>
    a.locationFlag.localeCompare(b.locationFlag) || Number(b.isSingleton) - Number(a.isSingleton) || a.itemId - b.itemId);
  for (const node of list) sortNodes(node.children);
}

function countNodes(list: AssetNode[]): number {
  let total = 0;
  for (const node of list) total += 1 + countNodes(node.children);
  return total;
}

/** The subset of `SdeType` this module needs; `getTypes()`' map satisfies it structurally. */
/** `isBlueprint` picks the image server's bp/bpc variation; every other type has an "icon". */
export interface TypeInfo { name: string | null; volume: number | null; isBlueprint?: boolean; isCharge?: boolean }

const BLUEPRINT_CATEGORY_ID = 9;
const CHARGE_CATEGORY_ID = 8;
/** Ammunition, scripts, crystals — what sits in a module's own slot beside it. */
export function isChargeCategory(categoryId: number | null | undefined): boolean {
  return categoryId === CHARGE_CATEGORY_ID;
}
export function isBlueprintCategory(categoryId: number | null | undefined): boolean {
  return categoryId === BLUEPRINT_CATEGORY_ID;
}

/** The 32px type image the row shows: blueprints only exist as bp (original) / bpc (copy). */
export function typeIconUrl(typeId: number, isBlueprint: boolean, isCopy: boolean, size: 32 | 64 = 32): string {
  const variation = isBlueprint ? (isCopy ? "bpc" : "bp") : "icon";
  return `https://images.evetech.net/types/${typeId}/${variation}?size=${size}`;
}

export interface AssetViewNode {
  itemId: number; typeId: number; typeName: string; name: string | null; quantity: number;
  flag: string; isBlueprintCopy: boolean; volume: number; iconUrl: string; children: AssetViewNode[];
  /** The raw ESI location_flag (`HiSlot3`), which `flag` is the readable form of. */
  rawFlag: string;
  /** True for ammunition, scripts and crystals. */
  isCharge: boolean;
}

export interface AssetViewLocation {
  locationId: number; label: string; itemCount: number; volume: number; nodes: AssetViewNode[];
}

/** Serialisable view nodes: names resolved, flags humanised, volume already multiplied out. */
export function toViewNodes(nodes: AssetNode[], types: ReadonlyMap<number, TypeInfo>): AssetViewNode[] {
  return nodes.map((node) => {
    const type = types.get(node.typeId);
    return {
      itemId: node.itemId,
      typeId: node.typeId,
      typeName: type?.name ?? `Type ${node.typeId}`,
      name: node.name,
      quantity: node.quantity,
      flag: flagLabel(node.locationFlag),
      rawFlag: node.locationFlag,
      isCharge: type?.isCharge ?? false,
      isBlueprintCopy: node.isBlueprintCopy,
      volume: (type?.volume ?? 0) * node.quantity,
      iconUrl: typeIconUrl(node.typeId, type?.isBlueprint ?? false, node.isBlueprintCopy),
      children: toViewNodes(node.children, types),
    };
  });
}

export function sumVolume(nodes: AssetViewNode[]): number {
  let total = 0;
  for (const node of nodes) total += node.volume + sumVolume(node.children);
  return total;
}

/**
 * Picks a root location's display label. `locationLabels` is asked about every root, including
 * `locationType: "item"` ones — a structure-docked hangar reports `location_id` = the structure's
 * item id, which is by definition not one of the character's own items (an orphan root), so it is a
 * place, not an item. When the id resolves to a real place, its name is used regardless of
 * `locationType`; only an unresolved id (kind "unknown", or nothing came back at all) falls back to
 * "Container <id>".
 */
export function locationDisplayLabel(locationId: number, resolved: { name: string; kind: string } | undefined): string {
  return resolved !== undefined && resolved.kind !== "unknown" ? resolved.name : `Container ${locationId}`;
}

/**
 * Substring filter over type name and custom name. A node is kept when it matches (with all of its
 * children, so an opened ship stays whole) or when any descendant matches (so the match stays
 * reachable). A blank query returns the input array unchanged.
 */
export function filterAssetTree(nodes: AssetViewNode[], query: string): AssetViewNode[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return nodes;
  const out: AssetViewNode[] = [];
  for (const node of nodes) {
    const self = node.typeName.toLowerCase().includes(needle) || (node.name ?? "").toLowerCase().includes(needle);
    const children = filterAssetTree(node.children, query);
    if (self) out.push(node);
    else if (children.length > 0) out.push({ ...node, children });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Grouped contents (redesign hand-off, PAGES.md §6): an open location shows each ship or container
// as a header with its contents in columns — Fitted, Drone bay, Cargo hold — identical items merged
// into one row with a quantity and, for fitted modules, a slot range.

export interface AssetItemRow {
  key: string;
  typeId: number;
  typeName: string;
  /** The pilot's own name for the item (a named container or ship); null for most rows. */
  name: string | null;
  iconUrl: string;
  /** How many: stack quantities summed, or the number of identical modules merged. */
  quantity: number;
  /** "Scan Resolution Script loaded in each"; null when there is nothing to add. */
  note: string | null;
  /** "High 1–6" for fitted modules; null elsewhere. */
  where: string | null;
  isBlueprintCopy: boolean;
}
export interface AssetGroupView { name: string; count: string; items: AssetItemRow[] }
export interface AssetHolderView {
  itemId: number; typeId: number; iconUrl: string;
  title: string;
  /** The pilot's own name for the ship or container. */
  label: string | null;
  summary: string;
  /** Where the holder itself sits, in capitals ("HANGAR"). */
  flag: string;
  groups: AssetGroupView[];
}
export interface AssetContents { holders: AssetHolderView[]; loose: AssetGroupView[] }

const SLOT_FAMILIES: [RegExp, string][] = [
  [/^HiSlot(\d+)$/, "High"], [/^MedSlot(\d+)$/, "Mid"], [/^LoSlot(\d+)$/, "Low"],
  [/^RigSlot(\d+)$/, "Rig"], [/^SubSystemSlot(\d+)$/, "Subsystem"],
];

/** `HiSlot3` -> family 0 ("High"), slot 4; null for anything that is not a fitting slot. */
function slotOf(rawFlag: string): { family: number; name: string; slot: number } | null {
  for (let family = 0; family < SLOT_FAMILIES.length; family++) {
    const match = SLOT_FAMILIES[family][0].exec(rawFlag);
    if (match !== null) return { family, name: SLOT_FAMILIES[family][1], slot: Number(match[1]) + 1 };
  }
  return null;
}

/** [1,2,3,5] -> "1–3, 5". */
function slotRange(slots: number[]): string {
  const sorted = [...slots].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? String(sorted[i]) : `${sorted[i]}–${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(", ");
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

function plainRow(node: AssetViewNode, key: string): AssetItemRow {
  return {
    key, typeId: node.typeId, typeName: node.typeName, name: node.name, iconUrl: node.iconUrl,
    quantity: node.quantity, note: null, where: null, isBlueprintCopy: node.isBlueprintCopy,
  };
}

/** Identical stacks — same type, same custom name, same original/copy — become one row. */
function mergeStacks(nodes: readonly AssetViewNode[], prefix: string): AssetItemRow[] {
  const rows = new Map<string, AssetItemRow>();
  for (const node of nodes) {
    const key = `${prefix}:${node.typeId}:${node.name ?? ""}:${node.isBlueprintCopy ? "c" : "o"}`;
    const row = rows.get(key);
    if (row === undefined) rows.set(key, plainRow(node, key));
    else row.quantity += node.quantity;
  }
  return [...rows.values()];
}

/**
 * The Fitted column. ESI gives a loaded charge the same slot flag as its module, so each slot is a
 * module plus, perhaps, a charge; the charge becomes a note on the module's row. Modules of one type
 * carrying the same charge, in the same slot family, merge into one row with their slot range.
 */
function fittedGroup(nodes: readonly AssetViewNode[]): AssetGroupView | null {
  interface Fitted { family: number; familyName: string; module: AssetViewNode; charge: AssetViewNode | null; slots: number[] }
  const bySlot = new Map<string, { slot: NonNullable<ReturnType<typeof slotOf>>; modules: AssetViewNode[]; charges: AssetViewNode[] }>();
  for (const node of nodes) {
    const slot = slotOf(node.rawFlag);
    if (slot === null) continue;
    const entry = bySlot.get(node.rawFlag) ?? { slot, modules: [], charges: [] };
    (node.isCharge ? entry.charges : entry.modules).push(node);
    bySlot.set(node.rawFlag, entry);
  }
  if (bySlot.size === 0) return null;
  const merged = new Map<string, Fitted>();
  for (const { slot, modules, charges } of bySlot.values()) {
    // A slot holding only a charge (the module's row missing from ESI) still shows what is there.
    const occupants = modules.length > 0 ? modules : charges;
    const charge = modules.length > 0 ? charges[0] ?? null : null;
    for (const module of occupants) {
      const key = `${slot.family}:${module.typeId}:${charge?.typeId ?? 0}`;
      const row = merged.get(key);
      if (row === undefined) merged.set(key, { family: slot.family, familyName: slot.name, module, charge, slots: [slot.slot] });
      else row.slots.push(slot.slot);
    }
  }
  const rows = [...merged.values()].sort((a, b) => a.family - b.family || Math.min(...a.slots) - Math.min(...b.slots));
  const moduleCount = rows.reduce((sum, row) => sum + row.slots.length, 0);
  return {
    name: "Fitted",
    count: plural(moduleCount, "item"),
    items: rows.map((row) => ({
      ...plainRow(row.module, `fit:${row.family}:${row.module.typeId}:${row.charge?.typeId ?? 0}`),
      quantity: row.slots.length,
      note: row.charge === null ? null : `${row.charge.typeName} loaded${row.slots.length > 1 ? " in each" : ""}`,
      where: `${row.familyName} ${slotRange(row.slots)}`,
    })),
  };
}

const GROUP_ORDER = ["Fitted", "Drone bay", "Cargo hold"];
function groupRank(name: string): number {
  const index = GROUP_ORDER.indexOf(name);
  return index === -1 ? GROUP_ORDER.length : index;
}

/** Everything directly inside one ship or container, as columns; deeper containers get a column each. */
function holderGroups(children: readonly AssetViewNode[], prefix: string): AssetGroupView[] {
  const groups: AssetGroupView[] = [];
  const fitted = fittedGroup(children);
  if (fitted !== null) groups.push(fitted);

  const byFlag = new Map<string, AssetViewNode[]>();
  for (const node of children) {
    if (slotOf(node.rawFlag) !== null) continue;
    const list = byFlag.get(node.flag) ?? [];
    list.push(node);
    byFlag.set(node.flag, list);
  }
  for (const [flag, nodes] of byFlag) {
    const items = mergeStacks(nodes, `${prefix}:${flag}`);
    const total = nodes.reduce((sum, node) => sum + node.quantity, 0);
    groups.push({ name: flag, count: flag === "Drone bay" ? plural(total, "drone") : plural(items.length, "stack"), items });
  }
  groups.sort((a, b) => groupRank(a.name) - groupRank(b.name) || a.name.localeCompare(b.name));

  // A container (or a ship in a maintenance bay) inside this one: its contents follow as their own column.
  for (const node of children) {
    if (node.children.length === 0) continue;
    const inner = holderGroups(node.children, `${prefix}:${node.itemId}`);
    const label = node.name === null ? node.typeName : `${node.typeName} “${node.name}”`;
    for (const group of inner) groups.push({ ...group, name: `${label} · ${group.name}` });
  }
  return groups;
}

function holderSummary(node: AssetViewNode): string {
  const inside = countViewNodes(node.children);
  const fitted = node.children.filter((c) => slotOf(c.rawFlag) !== null && !c.isCharge).length;
  const drones = node.children.filter((c) => c.rawFlag === "DroneBay").reduce((sum, c) => sum + c.quantity, 0);
  const cargo = node.children.filter((c) => c.rawFlag === "Cargo").length;
  const parts = [
    fitted > 0 ? `${fitted} fitted` : null,
    drones > 0 ? plural(drones, "drone") : null,
    cargo > 0 ? plural(cargo, "cargo stack") : null,
  ].filter((part): part is string => part !== null);
  return `${plural(inside, "item")} inside${parts.length === 0 ? "" : `: ${parts.join(", ")}`}`;
}

function countViewNodes(nodes: readonly AssetViewNode[]): number {
  let total = 0;
  for (const node of nodes) total += 1 + countViewNodes(node.children);
  return total;
}

/**
 * One location's contents: every item that holds something (a fitted ship, a filled container) as
 * a holder with its columns, and everything else — loose stacks, empty hulls — as columns by where
 * in the station it sits (Hangar, Deliveries, …).
 */
export function locationContents(nodes: readonly AssetViewNode[]): AssetContents {
  const holders: AssetHolderView[] = [];
  const looseByFlag = new Map<string, AssetViewNode[]>();
  for (const node of nodes) {
    if (node.children.length > 0) {
      holders.push({
        itemId: node.itemId, typeId: node.typeId, iconUrl: node.iconUrl.replace(/size=32$/, "size=64"),
        title: node.typeName, label: node.name, summary: holderSummary(node), flag: node.flag.toUpperCase(),
        groups: holderGroups(node.children, String(node.itemId)),
      });
    } else {
      const list = looseByFlag.get(node.flag) ?? [];
      list.push(node);
      looseByFlag.set(node.flag, list);
    }
  }
  const loose = [...looseByFlag].map(([flag, list]): AssetGroupView => {
    const items = mergeStacks(list, `loose:${flag}`);
    return { name: flag, count: plural(items.length, "stack"), items };
  });
  return { holders, loose };
}

function rowMatches(row: AssetItemRow, needle: string): boolean {
  return row.typeName.toLowerCase().includes(needle)
    || (row.name ?? "").toLowerCase().includes(needle)
    || (row.note ?? "").toLowerCase().includes(needle);
}

function filterGroups(groups: readonly AssetGroupView[], needle: string): AssetGroupView[] {
  return groups
    .map((group) => ({ ...group, items: group.items.filter((row) => rowMatches(row, needle)) }))
    .filter((group) => group.items.length > 0);
}

/**
 * Narrows a location's contents to the rows matching `query` (type name, custom name, or the charge
 * note). A holder whose own name matches stays whole, so "Hurricane" still shows the ship's fit.
 * A blank query returns the input unchanged.
 */
export function filterContents(contents: AssetContents, query: string): AssetContents {
  const needle = query.trim().toLowerCase();
  if (needle === "") return contents;
  const holders = contents.holders.flatMap((holder) => {
    if (holder.title.toLowerCase().includes(needle) || (holder.label ?? "").toLowerCase().includes(needle)) return [holder];
    const groups = filterGroups(holder.groups, needle);
    return groups.length === 0 ? [] : [{ ...holder, groups }];
  });
  return { holders, loose: filterGroups(contents.loose, needle) };
}

export function contentsEmpty(contents: AssetContents): boolean {
  return contents.holders.length === 0 && contents.loose.length === 0;
}
