import type { SkillQueueRow } from "../db/character-skills.js";
import { roman } from "../view/format.js";

/**
 * A stored queue entry as plain values. Anything a page works out against the clock — time left,
 * progress, which entry is the head — travels with these beside it, so a saved copy (the phone's)
 * can work it out again later: drop entries whose `finishAt` has passed (`liveQueue`), then
 * `duration` and `queueProgress` on what is left.
 */
export interface RawQueueEntry {
  skillId: number;
  skill: string;
  /** The level this entry finishes at. */
  level: number;
  /** "Gunnery V" — the name with the level in numerals, as the Overview shows it. */
  label: string;
  /** ISO-8601 UTC; both null on a paused queue. */
  startAt: string | null;
  finishAt: string | null;
  levelStartSp: number | null;
  levelEndSp: number | null;
  trainingStartSp: number | null;
}

export const iso = (date: Date | null): string | null => (date === null ? null : date.toISOString());

/** The queue as stored, finished entries included: what is "finished" depends on when it is read. */
export function rawQueue(queue: readonly SkillQueueRow[], names: ReadonlyMap<number, string>): RawQueueEntry[] {
  return queue.map((q) => {
    const skill = names.get(q.skillId) ?? `Skill ${q.skillId}`;
    return {
      skillId: q.skillId, skill, level: q.finishedLevel, label: `${skill} ${roman(q.finishedLevel)}`,
      startAt: iso(q.startDate), finishAt: iso(q.finishDate),
      levelStartSp: q.levelStartSp, levelEndSp: q.levelEndSp, trainingStartSp: q.trainingStartSp,
    };
  });
}
