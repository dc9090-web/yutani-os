import {
  ATTR, HARDPOINTS, Operator, SLOT_KINDS, State, explain, getAttr, itemLabel, round2, type AppliedModifier, type BuiltFit, type DogmaData, type Fit, type FitEntry, type FitStats, type FitPerformance, type Hardpoint, type Item, type LayerPerformance, type ModuleStat, type Problem, type ProblemKind, type SlotKind, CATEGORY, chargeFits, hardpointOf, moduleRange, weaponDpsWith, weaponRange, weaponRangeWith, chargeRangeHint, launchedDrones, type ChargeRangeHint, type ModuleRange, type WeaponRange, type SkillGap, type SkillGapGroup,
} from "../dogma/index.js";
import { clock, grouped, isk, typeDescription } from "./format.js";
export { typeDescription };
import { iskShort, priceOf, rollUpValue, unpricedNote, type Price } from "./price.js";
import { bonusLabel, fitValueGroups, gauge, type GaugeView, rangeText, hintText, dist, pct } from "./ships.js";
import { consumableRows, type ConsumableRowView } from "./consumables.js";
export { hintText, rangeText };
export type { ConsumableRowView, ConsumableKind } from "./consumables.js";

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

export function problemText(p: Problem): string {
  return p.item === undefined ? p.detail : `${itemLabel(p.item)} — ${p.detail}`;
}

/** The two range columns of the Modules and Ammunition lists. `null` in a cell renders as a dash. */
export interface RangeCells { optimal: string | null; falloff: string | null }

export interface ModuleRowView {
  /** How many identical modules — same type, charge, state and reach — this row stands for. */
  quantity: number;
  key: string; name: string; typeId: number; charge: string | null;
  /** The loaded charge's type, for its icon; null when the module holds none. */
  chargeTypeId: number | null;
  state: string;
  desc: string | null; chargeDesc: string | null;
  /** The charge was loaded by the app from the cargo hold (`assumeCargoAmmo`), not by the pilot. */
  chargeAssumed: boolean;
  /** Optimal + falloff for a loaded turret, flight range for a loaded launcher, optimal + falloff for
   *  a module that reaches out (a disruptor, a web, a neut); null for anything else. */
  range: RangeCells | null;
}
export interface SlotColumnView { slot: SlotKind; title: string; used: number; total: number; rows: ModuleRowView[] }
export interface CounterView { label: string; used: number; total: number; over: boolean }
export interface ProblemView { kind: ProblemKind; label: string; text: string }
export interface MissingSkillView { skillTypeId: number; name: string; have: number; need: number }
/**
 * How far a round of ammunition reaches, as a class. Measured against *this ship*: its reach (optimal +
 * falloff for a turret, flight range for a missile) as a share of the hull's lock range — under a
 * third is Short, under two thirds Medium, the rest Long. `beyond` marks ammo that reaches further
 * than the ship can lock at all (still Long on the pill; the hover text says so). Ammo nothing fitted
 * can load is classed by its own range modifier instead (Short for a −25 % round or worse, Long for
 * +25 % or better). `desc` says which rule produced the label.
 */
export interface RangeBand { label: "Short" | "Medium" | "Long"; level: 1 | 2 | 3; beyond: boolean; desc: string }

export interface EntryView {
  key: string; typeId: number;
  /** The type name, always — "Unknown type (id)" when this SDE build lacks the type. */
  name: string;
  /** The pilot's own name for the item, when it has one. */
  nickname: string | null;
  quantity: number; desc: string | null;
  /** Unit price × quantity, formatted; null when the type has no price. */
  value: string | null;
}

/**
 * One kind of ammunition the ship carries, in its weapons or its hold, for the Ammunition panel.
 * `loadedIn` is how many fitted weapons hold it; what the hold has of it is a cargo row. Reach
 * comes from the weapon that holds it, else from the first fitted weapon that would take it,
 * else from the charge itself (`chargeRangeHint`). `dps` is what every fitted weapon that takes the
 * round would do together, all of them loaded with it, so one row compares with the next like for
 * like; `dpsDesc` names those weapons. Both null for a round nothing fitted can fire.
 */
