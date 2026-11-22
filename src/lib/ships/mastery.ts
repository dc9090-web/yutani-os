import type { MasteryRequirements } from "../sde/repo.js";

/**
 * A pilot's mastery of one hull, 0–5 (shown as blocks and a Roman numeral). Level N is reached when
 * every skill its certificates ask for is trained to the level they ask, and so is every level
 * below it — the client shows mastery the same way, as a ladder. `null` when the SDE has no mastery
 * data for the hull (or the mastery tables are not imported yet): unknown, which is not level 0.
 *
 * Trained levels, like the missing-skill check: an inactive clone does not untrain a skill.
 */
export function masteryLevel(requirements: MasteryRequirements | undefined, skills: ReadonlyMap<number, number>): number | null {
  if (requirements === undefined) return null;
  let level = 0;
  for (const needs of requirements) {
    for (const [skillId, need] of needs) {
      if ((skills.get(skillId) ?? 0) < need) return level;
    }
    level += 1;
  }
  return level;
}
