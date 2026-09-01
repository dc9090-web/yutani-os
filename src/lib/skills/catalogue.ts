/**
 * One record per trainable skill. Pure and isomorphic: `PlanSkill[]` is what the editor receives
 * as props (a Map does not serialise across the server/client boundary), `SkillCatalogue` is what
 * every pure function here takes.
 */
import { spPerMinute, type AttributeSet } from "./attributes.js";

export interface SkillPrereq { skillId: number; level: number }

export interface PlanSkill {
  id: number; name: string; groupId: number | null; groupName: string | null;
  rank: number; primaryAttr: number; secondaryAttr: number;
  prereqs: SkillPrereq[]; alphaMaxLevel: number | null;
}

export type SkillCatalogue = ReadonlyMap<number, PlanSkill>;

/** Exactly the shape `listPlanSkills()` returns, restated so this module imports no server code. */
export interface CatalogueRow {
  id: number; name: string | null; groupId: number | null; groupName: string | null;
  rank: number; primaryAttr: number; secondaryAttr: number; prereqs: SkillPrereq[];
}

export function buildCatalogue(rows: readonly CatalogueRow[], alpha: ReadonlyMap<number, number>): PlanSkill[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? `Skill ${r.id}`,
    groupId: r.groupId,
    groupName: r.groupName,
    rank: r.rank,
    primaryAttr: r.primaryAttr,
    secondaryAttr: r.secondaryAttr,
    prereqs: r.prereqs,
    alphaMaxLevel: alpha.get(r.id) ?? null,
  }));
}

export function catalogueFrom(skills: readonly PlanSkill[]): SkillCatalogue {
  return new Map(skills.map((s) => [s.id, s]));
}

export function skillRate(skill: PlanSkill, attrs: AttributeSet): number {
  return spPerMinute(attrs, skill.primaryAttr, skill.secondaryAttr);
}

/** Spec §7: an id the SDE no longer has still renders, as `Unknown skill (id)`. */
export function skillLabel(catalogue: SkillCatalogue, skillId: number): string {
  return catalogue.get(skillId)?.name ?? `Unknown skill (${skillId})`;
}