export interface AmmoRowView {
  key: string; typeId: number; name: string; desc: string | null;
  loadedIn: number;
  dps: string | null; dpsDesc: string | null;
  range: RangeCells | null; band: RangeBand | null;
  /** The damage types the round deals, most first; `desc` gives each one's share. */
  damage: { types: DamageTypeView[]; desc: string } | null;
  /** Sort key: reach in metres; ammo nothing fitted can load sorts after by its modifier. */
  order: number;
}

export type DamageKind = "em" | "thermal" | "kinetic" | "explosive";
export interface DamageTypeView { kind: DamageKind; label: string; share: number }

/** em, thermal, kinetic, explosive: the charge's damage attributes, in EVE's order. */
const DAMAGE_TYPES: readonly { kind: DamageKind; label: string; attrId: number }[] = [
  { kind: "em", label: "EM", attrId: 114 },
  { kind: "thermal", label: "Thermal", attrId: 118 },
  { kind: "kinetic", label: "Kinetic", attrId: 117 },
  { kind: "explosive", label: "Explosive", attrId: 116 },
];
/**
 * A round's damage split from its own type attributes, unmodified: what the round is, not what this
 * ship's bonuses make of it (a kinetic-bonused hull would otherwise tilt a mixed round). Types that
 * deal nothing are left out; the largest comes first, ties in EVE's order. `null` for no damage.
 */
export function damageMix(attrs: ReadonlyMap<number, number>): { types: DamageTypeView[]; desc: string } | null {
  const amounts = DAMAGE_TYPES.map((t) => ({ ...t, amount: attrs.get(t.attrId) ?? 0 })).filter((t) => t.amount > 0);
  const total = amounts.reduce((sum, t) => sum + t.amount, 0);
  if (total <= 0) return null;
  const types = amounts
    .map(({ kind, label, amount }) => ({ kind, label, share: amount / total }))
    .sort((a, b) => b.share - a.share);
  const desc = types.map((t) => `${t.label} ${Math.round(t.share * 100)}%`).join(" · ") + ` of ${fmtNum(total, 1)} base damage per shot`;
  return { types, desc };
}

const BAND_ABSOLUTE_SHORT_M = 10_000;
const BAND_ABSOLUTE_MEDIUM_M = 40_000;
/** The class of a reach in metres, against the ship's lock range when it has one. */
export function reachBand(reach: number, lockRange: number | null): RangeBand {
  if (lockRange === null || lockRange <= 0) {
    const level = reach < BAND_ABSOLUTE_SHORT_M ? 1 : reach < BAND_ABSOLUTE_MEDIUM_M ? 2 : 3;
    return { label: (["Short", "Medium", "Long"] as const)[level - 1], level, beyond: false, desc: `Reaches ${dist(reach)}; this ship's lock range is not known` };
  }
  const share = reach / lockRange;
  const desc = `Reaches ${dist(reach)} of this ship's ${dist(lockRange)} lock range`;
  if (share > 1) return { label: "Long", level: 3, beyond: true, desc: `${desc} — further than it can target` };
  const level = share < 1 / 3 ? 1 : share < 2 / 3 ? 2 : 3;
  return { label: (["Short", "Medium", "Long"] as const)[level - 1], level, beyond: false, desc };
}
/** The class of ammo by its own optimal-range modifier, for ammo nothing fitted can load. */
export function modifierBand(optimalMultiplier: number): RangeBand {
  const level = optimalMultiplier <= 0.75 ? 1 : optimalMultiplier < 1.25 ? 2 : 3;
  const label = (["Short", "Medium", "Long"] as const)[level - 1];
  return { label, level, beyond: false, desc: `${label}-range ammunition: ${pct(optimalMultiplier)} optimal on whatever gun loads it` };
}

