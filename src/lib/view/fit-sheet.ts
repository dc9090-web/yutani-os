import {
  ATTR, HARDPOINTS, Operator, SLOT_KINDS, State, explain, itemLabel, round2,
  type AppliedModifier, type BuiltFit, type DogmaData, type Fit, type FitEntry, type FitStats,
  type Hardpoint, type Item, type ModuleStat, type Problem, type ProblemKind, type SlotKind,
} from "../dogma/index.js";
import { isk } from "./format.js";
import { priceOf, rollUpValue, unpricedNote, type Price } from "./price.js";
import { bonusLabel, fitValueGroups, gauge, type GaugeView } from "./ships.js";

const SLOT_TITLES: Record<SlotKind, string> = {
  high: "High", mid: "Mid", low: "Low", rig: "Rigs", subsystem: "Subsystems",
};
const HARDPOINT_TITLES: Record<Hardpoint, string> = { turret: "Turrets", launcher: "Launchers" };
const PROBLEM_LABELS: Record<ProblemKind, string> = {
  cpu: "CPU", power: "Powergrid", calibration: "Calibration", slot: "Slots", hardpoint: "Hardpoints",
  rigSize: "Rig size", shipRestriction: "Ship restriction", maxGroupFitted: "Max group fitted", skill: "Skill",
};

export function shipRenderUrl(typeId: number): string {
  return `https://images.evetech.net/types/${typeId}/render?size=128`;
}

export function stateLabel(state: State): string {
  switch (state) {
    case State.Offline: return "Offline";
    case State.Online: return "Online";
    case State.Active: return "Active";
    case State.Overload: return "Overload";
    default: return `State ${state}`;
  }
}

/** The in-game "affected by" panel's shorthand for each operator. */
export function operatorLabel(op: Operator): string {
  switch (op) {
    case Operator.PreAssign:
    case Operator.PostAssign: return "=";
    case Operator.PreMul:
    case Operator.PostMul:
    case Operator.PostMulImmune: return "×";
    case Operator.PreDiv:
    case Operator.PostDiv: return "÷";
    case Operator.ModAdd: return "+";
    case Operator.ModSub: return "−";
    case Operator.PostPercent: return "%";
    default: return "?";
  }
}

