import {
  ATTR, HARDPOINTS, Operator, SLOT_KINDS, State, explain, getAttr, itemLabel, round2,
  type AppliedModifier, type BuiltFit, type DogmaData, type Fit, type FitEntry, type FitStats,
  type FitPerformance, type Hardpoint, type Item, type LayerPerformance, type ModuleStat, type Problem,
  type ProblemKind, type SlotKind,
} from "../dogma/index.js";
import { clock, grouped, isk, typeDescription } from "./format.js";
export { typeDescription };
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
  /** The charge was loaded by the app from the cargo hold (`assumeCargoAmmo`), not by the pilot. */
  chargeAssumed: boolean;
  cpu: string; power: string; state: string;
  cpuExplain: ExplainRowView[]; powerExplain: ExplainRowView[];
}
export interface SlotColumnView { slot: SlotKind; title: string; used: number; total: number; rows: ModuleRowView[] }
export interface CounterView { label: string; used: number; total: number; over: boolean }
export interface ProblemView { kind: ProblemKind; label: string; text: string }
export interface MissingSkillView { skillTypeId: number; name: string; have: number; need: number }
export interface EntryView { key: string; typeId: number; name: string; quantity: number; value: string | null; desc: string | null }
export interface BonusView { skill: string | null; level: number | null; text: string }
export interface ValueLineView { label: string; value: string }

/** One label/value line of a ship-stats section. */
export interface StatRowView { label: string; value: string }
/** A tank layer row of the Defense section: pool, an optional note (shield recharge time) and the
 *  four resistances as whole percents in EVE's order — em, thermal, kinetic, explosive. */
export interface ResistRowView { layer: string; hp: string; note: string | null; resists: [number, number, number, number] }
export interface StatSectionView { title: string; headline: string; rows: StatRowView[]; note?: string | null }

/** The fitting window's stats panel: six sections plus the two bays, every value pre-formatted. */
export interface ShipStatsView {
  capacitor: StatSectionView & { ok: boolean | null };
  offense: StatSectionView;
  defense: StatSectionView & { recharge: string | null; layers: ResistRowView[] };
  targeting: StatSectionView;
  navigation: StatSectionView;
  drones: StatSectionView;
  bays: StatRowView[];
}

/** The header chips: hull, and its race and class when the SDE names them. */
export interface SheetShipView { typeName: string; groupName: string | null; raceName: string | null }
/** Where the ship is, the way the overview card says it: coloured security + system, the station or
 *  structure, and a note ("in Small Standard Container", "Saved fit"). Any part may be absent. */
export interface SheetLocationView {
  system: { name: string; sec: string; secClass: string } | null;
  place: string | null;
  note: string | null;
}

export interface FitSheetView {
  title: string; typeId: number; typeName: string; renderUrl: string; skillsSynced: boolean;
  ship: SheetShipView; location: SheetLocationView;
  stats: ShipStatsView;
  bonuses: BonusView[]; gauges: GaugeView[]; slots: SlotColumnView[]; counters: CounterView[];
  problems: ProblemView[]; missing: MissingSkillView[];
  cargo: EntryView[]; drones: EntryView[]; unfittable: EntryView[]; unknown: EntryView[];
  value: { total: string; lines: ValueLineView[]; unpriced: string | null };
}

export interface FitSheetInput {
  title: string; typeId: number; typeName: string;
  ship: SheetShipView; location: SheetLocationView;
  built: BuiltFit; stats: FitStats; problems: Problem[];
  bonuses: readonly { skillTypeId: number | null; bonus: number | null; bonusText: string | null; unitId: number | null }[];
  skillLevels: ReadonlyMap<number, number>;
  skillNames: ReadonlyMap<number, string>;
  prices: ReadonlyMap<number, Price>;
  /** Cleaned SDE descriptions keyed by type id — the hover text on every item name. */
  descriptions: ReadonlyMap<number, string>;
  /** `fitPerformance(built.fit)` — the fitting-window numbers. */
  perf: FitPerformance;
  skillsSynced: boolean;
}

const DASH = "—";
const fmtNum = (value: number | null, decimals: number, unit = ""): string =>
  value === null ? DASH : `${grouped(value.toFixed(decimals))}${unit}`;
const whole = (value: number | null, unit = ""): string => value === null ? DASH : `${grouped(Math.round(value))}${unit}`;
const km = (metres: number | null): string => metres === null ? DASH : `${grouped((metres / 1000).toFixed(1))} km`;

function layerRow(layer: string, perf: LayerPerformance | null, note: string | null = null): ResistRowView | null {
  if (perf === null) return null;
  return {
    layer, hp: whole(perf.hp, " hp"), note,
    resists: perf.resists.map((r) => Math.round(r * 100)) as [number, number, number, number],
  };
}

