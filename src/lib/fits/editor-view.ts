/**
 * The whole editor as plain strings and numbers. Pure and isomorphic; the React components in
 * Tasks 14–16 render this and hold no logic of their own — the phase-3b/4b pattern, applied to an
 * interactive page.
 */
import {
  ATTR, HARDPOINTS, SLOT_KINDS, explain, fitStats, itemLabel, missingSkills, round2, validateFit,
  type AttrId, type DogmaData, type Fit, type FitContext, type FitStats, type Hardpoint, type Item,
  type ModuleStat, type Problem, type ProblemKind, type SlotKind,
} from "../dogma/index.js";
import { isk } from "../view/format.js";
import { priceOf, rollUpValue, unpricedNote, iskShort, type Price, type ValuedEntry } from "../view/price.js";
import { gauge, type GaugeView } from "../view/ships.js";
import {
  explainRows, problemText,
  type CounterView, type ExplainRowView, type MissingSkillView, type ProblemView,
} from "../view/fit-sheet.js";
import { fitFromDoc, type DocFit, type FitDoc, type FitItem, type FitItemState } from "./doc.js";
import { allowedStates, slotGrid, slotTotals, type SlotTotals } from "./slots.js";

export interface EditorSlotRow {
  key: string; slot: SlotKind; index: number; over: boolean; typeId: number | null;
  name: string; iconUrl: string | null; charge: { typeId: number; name: string } | null;
  /** `data-desc` tooltip text (Task 4 part E) — null for an empty slot, which has nothing to hover. */
  desc: string | null;
  cpu: string; power: string; calibration: string;
  state: FitItemState | null; states: FitItemState[];
  cpuExplain: ExplainRowView[]; powerExplain: ExplainRowView[]; price: string | null;
}
export interface EditorSlotBlock { slot: SlotKind; title: string; used: number; total: number; rows: EditorSlotRow[] }
export interface EditorEntryRow {
  key: string; typeId: number; flag: string; name: string; quantity: number; value: string | null;
  /** `data-desc` tooltip text (Task 4 part E). */
  desc: string;
}
export interface EditorView {
  gauges: GaugeView[]; counters: CounterView[]; blocks: EditorSlotBlock[];
  problems: ProblemView[]; missing: MissingSkillView[];
  drones: EditorEntryRow[]; cargo: EditorEntryRow[]; unknown: EditorEntryRow[];
  value: { total: string; unpriced: string | null };
}
export type EditorResult =
  | { kind: "ok"; view: EditorView; totals: SlotTotals; built: DocFit }
  | { kind: "error" };

export const STATE_LABELS: Record<FitItemState, string> = {
  offline: "Offline", online: "Online", active: "Active", overload: "Overload",
};
const SLOT_TITLES: Record<SlotKind, string> = {
  high: "High", mid: "Mid", low: "Low", rig: "Rigs", subsystem: "Subsystems",
};
const COUNTER_LABELS: Record<SlotKind, string> = {
  high: "High", mid: "Mid", low: "Low", rig: "Rigs", subsystem: "Subsystems",
};
const HARDPOINT_LABELS: Record<Hardpoint, string> = { turret: "Turrets", launcher: "Launchers" };
const PROBLEM_LABELS: Record<ProblemKind, string> = {
  cpu: "CPU", power: "Powergrid", calibration: "Calibration", slot: "Slots", hardpoint: "Hardpoints",
  rigSize: "Rig size", shipRestriction: "Ship restriction", maxGroupFitted: "Max group fitted", skill: "Skill",
};

export function typeIconUrl(typeId: number, size = 32): string {
  return `https://images.evetech.net/types/${typeId}/icon?size=${size}`;
}

/** Exactly what `ensureTypes` must load before the engine can run on this document. */
export function fitTypeIds(doc: FitDoc): number[] {
  const ids = new Set<number>([doc.shipTypeId]);
  for (const entry of doc.items) {
    ids.add(entry.typeId);
    if (entry.chargeTypeId !== null) ids.add(entry.chargeTypeId);
  }
  return [...ids];
}

/** Hull + fitted modules + their charges + drones + cargo, the same roll-up `/ships` uses. */
export function docValueEntries(built: DocFit): ValuedEntry[] {
  const entries: ValuedEntry[] = [{ typeId: built.fit.ship.typeId, quantity: 1 }];
  for (const slotted of built.fit.modules) {
    entries.push({ typeId: slotted.item.typeId, quantity: 1 });
    if (slotted.item.charge !== undefined) entries.push({ typeId: slotted.item.charge.typeId, quantity: 1 });
  }
  for (const drone of built.drones) entries.push({ typeId: drone.typeId, quantity: drone.quantity });
  for (const entry of built.cargo) entries.push({ typeId: entry.typeId, quantity: entry.quantity });
  return entries;
}

/** One module's "affected by" must never take down an editor that otherwise renders. */
function safeExplain(fit: Fit, item: Item, attrId: AttrId): ExplainRowView[] {
  try {
    return explainRows(explain(fit, item, attrId));
  } catch (e) {
    console.error(`[fitting] could not explain attribute ${attrId} of type ${item.typeId}`, e);
    return [];
  }
}

function typeName(data: DogmaData, typeId: number): string {
  return data.types.get(typeId)?.name ?? `Unknown type (${typeId})`;
}

/**
 * "name — group", the closest thing to a hover description this data model has. Task 4 part F: the
 * SDE's flavour-text `description` column is not loaded anywhere in this app, and adding that import
 * is out of scope for this task — so every `data-desc` in the fitting editor reads this instead.
 */
