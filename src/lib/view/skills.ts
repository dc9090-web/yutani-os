import type { SkillRow } from "../db/character-skills.js";
import { relativeTime } from "./format.js";

/** sde_categories.id for Skills — the Skills page shows nothing outside it (spec §7). */
export const SKILL_CATEGORY_ID = 16;

export type AttributeKey = "charisma" | "intelligence" | "memory" | "perception" | "willpower";

/** charismaBonus … willpowerBonus in sde_type_attributes, in the order EVE numbers them. */
export const ATTRIBUTE_BONUS_ATTR: Record<AttributeKey, number> = {
  charisma: 175, intelligence: 176, memory: 177, perception: 178, willpower: 179,
};

export const ATTRIBUTE_LABEL: Record<AttributeKey, string> = {
  charisma: "Charisma", intelligence: "Intelligence", memory: "Memory",
  perception: "Perception", willpower: "Willpower",
};

const ORDER: AttributeKey[] = ["charisma", "intelligence", "memory", "perception", "willpower"];

export interface AttributeView { key: AttributeKey; label: string; base: number; bonus: number; total: number }

/**
 * base + Σ implant attribute bonus (spec §7). `implantAttributes` is one `getTypeAttributes(typeId)`
 * map per implant on the active clone; an implant with no relevant attribute contributes zero.
 */
export function attributeViews(
  base: Record<AttributeKey, number>,
  implantAttributes: ReadonlyMap<number, number>[],
): AttributeView[] {
  return ORDER.map((key) => {
    const attributeId = ATTRIBUTE_BONUS_ATTR[key];
    let bonus = 0;
    for (const attributes of implantAttributes) bonus += attributes.get(attributeId) ?? 0;
    return { key, label: ATTRIBUTE_LABEL[key], base: base[key], bonus, total: base[key] + bonus };
  });
}

/**
 * 0–1 progress of a queue entry by wall clock. SP-based progress would need the character's live SP,
 * which ESI only refreshes on login; the dates are exact. A paused entry has no dates and reads 0.
 */
export function queueProgress(entry: { startDate: Date | null; finishDate: Date | null }, now: Date): number {
  if (entry.startDate === null || entry.finishDate === null) return 0;
  const window = entry.finishDate.getTime() - entry.startDate.getTime();
  if (window <= 0) return 1;
  const done = (now.getTime() - entry.startDate.getTime()) / window;
  return Math.min(1, Math.max(0, done));
}

export interface SkillView { skillId: number; name: string; trainedLevel: number; activeLevel: number; skillpoints: number }
export interface SkillGroupView { groupId: number; name: string; groupSp: number; skills: SkillView[] }

/**
 * Groups the skill sheet by sde_groups, keeping only category 16 (Skills) — a character row can
 * carry a type the SDE has since dropped, and injected skills occasionally arrive with a group that
 * is not a skill group. Groups and their skills are sorted by name so the page order is stable.
 */
export function groupSkills(
  skills: SkillRow[],
  types: ReadonlyMap<number, { name: string | null; groupId: number | null }>,
  groups: ReadonlyMap<number, { name: string | null; categoryId: number | null }>,
): SkillGroupView[] {
  const byGroup = new Map<number, SkillGroupView>();
  for (const skill of skills) {
    const type = types.get(skill.skillId);
    const groupId = type?.groupId ?? null;
    if (groupId === null) continue;
    const group = groups.get(groupId);
    if (group === undefined || group.categoryId !== SKILL_CATEGORY_ID) continue;
    let view = byGroup.get(groupId);
    if (view === undefined) {
      view = { groupId, name: group.name ?? `Group ${groupId}`, groupSp: 0, skills: [] };
      byGroup.set(groupId, view);
    }
    view.groupSp += skill.skillpoints;
    view.skills.push({
      skillId: skill.skillId, name: type?.name ?? `Skill ${skill.skillId}`,
      trainedLevel: skill.trainedLevel, activeLevel: skill.activeLevel, skillpoints: skill.skillpoints,
    });
  }
  const out = [...byGroup.values()];
  for (const group of out) group.skills.sort((a, b) => a.name.localeCompare(b.name));
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export interface RemapAttributes { bonusRemaps: number | null; accruedRemapCooldownDate: Date | null }

/**
 * "available now" when a remap can be done immediately: the cooldown already elapsed, or there is
 * no cooldown on record at all but a bonus remap is banked (a character who has never remapped, or
 * whose last remap used a bonus, carries no cooldown date yet still has remaps to spend). Otherwise
 * the relative time until the cooldown clears; null when there is nothing to report.
 */
export function remapAvailability(attrs: RemapAttributes, now: Date): string | null {
  if (attrs.accruedRemapCooldownDate === null) {
    return (attrs.bonusRemaps ?? 0) > 0 ? "available now" : null;
  }
  return attrs.accruedRemapCooldownDate.getTime() <= now.getTime() ? "available now" : relativeTime(attrs.accruedRemapCooldownDate, now);
}

/** "+5 Intelligence" for an attribute implant, null for anything else (a hardwiring, a booster). */
export function implantBonusLabel(attributes: ReadonlyMap<number, number>): string | null {
  for (const key of ORDER) {
    const value = attributes.get(ATTRIBUTE_BONUS_ATTR[key]);
    if (value !== undefined && value !== 0) return `+${value} ${ATTRIBUTE_LABEL[key]}`;
  }
  return null;
}