/** What the bay and drone maths need of an entry — `FitEntry` (the sheet) and the editor's `FitItem` both fit. */
export interface StackedEntry { typeId: number; quantity: number }
/** `BuiltFit` or the editor's `DocFit`: the engine fit plus what sits in the cargo hold and drone bay. */
export interface StatsSource { fit: Fit; cargo: readonly StackedEntry[]; drones: readonly StackedEntry[] }

/** "used / total m³" for a bay: the fit's entries' volumes summed against the hull's modified capacity. */
function bayRow(label: string, entries: readonly StackedEntry[], fit: Fit, capacityAttr: number): StatRowView {
  let used = 0;
  for (const entry of entries) used += (fit.data.types.get(entry.typeId)?.attrs.get(ATTR.volume) ?? 0) * entry.quantity;
  const total = fit.data.attributes.has(capacityAttr) && fit.ship.attrs.has(capacityAttr) ? getAttr(fit, fit.ship, capacityAttr) : null;
  const fmt = (v: number) => grouped(Number.isInteger(v) ? v : Number(v.toFixed(1)));
  // A hull with no such bay (a Rifter's drone bay is 0 m³) shows only what is stowed there.
  return { label, value: total === null || total <= 0 ? `${fmt(used)} m³` : `${fmt(used)} / ${fmt(total)} m³` };
}

/**
 * The fitting window's right-hand panel, section by section, formatted the way the client shows
 * it. A number the engine cannot give (see `FitPerformance`) renders as the dash; a section whose
 * headline is a dash still lists what it can.
 */
export function shipStatsView(perf: FitPerformance, built: StatsSource): ShipStatsView {
  const fit = built.fit;
  const cap = perf.capStable;
  const capHeadline = cap === null ? DASH : cap.stable ? `Stable ${Math.round(cap.level * 100)}%` : `Lasts ${clock(cap.lastsSeconds)}`;
  const deltaPct = perf.capDelta === null || perf.capPeakRecharge === null || perf.capPeakRecharge <= 0
    ? null : (perf.capDelta / perf.capPeakRecharge) * 100;
  const delta = perf.capDelta === null ? DASH
    : `${perf.capDelta >= 0 ? "+" : "−"}${Math.abs(perf.capDelta).toFixed(1)} GJ/s${deltaPct === null ? "" : ` (${Math.abs(deltaPct).toFixed(1)}%)`}`;

  const layers = [
    layerRow("Shield", perf.shield, perf.shieldRechargeTime === null ? null : whole(perf.shieldRechargeTime, " s")),
    layerRow("Armor", perf.armor),
    layerRow("Hull", perf.hull),
  ].filter((row): row is ResistRowView => row !== null);

  const droneCount = built.drones.reduce((sum, entry) => sum + entry.quantity, 0);
  let bandwidthUsed = 0;
  for (const entry of built.drones) bandwidthUsed += (fit.data.types.get(entry.typeId)?.attrs.get(PERF_ATTR_DRONE_BANDWIDTH_USED) ?? 0) * entry.quantity;

  return {
    capacitor: {
      title: "Capacitor", headline: capHeadline, ok: cap === null ? null : cap.stable,
      rows: [
        { label: "Capacity", value: perf.capacitorCapacity === null ? DASH : `${whole(perf.capacitorCapacity, " GJ")}${perf.capRechargeTime === null ? "" : ` / ${clock(perf.capRechargeTime)}`}` },
        { label: "Recharge", value: fmtNum(perf.capPeakRecharge, 1, " GJ/s peak") },
        { label: "Δ", value: delta },
      ],
    },
    offense: {
      title: "Offense", headline: fmtNum(perf.dps, 1, " dps"),
      note: assumedCount(fit) === 0 ? null : `${assumedCount(fit)} weapon${assumedCount(fit) === 1 ? "" : "s"} loaded with the best ammo in cargo`,
      rows: [
        { label: "Weapons", value: fmtNum(perf.weaponDps, 1, " dps") },
        { label: "Drones", value: fmtNum(perf.droneDps, 1, " dps") },
        { label: "Volley", value: whole(perf.volley, " HP") },
      ],
    },
    defense: {
      title: "Defense", headline: whole(perf.ehp, " ehp"),
      recharge: perf.shieldRechargeRate === null ? null : `${fmtNum(perf.shieldRechargeRate, 1)} hp/s`,
      layers, rows: [],
    },
    targeting: {
      title: "Targeting", headline: km(perf.maxTargetRange),
      rows: [
        { label: "Sensor strength", value: perf.sensorStrength === null ? DASH : `${fmtNum(perf.sensorStrength.points, 1)} points (${perf.sensorStrength.kind})` },
        { label: "Scan resolution", value: whole(perf.scanResolution, " mm") },
        { label: "Signature radius", value: perf.propulsion?.kind === "Microwarpdrive" && perf.propulsion.signatureRadius !== null
          ? `${whole(perf.signatureRadius, " m")} · ${whole(perf.propulsion.signatureRadius, " m")} MWD` : whole(perf.signatureRadius, " m") },
        { label: "Max targets", value: perf.maxTargets === null ? DASH : `${perf.maxTargets}×` },
      ],
    },
    navigation: {
      title: "Navigation", headline: fmtNum(perf.maxVelocity, 1, " m/s"),
      rows: [
        ...(perf.propulsion === null ? [] : [
          { label: `With ${perf.propulsion.kind === "Microwarpdrive" ? "MWD" : "afterburner"}`, value: fmtNum(perf.propulsion.velocity, 1, " m/s") },
        ]),
        { label: "Mass", value: perf.mass === null ? DASH : `${grouped((perf.mass / 1000).toFixed(1))} t` },
        { label: "Inertia", value: perf.inertia === null ? DASH : `${perf.inertia.toFixed(4)}×` },
        { label: "Warp speed", value: fmtNum(perf.warpSpeed, 2, " AU/s") },
        { label: "Align time", value: fmtNum(perf.alignTime, 2, " s") },
        ...(perf.propulsion === null || perf.propulsion.alignTime === null ? [] : [
          { label: `Align, ${perf.propulsion.kind === "Microwarpdrive" ? "MWD" : "AB"} on`, value: fmtNum(perf.propulsion.alignTime, 2, " s") },
        ]),
      ],
    },
    drones: {
      title: "Drones", headline: fmtNum(perf.droneDps, 1, " dps"),
      rows: [
        { label: "Bandwidth", value: perf.droneBandwidth === null ? DASH : `${whole(bandwidthUsed)} / ${whole(perf.droneBandwidth)} Mbit/s` },
        { label: "Control range", value: km(perf.droneControlRange) },
        { label: "In bay", value: `${droneCount} drone${droneCount === 1 ? "" : "s"}` },
      ],
    },
    bays: [
      bayRow("Cargo hold", built.cargo, fit, ATTR.capacity),
      bayRow("Drone bay", built.drones, fit, PERF_ATTR_DRONE_CAPACITY),
    ],
  };
}

