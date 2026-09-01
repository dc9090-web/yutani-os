import type { AssetRow } from "../db/character-assets.js";
import { flagLabel } from "./enums.js";

export interface AssetNode {
  itemId: number; typeId: number; quantity: number; locationFlag: string;
  isSingleton: boolean; isBlueprintCopy: boolean; name: string | null; children: AssetNode[];
}

/**
 * A root location. `locationType` is the raw ESI `location_type` of the rows sitting directly in it
 * — "station" | "solar_system" | "item" | "other". The page must only call locationLabel/locationLabels
 * for a root whose type is NOT "item": item ids are >= 1e12, which classifyLocation() would happily
 * (and wrongly) call a player structure.
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
export interface TypeInfo { name: string | null; volume: number | null }

export interface AssetViewNode {
  itemId: number; typeName: string; name: string | null; quantity: number;
  flag: string; isBlueprintCopy: boolean; volume: number; children: AssetViewNode[];
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
      typeName: type?.name ?? `Type ${node.typeId}`,
      name: node.name,
      quantity: node.quantity,
      flag: flagLabel(node.locationFlag),
      isBlueprintCopy: node.isBlueprintCopy,
      volume: (type?.volume ?? 0) * node.quantity,
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