export function typeDesc(data: DogmaData, typeId: number): string {
  const name = typeName(data, typeId);
  const groupId = data.types.get(typeId)?.groupId;
  const group = groupId === undefined ? undefined : data.groups.get(groupId)?.name ?? undefined;
  return group === undefined ? name : `${name} — ${group}`;
}

function entryRow(entry: FitItem, data: DogmaData, prices: ReadonlyMap<number, Price>): EditorEntryRow {
  const unit = priceOf(prices.get(entry.typeId));
  return {
    key: `${entry.flag}:${entry.typeId}`,
    typeId: entry.typeId, flag: entry.flag, name: typeName(data, entry.typeId),
    quantity: entry.quantity, value: unit === null ? null : isk(unit * entry.quantity),
    desc: typeDesc(data, entry.typeId),
  };
}

export function editorView(input: {
  doc: FitDoc; data: DogmaData; built: DocFit; stats: FitStats; problems: Problem[];
  totals: SlotTotals; prices: ReadonlyMap<number, Price>;
}): EditorView {
  const { doc, data, built, stats, problems, totals, prices } = input;
  const grid = slotGrid(doc, totals);
  const statByKey = new Map<string, ModuleStat>(
    stats.modules.map((m) => [`${m.slot}:${m.index}`, m]));

  const blocks: EditorSlotBlock[] = [];
  for (const slot of SLOT_KINDS) {
    const cells = grid[slot];
    if (cells.length === 0) continue;                    // a Rifter has no subsystem row at all
    blocks.push({
      slot, title: SLOT_TITLES[slot], used: stats.slots[slot].used, total: totals[slot],
      rows: cells.map((cell) => {
        const key = `${slot}:${cell.index}`;
        if (cell.item === null) {
          return {
            key, slot, index: cell.index, over: cell.over, typeId: null, name: "Empty", iconUrl: null,
            charge: null, desc: null, cpu: "—", power: "—", calibration: "—", state: null, states: [],
            cpuExplain: [], powerExplain: [], price: null,
          };
        }
        const stat = statByKey.get(key);
        const type = data.types.get(cell.item.typeId);
        const unit = priceOf(prices.get(cell.item.typeId));
        return {
          key, slot, index: cell.index, over: cell.over, typeId: cell.item.typeId,
          name: stat === undefined ? typeName(data, cell.item.typeId) : itemLabel(stat.item),
          iconUrl: typeIconUrl(cell.item.typeId),
          desc: typeDesc(data, cell.item.typeId),
          charge: cell.item.chargeTypeId === null
            ? null
            : { typeId: cell.item.chargeTypeId, name: typeName(data, cell.item.chargeTypeId) },
          cpu: stat === undefined ? "—" : round2(stat.cpu).toFixed(2),
          power: stat === undefined ? "—" : round2(stat.power).toFixed(2),
          calibration: stat === undefined ? "—" : round2(stat.calibration).toFixed(2),
          state: cell.item.state,
          states: type === undefined ? [] : allowedStates(data, type),
          cpuExplain: stat === undefined ? [] : safeExplain(built.fit, stat.item, ATTR.cpu),
          powerExplain: stat === undefined ? [] : safeExplain(built.fit, stat.item, ATTR.power),
          price: unit === null ? null : isk(unit),
        };
      }),
    });
  }

  const counters: CounterView[] = [
    ...SLOT_KINDS.filter((slot) => totals[slot] > 0 || stats.slots[slot].used > 0).map((slot) => ({
      label: COUNTER_LABELS[slot], used: stats.slots[slot].used, total: totals[slot],
      over: stats.slots[slot].used > totals[slot],
    })),
    ...HARDPOINTS.map((kind) => ({
      label: HARDPOINT_LABELS[kind], used: stats.hardpoints[kind].used,
      total: stats.hardpoints[kind].total, over: stats.hardpoints[kind].used > stats.hardpoints[kind].total,
    })),
  ];

  const roll = rollUpValue(docValueEntries(built), prices);

  return {
    gauges: [
      gauge("CPU", "tf", stats.cpu),
      gauge("Powergrid", "MW", stats.power),
      gauge("Calibration", "", stats.calibration),
    ],
    counters,
    blocks,
    problems: problems.map((p) => ({ kind: p.kind, label: PROBLEM_LABELS[p.kind], text: problemText(p) })),
    missing: missingSkills(built.fit).map((s) => ({
      skillTypeId: s.skillTypeId,
      name: data.types.get(s.skillTypeId)?.name ?? `Skill ${s.skillTypeId}`,
      have: s.have, need: s.required,
    })),
    drones: built.drones.map((d) => entryRow(d, data, prices)),
    cargo: built.cargo.map((c) => entryRow(c, data, prices)),
    unknown: built.unknown.map((u) => entryRow(u, data, prices)),
    value: { total: iskShort(roll.total), unpriced: unpricedNote(roll.unpriced) },
  };
}

/**
 * The single call the editor component makes, once per edit. It is also the only place engine
 * exceptions are caught — `{ kind: "error" }` renders "Could not compute", exactly as `/ships` does.
 */
export function computeEditor(
  doc: FitDoc, ctx: FitContext, prices: ReadonlyMap<number, Price>,
): EditorResult {
  try {
    const built = fitFromDoc(doc, ctx);
    const stats = fitStats(built.fit);
    const problems = validateFit(built.fit);
    const totals = slotTotals(built.fit);
    return {
      kind: "ok", built, totals,
      view: editorView({ doc, data: ctx.data, built, stats, problems, totals, prices }),
    };
  } catch (e) {
    console.error("[fitting] could not compute the fit", e);
    return { kind: "error" };
  }
}
