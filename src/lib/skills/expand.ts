/**
 * Prerequisite expansion, ported from EVEMon's `FillDependencies`
 * (src/EVEMon.Common/Extensions/StaticSkillLevelEnumerableExtensions.cs).
 *
 * The output is a flat, ordered, de-duplicated list of (skill, level) pairs in trainable order —
 * "Eidetic Memory II" becomes Instant Recall I..IV then Eidetic Memory I, II. The dedupe key is the
 * PAIR, and a skill's prerequisites are walked at most once, which keeps a long plan near-linear.
 */
import { MAX_SKILL_LEVEL } from "./sp.js";
import type { SkillCatalogue } from "./catalogue.js";

export interface PlanEntry { skillId: number; level: number; note?: string | null }
export interface ExpandedEntry { skillId: number; level: number; note: string | null; prereq: boolean }

/** skillId → the highest level the character already has (trained, or the queue will deliver). */
export type KnownLevels = ReadonlyMap<number, number>;

const key = (skillId: number, level: number): string => `${skillId}:${level}`;

export function expandPlan(
  entries: readonly PlanEntry[], known: KnownLevels, catalogue: SkillCatalogue,
): ExpandedEntry[] {
  const out: ExpandedEntry[] = [];
  const emitted = new Set<string>();
  const walked = new Set<number>();       // skills whose prerequisites have already been expanded
  const stack = new Set<number>();        // guards a prerequisite cycle

  /** Emits levels `from`..`to` of a skill, skipping known ones unless the pair was requested. */
  const emit = (skillId: number, to: number, requestedLevel: number | null, note: string | null): void => {
    const have = known.get(skillId) ?? 0;
    for (let level = 1; level <= to; level++) {
      const requested = level === requestedLevel;
      if (!requested && level <= have) continue;
      const k = key(skillId, level);
      if (emitted.has(k)) continue;
      emitted.add(k);
      out.push({ skillId, level, note: requested ? note : null, prereq: !requested });
    }
  };

  const walk = (skillId: number, level: number, requestedLevel: number | null, note: string | null): void => {
    if (!walked.has(skillId) && !stack.has(skillId)) {
      walked.add(skillId);
      stack.add(skillId);
      for (const prereq of catalogue.get(skillId)?.prereqs ?? []) {
        if (prereq.skillId === skillId) continue;                         // the SDE has such rows
        if (prereq.level < 1 || prereq.level > MAX_SKILL_LEVEL) continue;
        walk(prereq.skillId, prereq.level, null, null);
      }
      stack.delete(skillId);
    }
    emit(skillId, level, requestedLevel, note);
  };

  for (const entry of entries) {
    if (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > MAX_SKILL_LEVEL) continue;
    walk(entry.skillId, entry.level, entry.level, entry.note ?? null);
  }
  return out;
}