/** How many weapons carry an app-loaded charge — the Offense note. */
function assumedCount(fit: Fit): number {
  let n = 0;
  for (const { item } of fit.modules) if (item.charge?.assumed === true) n += 1;
  return n;
}

// Attribute ids also spelled in dogma/perf.ts's PERF_ATTR; named here so this file needs no import of it.
const PERF_ATTR_DRONE_BANDWIDTH_USED = 1272;
const PERF_ATTR_DRONE_CAPACITY = 283;


function moduleRow(fit: Fit, stat: ModuleStat, descriptions: ReadonlyMap<number, string>): ModuleRowView {
  return {
    key: `${stat.slot}:${stat.index}`,
    name: itemLabel(stat.item),
    typeId: stat.item.typeId,
    charge: stat.item.charge === undefined ? null : itemLabel(stat.item.charge),
    desc: descriptions.get(stat.item.typeId) ?? null,
    chargeDesc: stat.item.charge === undefined ? null : descriptions.get(stat.item.charge.typeId) ?? null,
    chargeAssumed: stat.item.charge?.assumed === true,
    // Half-even round to 2dp first — same convention as the pool totals in `fitStats` — so a row's
    // own cpu/power always matches what the gauge above it is summing.
    cpu: round2(stat.cpu).toFixed(2),
    power: round2(stat.power).toFixed(2),
    state: stateLabel(stat.state),
    cpuExplain: safeExplain(fit, stat.item, ATTR.cpu),
    powerExplain: safeExplain(fit, stat.item, ATTR.power),
  };
}

/**
 * One line per type (and per custom nickname) with the quantities summed. ESI hands back every
 * drone that has ever been launched as its own singleton row of quantity 1 — five Wasp IIs arrive
 * as five rows — and splits cargo stacks the pilot never merged; the in-game inventory shows them
 * grouped with a count, so the sheet does too.
 */
function mergeEntries(entries: FitEntry[]): FitEntry[] {
  const merged = new Map<string, FitEntry>();
  for (const entry of entries) {
    const key = `${entry.flag}:${entry.typeId}:${entry.name ?? ""}`;
    const seen = merged.get(key);
    if (seen === undefined) merged.set(key, { ...entry });
    else seen.quantity += entry.quantity;
  }
  return [...merged.values()];
}

function entryViews(entries: FitEntry[], data: DogmaData, prices: ReadonlyMap<number, Price>, descriptions: ReadonlyMap<number, string>): EntryView[] {
  return mergeEntries(entries).map((entry, index) => {
    const unit = priceOf(prices.get(entry.typeId));
    return {
      key: `${entry.flag}:${entry.typeId}:${index}`,
      typeId: entry.typeId,
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
    title: input.title, typeId: input.typeId, typeName: input.typeName,
    ship: input.ship, location: input.location,
    renderUrl: shipRenderUrl(input.typeId), skillsSynced: input.skillsSynced,
    stats: shipStatsView(input.perf, built),
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
