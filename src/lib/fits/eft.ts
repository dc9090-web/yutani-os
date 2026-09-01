/**
 * EFT text (spec §5). Pure and isomorphic: the editor exports in the browser, the import route
 * parses on the server, and neither one touches a database from here.
 */
import {
  DRONE_BAY_FLAG, defaultStateOfType, kindOfType, slotFromFlag, slotOfType,
  type DogmaData, type SlotKind,
} from "../dogma/index.js";
import { CARGO_FLAG, flagFor, stateName, type FitDoc, type FitItem } from "./doc.js";
import { slotGrid, type SlotTotals } from "./slots.js";

export interface EftLine {
  name: string;
  chargeName: string | null;
  quantity: number;
  offline: boolean;
  /** Set for an `[Empty X slot]` marker; `name` is empty then. */
  empty: SlotKind | null;
}
export interface EftText { shipName: string; fitName: string; lines: EftLine[] }
export interface EftAssignment {
  shipTypeId: number; name: string; items: FitItem[]; unresolved: string[];
}

/** Spec §5's section order. Drones and cargo follow, in that order. */
export const EFT_SECTIONS: readonly SlotKind[] = ["low", "mid", "high", "rig", "subsystem"];

const SECTION_LABELS: Record<SlotKind, string> = {
  low: "Low", mid: "Med", high: "High", rig: "Rig", subsystem: "Subsystem",
};
const SECTION_BY_LABEL = new Map<string, SlotKind>(
  EFT_SECTIONS.map((slot) => [SECTION_LABELS[slot].toLowerCase(), slot]));

const OFFLINE_SUFFIX = "/offline";
const HEADER = /^\[(.+?), (.+)\]$/;
const EMPTY_MARKER = /^\[Empty (.+) slot\]$/i;
const QUANTITY = / x(\d+)$/;

function typeName(data: DogmaData, typeId: number): string {
  return data.types.get(typeId)?.name ?? `Unknown type (${typeId})`;
}

export function exportEft(doc: FitDoc, data: DogmaData, totals: SlotTotals): string {
  const grid = slotGrid(doc, totals);
  const lines: string[] = [`[${typeName(data, doc.shipTypeId)}, ${doc.name}]`];

  for (const slot of EFT_SECTIONS) {
    for (const cell of grid[slot]) {
      if (cell.item === null) { lines.push(`[Empty ${SECTION_LABELS[slot]} slot]`); continue; }
      const charge = cell.item.chargeTypeId === null ? "" : `, ${typeName(data, cell.item.chargeTypeId)}`;
      const state = cell.item.state === "offline" ? OFFLINE_SUFFIX : "";
      lines.push(`${typeName(data, cell.item.typeId)}${charge}${state}`);
    }
    lines.push("");                       // one blank line closes every section, empty or not
  }

  // Drones first, then everything else that is not in a slot — the same split `fitFromDoc` makes,
  // so a flag we have never seen still exports as cargo instead of vanishing.
  const inBay = (e: FitItem) => e.flag === DRONE_BAY_FLAG;
  const inHold = (e: FitItem) => !inBay(e) && slotFromFlag(e.flag) === null;
  for (const belongs of [inBay, inHold]) {
    for (const entry of doc.items) {
      if (!belongs(entry)) continue;
      lines.push(`${typeName(data, entry.typeId)}${entry.quantity > 1 ? ` x${entry.quantity}` : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/** Text → lines, with no static data involved. `null` when there is no `[Ship, Name]` header. */
export function tokeniseEft(text: string): EftText | null {
  const rows = text.split(/\r?\n/);
  let header: RegExpMatchArray | null = null;
  let start = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const trimmed = rows[i].trim();
    if (trimmed === "") continue;
    header = HEADER.exec(trimmed);
    start = i + 1;
    break;
  }
  if (header === null) return null;

  const lines: EftLine[] = [];
  for (const raw of rows.slice(start)) {
    let line = raw.trim();
    if (line === "") continue;

    const empty = EMPTY_MARKER.exec(line);
    if (empty !== null) {
      const slot = SECTION_BY_LABEL.get(empty[1].trim().toLowerCase());
      if (slot !== undefined) {
        lines.push({ name: "", chargeName: null, quantity: 1, offline: false, empty: slot });
      }
      continue;
    }

    let offline = false;
    if (line.toLowerCase().endsWith(OFFLINE_SUFFIX)) {
      offline = true;
      line = line.slice(0, -OFFLINE_SUFFIX.length).trim();
    }

    let quantity = 1;
    const counted = QUANTITY.exec(line);
    if (counted !== null) {
      quantity = Number(counted[1]);
      line = line.slice(0, counted.index).trim();
    }

    const comma = line.indexOf(", ");
    const name = comma === -1 ? line : line.slice(0, comma).trim();
    const chargeName = comma === -1 ? null : line.slice(comma + 2).trim();
    if (name === "") continue;
    lines.push({ name, chargeName, quantity, offline, empty: null });
  }

  return { shipName: header[1].trim(), fitName: header[2].trim(), lines };
}

/**
 * Lines → fit items. Slots come from each type's marker effect, in the order listed; an
 * `[Empty X slot]` marker advances that kind's counter. Unknown names are reported, never fatal.
 */
export function assignEftItems(
  parsed: EftText, byName: ReadonlyMap<string, number>, data: DogmaData,
): EftAssignment | null {
  const shipTypeId = byName.get(parsed.shipName.toLowerCase());
  if (shipTypeId === undefined || !data.types.has(shipTypeId)) return null;

  const next: Record<SlotKind, number> = { high: 0, mid: 0, low: 0, rig: 0, subsystem: 0 };
  const items: FitItem[] = [];
  const unresolved: string[] = [];

  for (const line of parsed.lines) {
    if (line.empty !== null) { next[line.empty] += 1; continue; }

    const typeId = byName.get(line.name.toLowerCase());
    const type = typeId === undefined ? undefined : data.types.get(typeId);
    if (typeId === undefined || type === undefined) { unresolved.push(line.name); continue; }

    let chargeTypeId: number | null = null;
    if (line.chargeName !== null) {
      const resolved = byName.get(line.chargeName.toLowerCase());
      if (resolved === undefined || !data.types.has(resolved)) unresolved.push(line.chargeName);
      else chargeTypeId = resolved;
    }

    const slot = slotOfType(type);
    if (slot === null) {
      const flag = kindOfType(type) === "drone" ? DRONE_BAY_FLAG : CARGO_FLAG;
      items.push({ typeId, quantity: line.quantity, flag, chargeTypeId: null, state: "active" });
      continue;
    }
    const index = next[slot];
    next[slot] += 1;
    items.push({
      typeId, quantity: 1, flag: flagFor(slot, index), chargeTypeId,
      state: line.offline ? "offline" : stateName(defaultStateOfType(data, type, kindOfType(type))),
    });
  }

  return { shipTypeId, name: parsed.fitName, items, unresolved };
}
