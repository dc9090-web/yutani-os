/**
 * The plan's clock. Pure and isomorphic: the server renders with it, the editor recomputes with it
 * on every keystroke, and `planDurationMs` is the inner loop the remap optimiser runs 2,885 times.
 */
import { spBetween, spForLevel, trainingMs } from "./sp.js";
import type { AttributeSet } from "./attributes.js";
import { skillRate, type SkillCatalogue } from "./catalogue.js";
import type { ExpandedEntry, KnownLevels } from "./expand.js";

export type PlanStatus = "done" | "queued" | "planned";

export interface TimelineInput {
  entries: readonly ExpandedEntry[];
  catalogue: SkillCatalogue;
  attributes: AttributeSet;
  trained: KnownLevels;
  queued: KnownLevels;
  partialSp?: ReadonlyMap<number, number>;
  startAt: Date;
}

export interface TimelineEntry {
  skillId: number; level: number; prereq: boolean; note: string | null;
  status: PlanStatus;
  rank: number | null;
  levelSp: number;
  sp: number;
  spPerMinute: number;
  ms: number; cumulativeMs: number; doneAt: Date;
}

export interface Timeline {
  entries: TimelineEntry[]; totalSp: number; totalMs: number; doneAt: Date; unknownSkillIds: number[];
}

function statusOf(entry: ExpandedEntry, trained: KnownLevels, queued: KnownLevels): PlanStatus {
  if ((trained.get(entry.skillId) ?? 0) >= entry.level) return "done";
  if ((queued.get(entry.skillId) ?? 0) >= entry.level) return "queued";
  return "planned";
}

/**
 * SP still owed for a planned level. `held` only bites on a skill's FIRST planned level, because
 * `expandPlan` emits levels in ascending order and the floor overtakes `held` immediately after.
 */
function remainingSp(rank: number, level: number, held: number): number {
  const target = spForLevel(rank, level);
  const floor = spForLevel(rank, level - 1);
  const from = Math.max(floor, Math.min(held, target));
  return target - from;
}

export function planTimeline(input: TimelineInput): Timeline {
  const { entries, catalogue, attributes, trained, queued, partialSp, startAt } = input;
  const out: TimelineEntry[] = [];
  const unknown: number[] = [];
  const seenUnknown = new Set<number>();
  let cumulativeMs = 0;
  let totalSp = 0;

  for (const entry of entries) {
    const skill = catalogue.get(entry.skillId);
    const status = statusOf(entry, trained, queued);
    if (skill === undefined) {
      if (!seenUnknown.has(entry.skillId)) { seenUnknown.add(entry.skillId); unknown.push(entry.skillId); }
      out.push({
        skillId: entry.skillId, level: entry.level, prereq: entry.prereq, note: entry.note,
        status, rank: null, levelSp: 0, sp: 0, spPerMinute: 0,
        ms: 0, cumulativeMs, doneAt: new Date(startAt.getTime() + Math.round(cumulativeMs)),
      });
      continue;
    }
    const levelSp = spBetween(skill.rank, entry.level - 1, entry.level);
    const rate = skillRate(skill, attributes);
    const sp = status === "planned"
      ? remainingSp(skill.rank, entry.level, partialSp?.get(entry.skillId) ?? 0)
      : 0;
    const ms = trainingMs(sp, rate);
    cumulativeMs += ms;
    totalSp += sp;
    out.push({
      skillId: entry.skillId, level: entry.level, prereq: entry.prereq, note: entry.note,
      status, rank: skill.rank, levelSp, sp, spPerMinute: rate,
      ms, cumulativeMs, doneAt: new Date(startAt.getTime() + Math.round(cumulativeMs)),
    });
  }

  return {
    entries: out, totalSp, totalMs: cumulativeMs,
    doneAt: new Date(startAt.getTime() + Math.round(cumulativeMs)),
    unknownSkillIds: unknown,
  };
}

/**
 * Total remaining milliseconds, with no per-entry allocation. `optimalRemap` calls this once per
 * candidate distribution, so it must stay a plain loop.
 */
export function planDurationMs(input: Omit<TimelineInput, "startAt">): number {
  const { entries, catalogue, attributes, trained, queued, partialSp } = input;
  let total = 0;
  for (const entry of entries) {
    if (statusOf(entry, trained, queued) !== "planned") continue;
    const skill = catalogue.get(entry.skillId);
    if (skill === undefined) continue;
    const sp = remainingSp(skill.rank, entry.level, partialSp?.get(entry.skillId) ?? 0);
    total += trainingMs(sp, skillRate(skill, attributes));
  }
  return total;
}