/** A weapon's reach as the two cells. */
export function rangeCells(range: WeaponRange | null): RangeCells | null {
  if (range === null) return null;
  if (range.kind === "missile") return { optimal: dist(range.range), falloff: null };
  return { optimal: dist(range.optimal), falloff: range.falloff > 1 ? dist(range.falloff) : null };
}
/** A non-weapon module's reach as the two cells; a module with no falloff (a scrambler) shows the dash. */
export function moduleRangeCells(range: ModuleRange | null): RangeCells | null {
  if (range === null) return null;
  return { optimal: dist(range.optimal), falloff: range.falloff > 0 ? dist(range.falloff) : null };
}
/** Unloadable ammo as the two cells: a missile's own range, or a turret charge's multipliers. */
export function hintCells(hint: ChargeRangeHint | null): RangeCells | null {
  if (hint === null) return null;
  if (hint.kind === "missile") return { optimal: dist(hint.range), falloff: null };
  return { optimal: hint.optimal === 1 ? null : pct(hint.optimal), falloff: hint.falloff === 1 ? null : pct(hint.falloff) };
}
export interface BonusView { skill: string | null; level: number | null; text: string }
export interface ValueLineView { label: string; value: string }

/** One label/value line of a ship-stats section. */
export interface StatRowView { label: string; value: string }
/** A tank layer row of the Defense section: pool, an optional note (shield recharge time) and the
 *  four resistances as whole percents in EVE's order — em, thermal, kinetic, explosive. */
export interface ResistRowView {
  layer: string; hp: string; note: string | null; resists: [number, number, number, number];
  /** The layer's own effective hit points against an even damage profile, "23,612". */
  ehp: string;
}
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
  /** Every round in the weapons or the hold, shortest reach first. */
  ammo: AmmoRowView[];
  /** What the hold carries that the ship uses up and is not ammunition, with what each does and how this ship uses it. */
  consumables: ConsumableRowView[];
  /** The whole hold, ammunition included: the Ammunition panel says what a round does, this says how many and what they are worth. */
  cargo: EntryView[]; drones: EntryView[]; unfittable: EntryView[]; unknown: EntryView[];
  value: { total: string; totalShort: string; lines: ValueLineView[]; unpriced: string | null };
  /** The pilot's mastery of the hull, 0–5; null when the SDE has none for it or skills have not synced. */
  mastery: number | null;
  /** The key figures strip, DPS aside — that one follows the drone selector and is drawn from `droneControl`. */
  key: KeyFiguresView;
  /** hp/s per repair source; `idle` marks a source the fit does not have. */
  repairs: RepairView[];
  /** What the drone selector needs; null for a hull with no drone bay and no drones aboard. */
  droneControl: DroneSheetView | null;
  /** Turrets and launchers alone, as numbers: the drone selector adds the launched drones to them. */
  weapons: { dps: number; volley: number };
  /** Skills below level 5 that change a number on this fit, grouped by where they land. */
  skillGaps: SkillGapGroupView[];
}

export interface KeyFigureView { value: string; unit: string | null; note: string | null; tone: "good" | "bad" | null }
export interface KeyFiguresView { ehp: KeyFigureView; speed: KeyFigureView; capacitor: KeyFigureView; lock: KeyFigureView; align: KeyFigureView }
export interface RepairView { label: string; value: string; idle: boolean }
export interface DroneTypeView { typeId: number; name: string; inBay: number; bandwidth: number; dpsEach: number; volleyEach: number }
/** Plain numbers, not strings: the selector recalculates DPS, bandwidth and the limits in the browser. */
export interface DroneSheetView {
  types: DroneTypeView[];
  /** Mbit/s the hull can control. */
  bandwidth: number;
  /** How many drones the pilot can control at once; null when the data does not say. */
  maxActive: number | null;
  /** typeId → launched count the page opens with. */
  launched: Record<number, number>;
  controlRange: string;
  /** "40 / 40 m³". */
  bay: string;
}
export interface SkillGapView { skillTypeId: number; name: string; level: number; effect: string | null; affects: string }
export interface SkillGapGroupView { name: string; skills: SkillGapView[] }

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
  /** `fitPerformance(built.fit, built.drones)` — the fitting-window numbers. */
  perf: FitPerformance;
  skillsSynced: boolean;
  /** `masteryLevel()` for the hull; absent → unknown. */
  mastery?: number | null;
  /** `skillGaps(built.fit)`; absent → no Skills panel rows. */
  skillGaps?: readonly SkillGap[];
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
    ehp: whole(perf.ehp),
  };
}

