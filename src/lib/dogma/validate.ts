/**
 * Fit validation. EOS's restriction service aggregates per-item errors and raises one ValidationError;
 * we return the same information as a flat, ordered list so a page can render it. Comparison is
 * `used > output` with no epsilon — the calculator's 2-dp rounding is the tolerance (research §5.9).
 */
import { ATTR, type TypeId } from "./data.js";
import { HARDPOINTS, SLOT_KINDS, type Fit, type Hardpoint, type Item, type SlotKind } from "./fit.js";
import { fitStats, type FitStats } from "./stats.js";

export type ProblemKind =
  | "cpu" | "power" | "calibration" | "slot" | "hardpoint"
  | "rigSize" | "shipRestriction" | "maxGroupFitted" | "skill";

export interface MissingSkill {
  skillTypeId: TypeId;
  required: number;
  have: number;
}

export interface Problem {
  kind: ProblemKind;
  /** The offending module, where the problem is about one item. */
  item?: Item;
  detail: string;
  /** Set only when `kind` is "skill". */
  skill?: MissingSkill;
}

const SLOT_LABELS: Record<SlotKind, string> = {
  high: "High", mid: "Mid", low: "Low", rig: "Rig", subsystem: "Subsystem",
};

const HARDPOINT_LABELS: Record<Hardpoint, string> = { turret: "Turret", launcher: "Launcher" };

export function itemLabel(item: Item): string {
  return item.name ?? `type ${item.typeId}`;
}

export function validateFit(fit: Fit): Problem[] {
  const stats = fitStats(fit);
  const problems: Problem[] = [];
  resourceProblems(stats, problems);
  slotProblems(stats, problems);
  hardpointProblems(stats, problems);
  moduleProblems(fit, problems);
  return problems;
}

function resourceProblems(stats: FitStats, out: Problem[]): void {
  if (stats.cpu.used > stats.cpu.output) {
    out.push({ kind: "cpu", detail: `CPU: ${stats.cpu.used} tf used of ${stats.cpu.output} tf` });
  }
  if (stats.power.used > stats.power.output) {
    out.push({ kind: "power", detail: `Powergrid: ${stats.power.used} MW used of ${stats.power.output} MW` });
  }
  if (stats.calibration.used > stats.calibration.output) {
    out.push({
      kind: "calibration",
      detail: `Calibration: ${stats.calibration.used} used of ${stats.calibration.output}`,
    });
  }
}

function slotProblems(stats: FitStats, out: Problem[]): void {
  for (const kind of SLOT_KINDS) {
    const { used, total } = stats.slots[kind];
    if (used > total) {
      out.push({ kind: "slot", detail: `${SLOT_LABELS[kind]} slots: ${used} used of ${total}` });
    }
  }
}

function hardpointProblems(stats: FitStats, out: Problem[]): void {
  for (const kind of HARDPOINTS) {
    const { used, total } = stats.hardpoints[kind];
    if (used > total) {
      out.push({ kind: "hardpoint", detail: `${HARDPOINT_LABELS[kind]} hardpoints: ${used} used of ${total}` });
    }
  }
}

function moduleProblems(fit: Fit, out: Problem[]): void {
  // Raw, unmodified attribute — EOS compares type attributes and skips when either side lacks rigSize.
  const hullRigSize = fit.ship.attrs.get(ATTR.rigSize);
  for (const { item, slot } of fit.modules) {
    if (slot !== "rig") continue;
    const rigSize = item.attrs.get(ATTR.rigSize);
    if (rigSize === undefined || hullRigSize === undefined || rigSize === hullRigSize) continue;
    out.push({
      kind: "rigSize",
      item,
      detail: `${itemLabel(item)} is a size-${rigSize} rig; this hull takes size ${hullRigSize}`,
    });
  }
}
