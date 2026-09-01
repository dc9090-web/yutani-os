/**
 * Skill points and training time. Pure, isomorphic, no imports.
 *
 * SP(rank, level) = ceil(250 * rank * 2^(2.5 * (level - 1))) is the CUMULATIVE SP a character
 * must hold to have that level. `ceil` — not `round`, not `floor` — is the game's behaviour:
 * summing SP(rank, cap) over the 175 skills in the SDE's Alpha clone grade gives CCP's published
 * maximum of 19,669,072 SP exactly, while `round` gives 19,669,032 and `floor` 19,668,988.
 * A rank-1 skill therefore needs 1415 SP for level II, not the 1414 that a truncating
 * approximation (including EVEMon's own fast path) produces.
 */

export const MAX_SKILL_LEVEL = 5;

export function spForLevel(rank: number, level: number): number {
  if (level <= 0) return 0;
  return Math.ceil(250 * rank * Math.pow(2, 2.5 * (level - 1)));
}

export function spBetween(rank: number, from: number, to: number): number {
  const gap = spForLevel(rank, to) - spForLevel(rank, from);
  return gap > 0 ? gap : 0;
}

export function trainingMs(sp: number, spPerMinute: number): number {
  if (sp <= 0 || spPerMinute <= 0) return 0;
  return (sp / spPerMinute) * 60_000;
}

export interface TrainingEntry {
  startDate: Date | null; finishDate: Date | null;
  trainingStartSp: number | null; levelEndSp: number | null;
}

/**
 * SP held right now in the skill the head queue entry is training, interpolated from the entry's
 * own dates (EVEMon `QueuedSkill.CurrentSP`). Deriving the rate from the dates rather than from
 * attributes absorbs implants, boosters and clone state for free.
 * `null` when ESI gave us nothing to interpolate: a paused queue omits both dates.
 */
export function currentSpInTraining(entry: TrainingEntry, now: Date): number | null {
  const { startDate, finishDate, trainingStartSp, levelEndSp } = entry;
  if (startDate === null || finishDate === null || levelEndSp === null) return null;
  const window = finishDate.getTime() - startDate.getTime();
  if (window <= 0) return null;
  const from = trainingStartSp ?? 0;
  const done = (now.getTime() - startDate.getTime()) / window;
  const sp = from + (levelEndSp - from) * done;
  return Math.floor(Math.min(levelEndSp, Math.max(from, sp)));
}