/** The key figures strip, DPS aside (redesign hand-off, PAGES.md §5). A dash wherever the engine cannot say. */
export function keyFigures(perf: FitPerformance): KeyFiguresView {
  const prop = perf.propulsion;
  const propName = prop === null ? null : prop.kind === "Microwarpdrive" ? "MWD" : "afterburner";
  const cap = perf.capStable;
  const lockNotes = [
    perf.maxTargets === null ? null : `${perf.maxTargets} target${perf.maxTargets === 1 ? "" : "s"}`,
    perf.scanResolution === null ? null : `${whole(perf.scanResolution)} mm scan res`,
  ].filter((part): part is string => part !== null);
  return {
    ehp: {
      value: whole(perf.ehp), unit: null, tone: null,
      note: perf.shieldRechargeRate === null ? null : `Shield recharge ${fmtNum(perf.shieldRechargeRate, 1)} hp/s`,
    },
    speed: prop !== null
      ? { value: whole(prop.velocity), unit: "m/s", tone: null, note: `With ${propName}${perf.maxVelocity === null ? "" : ` · ${fmtNum(perf.maxVelocity, 1)} m/s without`}` }
      : { value: whole(perf.maxVelocity), unit: perf.maxVelocity === null ? null : "m/s", tone: null, note: null },
    capacitor: {
      value: cap === null ? DASH : cap.stable ? `Stable ${Math.round(cap.level * 100)}%` : `Lasts ${clock(cap.lastsSeconds)}`,
      unit: null, tone: cap === null ? null : cap.stable ? "good" : "bad",
      note: perf.capDelta === null ? null : `${perf.capDelta >= 0 ? "+" : "\u2212"}${Math.abs(perf.capDelta).toFixed(1)} GJ/s`,
    },
    lock: {
      value: perf.maxTargetRange === null ? DASH : grouped((perf.maxTargetRange / 1000).toFixed(1)),
      unit: perf.maxTargetRange === null ? null : "km", tone: null,
      note: lockNotes.length === 0 ? null : lockNotes.join(" · "),
    },
    align: {
      value: fmtNum(perf.alignTime, 2), unit: perf.alignTime === null ? null : "s", tone: null,
      note: prop === null || prop.alignTime === null ? null : `${fmtNum(prop.alignTime, 2)} s with ${prop.kind === "Microwarpdrive" ? "MWD" : "AB"} on`,
    },
  };
}

/** The Repairs panel: the passive shield peak, then the three active repair rates. */
export function repairViews(perf: FitPerformance): RepairView[] {
  const row = (label: string, rate: number | null): RepairView => ({
    label, value: rate === null ? DASH : rate > 0 ? fmtNum(rate, 1) : "0", idle: rate === null || rate <= 0,
  });
  return [
    row("Passive shield", perf.shieldRechargeRate),
    row("Shield boost", perf.shieldBoostRate),
    row("Armor repair", perf.armorRepairRate),
    row("Hull repair", perf.hullRepairRate),
  ];
}

const GAP_GROUP_NAMES: Record<SkillGapGroup, string> = { ship: "Ship and bonuses", modules: "Modules", drones: "Drones" };
const GAP_GROUP_ORDER: readonly SkillGapGroup[] = ["ship", "modules", "drones"];
/** How many affected items a row names before it says "+N more". */
const GAP_AFFECTS_LIMIT = 4;