function num(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export interface ExplainRowView { carrier: string; operator: string; value: string; penalised: boolean }

/** `rawValue` is the carrier attribute's own number (-25 for Weapon Upgrades V) — what EVE shows. */
export function explainRows(applied: AppliedModifier[]): ExplainRowView[] {
  return applied.map((a) => ({
    carrier: a.carrierName ?? `type ${a.carrierTypeId}`,
    operator: operatorLabel(a.operator),
    value: num(a.rawValue),
    penalised: a.penalised,
  }));
}

/**
 * A module whose "affected by" cannot be computed must not take down a sheet that otherwise renders,
 * so the failure is logged and the popover comes up empty.
 */
function safeExplain(fit: Fit, item: Item, attrId: number): ExplainRowView[] {
  try {
    return explainRows(explain(fit, item, attrId));
  } catch (e) {
    console.error(`[ships] could not explain attribute ${attrId} of type ${item.typeId}`, e);
    return [];
  }
}

export function problemText(p: Problem): string {
  return p.item === undefined ? p.detail : `${itemLabel(p.item)} — ${p.detail}`;
}

export interface ModuleRowView {
  key: string; name: string; typeId: number; charge: string | null;
  /** SDE descriptions, plain text — `typeDescription()`; null when the SDE has none. */
  desc: string | null; chargeDesc: string | null;
  cpu: string; power: string; state: string;
  cpuExplain: ExplainRowView[]; powerExplain: ExplainRowView[];
}
export interface SlotColumnView { slot: SlotKind; title: string; used: number; total: number; rows: ModuleRowView[] }
export interface CounterView { label: string; used: number; total: number; over: boolean }
export interface ProblemView { kind: ProblemKind; label: string; text: string }
export interface MissingSkillView { skillTypeId: number; name: string; have: number; need: number }
export interface EntryView { key: string; name: string; quantity: number; value: string | null; desc: string | null }
export interface BonusView { skill: string | null; level: number | null; text: string }
export interface ValueLineView { label: string; value: string }

export interface FitSheetView {
  title: string; subtitle: string; typeId: number; typeName: string; renderUrl: string; skillsSynced: boolean;
  bonuses: BonusView[]; gauges: GaugeView[]; slots: SlotColumnView[]; counters: CounterView[];
  problems: ProblemView[]; missing: MissingSkillView[];
  cargo: EntryView[]; drones: EntryView[]; unfittable: EntryView[]; unknown: EntryView[];
  value: { total: string; lines: ValueLineView[]; unpriced: string | null };
}

export interface FitSheetInput {
  title: string; subtitle: string; typeId: number; typeName: string;
  built: BuiltFit; stats: FitStats; problems: Problem[];
  bonuses: readonly { skillTypeId: number | null; bonus: number | null; bonusText: string | null; unitId: number | null }[];
  skillLevels: ReadonlyMap<number, number>;
  skillNames: ReadonlyMap<number, string>;
  prices: ReadonlyMap<number, Price>;
  /** Cleaned SDE descriptions keyed by type id — the hover text on every item name. */
  descriptions: ReadonlyMap<number, string>;
  skillsSynced: boolean;
}

const DESCRIPTION_MAX = 600;

/**
 * An SDE type description as hover text: anchors and other client markup stripped, CRLF and runs
 * of blank lines collapsed to paragraph breaks (rendered with `white-space: pre-line`), and the
 * rare multi-screen essay cut at a word boundary. Null when the SDE has nothing to say.
 */
export function typeDescription(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const text = raw.replace(/<[^>]*>/g, "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n").trim();
  if (text === "") return null;
  if (text.length <= DESCRIPTION_MAX) return text;
  const cut = text.slice(0, DESCRIPTION_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), DESCRIPTION_MAX - 40)).trimEnd()}…`;
}

function moduleRow(fit: Fit, stat: ModuleStat, descriptions: ReadonlyMap<number, string>): ModuleRowView {
  return {
    key: `${stat.slot}:${stat.index}`,
    name: itemLabel(stat.item),
    typeId: stat.item.typeId,
    charge: stat.item.charge === undefined ? null : itemLabel(stat.item.charge),
    desc: descriptions.get(stat.item.typeId) ?? null,
    chargeDesc: stat.item.charge === undefined ? null : descriptions.get(stat.item.charge.typeId) ?? null,
    // Half-even round to 2dp first — same convention as the pool totals in `fitStats` — so a row's
    // own cpu/power always matches what the gauge above it is summing.
    cpu: round2(stat.cpu).toFixed(2),
    power: round2(stat.power).toFixed(2),
    state: stateLabel(stat.state),
    cpuExplain: safeExplain(fit, stat.item, ATTR.cpu),
    powerExplain: safeExplain(fit, stat.item, ATTR.power),
  };
}

function entryViews(entries: FitEntry[], data: DogmaData, prices: ReadonlyMap<number, Price>, descriptions: ReadonlyMap<number, string>): EntryView[] {
  return entries.map((entry, index) => {
    const unit = priceOf(prices.get(entry.typeId));
    return {
      key: `${entry.flag}:${entry.typeId}:${index}`,
      // `entry.name` is the asset's own custom nickname (may be null); fall back to the SDE type name,
      // and to spec §6's "Unknown type (id)" when this SDE build doesn't know the type either.
      name: entry.name ?? data.types.get(entry.typeId)?.name ?? `Unknown type (${entry.typeId})`,
      quantity: entry.quantity,
      value: unit === null ? null : isk(unit * entry.quantity),
      desc: descriptions.get(entry.typeId) ?? null,
    };
  });
}

export function buildFitSheet(input: FitSheetInput): FitSheetView {
  const { built, stats, prices, descriptions } = input;
  const fit = built.fit;

  const bySlot = new Map<SlotKind, ModuleStat[]>();
  for (const stat of stats.modules) {
    const bucket = bySlot.get(stat.slot);
    if (bucket === undefined) bySlot.set(stat.slot, [stat]);
    else bucket.push(stat);
  }
  const slots: SlotColumnView[] = SLOT_KINDS.map((slot) => ({
    slot,
    title: SLOT_TITLES[slot],
    used: stats.slots[slot].used,
    total: stats.slots[slot].total,
    rows: [...(bySlot.get(slot) ?? [])].sort((a, b) => a.index - b.index).map((stat) => moduleRow(fit, stat, descriptions)),
  }));

  const counters: CounterView[] = [
    ...SLOT_KINDS.map((slot) => ({
      label: SLOT_TITLES[slot], used: stats.slots[slot].used, total: stats.slots[slot].total,
      over: stats.slots[slot].used > stats.slots[slot].total,
    })),
    ...HARDPOINTS.map((hardpoint) => ({
      label: HARDPOINT_TITLES[hardpoint], used: stats.hardpoints[hardpoint].used,
      total: stats.hardpoints[hardpoint].total,
      over: stats.hardpoints[hardpoint].used > stats.hardpoints[hardpoint].total,
    })),
  ];

  const missing: MissingSkillView[] = input.problems
    .flatMap((p) => (p.kind === "skill" && p.skill !== undefined ? [p.skill] : []))
    .map((s) => ({
      skillTypeId: s.skillTypeId,
      name: input.skillNames.get(s.skillTypeId) ?? `Skill ${s.skillTypeId}`,
      have: s.have, need: s.required,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Spec §4: ship + fitted + charges + drones + cargo, from the one walk `fitValueEntries` also
  // reads (`fitValueGroups`) — the per-group sums add up to exactly rollUpValue(fitValueEntries(built))
  // by construction, and a test pins that.
  const groups = fitValueGroups(built);
  let total = 0;
  let unpriced = 0;
  const lines: ValueLineView[] = [];
  for (const group of groups) {
    const roll = rollUpValue(group.entries, prices);
    total += roll.total;
    unpriced += roll.unpriced;
    if (group.label === "Hull" || group.entries.length > 0) lines.push({ label: group.label, value: isk(roll.total) });
  }

  return {
    title: input.title, subtitle: input.subtitle, typeId: input.typeId, typeName: input.typeName,
    renderUrl: shipRenderUrl(input.typeId), skillsSynced: input.skillsSynced,
    bonuses: input.bonuses.map((b) => ({
      skill: b.skillTypeId === null ? null : input.skillNames.get(b.skillTypeId) ?? `Skill ${b.skillTypeId}`,
      level: b.skillTypeId === null ? null : input.skillLevels.get(b.skillTypeId) ?? 0,
      text: bonusLabel(b),
    })),
    gauges: [
      gauge("CPU", "tf", stats.cpu),
      gauge("Powergrid", "MW", stats.power),
      gauge("Calibration", "", stats.calibration, 0),
    ],
    slots, counters,
    problems: input.problems.map((p) => ({ kind: p.kind, label: PROBLEM_LABELS[p.kind], text: problemText(p) })),
    missing,
    cargo: entryViews(built.cargo, fit.data, prices, descriptions),
    drones: entryViews(built.drones, fit.data, prices, descriptions),
    unfittable: entryViews(built.unfittable, fit.data, prices, descriptions),
    unknown: entryViews(built.unknown, fit.data, prices, descriptions),
    value: { total: isk(total), lines, unpriced: unpricedNote(unpriced) },
  };
}
