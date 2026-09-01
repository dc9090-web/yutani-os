/**
 * Fit validation. EOS's restriction service aggregates per-item errors and raises one ValidationError;
 * we return the same information as a flat, ordered list so a page can render it. Comparison is
 * `used > output` with no epsilon — the calculator's 2-dp rounding is the tolerance (research §5.9).
 */
import {
  ATTR, CAN_FIT_SHIP_GROUP_ATTRS, CAN_FIT_SHIP_TYPE_ATTRS, REQUIRED_SKILL_ATTRS, type TypeId,
} from "./data.js";
import { HARDPOINTS, SLOT_KINDS, requiredSkills, type Fit, type Hardpoint, type Item, type SlotKind } from "./fit.js";
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
    if (slot === "rig") {
      const rigSize = item.attrs.get(ATTR.rigSize);
      if (rigSize !== undefined && hullRigSize !== undefined && rigSize !== hullRigSize) {
        out.push({
          kind: "rigSize",
          item,
          detail: `${itemLabel(item)} is a size-${rigSize} rig; this hull takes size ${hullRigSize}`,
        });
      }
    }
    // Rigs and subsystems are exempt from the hull restriction (EOS checks high/mid/low only).
    if (slot !== "rig" && slot !== "subsystem" && !allowedOnHull(fit, item)) {
      out.push({
        kind: "shipRestriction",
        item,
        detail: `${itemLabel(item)} cannot be fitted to ${itemLabel(fit.ship)}`,
      });
    }
    const max = item.attrs.get(ATTR.maxGroupFitted);      // Pyfa's ruling: the raw value
    if (max !== undefined && max > 0) {
      const fitted = fit.modules.filter((m) => m.item.groupId === item.groupId).length;
      if (fitted > max) {
        out.push({
          kind: "maxGroupFitted",
          item,
          detail: `${itemLabel(item)}: only ${max} of this group can be fitted (${fitted} fitted)`,
        });
      }
    }
  }
  for (const missing of missingSkills(fit)) {
    const name = fit.data.types.get(missing.skillTypeId)?.name ?? `skill ${missing.skillTypeId}`;
    out.push({
      kind: "skill",
      skill: missing,
      detail: `${name} level ${missing.required} required (trained ${missing.have})`,
    });
  }
}

/** The union of canFitShipType* / fitsToShipType and canFitShipGroup*; empty means "fits anything". */
function allowedOnHull(fit: Fit, item: Item): boolean {
  const typeIds = new Set<number>();
  const groupIds = new Set<number>();
  for (const attrId of [...CAN_FIT_SHIP_TYPE_ATTRS, ATTR.fitsToShipType]) {
    const value = item.attrs.get(attrId);
    if (value !== undefined && value > 0) typeIds.add(Math.round(value));
  }
  for (const attrId of CAN_FIT_SHIP_GROUP_ATTRS) {
    const value = item.attrs.get(attrId);
    if (value !== undefined && value > 0) groupIds.add(Math.round(value));
  }
  if (typeIds.size === 0 && groupIds.size === 0) return true;
  return typeIds.has(fit.ship.typeId) || groupIds.has(fit.ship.groupId);
}

/**
 * Every unmet skill requirement of the hull, the non-rig modules, their charges and the drones, with each
 * missing skill's own prerequisites expanded recursively and the highest requirement per skill kept.
 */
export function missingSkills(fit: Fit): MissingSkill[] {
  const trained = (skillTypeId: TypeId): number =>
    fit.skills.get(skillTypeId)?.attrs.get(ATTR.skillLevel) ?? 0;
  const worst = new Map<TypeId, MissingSkill>();

  const record = (skillTypeId: TypeId, required: number): void => {
    const have = trained(skillTypeId);
    if (have >= required) return;              // trained deeply enough: its own prerequisites are met too
    const already = worst.get(skillTypeId);
    if (already && already.required >= required) return;
    worst.set(skillTypeId, { skillTypeId, required, have });
    const type = fit.data.types.get(skillTypeId);
    if (!type) return;                         // this SDE build does not know the skill
    for (const [skillAttr, levelAttr] of REQUIRED_SKILL_ATTRS) {
      const child = type.attrs.get(skillAttr);
      if (child === undefined || child <= 0) continue;
      record(Math.round(child), Math.round(type.attrs.get(levelAttr) ?? 0));
    }
  };

  const checked: Item[] = [fit.ship];
  for (const { item, slot } of fit.modules) {
    if (slot === "rig") continue;              // both reference engines exempt rigs entirely
    checked.push(item);
    if (item.charge) checked.push(item.charge);
  }
  checked.push(...fit.drones);
  for (const item of checked) {
    for (const { skillTypeId, level } of requiredSkills(item)) record(skillTypeId, level);
  }
  return [...worst.values()].sort((a, b) => a.skillTypeId - b.skillTypeId);
}
