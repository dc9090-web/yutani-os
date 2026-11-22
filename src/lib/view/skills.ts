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

export { queueProgress } from "./format.js";

/**
 * The queue as it stands now. ESI only advances a character's queue when they log in (a finished
 * entry stays at the front until then, and Sasha's queue arrives numbered from 6 after ESI trimmed
 * completed entries without renumbering), but every entry's dates are exact — so drop what has
 * finished and take the first survivor, in ESI's order, as the head. A paused entry has no finish
 * date and is never dropped.
 */
export function liveQueue<T extends { finishDate: Date | null }>(queue: readonly T[], now: Date): T[] {
  return queue.filter((q) => q.finishDate === null || q.finishDate.getTime() > now.getTime());
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

export interface SheetSkillView {
  skillId: number;
  name: string;
  /** Levels trained, as the blocks show them. */
  level: number;
  /** Lower than `level` only when a trained level is not active (an alpha clone, a lapsed Expert System). */
  activeLevel: number;
  /** Further levels of this skill sitting in the training queue. */
  queued: number;
  /** True when the first of those queued levels is the one training right now. */
  training: boolean;
}
export interface SheetGroupView {
  groupId: number; name: string; groupSp: number;
  /** Queued levels across the group's skills. */
  queued: number;
  skills: SheetSkillView[];
}

/**
 * The Skills tab (redesign hand-off, PAGES.md §2): the grouped skill sheet with the live training
 * queue laid over it, so each skill shows the levels queued behind what is trained and which level
 * is in training now.
 *
 * `queue` is the live queue (after `liveQueue`). Only entries above the trained level count. The
 * sheet can lag the queue — ESI advances it on login — so when the lowest live entry for a skill
 * starts more than one level above the sheet, the levels in between have finished and are shown as
 * trained.
 */
export function sheetGroups(
  groups: readonly SkillGroupView[],
  queue: readonly { skillId: number; finishedLevel: number; finishDate: Date | null }[],
): SheetGroupView[] {
  const head = queue[0] ?? null;
  const levels = new Map<number, number[]>();
  for (const entry of queue) {
    const list = levels.get(entry.skillId) ?? [];
    list.push(entry.finishedLevel);
    levels.set(entry.skillId, list);
  }
  return groups.map((group) => {
    const skills = group.skills.map((skill): SheetSkillView => {
      const ahead = (levels.get(skill.skillId) ?? []).filter((level) => level > skill.trainedLevel);
      const level = ahead.length === 0 ? skill.trainedLevel : Math.max(skill.trainedLevel, Math.min(...ahead) - 1);
      const queued = new Set(ahead).size;
      return {
        skillId: skill.skillId, name: skill.name, level,
        activeLevel: Math.min(skill.activeLevel, level),
        queued,
        training: queued > 0 && head !== null && head.finishDate !== null && head.skillId === skill.skillId,
      };
    });
    return {
      groupId: group.groupId, name: group.name, groupSp: group.groupSp,
      queued: skills.reduce((sum, skill) => sum + skill.queued, 0),
      skills,
    };
  });
}