/**
 * The sentence of a skill's SDE description that states its bonus ("3% bonus to missile launcher
 * rate of fire per skill level."). The SDE has no separate field for it; when no sentence reads
 * like a bonus the first one stands in.
 */
export function skillEffectText(description: string | null | undefined): string | null {
  if (description == null || description.trim() === "") return null;
  const sentences = description.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/);
  const bonus = sentences.filter((s) => /%|per (skill )?level|bonus|reduc|increase/i.test(s));
  return (bonus.length > 0 ? bonus : sentences.slice(0, 1)).join(" ");
}

/**
 * `hullBonuses` is the hull's own per-level bonus lines keyed by skill: for a ship skill those say
 * what a level buys on this hull, which the skill's generic description ("Skill for operation of
 * Heavy Assault Cruisers.") does not.
 */
export function skillGapGroups(
  gaps: readonly SkillGap[], descriptions: ReadonlyMap<number, string>,
  hullBonuses: ReadonlyMap<number, readonly string[]> = new Map(),
): SkillGapGroupView[] {
  return GAP_GROUP_ORDER.flatMap((group) => {
    const skills = gaps.filter((gap) => gap.group === group).map((gap): SkillGapView => {
      const names = gap.affects.map((a) => {
        const name = a.name ?? `Unknown type (${a.typeId})`;
        return a.isShip ? `${name} hull` : a.count > 1 ? `${a.count}× ${name}` : name;
      });
      const extra = names.length - GAP_AFFECTS_LIMIT;
      return {
        skillTypeId: gap.skillTypeId, name: gap.name ?? `Skill ${gap.skillTypeId}`, level: gap.level,
        effect: hullBonuses.has(gap.skillTypeId)
          ? `${hullBonuses.get(gap.skillTypeId)!.join("; ")}, per level`
          : skillEffectText(descriptions.get(gap.skillTypeId)),
        affects: extra > 0 ? `${names.slice(0, GAP_AFFECTS_LIMIT).join(", ")}, +${extra} more` : names.join(", "),
      };
    });
    return skills.length === 0 ? [] : [{ name: GAP_GROUP_NAMES[group], skills }];
  });
}

/**
 * Identical modules in one rack — same type, same charge, same state, same reach — as one row with
 * a quantity ("5×"), in the order the first of each sits in the rack.
 */
export function mergeModuleRows(rows: ModuleRowView[]): ModuleRowView[] {
  const merged = new Map<string, ModuleRowView>();
  for (const row of rows) {
    const key = [row.typeId, row.chargeTypeId ?? 0, row.state, row.range?.optimal ?? "", row.range?.falloff ?? "", row.chargeAssumed ? 1 : 0].join(":");
    const seen = merged.get(key);
    if (seen === undefined) merged.set(key, { ...row });
    else seen.quantity += 1;
  }
  return [...merged.values()];
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
    quantity: 1,
    key: `${stat.slot}:${stat.index}`,
    name: itemLabel(stat.item),
    typeId: stat.item.typeId,
    charge: stat.item.charge === undefined ? null : itemLabel(stat.item.charge),
    chargeTypeId: stat.item.charge?.typeId ?? null,
    desc: descriptions.get(stat.item.typeId) ?? null,
    chargeDesc: stat.item.charge === undefined ? null : descriptions.get(stat.item.charge.typeId) ?? null,
    chargeAssumed: stat.item.charge?.assumed === true,
    range: hardpointOf(stat.item) === null ? moduleRangeCells(moduleRange(fit, stat.item))
      : stat.item.charge === undefined ? null : rangeCells(weaponRange(fit, stat.item)),
    state: stateLabel(stat.state),
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
      // The type name is the label; spec §6's "Unknown type (id)" when this SDE build lacks the type.
      // A custom nickname rides alongside rather than replacing it, so a container called "Ammo"
      // still says what kind of container it is.
      name: data.types.get(entry.typeId)?.name ?? `Unknown type (${entry.typeId})`,
      nickname: entry.name,
      quantity: entry.quantity,
      desc: descriptions.get(entry.typeId) ?? null,
      value: unit === null ? null : isk(unit * entry.quantity),
    };
  });
}

