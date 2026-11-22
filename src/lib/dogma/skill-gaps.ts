/**
 * Which of the pilot's skills still have room to improve a fit: every skill below level 5 with a
 * running modifier that reaches the hull, a fitted module, a loaded charge or a drone in the bay.
 *
 * It asks the same question the calculator does — `affects()` from affection.ts — and then whether
 * the item carries the attribute being modified, so a skill is listed when training it would change
 * a number on this fit. A skill that is only a
 * prerequisite (it unlocks a module but modifies nothing) is not listed: one more level of it would
 * change nothing here. Unmet prerequisites are the missing-skill check's business.
 */
import { ATTR } from "./data.js";
import { affects } from "./affection.js";
import { activeModifiers } from "./effects.js";
import type { Fit, Item } from "./fit.js";

export type SkillGapGroup = "ship" | "modules" | "drones";

export interface SkillGap {
  skillTypeId: number;
  name: string | null;
  /** The trained level, 0–4. */
  level: number;
  /** Where it lands first: the hull (and its bonuses), else the modules, else the drones. */
  group: SkillGapGroup;
  /** The distinct items it reaches, most numerous first: the hull, module and charge types, drone types. */
  affects: { typeId: number; name: string | null; count: number; isShip: boolean }[];
}

export function skillGaps(fit: Fit): SkillGap[] {
  const modules: Item[] = [];
  for (const { item } of fit.modules) {
    modules.push(item);
    if (item.charge) modules.push(item.charge);
  }
  const bySkill = new Map<Item, ReturnType<typeof activeModifiers>>();
  for (const carried of activeModifiers(fit)) {
    if (carried.carrier.kind !== "skill") continue;
    const list = bySkill.get(carried.carrier);
    if (list) list.push(carried); else bySkill.set(carried.carrier, [carried]);
  }

  const gaps: SkillGap[] = [];
  for (const [skill, carried] of bySkill) {
    const level = Math.round(skill.attrs.get(ATTR.skillLevel) ?? 0);
    if (level >= 5) continue;
    // Reaching an item is not enough: every racial ship skill has a modifier aimed at "the ship",
    // but it only does anything on a hull that carries the attribute it modifies.
    const reaches = (target: Item): boolean =>
      carried.some((c) => target.attrs.has(c.modifier.modifiedAttrId) && affects(fit, c, target));
    const onShip = reaches(fit.ship);
    const hitModules = modules.filter(reaches);
    const hitDrones = fit.drones.filter(reaches);
    if (!onShip && hitModules.length === 0 && hitDrones.length === 0) continue;

    const counted = new Map<number, SkillGap["affects"][number]>();
    if (onShip) counted.set(fit.ship.typeId, { typeId: fit.ship.typeId, name: fit.ship.name, count: 1, isShip: true });
    for (const item of [...hitModules, ...hitDrones]) {
      const seen = counted.get(item.typeId);
      if (seen) seen.count += 1;
      else counted.set(item.typeId, { typeId: item.typeId, name: item.name, count: 1, isShip: false });
    }
    gaps.push({
      skillTypeId: skill.typeId, name: skill.name, level,
      group: onShip ? "ship" : hitModules.length > 0 ? "modules" : "drones",
      affects: [...counted.values()].sort((a, b) => Number(b.isShip) - Number(a.isShip) || b.count - a.count || (a.name ?? "").localeCompare(b.name ?? "")),
    });
  }
  return gaps.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "") || a.skillTypeId - b.skillTypeId);
}