interface AmmoReach { range: RangeCells; band: RangeBand; order: number }
const UNLOADABLE_ORDER_BASE = 1e9;

/**
 * The Ammunition panel: one row per charge type found loaded in a weapon or lying in the hold,
 * shortest reach first. A charge that deals no damage (a probe, a script) is not ammunition.
 */
function ammoRows(built: BuiltFit, perf: FitPerformance, descriptions: ReadonlyMap<number, string>): AmmoRowView[] {
  const fit = built.fit;
  const lockRange = perf.maxTargetRange;
  const reachOf = (wr: WeaponRange): AmmoReach => {
    const reach = wr.kind === "turret" ? wr.optimal + wr.falloff : wr.range;
    return { range: rangeCells(wr)!, band: reachBand(reach, lockRange), order: reach };
  };
  const isAmmo = (typeId: number): boolean => chargeRangeHint(fit, typeId) !== null
    || fit.modules.some(({ item }) => item.charge?.typeId === typeId && hardpointOf(item) !== null);

  // Loaded rounds: which weapons hold which charge, and the reach the first of them gives it.
  const loaded = new Map<number, { count: number; reach: AmmoReach | null }>();
  for (const { item } of fit.modules) {
    if (item.charge === undefined || hardpointOf(item) === null) continue;
    const seen = loaded.get(item.charge.typeId);
    if (seen !== undefined) { seen.count += 1; continue; }
    const wr = weaponRange(fit, item);
    loaded.set(item.charge.typeId, { count: 1, reach: wr === null ? null : reachOf(wr) });
  }
  // Rounds in the hold.
  const held = built.cargo.filter((entry) => isAmmo(entry.typeId)).map((entry) => entry.typeId);
  const ammoTypeIds = new Set<number>([...loaded.keys(), ...held]);

  // Reach for a round nothing holds: the first fitted weapon that takes it, else the charge itself.
  const unloadedReach = (typeId: number): AmmoReach | null => {
    const chargeType = fit.data.types.get(typeId);
    if (chargeType === undefined) return null;
    for (const { item } of fit.modules) {
      if (hardpointOf(item) === null) continue;
      const weaponType = fit.data.types.get(item.typeId);
      if (weaponType === undefined || !chargeFits(weaponType, chargeType)) continue;
      const wr = weaponRangeWith(fit, item, typeId);
      return wr === null ? null : reachOf(wr);
    }
    const hint = chargeRangeHint(fit, typeId);
    if (hint === null) return null;
    if (hint.kind === "missile") return { range: hintCells(hint)!, band: reachBand(hint.range, lockRange), order: hint.range };
    return { range: hintCells(hint)!, band: modifierBand(hint.optimal), order: UNLOADABLE_ORDER_BASE * hint.optimal };
  };

  // Damage: every fitted weapon that takes the round, as if each held it, summed; the hover text
  // counts them by type. Weapons are summed whatever their state — the row says what the round
  // does in these guns, which is what the pilot is choosing between.
  const damageOf = (typeId: number): { dps: string; desc: string } | null => {
    const chargeType = fit.data.types.get(typeId);
    if (chargeType === undefined) return null;
    let total = 0;
    const byWeapon = new Map<string, number>();
    for (const { item } of fit.modules) {
      if (hardpointOf(item) === null) continue;
      const weaponType = fit.data.types.get(item.typeId);
      if (weaponType === undefined || !chargeFits(weaponType, chargeType)) continue;
      const dps = weaponDpsWith(fit, item, typeId);
      if (dps === null) continue;
      total += dps;
      const name = weaponType.name ?? `Unknown type (${item.typeId})`;
      byWeapon.set(name, (byWeapon.get(name) ?? 0) + 1);
    }
    if (byWeapon.size === 0) return null;
    const dps = fmtNum(total, 1);
    const weapons = [...byWeapon].map(([name, count]) => `${count} × ${name}`).join(", ");
    return { dps, desc: `${dps} dps from ${weapons} loaded with it` };
  };

  const ammo: AmmoRowView[] = [...ammoTypeIds].map((typeId) => {
    const inWeapons = loaded.get(typeId);
    const reach = inWeapons?.reach ?? unloadedReach(typeId);
    const damage = damageOf(typeId);
    return {
      key: `ammo:${typeId}`, typeId,
      name: fit.data.types.get(typeId)?.name ?? `Unknown type (${typeId})`,
      desc: descriptions.get(typeId) ?? null,
      loadedIn: inWeapons?.count ?? 0,
      dps: damage?.dps ?? null, dpsDesc: damage?.desc ?? null,
      range: reach?.range ?? null, band: reach?.band ?? null,
      damage: damageMix(fit.data.types.get(typeId)?.attrs ?? new Map()),
      order: reach?.order ?? Number.MAX_SAFE_INTEGER,
    };
  });
  // Shortest reach first; ties by name so the order never depends on Map insertion.
  ammo.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return ammo;
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
    rows: mergeModuleRows([...(bySlot.get(slot) ?? [])].sort((a, b) => a.index - b.index).map((stat) => moduleRow(fit, stat, descriptions))),
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
  const ammo = ammoRows(built, input.perf, descriptions);

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
    ammo,
    consumables: consumableRows(built, descriptions),
    cargo: entryViews(built.cargo, fit.data, prices, descriptions),
    drones: entryViews(built.drones, fit.data, prices, descriptions),
    unfittable: entryViews(built.unfittable, fit.data, prices, descriptions),
    unknown: entryViews(built.unknown, fit.data, prices, descriptions),
    value: { total: isk(total), totalShort: iskShort(total), lines, unpriced: unpricedNote(unpriced) },
    mastery: input.mastery ?? null,
    key: keyFigures(input.perf),
    repairs: repairViews(input.perf),
    droneControl: droneSheetView(input.perf, built),
    weapons: {
      dps: input.perf.weaponDps ?? 0,
      volley: Math.max(0, (input.perf.volley ?? 0) - (input.perf.drones === null ? 0 : launchedDrones(input.perf.drones, input.perf.drones.launched).volley)),
    },
    skillGaps: skillGapGroups(input.skillGaps ?? [], descriptions, hullBonusLines(input.bonuses)),
  };
}

function hullBonusLines(bonuses: FitSheetInput["bonuses"]): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const bonus of bonuses) {
    if (bonus.skillTypeId === null) continue;
    const lines = out.get(bonus.skillTypeId) ?? [];
    lines.push(bonusLabel(bonus));
    out.set(bonus.skillTypeId, lines);
  }
  return out;
}

/** The drone selector's data: nothing for a hull with no bay and nothing in it. */
function droneSheetView(perf: FitPerformance, built: BuiltFit): DroneSheetView | null {
  const control = perf.drones;
  if (control === null || (control.types.length === 0 && (perf.droneBay ?? 0) <= 0)) return null;
  return {
    types: control.types.map((t) => ({ typeId: t.typeId, name: t.name, inBay: t.inBay, bandwidth: t.bandwidth, dpsEach: t.dpsEach, volleyEach: t.volleyEach })),
    bandwidth: control.bandwidth,
    maxActive: control.maxActive,
    launched: control.launched,
    controlRange: km(perf.droneControlRange),
    bay: bayRow("Drone bay", built.drones, built.fit, PERF_ATTR_DRONE_CAPACITY).value,
  };
}
